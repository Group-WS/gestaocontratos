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

/* ---------- a gravacao da obra ---------- */

// O conteudo da obra vai comprimido (gzip) e em base64: o JSON inteiro passa
// de 1 MB nas obras grandes, e a Vercel corta o corpo em 4,5 MB. Comprimido,
// cabe com folga — e em JSON, porque corpo binario ja' chegou corrompido
// pela Vercel (ver a leitura de PDF do Sienge).
const LIMITE_GRAVACAO_BASE64 = 4 * 1024 * 1024;
// Teto do JSON depois de descomprimido: nenhuma obra chega perto, e o teto
// impede um arquivo pequeno feito para explodir na memoria da funcao.
const LIMITE_CONTEUDO_BYTES = 48 * 1024 * 1024;

const codigoDeObra = z.string().trim().min(1).max(40).regex(/^[0-9A-Za-z._-]+$/);
const versaoDaObra = z.number().int().positive();
const paramCodigoObra = z.object({ codigo: codigoDeObra }).strict();
const paramVersaoGuardada = z.object({ codigo: codigoDeObra, id: z.coerce.number().int().positive() }).strict();

const gravacaoDaObra = z.object({
  versao: versaoDaObra,
  gzip: z.string().min(1).max(LIMITE_GRAVACAO_BASE64).regex(/^[A-Za-z0-9+/]+={0,2}$/),
}).strict();

/* O conteudo, com os nomes das colunas de `obra_dados`. As listas e mapas
   levam o que o app monta — itens das tres fontes, cadernos, escopos —,
   cujo formato muda com o app e e' conferido la'; aqui vale o formato de
   cada coluna, o mesmo que a funcao `salvar_obra` confere no banco. */
const textoOuNulo = z.string().max(20000).nullable();
const dataOuNulo = z.string().regex(/^\d{4}-\d{2}-\d{2}/).max(40).nullable();
const conteudoDaObra = z.object({
  categorias: z.array(z.record(z.string(), z.unknown())).max(2000),
  cadernos: z.record(z.string(), z.unknown()),
  arquivos: z.array(z.unknown()).max(10000),
  aprovacoes: z.array(z.unknown()).max(100000),
  escopos: z.array(z.unknown()).max(2000),
  etapas_concluidas: z.record(z.string(), z.unknown()),
  depara_aprovado: z.boolean(),
  executivo_liberado_direto: z.boolean(),
  compras_liberadas: z.boolean(),
  cliente_assinou_em: dataOuNulo,
  cliente_assinatura_por: textoOuNulo,
  cliente_assinatura_arq: z.record(z.string(), z.unknown()).nullable(),
  cliente_assinatura_obs: textoOuNulo,
  compra_sem_assinatura_por: textoOuNulo,
  compra_sem_assinatura_em: dataOuNulo,
  compra_sem_assinatura_just: textoOuNulo,
  cmv_liberado: z.number().finite().nullable(),
  cmv_liberado_em: dataOuNulo,
  cmv_liberado_por: textoOuNulo,
  data_entrega: dataOuNulo,
}).strict();

// Um patch e' "este campo deste item", "esta chave deste mapa da verba" ou
// "esta marca da obra" — os tres formatos que `aplicar_patch_obra` entende.
const camposDoPatch = z.record(z.string(), z.unknown());
const patchDaObra = z.union([
  z.object({
    verba: z.number().int().nonnegative(), item: z.number().int().nonnegative(), campos: camposDoPatch,
    confCodigo: z.string().max(200).optional(), confDesc: z.string().max(4000).optional(),
  }).strict(),
  z.object({
    verba: z.number().int().nonnegative(), mapa: z.enum(["comprasAditivo"]), chave: z.string().min(1).max(200), campos: camposDoPatch,
  }).strict(),
  z.object({ coluna: z.string().min(1).max(60), valor: z.unknown() }).strict(),
]);
const patchesDaObra = z.object({ versao: versaoDaObra, patches: z.array(patchDaObra).min(1).max(5000) }).strict();

module.exports = {
  z, zValidator, validarPdf, pareceUmPdf,
  LIMITE_PDF_BYTES, LIMITE_PDF_BASE64, PAGINAS_MAX, LIMITE_GRAVACAO_BASE64, LIMITE_CONTEUDO_BYTES,
  esquemas: {
    solicitacaoDeCompra, paramObra, paramSolicitacao, queryInsumos, pdfEmBase64,
    paramCodigoObra, paramVersaoGuardada, gravacaoDaObra, conteudoDaObra, patchesDaObra,
  },
};
