/**
 * Os dois documentos que moram fora da obra: o aditivo e a apresentacao.
 * -----------------------------------------------------------
 * GET    /api/aditivos                                 ?obra=   -> { aditivos }
 * GET    /api/obras/:codigo/aditivos/:id                        -> { aditivo }    (com o documento)
 * POST   /api/obras/:codigo/aditivos                   { campos }          -> { id, seq, numero, versao }
 * POST   /api/obras/:codigo/aditivos/:id/gravar        { versao, campos }  -> { versao }
 * DELETE /api/obras/:codigo/aditivos/:id                                   -> { apagado }
 * GET    /api/obras/:codigo/apresentacoes                       -> { apresentacoes } (sem capa e slides)
 * GET    /api/obras/:codigo/apresentacoes/:id                   -> { apresentacao }
 * POST   /api/obras/:codigo/apresentacoes              { rev, conteudo }     -> { id, rev, versao }
 * POST   /api/obras/:codigo/apresentacoes/:id/gravar   { versao, conteudo }  -> { versao }
 * DELETE /api/obras/:codigo/apresentacoes/:id                                -> { apagado }
 * POST   /api/obras/:codigo/ambientes                  { nome, tipo, base64 } -> { caminho }
 * POST   /api/obras/:codigo/ambientes/links            { caminhos }           -> { urls }
 *
 * Antes o navegador gravava direto nas duas tabelas, com o documento inteiro
 * e sem conferir nada: duas pessoas no mesmo aditivo (ou na mesma revisao da
 * apresentacao) se apagavam em silencio. Agora quem decide e' o banco
 * (supabase/salvar-aditivo-apresentacao.sql): so' grava com a versao que a
 * tela leu, e o que nao bater volta 409 com o motivo.
 *
 * Quem ABRE um aditivo ou uma revisao carrega o documento por id, e assim
 * comeca a editar sempre a partir do que esta' no banco — e nao da copia que
 * a lista trouxe minutos atras. A lista da apresentacao nem leva capa e
 * slides; a do aditivo leva o documento porque as contas da obra (orcamento,
 * CMV, Plano de Compras) leem os grupos de dentro dele.
 *
 * Molde das rotas de dados: valida -> autoriza (login, membro, edicao da
 * obra) -> fala com o banco pelo client do usuario (RLS) -> responde, com o
 * erro traduzido. Quem gravou sai do login, no banco.
 */

const express = require("express");
const { exigirLogin, exigirMembro, exigirObra, exigirEdicaoDeObra } = require("../auth.js");
const { zValidator, esquemas, LIMITE_DOCUMENTO_JSON } = require("../validacao.js");
const { erroDoBanco } = require("../erroDoBanco.js");

/* Os documentos passam do limite global de 1 MB (um aditivo grande tem
   centenas de KB, e a imagem do ambiente vem em base64). Estes caminhos tem
   leitor proprio — ver CAMINHOS_COM_LEITOR_PROPRIO no mondayApp.js. */
const CAMINHOS_DE_DOCUMENTO = [
  /^\/api\/obras\/[^/]+\/aditivos(\/[^/]+\/gravar)?$/,
  /^\/api\/obras\/[^/]+\/apresentacoes(\/[^/]+\/gravar)?$/,
  /^\/api\/obras\/[^/]+\/ambientes$/,
];
const jsonDoDocumento = express.json({ limit: LIMITE_DOCUMENTO_JSON });

const BALDE = "obra-arquivos";
// O balde de antes das imagens de ambiente. As apresentacoes ja' gravadas
// apontam para `ambientes/<obra>/...` la' dentro, e continuam abrindo.
const BALDE_ANTIGO = "catalogo";
const MINUTOS_DO_LINK = 60;

const COLUNAS_ADITIVO = "id, obra_codigo, seq, numero, descricao, status, total_supressao, total_adicao, criado_em, criado_por, atualizado_em, atualizado_por, versao";
const COLUNAS_APRESENTACAO = "id, obra_codigo, rev, idioma, arquivo, gerado_em, criado_em, criado_por, atualizado_em, atualizado_por, versao";
const TETO_DA_LISTA = 2000;

/* A funcao ainda nao existe no banco: o SQL novo nao rodou. Nao e' erro de
   quem esta' usando — a tela guarda o trabalho e tenta de novo sozinha. */
const semFuncao = (error) => error?.code === "PGRST202" || error?.code === "42883";

/** A resposta das funcoes do banco virando HTTP. */
function responder(res, data) {
  if (data?.ok) {
    const { ok, ...resto } = data;
    return res.json(resto);
  }
  switch (data?.motivo) {
    case "versao":
      return res.status(409).json({
        error: "Este documento foi alterado depois que esta tela o leu.",
        motivo: "versao", versao: data.versao ?? null,
        atualizadoPor: data.atualizadoPor || null, atualizadoEm: data.atualizadoEm || null,
      });
    case "rev_existe":
      return res.status(409).json({
        error: `A revisão ${data.rev || ""} já existe nesta obra.`.replace("  ", " "),
        motivo: "rev_existe",
      });
    case "sem_linha":
      return res.status(404).json({ error: "Registro não encontrado." });
    case "sem_obra":
      return res.status(400).json({ error: "Informe a obra." });
    case "sem_usuario":
      return res.status(401).json({ error: "Não autenticado." });
    default:
      return res.status(400).json({ error: "Os dados enviados não estão no formato esperado." });
  }
}

