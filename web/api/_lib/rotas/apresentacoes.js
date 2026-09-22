/**
 * Apresentacao de especificacoes — as revisoes que vao pro cliente.
 * -----------------------------------------------------------
 * GET    /api/apresentacoes?obra=2307       -> as revisoes da obra (ou todas), da mais nova pra mais velha
 * PUT    /api/apresentacoes                 -> grava: com `id` atualiza a revisao, sem `id` cria outra
 * DELETE /api/apresentacoes/:id             -> apaga uma revisao
 * PUT    /api/apresentacoes/:id/gerada      -> marca que esta revisao virou PDF, e onde ele foi parar
 * POST   /api/apresentacoes/ambiente/envio  -> assina a subida da imagem do ambiente
 *
 * Antes o navegador falava direto com a tabela e com o Storage. Agora quem
 * fala e' esta rota (VH-02): o caminho mudou, o que a tela recebe nao.
 *
 * Uma apresentacao por obra E por revisao: a REV 01 nao apaga a 00, porque
 * a 00 ja' foi apresentada ao cliente e alguem vai querer conferir o que
 * mudou. Por isso gravar SEM `id` e' insert, nao upsert.
 *
 * Molde das rotas de dados: valida -> autoriza -> fala com o banco com o
 * client do usuario (RLS) -> responde, com o erro do banco traduzido.
 */

const express = require("express");
const { exigirLogin, exigirMembro } = require("../auth.js");
const { zValidator, z } = require("../validacao.js");
const { erroDoBanco } = require("../erroDoBanco.js");
const { assinarEnvio, erroDoStorage } = require("../storage.js");

/* As colunas que a tela usa — nunca `select("*")` (SQL-32). `criado_em` e
   `criado_por` ficam de fora de proposito: ninguem os mostra. */
const COLUNAS = "id, obra_codigo, rev, capa, slides, idioma, arquivo, gerado_em, atualizado_em, atualizado_por";

/* As imagens de ambiente moram no mesmo balde do catalogo, numa pasta
   propria. Um balde so', um conjunto de permissoes so' — dois baldes seria
   o dobro de politica pra manter e nenhuma vantagem. */
const BALDE_DAS_IMAGENS = "catalogo";

const FORMATO = "Os dados enviados não estão no formato esperado.";

const codigoDeObra = z.string().trim().min(1).max(40).regex(/^[0-9A-Za-z._-]+$/);
const id = z.string().uuid();

const queryDaLista = z.object({ obra: codigoDeObra.optional() }).strict();
const paramId = z.object({ id }).strict();

/* A capa e os slides vao inteiros, como a tela os monta: o desenho de um
   slide muda com o uso, e campo por campo viraria uma migracao a cada
   ajuste de layout. O que se confere aqui e' o formato da coluna. */
const corpoDoDoc = z.object({
  id: id.optional(),
  obraCodigo: codigoDeObra,
  capa: z.record(z.string(), z.unknown()),
  slides: z.array(z.unknown()).max(500),
  idioma: z.string().trim().min(1).max(10),
}).strict();

const corpoDaGerada = z.object({ caminho: z.string().trim().min(1).max(400) }).strict();

const corpoDoEnvio = z.object({
  obraCodigo: codigoDeObra.optional(),
  nome: z.string().trim().min(1).max(200),
}).strict();

const rotas = express.Router();
rotas.use(exigirLogin, exigirMembro);

rotas.get("/api/apresentacoes",
  zValidator("query", queryDaLista),
  async (req, res) => {
    let q = req.supabase.from("apresentacao").select(COLUNAS).order("atualizado_em", { ascending: false });
    const { obra } = req.valido.query;
    if (obra) q = q.eq("obra_codigo", obra);
    const { data, error } = await q;
    if (error) return erroDoBanco(res, error);
    res.json(data || []);
  });

rotas.put("/api/apresentacoes",
  zValidator("json", corpoDoDoc),
  async (req, res) => {
    const doc = req.valido.json;
    /* Quem gravou vem do LOGIN, nunca do pedido (SEG-13). */
    const linha = {
      obra_codigo: doc.obraCodigo,
      rev: doc.capa?.rev || "00",
      capa: doc.capa,
      slides: doc.slides,
      idioma: doc.idioma,
      atualizado_por: req.usuario.email,
      atualizado_em: new Date().toISOString(),
    };
    const q = doc.id
      ? req.supabase.from("apresentacao").update(linha).eq("id", doc.id)
      : req.supabase.from("apresentacao").insert({ ...linha, criado_por: req.usuario.email });
    const { data, error } = await q.select(COLUNAS).single();
    if (error) return erroDoBanco(res, error);
    res.json(data);
  });

rotas.delete("/api/apresentacoes/:id",
  zValidator("param", paramId),
  async (req, res) => {
    const { error } = await req.supabase.from("apresentacao").delete().eq("id", req.valido.param.id);
    if (error) return erroDoBanco(res, error);
    res.json({ ok: true });
  });

/** Marca que esta revisao virou PDF, e onde ele foi parar. */
rotas.put("/api/apresentacoes/:id/gerada",
  zValidator("param", paramId),
  zValidator("json", corpoDaGerada),
  async (req, res) => {
    const { error } = await req.supabase.from("apresentacao")
      .update({ arquivo: req.valido.json.caminho, gerado_em: new Date().toISOString() })
      .eq("id", req.valido.param.id);
    if (error) return erroDoBanco(res, error);
    res.json({ ok: true });
  });

/**
 * A imagem do ambiente: a rota assina, o navegador manda o arquivo.
 *
 * Quem monta o caminho e' o servidor — o navegador nao escolhe onde grava.
 * Carimbo de tempo no nome: reusar o caminho faria o navegador continuar
 * mostrando o render antigo, do cache, depois da troca.
 */
rotas.post("/api/apresentacoes/ambiente/envio",
  zValidator("json", corpoDoEnvio),
  async (req, res) => {
    const { obraCodigo, nome } = req.valido.json;
    const ext = (nome.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const alvo = `ambientes/${obraCodigo || "sem-obra"}/${Date.now()}.${ext}`;
    const { erroDeCaminho, error, caminho, token } = await assinarEnvio(req.supabase, BALDE_DAS_IMAGENS, alvo, { upsert: true });
    if (erroDeCaminho) return res.status(400).json({ error: FORMATO, campos: ["nome"] });
    if (error) return erroDoStorage(res, error);
    res.json({ caminho, token });
  });

module.exports = { rotasDeApresentacoes: rotas };
