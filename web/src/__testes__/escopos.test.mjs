/* Os 24 modelos de escopo, extraídos do Gerador de Escopos WS.
 *
 * Roda com: node web/src/__testes__/escopos.test.mjs
 *
 * O que está em jogo: este é o texto que vira contrato assinado. Um
 * modelo que perdeu as medições no caminho da extração gera um contrato
 * sem forma de pagamento, e ninguém percebe até alguém cobrar.
 */
import { MODELOS_ESCOPO, modelosPorGrupo, modeloSugerido } from "../lib/escopos.js";

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(54)} ${String(o).padEnd(12)} ${ok ? "" : "esperava " + e}`); };

const ids = Object.keys(MODELOS_ESCOPO);
conf("os 24 modelos vieram", ids.length, 24);
conf("pintura está entre eles", !!MODELOS_ESCOPO["pintura-concluido"], true);

/* ---- todo modelo precisa do mínimo pra virar contrato ---- */
const semNome = ids.filter((id) => !MODELOS_ESCOPO[id].nome);
const semBanda = ids.filter((id) => !MODELOS_ESCOPO[id].banda);
const semItens = ids.filter((id) => !(MODELOS_ESCOPO[id].itens || []).length);
conf("nenhum modelo sem nome", semNome.length, 0);
conf("nenhum modelo sem banda", semBanda.length, 0);
// Nenhum vem vazio — nem o "personalizado", que traz a estrutura base.
conf("nenhum modelo chegou sem itens", semItens.join(",") || "nenhum", "nenhum");

/* ---- forma de pagamento: percentuais têm que fechar 100 ---- */
// Percentual que não fecha é dinheiro a mais ou fornecedor sem receber.
const somaP = (m) => (m.medicoes || []).reduce((a, x) => a + (parseFloat(String(x.p).replace(",", ".")) || 0), 0);
const comMedicao = ids.filter((id) => (MODELOS_ESCOPO[id].medicoes || []).length);
const naoFecham = comMedicao.filter((id) => Math.round(somaP(MODELOS_ESCOPO[id])) !== 100);
conf("todo modelo trouxe forma de pagamento",
  ids.filter((id) => !(MODELOS_ESCOPO[id].medicoes || []).length).join(",") || "todos têm", "todos têm");
conf("os percentuais fecham 100% em todos", naoFecham.join(",") || "nenhum", "nenhum");

/* ---- cada medição precisa dizer QUANDO é paga ---- */
const semCond = [];
comMedicao.forEach((id) => (MODELOS_ESCOPO[id].medicoes || []).forEach((m) => {
  if (!m.cond || !m.rot) semCond.push(id);
}));
conf("toda medição tem rótulo e condição", [...new Set(semCond)].join(",") || "todas têm", "todas têm");

/* ---- a sugestão por verba ---- */
conf("verba 18 sugere pintura", modeloSugerido("18"), "pintura-concluido");
conf("verba 10 sugere gesso", modeloSugerido("10"), "gesso");
conf("verba 26 sugere marmoraria", modeloSugerido("26"), "marmoraria");
// Errar pro lado de não sugerir: modelo errado escolhido sozinho vira
// contrato errado, e ninguém revisa o que o sistema já preencheu.
conf("verba sem modelo não sugere nada", modeloSugerido("02"), null);
conf("verba inexistente não sugere", modeloSugerido("99"), null);
// Toda sugestão tem que apontar pra um modelo que existe de verdade.
const sugeridos = ["05","06","09","10","11","13","18","19","20","21","22","23","25","26","28","30"]
  .map(modeloSugerido).filter(Boolean);
conf("toda sugestão aponta pra modelo real",
  sugeridos.filter((id) => !MODELOS_ESCOPO[id]).length, 0);

/* ---- agrupamento pra tela de escolha ---- */
const grupos = modelosPorGrupo();
conf("os modelos vêm agrupados", grupos.length >= 6, true);
conf("nenhum modelo fica de fora do agrupamento",
  grupos.reduce((a, g) => a + g.itens.length, 0), ids.length);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
