/* "Entrou ou saiu": a diferença entre a Vendido Planilha e o Executivo.
 *
 * Roda com: node web/src/__testes__/entrou-saiu.test.mjs
 *
 * Pergunta dela em 17/09/2026: "confirme se aqui nesse entrou e saiu a regra
 * ta correta. tem que mostrar exatamente a diferença entre o vendido planilha
 * e o executivo... a ideia é ver se precisa lançar aditivo para o cliente."
 *
 * O QUE ESTE CARTÃO É: a lista de itens que existem em UM documento e não no
 * outro — mais as trocas de produto. É item que apareceu ou sumiu.
 *
 * O QUE ELE NÃO É, e está fixado aqui de propósito: ele NÃO mostra item que
 * ficou nos dois com quantidade ou valor diferente. Essa linha entra em
 * "Conferido", porque em 16/09/2026 ela decidiu que "Divergente" deixaria de
 * ser pendência (`if (status === "diferente") status = "ok"` em
 * `linhaConfExecutivo`). Para a pergunta do aditivo isso importa: 10 luminárias
 * que viraram 14 são cobráveis e não aparecem neste cartão.
 */
import fs from "node:fs";

const src = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const bloco = (a, fim = "\n}\n") => {
  const i = src.indexOf(a);
  if (i === -1) throw new Error(`não achei no App.jsx: ${a}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};
const linha = (a) => {
  const i = src.indexOf(a);
  if (i === -1) throw new Error(`não achei no App.jsx: ${a}`);
  return src.slice(i, src.indexOf("\n};", i) + 3);
};

const M = eval(`(function () {
  ${linha("const detalheDaPlanilha =")}
  ${bloco("function resumoEntrouSaiu(")}
  return { resumoEntrouSaiu, detalheDaPlanilha };
})()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(58)} ${String(o).slice(0, 38).padEnd(40)} ${ok ? "" : "esperava " + e}`); };

const verba = { num: "05", nome: "Instalações Elétricas e Iluminação" };
const item = (extra) => ({ un: "un", qtdVendida: 1, custo: 100, ...extra });

/* ---- 1. O que entrou, o que saiu ---- */
const r = M.resumoEntrouSaiu([
  // só no executivo: entrou
  { verba, planilhaVendido: null, planilhaExecutivo: item({ desc: "Spot LOYO Duplo", qtdVendida: 4, custo: 3676, codigo: "05.7", especificacao: "GU10 AR70", marca: "LOYO" }) },
  // só no vendido: saiu
  { verba, planilhaVendido: item({ desc: "Arandela antiga", custo: 500, codigo: "V-12", marca: "Dimlux" }), planilhaExecutivo: null },
  // nos dois, igual: não é nem um nem outro
  { verba, planilhaVendido: item({ desc: "Fita LED" }), planilhaExecutivo: item({ desc: "Fita LED" }) },
]);
conf("item só do executivo entra como ENTROU", r.nEntrou, 1);
conf("item só do vendido entra como SAIU", r.nSaiu, 1);
conf("item igual nos dois não entra em nenhum", r.nEntrou + r.nSaiu, 2);
conf("soma o valor do que entrou", r.totEntrou, 3676);
conf("e do que saiu", r.totSaiu, 500);
conf("agrupa por verba", r.grupos[0]?.num, "05");

/* ---- 2. O DETALHE DA PLANILHA (pedido dela, 17/09/2026) ----
   Código, especificação e fornecedor, do lado que existe. */
const entrou = r.grupos[0].entrou[0];
conf("o código vem junto", entrou.codigo, "05.7");
conf("a especificação também", entrou.espec, "GU10 AR70");
conf("e o fornecedor", entrou.fornecedor, "LOYO");
const saiu = r.grupos[0].saiu[0];
conf("no que saiu, o detalhe vem do vendido", saiu.codigo, "V-12");
conf("... com o fornecedor dele", saiu.fornecedor, "Dimlux");
conf("item sem detalhe não inventa nada", M.resumoEntrouSaiu([
  { verba, planilhaVendido: null, planilhaExecutivo: item({ desc: "X" }) },
]).grupos[0].entrou[0].codigo, "null");

/* ---- 3. Troca de produto: sai um, entra outro, com o par escrito ---- */
const troca = M.resumoEntrouSaiu([
  { verba, planilhaVendido: item({ desc: "Pendente antigo" }),
    planilhaExecutivo: item({ desc: "Pendente antigo", excluido: true, substituidoPorDesc: "Pendente Bella", vendido: { qtd: 1, custo: 900 } }) },
  { verba, planilhaVendido: null,
    planilhaExecutivo: item({ desc: "Pendente Bella", custo: 1200, substitui: true, substituiDesc: "Pendente antigo", codigo: "05.9" }) },
]);
conf("o trocado sai", troca.nSaiu, 1);
conf("... dizendo por quem foi trocado", troca.grupos[0].saiu[0].trocadoPor, "Pendente Bella");
conf("o novo entra", troca.nEntrou, 1);
conf("... dizendo no lugar de quem", troca.grupos[0].entrou[0].noLugarDe, "Pendente antigo");
conf("o valor que sai é o VENDIDO, não o do executivo", troca.totSaiu, 900);

/* ---- 4. Criado e apagado no executivo não conta ----
   Nunca foi vendido ao cliente: não entrou nem saiu da venda. */
const fantasma = M.resumoEntrouSaiu([
  { verba, planilhaVendido: null, planilhaExecutivo: item({ desc: "Linha de teste", excluido: true, manual: true }) },
]);
conf("item criado e apagado no executivo não conta", fantasma.nEntrou + fantasma.nSaiu, 0);

/* ---- 5. O BURACO, FIXADO DE PROPÓSITO ----
   Quantidade e valor diferentes NÃO aparecem aqui. Para a pergunta do
   aditivo, isto é o que o cartão não responde sozinho. */
const qtdMudou = M.resumoEntrouSaiu([
  { verba, planilhaVendido: item({ desc: "Luminária", qtdVendida: 10, custo: 1000 }),
    planilhaExecutivo: item({ desc: "Luminária", qtdVendida: 14, custo: 1400 }) },
]);
conf("quantidade que mudou NÃO aparece em entrou/saiu", qtdMudou.nEntrou + qtdMudou.nSaiu, 0);
conf("... nem no valor somado", qtdMudou.totEntrou + qtdMudou.totSaiu, 0);
/* E a linha dessas vira "Conferido" na tela — decisão dela de 16/09/2026. */
conf("a tela transforma 'diferente' em 'ok'", /if \(status === "diferente"\) status = "ok";/.test(src), true);

/* ---- 6. Obra vazia não quebra ---- */
conf("cruzamento vazio não quebra", M.resumoEntrouSaiu([]).nEntrou, 0);
conf("cruzamento undefined não quebra", M.resumoEntrouSaiu(undefined).nSaiu, 0);

/* ---- 7. A tela mostra o detalhe ---- */
conf("a linha desenha o detalhe", src.includes(`{[it.codigo, it.espec, it.fornecedor].filter(Boolean).join(" · ")}`), true);
conf("e o CSS dele existe", src.includes(".es-det {"), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
