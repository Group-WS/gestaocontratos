/**
 * Erro do banco (PostgREST/Postgres) virando resposta para a pessoa.
 * -----------------------------------------------------------------
 * Erro esperado (duplicado, sem permissao, nao encontrado, lento) tem
 * mensagem padrao; o resto e' inesperado: vai pro log com um codigo, e a
 * tela recebe a mensagem padrao com esse codigo. O texto do Postgres nunca
 * sai daqui (SEG-33, ARQ-06).
 *
 * A excecao sao as regras de negocio garantidas no banco: a mensagem delas
 * comeca com o ID ("RN-001: so' o administrador libera a compra.") e foi
 * escrita para a pessoa — essa sobe como esta'.
 */

const { publicError } = require("./publicError.js");

const CONHECIDOS = {
  "23505": [409, "Já existe um registro com estes dados."],
  "23503": [409, "Não é possível concluir: existem registros vinculados."],
  "23514": [422, "Os dados enviados não passaram na conferência do banco."],
  "42501": [403, "Você não tem permissão para esta ação."],
  PGRST116: [404, "Registro não encontrado."],
  "57014": [504, "A consulta demorou demais. Tente de novo."],
};

function erroDoBanco(res, error) {
  const mensagem = String(error?.message || "");
  if (/^RN-\d{3}:/.test(mensagem)) return res.status(403).json({ error: mensagem, code: error.code || null });
  const conhecido = CONHECIDOS[error?.code];
  if (conhecido) return res.status(conhecido[0]).json({ error: conhecido[1], code: error.code });
  return publicError(res, error, { status: 500 });
}

module.exports = { erroDoBanco };
