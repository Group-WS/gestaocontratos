/* Cabeçalho de planilha quebrado em duas linhas.
 *
 * Roda com: node web/src/__testes__/cabecalho-duas-linhas.test.mjs
 *
 * O criativo da obra 2405 escreve os títulos em duas alturas:
 *
 *   linha 0   ... Qtd. | un | Custo    | Custo       | Custo Total | Custo Total
 *   linha 1                   Material | Mão de Obra | Material    | Mão de Obra
 *
 * Lendo só a primeira, cinco colunas viram "Custo"/"Custo Total" e ficam
 * indistinguíveis — o app dizia "faltam Custo Material e Mão de Obra" num
 * Excel que tinha as duas, e sugeria subir o Excel (que já era o Excel).
 *
 * O risco do conserto é o oposto: confundir uma linha de DADO com
 * continuação de cabeçalho e engolir o primeiro item. Por isso os casos
 * negativos abaixo importam tanto quanto os positivos.
 */
const ehContinuacao = (row) => {
  if (!row) return false;
  const cels = row.map((c) => String(c ?? "").trim());
  if (/^\d/.test(cels[0] || "")) return false;
  const p = cels.filter((c) => c !== "" && c !== "0");
  return p.length > 0 && p.every((c) => c.length <= 22 && !/^[\d.,\s]+$/.test(c) && !/^R\$/.test(c));
};
const juntar = (a, b) => {
  const w = Math.max(a.length, b.length), out = [];
  for (let j = 0; j < w; j++)
    out[j] = [String(a[j] ?? "").trim(), String(b[j] ?? "").trim()].filter((x) => x && x !== "0").join(" ");
  return out;
};

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(46)} ${String(o).padEnd(24)} ${ok ? "" : "esperava " + e}`); };

// layout real da 2405
const l0 = ["Item","Descrição","Código / especificação / Obs.","Fornecedor","Ambiente","Qtd.","un","Custo","Custo","Custo Total","Custo Total","Custo","Observações"];
const l1 = ["","","","","","","","Material","Mão de Obra","Material","Mão de Obra","Total",""];

conf("linha 1 e continuacao", ehContinuacao(l1), true);
const h = juntar(l0, l1);
conf("coluna 7 vira Custo Material", h[7], "Custo Material");
conf("coluna 8 vira Custo Mão de Obra", h[8], "Custo Mão de Obra");
conf("coluna 9 vira Custo Total Material", h[9], "Custo Total Material");
conf("coluna 10 vira Custo Total Mão de Obra", h[10], "Custo Total Mão de Obra");
conf("coluna 1 nao duplica", h[1], "Descrição");

console.log("");
// NEGATIVOS: nada disso pode ser tratado como cabecalho, senao some um item
conf("linha de item NAO e continuacao", ehContinuacao(["2.1","Anotação de responsabilidade","0","Histórico de compra","0","1","vb","108.67"]), false);
conf("linha de grupo NAO e continuacao", ehContinuacao(["2","SERVIÇOS COMPLEMENTARES","0","0","0","0","0"]), false);
conf("linha vazia NAO e continuacao", ehContinuacao(["","","",""]), false);
conf("linha com R$ NAO e continuacao", ehContinuacao(["","","","R$ 1.234,56"]), false);
conf("linha so com numeros NAO e continuacao", ehContinuacao(["","","","12345"]), false);
conf("cabecalho de uma linha so fica intacto", ehContinuacao(undefined), false);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f ? 1 : 0);
