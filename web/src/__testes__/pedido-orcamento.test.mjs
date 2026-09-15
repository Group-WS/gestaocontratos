/* Filtro por fornecedor e pedido de orçamento (Compras da obra).
 *
 * Roda com: node web/src/__testes__/pedido-orcamento.test.mjs
 *
 * O fornecedor mora em `marca` (a coluna Fornecedor da planilha do
 * Executivo). O filtro junta grafias diferentes do mesmo nome, e o pedido
 * leva só o que ainda não foi comprado, por verba.
 */
import fs from "node:fs";

const src = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const bloco = (a) => {
  const i = src.indexOf(a);
  if (i === -1) throw new Error(`não achei no App.jsx: ${a}`);
  return src.slice(i, src.indexOf("\n}\n", i) + 3);
};
const linha = (a) => {
  const i = src.indexOf(a);
  if (i === -1) throw new Error(`não achei no App.jsx: ${a}`);
  return src.slice(i, src.indexOf("\n", i) + 1);
};
const M = new Function(`
  ${linha("const SEM_FORNECEDOR =")}
  ${bloco("function nomeDoFornecedor(")}
  ${bloco("function chaveFornecedor(")}
  ${bloco("function fornecedoresDasLinhas(")}
  ${bloco("function itensDoPedido(")}
  return { SEM_FORNECEDOR, chaveFornecedor, fornecedoresDasLinhas, itensDoPedido };
`)();

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(58)} ${String(o).slice(0, 40).padEnd(42)} ${ok ? "" : "esperava " + e}`); };

const L = (catNum, marca, extra = {}) => ({ catNum, catNome: `Verba ${catNum}`, it: { desc: "x", marca, ...extra } });
const linhas = [L("24", "Rivatti"), L("24", "RIVATTI "), L("05", "Lumini"), L("21", ""),
  L("24", "Rivatti", { comprado: true }), L("10", "  rivatti  ")];

/* ---- 1. a lista do filtro ---- */
const lista = M.fornecedoresDasLinhas(linhas);
conf("grafias do mesmo fornecedor viram um só", lista.find((x) => x.chave === "rivatti").n, 4);
conf("o nome aparece como veio na primeira linha", lista.find((x) => x.chave === "rivatti").nome, "Rivatti");
conf("em ordem alfabética", lista.map((x) => x.nome).slice(0, 2).join(), "Lumini,Rivatti");
conf("sem fornecedor fica por último", lista[lista.length - 1].chave, M.SEM_FORNECEDOR);
conf("sem fornecedor conta os vazios", lista[lista.length - 1].n, 1);

/* ---- 2. o pedido ---- */
const doRivatti = linhas.filter((r) => M.chaveFornecedor(r.it) === "rivatti");
const pedido = M.itensDoPedido(doRivatti);
conf("o pedido não leva o que já foi comprado", pedido.reduce((a, g) => a + g.itens.length, 0), 3);
conf("as verbas vêm em ordem", pedido.map((g) => g.num).join(), "10,24");
conf("cada verba leva o nome", pedido[0].nome, "Verba 10");
conf("fornecedor todo comprado: pedido vazio", M.itensDoPedido([L("24", "X", { comprado: true })]).length, 0);

/* ---- 3. link colado no lugar do nome ---- */
conf("link vira o site", M.fornecedoresDasLinhas([L("24", "https://www.mercadolivre.com.br/espelho?x=1")])[0].nome, "mercadolivre.com.br");
conf("links do mesmo site caem juntos",
  M.fornecedoresDasLinhas([L("24", "https://www.mercadolivre.com.br/a"), L("24", "http://mercadolivre.com.br/b")]).length, 1);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
