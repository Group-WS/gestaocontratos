/**
 * Apresentacao de especificacoes — as revisoes que vao pro cliente.
 * -----------------------------------------------------------
 * GET    /api/obras/:codigo/apresentacoes               -> as revisoes da obra (sem capa e slides)
 * GET    /api/obras/:codigo/apresentacoes/:id           -> uma revisao inteira, com a versao de agora
 * POST   /api/obras/:codigo/apresentacoes               -> cria a revisao (a 01 nasce sem apagar a 00)
 * POST   /api/obras/:codigo/apresentacoes/:id/gravar    -> grava com a versao que a tela leu
 * DELETE /api/obras/:codigo/apresentacoes/:id           -> apaga uma revisao
 * POST   /api/obras/:codigo/ambientes                   -> sobe a imagem do ambiente (ja' reduzida)
 * POST   /api/obras/:codigo/ambientes/links             -> os enderecos para VER essas imagens
 *
 * Antes o navegador falava direto com a tabela e com o Storage (VH-02), e
 * gravava capa e slides inteiros a cada 1,5 s sem conferir nada: duas
 * pessoas na mesma revisao se apagavam em silencio. Agora quem decide e' o
 * banco (supabase/salvar-aditivo-apresentacao.sql): `salvar_apresentacao`
 * so' grava com a VERSAO que a tela leu.
 *
 * Uma apresentacao por obra E por revisao: a REV 01 nao apaga a 00, porque a
 * 00 ja' foi apresentada ao cliente e alguem vai querer conferir o que
 * mudou. Revisao repetida e' recusada com motivo, e nao com erro de indice.
 *
 * AS IMAGENS DOS AMBIENTES mudaram de balde: agora moram no da OBRA
 * (`obra-arquivos/<codigo>/ambientes/`), privado, com as mesmas permissoes
 * dos outros arquivos dela — antes ficavam no balde do catalogo, que e'
 * publico. O navegador reduz a foto antes de mandar (lado maior de 2000 px),
 * o que a faz caber no corpo da funcao e deixa o PDF leve; o endereco para
 * ver e' assinado aqui, e so' para caminho que e' daquela obra. As imagens
 * antigas continuam abrindo de onde estao.
 *
 * Molde das rotas de dados: valida -> autoriza -> fala com o banco com o
 * client do usuario (RLS) -> responde, com o erro do banco traduzido.
 */

const express = require("express");
const { exigirLogin, exigirMembro, exigirObra, exigirEdicaoDeObra } = require("../auth.js");
const { zValidator, esquemas, LIMITE_DOCUMENTO_JSON } = require("../validacao.js");
const { erroDoBanco } = require("../erroDoBanco.js");
const { responderDaFuncao, erroDaFuncao } = require("../respostaDaFuncao.js");

const SQL = "supabase/salvar-aditivo-apresentacao.sql";

/* A capa, os slides e a imagem em base64 passam do limite global de 1 MB.
   Estes caminhos tem leitor proprio — ver CAMINHOS_COM_LEITOR_PROPRIO no
   mondayApp.js. */
const CAMINHOS_DE_APRESENTACAO = [
  /^\/api\/obras\/[^/]+\/apresentacoes(\/[^/]+\/gravar)?$/,
  /^\/api\/obras\/[^/]+\/ambientes$/,
];
const jsonDoDocumento = express.json({ limit: LIMITE_DOCUMENTO_JSON });

/* As colunas que a tela usa — nunca `select("*")` (SQL-32). Capa e slides
   ficam de fora da LISTA: ela mostra revisao, data e quem mexeu, e o
   documento vem por id na hora de abrir. */
const COLUNAS = "id, obra_codigo, rev, idioma, arquivo, gerado_em, criado_em, criado_por, atualizado_em, atualizado_por, versao";
const TETO_DA_LISTA = 2000;

const BALDE = "obra-arquivos";
// O balde de antes das imagens de ambiente. As apresentacoes ja' gravadas
// apontam para `ambientes/<obra>/...` la' dentro, e continuam abrindo.
const BALDE_ANTIGO = "catalogo";
const MINUTOS_DO_LINK = 60;

/* A extensao sai do TIPO, e nao do nome do arquivo: nome vindo de fora nao
   escolhe caminho dentro do balde. */
const EXTENSAO = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Este caminho e' de uma imagem de ambiente DESTA obra? */
function baldeDaImagem(caminho, codigo) {
  if (caminho.includes("..")) return null;
  if (caminho.startsWith(`${codigo}/ambientes/`)) return BALDE;
  if (caminho.startsWith(`ambientes/${codigo}/`)) return BALDE_ANTIGO;
  return null;
}

const codigoDoPedido = (req) => req.valido.param.codigo;

const rotas = express.Router();
rotas.use(exigirLogin, exigirMembro);

rotas.get("/api/obras/:codigo/apresentacoes",
  zValidator("param", esquemas.paramCodigoObra),
  exigirObra(codigoDoPedido),
  async (req, res) => {
    const { data, error } = await req.supabase.from("apresentacao").select(COLUNAS)
      .eq("obra_codigo", codigoDoPedido(req))
      .order("atualizado_em", { ascending: false }).limit(TETO_DA_LISTA);
    if (error) return erroDoBanco(res, error);
    return res.json({ apresentacoes: data || [] });
  });

