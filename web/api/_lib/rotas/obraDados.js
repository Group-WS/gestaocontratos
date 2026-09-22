/**
 * Gravar a obra — o unico caminho de escrita do conteudo de uma obra.
 * -----------------------------------------------------------
 * POST /api/obras/:codigo/gravar                  { versao, gzip }     -> { versao }
 * POST /api/obras/:codigo/patch                   { versao, patches }  -> { versao, aplicados, recusados }
 * POST /api/obras/:codigo/versoes/:id/restaurar                        -> { versao, restaurou, de }
 *
 * Antes o navegador gravava direto na tabela, com um UPSERT da linha inteira
 * que nao conferia nada: uma copia velha da obra ia por cima do trabalho de
 * outra pessoa sem ninguem saber. Agora quem decide e' o banco
 * (supabase/salvar-obra.sql): so' grava com a trava de quem grava e com a
 * versao que a tela leu. O que nao bater volta 409 com o motivo, e a tela
 * avisa — nada e' escrito.
 *
 * Molde das rotas de dados: valida -> autoriza (login, membro, edicao da
 * obra) -> grava com o client do usuario (RLS) -> responde, com o erro do
 * banco traduzido. O e-mail de quem grava vem do login, no banco.
 */

const express = require("express");
const { gunzipSync } = require("node:zlib");
const { exigirLogin, exigirMembro, exigirEdicaoDeObra } = require("../auth.js");
const { zValidator, esquemas, LIMITE_GRAVACAO_BASE64, LIMITE_CONTEUDO_BYTES } = require("../validacao.js");
const { erroDoBanco } = require("../erroDoBanco.js");

/* O leitor de JSON desta rota tem limite proprio: o global (1 MB) nao cabe
   uma obra grande nem comprimida. Por isso o mondayApp.js deixa passar este
   caminho sem ler (ver CAMINHOS_COM_LEITOR_PROPRIO). */
const CAMINHO_DA_GRAVACAO = /^\/api\/obras\/[^/]+\/gravar$/;
const jsonDaGravacao = express.json({ limit: LIMITE_GRAVACAO_BASE64 + 1024 });

const FORMATO = "Os dados enviados não estão no formato esperado.";

/** O conteudo que veio comprimido, de volta a objeto. Nulo quando nao e' gzip de JSON. */
function descomprimir(base64) {
  try {
    const texto = gunzipSync(Buffer.from(base64, "base64"), { maxOutputLength: LIMITE_CONTEUDO_BYTES }).toString("utf8");
    return { conteudo: JSON.parse(texto) };
  } catch (e) {
    return { grande: e instanceof RangeError || e?.code === "ERR_BUFFER_TOO_LARGE" };
  }
}

/* A funcao ainda nao existe no banco: o SQL novo nao rodou. Nao e' erro de
   quem esta' usando — o app guarda o trabalho e tenta de novo sozinho. */
const semFuncao = (error) => error?.code === "PGRST202" || error?.code === "42883";

/** A resposta das funcoes do banco virando HTTP. */
function responder(res, data) {
  if (data?.ok) {
    const { ok, ...resto } = data;
    return res.json(resto);
  }
  switch (data?.motivo) {
    case "trava":
    case "trava de outra pessoa":
      return res.status(409).json({
        error: "Outra pessoa está com a edição desta obra.",
        motivo: "trava", por: data.por || null, desde: data.desde || null,
      });
    case "versao":
      return res.status(409).json({
        error: "A obra foi alterada depois que esta tela a leu.",
        motivo: "versao", versao: data.versao ?? null,
        atualizadoPor: data.atualizado_por || null, atualizadoEm: data.atualizado_em || null,
      });
    case "vazia":
      return res.status(409).json({
        error: "Esta tela está sem os itens da obra, mas a obra no banco tem itens.",
        motivo: "vazia",
      });
    case "sem_linha":
    case "obra sem linha em obra_dados":
    case "sem_versao":
      return res.status(404).json({ error: "Registro não encontrado." });
    case "outra_obra":
      return res.status(400).json({ error: "Essa versão é de outra obra." });
    case "sem_usuario":
    case "sem usuario identificado":
      return res.status(401).json({ error: "Não autenticado." });
    default:
      return res.status(400).json({ error: FORMATO });
  }
}

function erroDaFuncao(res, error) {
  if (semFuncao(error)) {
    return res.status(503).json({
      error: "A gravação protegida ainda não está no banco (falta rodar supabase/salvar-obra.sql).",
      code: error.code,
    });
  }
  // O gatilho da trava: gravacao por cima de quem esta' editando.
  if (error?.code === "55006") {
    return res.status(409).json({ error: "Outra pessoa está com a edição desta obra.", motivo: "trava", por: null, desde: null });
  }
  return erroDoBanco(res, error);
}

const codigoDoPedido = (req) => req.valido.param.codigo;

const rotas = express.Router();
rotas.use(exigirLogin, exigirMembro);

rotas.post("/api/obras/:codigo/gravar",
  jsonDaGravacao,
  zValidator("param", esquemas.paramCodigoObra),
  exigirEdicaoDeObra(codigoDoPedido),
  zValidator("json", esquemas.gravacaoDaObra),
  async (req, res) => {
    const { conteudo, grande } = descomprimir(req.valido.json.gzip);
    if (grande) return res.status(413).json({ error: "O conteúdo enviado passa do limite permitido." });
    const valido = esquemas.conteudoDaObra.safeParse(conteudo);
    if (!valido.success) {
      return res.status(400).json({
        error: FORMATO,
        campos: [...new Set(valido.error.issues.map((i) => i.path.join(".") || "conteudo"))].slice(0, 20),
      });
    }
    const { data, error } = await req.supabase.rpc("salvar_obra", {
      p_codigo: codigoDoPedido(req),
      p_versao: req.valido.json.versao,
      p_conteudo: valido.data,
    });
    if (error) return erroDaFuncao(res, error);
    return responder(res, data);
  });

rotas.post("/api/obras/:codigo/patch",
  zValidator("param", esquemas.paramCodigoObra),
  exigirEdicaoDeObra(codigoDoPedido),
  zValidator("json", esquemas.patchesDaObra),
  async (req, res) => {
    const { data, error } = await req.supabase.rpc("aplicar_patch_obra", {
      p_codigo: codigoDoPedido(req),
      p_patches: req.valido.json.patches,
      p_versao: req.valido.json.versao,
    });
    if (error) return erroDaFuncao(res, error);
    return responder(res, data);
  });

rotas.post("/api/obras/:codigo/versoes/:id/restaurar",
  zValidator("param", esquemas.paramVersaoGuardada),
  exigirEdicaoDeObra(codigoDoPedido),
  async (req, res) => {
    const { data, error } = await req.supabase.rpc("restaurar_versao_obra", {
      p_codigo: codigoDoPedido(req),
      p_versao_id: req.valido.param.id,
    });
    if (error) return erroDaFuncao(res, error);
    return responder(res, data);
  });

module.exports = { rotasDaObra: rotas, CAMINHO_DA_GRAVACAO };