function erroDaFuncao(res, error) {
  if (semFuncao(error)) {
    return res.status(503).json({
      error: "A gravação protegida destes documentos ainda não está no banco (falta rodar supabase/salvar-aditivo-apresentacao.sql).",
      code: error.code,
    });
  }
  return erroDoBanco(res, error);
}

const codigoDoPedido = (req) => req.valido.param.codigo;

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

const rotas = express.Router();
rotas.use(exigirLogin, exigirMembro);

/* ---------- aditivo ---------- */

/* Sem obra na rota: todos os aditivos que a pessoa enxerga (a tela de
   Aditivos e o painel do Início). Quem recorta e' o RLS.
 *
 * A lista leva o documento (`dados`), e nao e' desperdicio: os aditivos
 * aprovados entram na conta do orcamento, do CMV e do Plano de Compras, e
 * essa conta le os grupos de dentro do documento — tanto na obra aberta
 * quanto no painel do Inicio. O que mudou e' que as colunas sao nomeadas
 * (era `select('*')`), e que quem ABRE um aditivo o carrega por id, fresco,
 * em vez de editar a copia que a lista trouxe. */
rotas.get("/api/aditivos",
  zValidator("query", esquemas.queryDaObra),
  async (req, res) => {
    let q = req.supabase.from("aditivo").select(`${COLUNAS_ADITIVO}, dados`)
      .order("obra_codigo").order("seq", { ascending: false }).limit(TETO_DA_LISTA);
    if (req.valido.query.obra) q = q.eq("obra_codigo", req.valido.query.obra);
    const { data, error } = await q;
    if (error) return erroDoBanco(res, error);
    return res.json({ aditivos: data || [] });
  });

rotas.get("/api/obras/:codigo/aditivos/:id",
  zValidator("param", esquemas.paramDocumentoDaObra),
  exigirObra(codigoDoPedido),
  async (req, res) => {
    const { data, error } = await req.supabase.from("aditivo")
      .select(`${COLUNAS_ADITIVO}, dados`)
      .eq("id", req.valido.param.id).eq("obra_codigo", codigoDoPedido(req)).maybeSingle();
    if (error) return erroDoBanco(res, error);
    if (!data) return res.status(404).json({ error: "Registro não encontrado." });
    return res.json({ aditivo: data });
  });

rotas.post("/api/obras/:codigo/aditivos",
  jsonDoDocumento,
  zValidator("param", esquemas.paramCodigoObra),
  exigirEdicaoDeObra(codigoDoPedido),
  zValidator("json", esquemas.aditivoNovo),
  async (req, res) => {
    const { data, error } = await req.supabase.rpc("criar_aditivo", {
      p_obra: codigoDoPedido(req),
      p_campos: req.valido.json.campos,
    });
    if (error) return erroDaFuncao(res, error);
    return responder(res, data);
  });

rotas.post("/api/obras/:codigo/aditivos/:id/gravar",
  jsonDoDocumento,
  zValidator("param", esquemas.paramDocumentoDaObra),
  exigirEdicaoDeObra(codigoDoPedido),
  zValidator("json", esquemas.gravacaoDoAditivo),
  async (req, res) => {
    const { data, error } = await req.supabase.rpc("salvar_aditivo", {
      p_id: req.valido.param.id,
      p_versao: req.valido.json.versao,
      p_campos: req.valido.json.campos,
    });
    if (error) return erroDaFuncao(res, error);
    return responder(res, data);
  });

/* Apagar continua sendo do banco: so' quem criou, ou um administrador
   (policy do rls-reforco.sql). O `.select()` e' o que separa "apagou" de
   "o RLS recusou e voltaram zero linhas" — sem ele, a tela tirava o aditivo
   da lista e ele continuava no banco. */
rotas.delete("/api/obras/:codigo/aditivos/:id",
  zValidator("param", esquemas.paramDocumentoDaObra),
  exigirEdicaoDeObra(codigoDoPedido),
  async (req, res) => {
    const { data, error } = await req.supabase.from("aditivo").delete()
      .eq("id", req.valido.param.id).eq("obra_codigo", codigoDoPedido(req)).select("id");
    if (error) return erroDoBanco(res, error);
    if (!data?.length) return res.status(403).json({ error: "Só quem criou o aditivo, ou um administrador, pode excluí-lo." });
    return res.json({ apagado: true });
  });

/* ---------- apresentação ---------- */

rotas.get("/api/obras/:codigo/apresentacoes",
  zValidator("param", esquemas.paramCodigoObra),
  exigirObra(codigoDoPedido),
  async (req, res) => {
    const { data, error } = await req.supabase.from("apresentacao").select(COLUNAS_APRESENTACAO)
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
      .select(`${COLUNAS_APRESENTACAO}, capa, slides`)
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
    if (error) return erroDaFuncao(res, error);
    return responder(res, data);
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
    if (error) return erroDaFuncao(res, error);
    return responder(res, data);
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

/* Elas ficam no balde da OBRA (`obra-arquivos/<codigo>/ambientes/`), e não
   mais no do catálogo: é o balde privado, com as mesmas permissões dos
   outros arquivos da obra — quem vê a obra vê, quem edita grava. A imagem
   chega reduzida pelo navegador (lado maior ~2000 px), que é o que a faz
   caber no corpo da função e deixa o PDF leve. */
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

module.exports = { rotasDosDocumentos: rotas, CAMINHOS_DE_DOCUMENTO };
