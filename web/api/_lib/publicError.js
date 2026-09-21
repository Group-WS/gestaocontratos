const { randomUUID } = require("node:crypto");

/** Mantém o contrato legado `error: string` sem expor respostas de terceiros. */
function publicError(res, error, { status = 500, message, extra = {} } = {}) {
  const correlationId = randomUUID();
  // Não registrar mensagens de terceiros: podem carregar URLs, tokens ou dados pessoais.
  console.error(JSON.stringify({
    level: "error",
    event: "request_failed",
    correlationId,
    errorType: error instanceof TypeError ? "TypeError" : "Error",
    status,
  }));
  return res.status(status).json({
    ...extra,
    error: message || "Não foi possível concluir a operação. Tente novamente em instantes.",
    correlationId,
  });
}

module.exports = { publicError };
