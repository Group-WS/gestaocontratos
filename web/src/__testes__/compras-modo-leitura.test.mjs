/* Compras só muda item com a edição da obra habilitada.
 *
 * Roda com: node web/src/__testes__/compras-modo-leitura.test.mjs
 *
 * Quem grava é o salvamento automático, e ele só roda pra quem está com a
 * trava da obra. Em modo leitura a tela deixava marcar "solicitado", a marca
 * aparecia e sumia no F5 (15/09/2026). Aqui: toda mudança das Compras passa
 * por `mudar`, que não faz nada sem edição, e os botões travam.
 */
import fs from "node:fs";

const src = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const trecho = (a, b) => {
  const i = src.indexOf(a); const j = src.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error(`não achei no App.jsx: ${a}`);
  return src.slice(i, j);
};
const compras = trecho("function ComprasView(", "/* A situacao do produto no Sienge");
const linha = trecho("function LinhaCompra(", "MÓDULO CONTRATOS");
const escolha = trecho("function EscolhaSienge(", "function PedidoCompra(");

let f = 0;
const conf = (n, ok) => { if (!ok) f++; console.log(`${ok ? "ok  " : "FALHOU"} ${n}`); };

const def = compras.match(/const mudar = ([^\n]*);/)?.[1];
const chamadas = (podeEditar) => {
  const feitas = [];
  const mudar = new Function("podeEditar", "onItemChange", `return ${def};`)(podeEditar, (...a) => feitas.push(a));
  mudar(1, 2, { solicitado: true });
  return feitas.length;
};
conf("sem edição, marcar não muda nada", def && chamadas(false) === 0);
conf("com edição, marcar muda o item", def && chamadas(true) === 1);
conf("nas Compras só `mudar` chama onItemChange", (compras.match(/onItemChange\(/g) || []).length === 1);
conf("o App passa a edição da obra pras Compras", /<ComprasView [^>]*podeEditar=\{edicao\.minha\}/.test(src));
const i = compras.indexOf("<LinhaCompra ");
conf("a linha recebe a edição", i >= 0 && compras.slice(i, compras.indexOf("/>", i)).includes("podeEditar={podeEditar}"));
conf("solicitado trava em modo leitura", linha.includes("disabled={!podeEditar || !podeMudarSolicitado(it)}"));
conf("comprado trava em modo leitura", linha.includes("disabled={!podeEditar || (!it.comprado && !podeMarcarComprado(it))}"));
conf("insumo do Sienge fica só pra consulta", linha.includes("somenteLeitura={!podeEditar}") && /somenteLeitura = false/.test(escolha));
conf("canal e marcações em massa travam", (compras.match(/disabled=\{!podeEditar\}/g) || []).length >= 5);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
