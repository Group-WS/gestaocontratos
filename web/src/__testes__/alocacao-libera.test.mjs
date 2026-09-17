/* Corrigir a alocação não manda o item para a fila de liberação.
 *
 * Roda com: node web/src/__testes__/alocacao-libera.test.mjs
 *
 * Pedido dela em 17/09/2026: "quando muda a alocação de recurso no plano de
 * compras ele pede uma liberacao. corrija isso, nao precisa liberar
 * novamente."
 *
 * O porquê: mão de obra não aparece na fila de liberação (vai para
 * Contratos). Mudando para material, o item entra no fluxo de compra pela
 * primeira vez e, sem carimbo, nascia "a liberar". A decisão dela foi que
 * ele entra já liberado.
 *
 * As duas coisas que não podem quebrar:
 *   1. o carimbo NÃO sobrescreve quem liberou antes. Se a liberação já
 *      existe, a alocação não encosta nela — senão a correção de alocação
 *      apagaria o nome de quem respondeu pela compra.
 *   2. mão de obra continua SEM liberação. Liberar MO para compra colocaria
 *      na fila de produtos algo que é contrato.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "App.jsx"), "utf8");
const trecho = (de, ate) => {
  const i = src.indexOf(de), f = src.indexOf(ate);
  if (i === -1 || f === -1) throw new Error(`não achei o intervalo: ${de} .. ${ate}`);
  return src.slice(i, f);
};
const bloco = (assinatura, fim = "\n}\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei no App.jsx: ${assinatura}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};

const M = eval(`(function () {
  const padraoDaDescricao = () => null;
  const verbaPorNome = () => null;
  const eapPadrao = () => [];
  ${trecho("const ALOC_MAT =", "/* =====[ FIM DO MODELO PURO")}
  ${bloco("function parcelasDaPlanilha(")}
  ${bloco("function liberadoParaCompra(")}
  ${bloco("function liberacaoAoRealocar(")}
  return { liberacaoAoRealocar, liberadoParaCompra, alocacaoDoItem, ALOC_MAT, ALOC_MO, ALOC_AMBOS };
})()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(60)} ${String(o).padEnd(24)} ${ok ? "" : "esperava " + e}`); };

const quem = { em: "2026-09-17T18:00:00Z", por: "priscila.wayhs@groupws.com.br" };

/* ---- 1. O caso dela: mão de obra que passa a ser material ---- */
const eraMO = { desc: "Limpeza de obra", custoMO: 800 };
const carimbo = M.liberacaoAoRealocar(eraMO, M.ALOC_MAT, quem);
conf("item que virou material entra liberado", !!carimbo, true);
conf("com a data", carimbo?.em, quem.em);
conf("com quem mudou", carimbo?.por, quem.por);
conf("e marcado como vindo da alocação", carimbo?.viaAlocacao, true);
conf("depois do carimbo ele conta como liberado",
  M.liberadoParaCompra({ ...eraMO, liberadoCompra: carimbo }), true);

/* ---- 2. MAT+MO também se compra ----
   No Plano, tudo que não é MO é comprável — MAT+MO inclusive. */
conf("MAT+MO entra liberado", !!M.liberacaoAoRealocar(eraMO, M.ALOC_AMBOS, quem), true);

/* ---- 3. Mão de obra não se libera ---- */
conf("virar mão de obra não libera", M.liberacaoAoRealocar({ desc: "x", custo: 10 }, M.ALOC_MO, quem), null);

/* ---- 4. NÃO SOBRESCREVE QUEM LIBEROU ANTES ---- */
const jaLiberado = { desc: "Cuba", liberadoCompra: { em: "2026-09-10T10:00:00Z", por: "barbara.franco@groupws.com.br" } };
conf("item já liberado fica como está", M.liberacaoAoRealocar(jaLiberado, M.ALOC_MAT, quem), null);
conf("item com canal escolhido fica como está",
  M.liberacaoAoRealocar({ desc: "x", canalCompra: "sienge" }, M.ALOC_MAT, quem), null);
conf("item comprado fica como está",
  M.liberacaoAoRealocar({ desc: "x", comprado: true }, M.ALOC_MAT, quem), null);
conf("item solicitado fica como está",
  M.liberacaoAoRealocar({ desc: "x", solicitado: true }, M.ALOC_MAT, quem), null);
conf("compra avulsa fica como está",
  M.liberacaoAoRealocar({ desc: "x", avulso: true }, M.ALOC_MAT, quem), null);

/* ---- 5. Linha que não é item ---- */
conf("título não recebe liberação", M.liberacaoAoRealocar({ desc: "TÍTULO", ehTitulo: true }, M.ALOC_MAT, quem), null);
conf("item undefined não quebra", M.liberacaoAoRealocar(undefined, M.ALOC_MAT, quem), null);
conf("sem dados de quem, não quebra", !!M.liberacaoAoRealocar(eraMO, M.ALOC_MAT), true);

/* ---- 6. LIMPAR a correção manual ----
   Tirar a alocação manual devolve o item às regras de parcela. Um item que
   volta a ser mão de obra não pode sair liberado — é por isso que a tela
   passa a alocação EFETIVA, e não o valor cru do menu. */
const soMO = { desc: "Instalação", qtdExecutivo: 1, custoMO: 500, custoMaterial: 0 };
conf("sem correção manual, só MO deriva MO", M.alocacaoDoItem({ ...soMO, alocacaoManual: null }), M.ALOC_MO);
conf("e por isso não libera",
  M.liberacaoAoRealocar(soMO, M.alocacaoDoItem({ ...soMO, alocacaoManual: null }), quem), null);
const soMat = { desc: "Torneira", qtdExecutivo: 1, custoMaterial: 400, custoMO: 0 };
conf("sem correção manual, só material deriva MAT", M.alocacaoDoItem({ ...soMat, alocacaoManual: null }), M.ALOC_MAT);

/* ---- 7. A tela usa a alocação efetiva, e grava num patch só ----
   Dois updateItem seguidos no mesmo item fazem o segundo ler o estado
   velho: a liberação sairia sem a alocação, ou a alocação sem a liberação. */
conf("definirAlocacao pergunta pela alocação efetiva",
  /liberacaoAoRealocar\(item, alocacaoDoItem\(depois, obra\?\.categorias\?\.\[catIdx\]\)/.test(src), true);
conf("os dois campos vão no mesmo patch",
  src.includes("? { alocacaoManual: valor, liberadoCompra: carimbo }"), true);

/* ---- 8. O histórico conta de onde veio essa liberação ----
   Ela não passou pela conferência. Quem olhar depois precisa saber. */
conf("o histórico marca a liberação por alocação",
  src.includes(`detalhe: it.liberadoCompra?.viaAlocacao ? "ao corrigir a alocação" : null`), true);

/* ---- 9. A regra continua fora da lista que derruba aprovação ----
   Se `alocacaoManual` entrasse ali, mudar a alocação apagaria a aprovação
   do cliente — o contrário do pedido. */
const lista = trecho("const CAMPOS_QUE_DERRUBAM_APROVACAO = [", "];");
conf("alocação não derruba a aprovação", lista.includes("alocacaoManual"), false);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
