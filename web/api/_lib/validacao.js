/**
 * Validacao na fronteira da API — tudo que chega de fora passa por aqui.
 * -----------------------------------------------------------------------
 * Corpo, parametro de rota e query sao conferidos por um schema (zod) ANTES
 * de a rota fazer qualquer coisa: antes de consultar o banco, antes de
 * falar com o Sienge. Entrada fora do formato volta 400, com a lista dos
 * campos recusados e sem eco do que foi enviado.
 *
 * O PDF e' a excecao: o corpo e' binario, e o que se confere e' o tipo, o
 * tamanho e a assinatura `%PDF-` do arquivo (`validarPdf`).
 *
 * Regra: .quality/regras/01-arquitetura.md (ARQ-03) e perfis/webapp-vite-hono.md (VH-06).
 */

const { z } = require("zod");

const ONDE = { json: "body", query: "query", param: "params" };

/**
 * Middleware do Express no molde do `zValidator` do Hono:
 * `zValidator('json', schema)`, `zValidator('param', schema)`,
 * `zValidator('query', schema)`. O valor ja' validado (e convertido) fica
 * em `req.valido.<alvo>`.
 */
function zValidator(alvo, schema) {
  const campo = ONDE[alvo];
  if (!campo) throw new Error(`zValidator: alvo desconhecido "${alvo}"`);
  return (req, res, next) => {
    const r = schema.safeParse(req[campo]);
    if (!r.success) {
      return res.status(400).json({
        error: "Os dados enviados não estão no formato esperado.",
        campos: [...new Set(r.error.issues.map((i) => i.path.join(".") || alvo))],
      });
    }
    req.valido = { ...(req.valido || {}), [alvo]: r.data };
    next();
  };
}

/* ---------- PDF ---------- */

// A Vercel corta o corpo da funcao em 4,5 MB: acima disso o pedido nem
// chega aqui. O limite fica abaixo, e vale igual em desenvolvimento.
const LIMITE_PDF_BYTES = 4 * 1024 * 1024;
// O base64 do mesmo arquivo cresce 4/3.
const LIMITE_PDF_BASE64 = Math.ceil(LIMITE_PDF_BYTES / 3) * 4;
// Nenhum PDF do time passa disto; o teto impede um arquivo feito para
// travar o leitor (milhares de paginas) de ocupar a funcao.
const PAGINAS_MAX = 300;

/** O arquivo comeca com a assinatura de PDF (a especificacao tolera lixo antes, ate' 1 KB). */
function pareceUmPdf(buf) {
  return Buffer.isBuffer(buf) && buf.length > 0 && buf.subarray(0, 1024).includes("%PDF-");
}

/**
 * Confere o PDF que chegou em `req.pdf` (ou no corpo cru). Tipo, tamanho e
 * assinatura: o que nao for PDF de verdade nao chega ao leitor.
 *
 * `req.extraDoErroPdf` vai junto na recusa: a leitura do Sienge usa para
 * dizer ao front que vale tentar de novo em base64 (a Vercel as vezes
 * corrompe o corpo binario no caminho, e ai a assinatura some).
 */
function validarPdf(req, res, next) {
  const buf = req.pdf || (Buffer.isBuffer(req.body) ? req.body : null);
  const recusa = (status, error) => res.status(status).json({ ...(req.extraDoErroPdf || {}), error });
  if (!buf || !buf.length) return recusa(400, "Envie o PDF no corpo da requisição.");
  if (buf.length > LIMITE_PDF_BYTES) return recusa(413, "O arquivo passa do limite de 4 MB.");
  if (!pareceUmPdf(buf)) return recusa(415, "O arquivo enviado não é um PDF.");
  req.pdf = buf;
  next();
}

/* ---------- schemas do contrato ---------- */

const inteiroPositivo = z.number().int().positive();
// A mesma referencia que o Sienge aceita: nn.nnn.nnn.nnn
const REF_ORCAMENTO = /^\d{2}(\.\d{3}){3}$/;

const itemDaSolicitacao = z.object({
  productId: inteiroPositivo,
  detailId: inteiroPositivo.optional(),
  trademarkId: inteiroPositivo.optional(),
  quantity: z.number().positive().finite(),
  unitySymbol: z.string().trim().min(1).max(12),
  // O preco estimado e' opcional; sem custo na linha ele chega nulo.
  estimatedPrice: z.number().nonnegative().finite().nullish(),
  notes: z.string().max(4000).nullish(),
  buildingUnitId: inteiroPositivo,
  costEstimationItemReference: z.string().regex(REF_ORCAMENTO),
  // As linhas da obra que o item resume: e' o que liga a resposta de volta.
  chaves: z.array(z.union([z.string().min(1).max(200), z.number().int()])).max(200).optional(),
}).strict();

const solicitacaoDeCompra = z.object({
  buildingId: inteiroPositivo,
  // Reenvio: itens que faltaram numa solicitacao que ja' existe.
  solicitacaoId: inteiroPositivo.optional(),
  notes: z.string().max(4000).nullish(),
  itens: z.array(itemDaSolicitacao).min(1).max(200),
}).strict();

const paramObra = z.object({ buildingId: z.coerce.number().int().positive() }).strict();
const paramSolicitacao = z.object({ id: z.coerce.number().int().positive() }).strict();

const queryInsumos = z.object({
  ids: z.string().regex(/^\d{1,9}(,\d{1,9}){0,499}$/).optional(),
}).strict();

const pdfEmBase64 = z.object({
  pdfBase64: z.string().min(1).max(LIMITE_PDF_BASE64).regex(/^[A-Za-z0-9+/]+={0,2}$/),
}).strict();

module.exports = {
  z, zValidator, validarPdf, pareceUmPdf,
  LIMITE_PDF_BYTES, LIMITE_PDF_BASE64, PAGINAS_MAX,
  esquemas: { solicitacaoDeCompra, paramObra, paramSolicitacao, queryInsumos, pdfEmBase64 },
};