rotas.get("/api/obras/:codigo/apresentacoes/:id",
  zValidator("param", esquemas.paramDocumentoDaObra),
  exigirObra(codigoDoPedido),
  async (req, res) => {
    const { data, error } = await req.supabase.from("apresentacao")
      .select(`${COLUNAS}, capa, slides`)
      .eq("id", req.valido.param.id).eq("obra_codigo", codigoDoPedido(req)).maybeSingle();
    if (error) return erroDoBanco(res, error);
    if (!data) return res.status(404).json({ error: "Registro não encontrado." });
    return res.json({ apresentacao: data });
  });

rotas.post("/api/obras/:codigo/apresentacoes",
  jsonDoDocumento,
  zValidator("param", esquemas.paramCodigoObra),
  exigirEdicaoDeObra(codigoDoPedido),
  zValidator("json", esquemas.apresentacaoNova),
  async (req, res) => {
    const { data, error } = await req.supabase.rpc("criar_apresentacao", {
      p_obra: codigoDoPedido(req),
      p_rev: req.valido.json.rev,
      p_conteudo: req.valido.json.conteudo,
    });
    if (error) return erroDaFuncao(res, error, SQL);
    return responderDaFuncao(res, data);
  });

rotas.post("/api/obras/:codigo/apresentacoes/:id/gravar",
  jsonDoDocumento,
  zValidator("param", esquemas.paramDocumentoDaObra),
  exigirEdicaoDeObra(codigoDoPedido),
  zValidator("json", esquemas.gravacaoDaApresentacao),
  async (req, res) => {
    const { data, error } = await req.supabase.rpc("salvar_apresentacao", {
      p_id: req.valido.param.id,
      p_versao: req.valido.json.versao,
      p_conteudo: req.valido.json.conteudo,
    });
    if (error) return erroDaFuncao(res, error, SQL);
    return responderDaFuncao(res, data);
  });

rotas.delete("/api/obras/:codigo/apresentacoes/:id",
  zValidator("param", esquemas.paramDocumentoDaObra),
  exigirEdicaoDeObra(codigoDoPedido),
  async (req, res) => {
    const { data, error } = await req.supabase.from("apresentacao").delete()
      .eq("id", req.valido.param.id).eq("obra_codigo", codigoDoPedido(req)).select("id");
    if (error) return erroDoBanco(res, error);
    if (!data?.length) return res.status(404).json({ error: "Registro não encontrado." });
    return res.json({ apagado: true });
  });

/* ---------- as imagens dos ambientes ---------- */

rotas.post("/api/obras/:codigo/ambientes",
  jsonDoDocumento,
  zValidator("param", esquemas.paramCodigoObra),
  exigirEdicaoDeObra(codigoDoPedido),
  zValidator("json", esquemas.imagemDoAmbiente),
  async (req, res) => {
    const { tipo, base64 } = req.valido.json;
    const bytes = Buffer.from(base64, "base64");
    if (!bytes.length) return res.status(400).json({ error: "A imagem enviada está vazia." });
    const caminho = `${codigoDoPedido(req)}/ambientes/${Date.now()}.${EXTENSAO[tipo]}`;
    const { error } = await req.supabase.storage.from(BALDE)
      .upload(caminho, bytes, { contentType: tipo, upsert: false });
    if (error) {
      const status = /exceeded the maximum allowed size|payload too large/i.test(error.message || "") ? 413 : 400;
      return res.status(status).json({ error: "Não foi possível guardar a imagem." });
    }
    return res.json({ caminho });
  });

/* O endereço para VER cada imagem. O balde da obra é privado, então o
   endereço é assinado e vence em uma hora; a imagem antiga, que ficou no
   catálogo, tem endereço público. Caminho que não é desta obra não é
   assinado — nem que alguém o peça. */
rotas.post("/api/obras/:codigo/ambientes/links",
  zValidator("param", esquemas.paramCodigoObra),
  exigirObra(codigoDoPedido),
  zValidator("json", esquemas.caminhosDeImagem),
  async (req, res) => {
    const codigo = codigoDoPedido(req);
    const urls = {};
    const aAssinar = [];
    for (const caminho of new Set(req.valido.json.caminhos)) {
      const balde = baldeDaImagem(caminho, codigo);
      if (balde === BALDE) aAssinar.push(caminho);
      else if (balde === BALDE_ANTIGO) {
        urls[caminho] = req.supabase.storage.from(BALDE_ANTIGO).getPublicUrl(caminho).data.publicUrl;
      }
    }
    if (aAssinar.length) {
      const { data, error } = await req.supabase.storage.from(BALDE)
        .createSignedUrls(aAssinar, MINUTOS_DO_LINK * 60);
      if (error) return res.status(400).json({ error: "Não foi possível abrir as imagens." });
      for (const item of data || []) {
        if (item?.signedUrl && item?.path) urls[item.path] = item.signedUrl;
      }
    }
    return res.json({ urls });
  });

module.exports = { rotasDeApresentacoes: rotas, CAMINHOS_DE_APRESENTACAO };
