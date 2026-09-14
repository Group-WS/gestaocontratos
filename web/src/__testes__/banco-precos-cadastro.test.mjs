/* O cadastro de insumos do Sienge no Banco de Preços.
 *
 * Roda com: node web/src/__testes__/banco-precos-cadastro.test.mjs
 *
 * A base guarda o preço das COMPRAS (relatório de pedidos). O cadastro de
 * insumos é outro relatório: traz todos os insumos, a maioria sem preço
 * de tabela. Este teste guarda três decisões:
 *
 *   1. o cadastro se reconhece pela coluna Ativo, e nele preço zero entra
 *      — o que importa é o insumo existir (é a base do "Associar insumos"
 *      e do Gerador); no relatório de pedidos, zero continua fora;
 *   2. inativo e "vb" ficam fora, e título de grupo não vira insumo;
 *   3. o cadastro SOMA: só entra o que não está na base, e o que já está
 *      não é tocado — escrever por cima trocaria preço pago por zero.
 *
 * As descrições são do cadastro real (Tabela WS BUILDING, set/2026).
 */
import fs from "node:fs";
import XLSX from "xlsx";

const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const lib = fs.readFileSync(new URL("../lib/insumos.js", import.meta.url), "utf8");
const bloco = (src, a) => {
  const i = src.indexOf(a);
  if (i === -1) throw new Error(`não achei: ${a}`);
  return src.slice(i, src.indexOf("\n}\n", i) + 3);
};
const M = new Function("XLSX", `
  const parseCSVLinhas = () => { throw new Error("csv"); };
  const lerTextoComAcento = parseCSVLinhas;
  ${["function semAcentos(", "function normTxt(", "function parseBRL(", "function acharColuna(", "function normalizarData(", "async function lerSiengeExcel("].map((a) => bloco(app, a)).join("\n")}
  ${["export function chaveDoInsumo(", "export function soOsNovos("].map((a) => bloco(lib, a).replace(/^export /, "")).join("\n")}
  return { lerSiengeExcel, soOsNovos, chaveDoInsumo };
`)(XLSX);

// Um arquivo de verdade, montado na memória: o leitor recebe o mesmo que recebe na tela.
const arquivo = (nome, linhas) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas), "Relatório");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return { name: nome, arrayBuffer: async () => buf };
};

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(56)} ${String(o).padEnd(12)} ${ok ? "" : "esperava " + e}`); };

const V = null;
const ARANDELA = "LUMINÁRIA - ARANDELA / DIMLUX / ARANDELA ML 110 TUB / PRETO";
const PENDENTE = "LUMINÁRIA - PENDENTES DECORATIVOS / BELLA / LINHA FOGLIA / OC003";

/* ---- 1. o cadastro, no formato que o Sienge exporta ---- */
const cadastro = await M.lerSiengeExcel(arquivo("relatorio.xlsx", [
  [V, V, "Insumos"],
  ["Tabela", V, V, "1 - TABELA WS BUILDING"],
  ["BDI", V, V, "Não aplicar", V, "Encargos sociais", V, V, "Não aplicar"],
  ["Grupo", V, V, "01 - DESPESAS GERAIS"],
  ["Família", V, V, "01.001 - Taxas, Impostos, Documentos Legais"],
  ["Código", "Descrição", V, V, V, V, "Unidade", V, V, "Preço unitário", "Data do preço", "Ativo"],
  [25, "DESPESA ALIMENTACAO", V, V, V, V, "mes", V, V, 40.12, "30/08/2024", "Sim"],
  [1, "CONSULTA DE VIABILIDADE", V, V, V, V, "vb", V, V, 0, "30/08/2024", "Sim"],
  // título de grupo no meio da lista, como no arquivo real
  ["Grupo", V, V, "30 - ILUMINAÇÃO"],
  [3063, ARANDELA, V, V, V, V, "un", V, V, 0, "30/08/2024", "Sim"],
  [4756, "MOLESKINE", V, V, V, V, "un", V, V, 0, "30/08/2024", "Não"],
  [3065, PENDENTE, V, V, V, V, "un", V, V, 120, "13/07/2020", "Sim"],
  [3065, PENDENTE, V, V, V, V, "un", V, V, 150, "30/08/2024", "Sim"],
  ["14/09/2026 - 17:28:00", V, V, V, "SIENGE / STARIAN"],
]));
const acha = (d) => cadastro.precos.find((p) => p.descricao === d);
conf("reconhece o cadastro pela coluna Ativo", cadastro.cadastro, true);
conf("insumo sem preço de tabela entra", !!acha(ARANDELA), true);
conf("... com preço zero, e não inventado", acha(ARANDELA)?.custoUnitario, 0);
conf("insumo com preço entra com o preço", acha("DESPESA ALIMENTACAO")?.custoUnitario, 40.12);
conf("inativo fica fora", !!acha("MOLESKINE"), false);
conf("... e é contado", cadastro.inativos, 1);
conf("vb fica fora e é contado", cadastro.descartadosVb, 1);
conf("título de grupo e rodapé não viram insumo", cadastro.precos.length, 3);
conf("repetido: fica o preço mais recente", acha(PENDENTE)?.custoUnitario, 150);
conf("... com a data dele", acha(PENDENTE)?.dataRef, "2024-08-30");
conf("o código vira texto", acha(ARANDELA)?.codigo, "3063");

/* ---- 2. o relatório de pedidos continua como era ---- */
const pedidos = await M.lerSiengeExcel(arquivo("pedidos.xlsx", [
  ["Insumo", "Descrição", "Unidade", "Preço unitário", "Data", "Fornecedor"],
  ["3063", ARANDELA, "un", 0, "01/08/2026", "Dimlux"],
  ["25", "DESPESA ALIMENTACAO", "mes", 40.12, "01/08/2026", "Padaria Central"],
]));
conf("sem coluna Ativo não é cadastro", pedidos.cadastro, false);
conf("no pedido, preço zero continua fora", pedidos.precos.length, 1);
conf("... e o fornecedor vem junto", pedidos.precos[0]?.fornecedor, "Padaria Central");

/* ---- 3. o cadastro soma: só o que falta entra ---- */
const naBase = new Set([M.chaveDoInsumo({ codigo: "25", descricao: "DESPESA ALIMENTACAO", unidade: "mes" })]);
const soma = M.soOsNovos(cadastro.precos, naBase);
conf("o que já está na base não entra de novo", soma.novos.some((p) => p.codigo === "25"), false);
conf("... e é contado como já existente", soma.jaExistiam, 1);
conf("o resto entra", soma.novos.length, 2);
conf("repetido no arquivo entra uma vez só",
  M.soOsNovos([{ codigo: "3063", descricao: ARANDELA, unidade: "un" }, { codigo: "3063", descricao: ARANDELA, unidade: "un" }], []).novos.length, 1);
// A chave precisa bater com a do banco: código é texto lá, e unidade vazia é ''.
conf("código número e texto são a mesma chave",
  M.chaveDoInsumo({ codigo: 25, descricao: "X", unidade: "un" }) === M.chaveDoInsumo({ codigo: "25", descricao: "X", unidade: "un" }), true);
conf("unidade ausente e vazia são a mesma chave",
  M.chaveDoInsumo({ codigo: "1", descricao: "X" }) === M.chaveDoInsumo({ codigo: "1", descricao: "X", unidade: "" }), true);
conf("base vazia: tudo é novo", M.soOsNovos(cadastro.precos, new Set()).novos.length, 3);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
