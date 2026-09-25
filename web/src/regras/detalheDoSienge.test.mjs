/* RN-090 · Produto só vai ao Template Sienge com a decisão tomada.
 *
 * Roda com: node web/src/regras/detalheDoSienge.test.mjs
 *
 * Os exemplos da ficha (docs/regras-de-negocio/RN-090), um por um, mais os
 * limites: código só com espaço, descritivo editado para vazio, decisão
 * desfeita com código já digitado.
 */
import { DECISAO_DO_DETALHE as D, decisaoDoDetalhe, entraNoTemplateSienge } from "./detalheDoSienge.js";

let falhas = 0;
const conf = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome.padEnd(78)} ${ok ? "" : `obtido ${JSON.stringify(obtido)} · esperado ${JSON.stringify(esperado)}`}`);
};

// ---------- a decisão ----------
conf("RN-090 · escolheu um detalhe que existe", decisaoDoDetalhe({ detalheSienge: "CADEIRA / LINEE / BROTO" }), D.EXISTENTE);
conf("RN-090 · escolheu cadastrar como detalhe novo", decisaoDoDetalhe({ detalheNovoSienge: true }), D.NOVO);
conf("RN-090 · ninguém decidiu", decisaoDoDetalhe({}), D.A_CONFERIR);
conf("RN-090 · decisão desfeita volta a conferir", decisaoDoDetalhe({ detalheNovoSienge: false }), D.A_CONFERIR);
conf("RN-090 · desfeita, mesmo com código digitado", decisaoDoDetalhe({ detalheNovoSienge: false, codigoAuxSienge: "43977" }), D.A_CONFERIR);
conf("RN-090 · detalhe escolhido manda sobre a decisão de novo", decisaoDoDetalhe({ detalheSienge: "X", detalheNovoSienge: true }), D.EXISTENTE);
conf("RN-090 · detalhe só com espaço não é escolha", decisaoDoDetalhe({ detalheSienge: "  " }), D.A_CONFERIR);
conf("RN-090 · sem produto, a conferir", decisaoDoDetalhe(null), D.A_CONFERIR);

// ---------- o que veio de antes da regra ----------
conf("RN-090 · legado: descritivo editado conta como novo", decisaoDoDetalhe({ descritivoSienge: "RIVATTI / CADEIRA" }), D.NOVO);
conf("RN-090 · legado: descritivo editado para vazio também", decisaoDoDetalhe({ descritivoSienge: "" }), D.NOVO);
conf("RN-090 · legado: código do detalhe digitado", decisaoDoDetalhe({ codigoDetalheSienge: "12" }), D.NOVO);
conf("RN-090 · legado: código auxiliar digitado", decisaoDoDetalhe({ codigoAuxSienge: "43977" }), D.NOVO);
conf("RN-090 · legado: código só com espaço não conta", decisaoDoDetalhe({ codigoAuxSienge: "  " }), D.A_CONFERIR);
conf("RN-090 · legado: já solicitado conta como novo", decisaoDoDetalhe({}, { solicitado: true }), D.NOVO);

// ---------- o Template Sienge ----------
conf("RN-090 · detalhe novo entra no template", entraNoTemplateSienge({ detalheNovoSienge: true }), true);
conf("RN-090 · a conferir fica fora do template", entraNoTemplateSienge({}), false);
conf("RN-090 · detalhe que já existe fica fora do template", entraNoTemplateSienge({ detalheSienge: "X" }), false);
conf("RN-090 · legado solicitado entra no template", entraNoTemplateSienge({}, { solicitado: true }), true);

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
