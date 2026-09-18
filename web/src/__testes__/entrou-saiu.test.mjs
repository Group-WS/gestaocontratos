/* "Entrou ou saiu": a diferença entre a Vendido Planilha e o Executivo.
 *
 * Roda com: node web/src/__testes__/entrou-saiu.test.mjs
 *
 * Pergunta dela em 17/09/2026: "confirme se aqui nesse entrou e saiu a regra
 * ta correta. tem que mostrar exatamente a diferença entre o vendido planilha
 * e o executivo... a ideia é ver se precisa lançar aditivo para o cliente."
 *
 * O QUE ESTE CARTÃO É, depois da resposta dela ("pode fazer, adicionar a lista
 * de mudou quantidade ou valor"): TUDO que mudou em relação ao vendido, em três
 * listas — o que entrou, o que saiu, e o que ficou com outra quantidade ou
 * valor. Juntas, são exatamente o que se cobra do cliente num aditivo.
 *
 * A terceira lista nasceu de um buraco: a linha que mudou de número virava
 * "Conferido" (`if (status === "diferente") status = "ok"` em
 * `linhaConfExecutivo`, decisão dela de 16/09 para não travar a esteira) e
 * sumia da vista. Dez luminárias que viraram catorze são cobráveis igual a um
 * item novo.
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

/* ---- 5. MUDOU DE QUANTIDADE OU VALOR (pedido dela, 17/09/2026) ----
   Era o buraco: item que ficou nos dois documentos com outro tamanho não
   aparecia em lugar nenhum deste cartão, porque em 16/09 "Divergente" virou
   "Conferido". Dez luminárias que viraram catorze são cobráveis igual a um
   item novo — e é essa a pergunta que o cartão existe para responder. */
const mud = M.resumoEntrouSaiu([
  { verba, planilhaVendido: item({ desc: "Luminária", qtdVendida: 10, custo: 1000, codigo: "V-1" }),
    planilhaExecutivo: item({ desc: "Luminária", qtdVendida: 14, custo: 1400, codigo: "05.1", marca: "Stella" }) },
  { verba, planilhaVendido: item({ desc: "Perfil", qtdVendida: 5, custo: 800 }),
    planilhaExecutivo: item({ desc: "Perfil", qtdVendida: 5, custo: 500 }) },
  // mesma coisa dos dois lados: não entra
  { verba, planilhaVendido: item({ desc: "Fita", qtdVendida: 2, custo: 300 }),
    planilhaExecutivo: item({ desc: "Fita", qtdVendida: 2, custo: 300 }) },
]);
conf("item que cresceu entra em MUDOU", mud.nMudou, 2);
conf("o que não mexeu fica fora", mud.grupos[0].mudou.some((x) => x.desc === "Fita"), false);
conf("guarda o de/para da quantidade", `${mud.grupos[0].mudou[0].qtdDe}→${mud.grupos[0].mudou[0].qtdPara}`, "10→14");
conf("e o de/para do valor", `${mud.grupos[0].mudou[0].valorDe}→${mud.grupos[0].mudou[0].valorPara}`, "1000→1400");
conf("a diferença é o que vai pro aditivo", mud.grupos[0].mudou[0].dif, 400);
conf("linha que encolheu tem diferença negativa", mud.grupos[0].mudou[1].dif, -300);
conf("o total do que mudou é SALDO, não módulo", mud.totMudou, 100);
conf("o detalhe vem do executivo", mud.grupos[0].mudou[0].codigo, "05.1");
conf("... com o fornecedor dele", mud.grupos[0].mudou[0].fornecedor, "Stella");
conf("diz o que mudou: quantidade", mud.grupos[0].mudou[0].mudouQtd, true);
conf("... e valor", mud.grupos[0].mudou[0].mudouValor, true);
conf("só o valor mudando também conta", mud.grupos[0].mudou[1].mudouQtd, false);

/* Um centavo é arredondamento de conversão, não mudança de escopo. */
const centavo = M.resumoEntrouSaiu([
  { verba, planilhaVendido: item({ desc: "X", qtdVendida: 1, custo: 1000 }),
    planilhaExecutivo: item({ desc: "X", qtdVendida: 1, custo: 1000.005 }) },
]);
conf("meio centavo não vira linha", centavo.nMudou, 0);
conf("... e a verba sem nada some da lista", centavo.grupos.length, 0);

/* O que entrou/saiu NÃO pode virar "mudou" — seriam contados duas vezes. */
conf("quem entrou não aparece também em mudou", r.grupos[0].mudou.length, 0);

/* O SALDO conta as três coisas: item que cresceu pesa igual a item novo. */
conf("o saldo do painel soma entrou, saiu e mudou",
  src.includes("const saldo = totEntrou - totSaiu + totMudou;"), true);

/* ---- 6. Obra vazia não quebra ---- */
conf("cruzamento vazio não quebra", M.resumoEntrouSaiu([]).nEntrou, 0);
conf("cruzamento undefined não quebra", M.resumoEntrouSaiu(undefined).nSaiu, 0);

/* ---- 7. A tela mostra o detalhe ---- */
conf("a linha desenha o detalhe", src.includes(`{[it.codigo, it.espec, it.fornecedor].filter(Boolean).join(" · ")}`), true);
conf("e o CSS dele existe", src.includes(".es-det {"), true);
conf("a lista do que mudou é desenhada", /\{g\.mudou\.map\(\(it, i\) => <LinhaMudou/.test(src), true);
conf("com o de/para do valor na linha", src.includes("valor: {fmtBRL(it.valorDe)} → {fmtBRL(it.valorPara)}"), true);
/* Os três números viraram filtros em 18/09/2026: "habilitar esse entrou mudou
   e saiu para quando clicar neles filtrar na tela". Entrou e mudou peneiram a
   planilha; saiu abre o painel, porque ele não existe na planilha. */
conf("o cartão mostra o terceiro número", /~\{resumoEntrouSaiu\.nMudou\}/.test(src), true);
conf("e os três filtram ao clicar", src.includes(`setFiltro(filtro === "es_entrou" ? "todos" : "es_entrou")`), true);
conf("o 'saiu' abre o painel, que é onde ele existe", src.includes(`setFiltro(filtro === "somente_um" ? "todos" : "somente_um")`), true);
conf("e o rótulo do cartão diz as três coisas", src.includes('label: "Entrou, saiu ou mudou"'), true);
conf("o CSS da linha nova existe", src.includes(".es-linha.mudou {"), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
