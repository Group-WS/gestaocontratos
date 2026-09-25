/**
 * O detalhe do Sienge de cada produto — a decisão que a pessoa tomou
 * (25/09/2026).
 *
 * RN-090 — Produto só vai ao Template Sienge com a decisão tomada.
 *
 * Ficha: docs/regras-de-negocio/RN-090-template-sienge-so-com-decisao.md.
 *
 * Função pura: não lê banco, sessão nem relógio. Quem grava a decisão é o
 * fluxo (a linha de Compras, na etapa Sienge, e o Gerador de códigos).
 */

/** RN-090 — as três situações do detalhe de um produto. */
export const DECISAO_DO_DETALHE = Object.freeze({
  EXISTENTE: "existente",   // escolheu um detalhe que já está no Sienge
  NOVO: "novo",             // decidiu cadastrar como detalhe novo
  A_CONFERIR: "a-conferir", // ninguém decidiu ainda
});

const preenchido = (v) => String(v ?? "").trim() !== "";

/**
 * RN-090 — qual é a situação do detalhe deste produto.
 *
 * `detalheNovoSienge` é a decisão gravada: `true` quando a pessoa escolheu
 * "cadastrar como detalhe novo"; `false` quando ela desfez (trocou a mãe ou
 * escolheu um detalhe que existe). Antes da regra o campo não existia, e o
 * produto sem detalhe ia como novo sem ninguém decidir: o que já tinha
 * descritivo editado, código do detalhe ou auxiliar digitado, ou já foi
 * solicitado, conta como decidido.
 *
 * @param {{detalheSienge?: string|null, detalheNovoSienge?: boolean|null,
 *   descritivoSienge?: string|null, codigoDetalheSienge?: string|null,
 *   codigoAuxSienge?: string|null}} item
 * @param {{solicitado?: boolean}} [contexto] `solicitado`: o produto já foi solicitado (ou comprado).
 * @returns {"existente"|"novo"|"a-conferir"}
 */
export function decisaoDoDetalhe(item, { solicitado = false } = {}) {
  if (!item) return DECISAO_DO_DETALHE.A_CONFERIR;
  if (preenchido(item.detalheSienge)) return DECISAO_DO_DETALHE.EXISTENTE;
  if (item.detalheNovoSienge === true) return DECISAO_DO_DETALHE.NOVO;
  if (item.detalheNovoSienge === false) return DECISAO_DO_DETALHE.A_CONFERIR;
  const jaMexeram = item.descritivoSienge != null
    || preenchido(item.codigoDetalheSienge) || preenchido(item.codigoAuxSienge) || !!solicitado;
  return jaMexeram ? DECISAO_DO_DETALHE.NOVO : DECISAO_DO_DETALHE.A_CONFERIR;
}

/** RN-090 — este produto entra no Template Sienge (cadastro de detalhe novo)? */
export function entraNoTemplateSienge(item, contexto) {
  return decisaoDoDetalhe(item, contexto) === DECISAO_DO_DETALHE.NOVO;
}
