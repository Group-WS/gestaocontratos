/* Rateio de parcelas e medições — a lógica do Gerador de Escopos WS.
 *
 * Roda com: node web/src/__testes__/parcelas.test.mjs
 *
 * Isto vira valor de parcela em contrato assinado. A invariante que
 * importa: **a soma tem que fechar EXATO**. Um centavo sobrando é o
 * fornecedor cobrando a diferença; um centavo faltando é a empresa
 * pagando a mais, doze vezes, sem ninguém conferir.
 */
import {
  ratearParcelas, ratearMedicoes, ajustarQtdParcelas, reorganizarParcelas,
  sugerirDatas, somaParcelas, parcelasPadrao, naSexta,
} from "../lib/parcelas.js";

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(54)} ${String(o).padEnd(14)} ${ok ? "" : "esperava " + e}`); };

/* ---- 1. a soma fecha exato, sempre ---- */
// Valores escolhidos pra forçar dízima: 10.000/3, 12.345,67/7, 1/3.
const casos = [[3, 10000], [7, 12345.67], [12, 1], [2, 0.01], [5, 99999.99], [60, 7777.77], [1, 4321]];
casos.forEach(([n, total]) => {
  const p = ajustarQtdParcelas(parcelasPadrao(), n, total);
  conf(`${n} parcelas de ${total} fecham exato`, somaParcelas(p).toFixed(2), total.toFixed(2));
});

/* ---- 2. a última absorve o arredondamento ---- */
// É a regra do gerador original: as primeiras arredondam normal e a
// última recebe o que sobrou. Sem isso a soma erra por centavos.
const tres = ajustarQtdParcelas(parcelasPadrao(), 3, 10000);
conf("as três de 10.000", tres.map((x) => x.v).join(" "), "3333.33 3333.34 3333.33");

/* ---- 3. entrada digitada à mão é respeitada ---- */
// Quem negocia uma entrada maior não pode ver o sistema desfazer isso.
const comEntrada = ratearParcelas(
  [{ v: "5000" }, { v: "" }, { v: "" }], 12000, false);
conf("entrada de 5.000 fica", comEntrada[0].v, "5000.00");
conf("o resto divide os 7.000", comEntrada.slice(1).map((x) => x.v).join(" "), "3500.00 3500.00");
conf("e a soma continua exata", somaParcelas(comEntrada).toFixed(2), "12000.00");
// Entrada maior que o total seria parcela negativa nas outras.
const demais = ratearParcelas([{ v: "99999" }, { v: "" }], 1000, false);
conf("entrada acima do total é limitada", demais[0].v, "1000.00");
conf("... e não gera parcela negativa", Number(demais[1].v) >= 0, true);

/* ---- 4. medições: percentuais fecham 100 ---- */
const med = ratearMedicoes([{ p: "25", pBase: "25" }, { p: "50", pBase: "50" }, { p: "25", pBase: "25" }], 30);
conf("entrada de 30% aplicada", med[0].p, "30");
conf("as demais dividem proporcional ao original", med.slice(1).map((x) => x.p).join(" "), "46.67 23.33");
conf("os percentuais fecham 100", med.reduce((a, x) => a + Number(x.p), 0), 100);
// Mexer duas vezes não pode deformar: a conta usa o percentual ORIGINAL,
// não o resultado da passada anterior.
const duasVezes = ratearMedicoes(ratearMedicoes(med, 30), 30);
conf("mexer duas vezes dá o mesmo", duasVezes.map((x) => x.p).join(" "), med.map((x) => x.p).join(" "));

/* ---- 5. vencimento sempre em sexta ---- */
// A casa paga fornecedor na sexta. Data no meio da semana volta pro
// financeiro pra ser remarcada, e a data do contrato deixa de valer.
const dias = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
["2026-09-01", "2026-09-04", "2026-09-05", "2026-09-06"].forEach((d) => {
  const x = naSexta(new Date(`${d}T12:00:00`));
  conf(`${d} (${dias[new Date(`${d}T12:00:00`).getDay()]}) cai numa sexta`, dias[x.getDay()], "sex");
});
conf("sexta continua na mesma sexta",
  naSexta(new Date("2026-09-04T12:00:00")).getDate(), 4);

const comDatas = sugerirDatas(ajustarQtdParcelas(parcelasPadrao(), 4, 8000), "2026-09-01", 30);
conf("todas as datas são sexta",
  comDatas.every((p) => new Date(`${p.venc}T12:00:00`).getDay() === 5), true);
conf("as datas avançam", comDatas.map((p) => p.venc).join(" "),
  "2026-09-04 2026-10-02 2026-11-06 2026-12-04");
conf("sem 1º vencimento não inventa data", sugerirDatas(parcelasPadrao(), "", 30)[0].venc, "");

/* ---- 6. os dois formatos de número ---- */
// A pessoa digita "1.234,56"; o próprio rateio grava "1234.56".
conf("formato BR", somaParcelas([{ v: "1.234,56" }]), 1234.56);
conf("formato do toFixed", somaParcelas([{ v: "1234.56" }]), 1234.56);
conf("vazio não vira NaN", somaParcelas([{ v: "" }, { v: null }]), 0);

/* ---- 7. rótulos e limites ---- */
conf("primeira é a entrada", reorganizarParcelas([{}, {}])[0].rot, "1ª Parcela (entrada)");
conf("segunda é numerada", reorganizarParcelas([{}, {}])[1].rot, "2ª Parcela");
conf("rótulo escrito à mão sobrevive",
  reorganizarParcelas([{ rot: "Sinal combinado" }])[0].rot, "Sinal combinado");
conf("máximo de 60 parcelas", ajustarQtdParcelas(parcelasPadrao(), 999, 1000).length, 60);
conf("mínimo de 1", ajustarQtdParcelas(parcelasPadrao(), 0, 1000).length, 1);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
