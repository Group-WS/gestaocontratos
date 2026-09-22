/**
 * O "nao" das funcoes de gravacao do banco, virando HTTP.
 * -----------------------------------------------------------
 * As gravacoes protegidas (`salvar_obra`, `salvar_aditivo`,
 * `salvar_apresentacao`, `criar_aditivo`, `criar_apresentacao`) nao levantam
 * erro quando recusam: elas DEVOLVEM o motivo, porque recusar faz parte do
 * trabalho delas. Quem chama traduz esse motivo em status, e e' pela
 * tradução que a tela sabe se para, se tenta de novo ou se avisa.
 *
 * Um lugar so' para os dois documentos (aditivo e apresentacao): motivo novo
 * entra aqui e as duas rotas passam a responder igual.
 */

const { erroDoBanco } = require("./erroDoBanco.js");

const FORMATO = "Os dados enviados não estão no formato esperado.";

/** A resposta da funcao do banco virando HTTP. */
function responderDaFuncao(res, data) {
  if (data?.ok) {
    const { ok, ...resto } = data;
    return res.json(resto);
  }
  switch (data?.motivo) {
    case "versao":
      return res.status(409).json({
        error: "Este documento foi alterado depois que esta tela o leu.",
        motivo: "versao",
        versao: data.versao ?? null,
        atualizadoPor: data.atualizadoPor || null,
        atualizadoEm: data.atualizadoEm || null,
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
      return res.status(400).json({ error: FORMATO });
  }
}

/* A funcao ainda nao existe no banco: o SQL novo nao rodou. Nao e' erro de
   quem esta' usando — a tela guarda o trabalho e tenta de novo sozinha. */
const semFuncao = (error) => error?.code === "PGRST202" || error?.code === "42883";

/** O erro da chamada virando HTTP, dizendo qual SQL falta quando for o caso. */
function erroDaFuncao(res, error, arquivoSql) {
  if (semFuncao(error)) {
    return res.status(503).json({
      error: `A gravação protegida destes documentos ainda não está no banco (falta rodar ${arquivoSql}).`,
      code: error.code,
    });
  }
  return erroDoBanco(res, error);
}

module.exports = { responderDaFuncao, erroDaFuncao, FORMATO };
