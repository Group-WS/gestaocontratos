/* A frase que abre o dia.
 *
 * Roda com: node web/src/__testes__/mensagem-do-dia.test.mjs
 *
 * O que este teste guarda não é o texto: é que a frase seja ESTÁVEL
 * dentro do dia. Sorteio puro daria frase diferente a cada F5, e recado
 * que muda quando a pessoa recarrega deixa de ser recado e vira ruído.
 */
import { mensagemDoDia, MENSAGENS } from "../lib/mensagemDoDia.js";

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(52)} ${String(o).slice(0, 20).padEnd(22)} ${ok ? "" : "esperava " + e}`); };

const dia = (a, m, d) => new Date(a, m - 1, d);

conf("mesma data, mesma frase", mensagemDoDia(dia(2026, 8, 31)), mensagemDoDia(dia(2026, 8, 31)));
conf("dia seguinte, frase diferente",
  mensagemDoDia(dia(2026, 8, 31)) !== mensagemDoDia(dia(2026, 9, 1)), true);
// A hora não pode entrar na conta: às 8h e às 18h é o mesmo dia.
conf("a hora não muda a frase",
  mensagemDoDia(new Date(2026, 7, 31, 8, 0)) === mensagemDoDia(new Date(2026, 7, 31, 18, 30)), true);

/* Um ano inteiro sem quebrar, e passando por todas as frases: se o índice
   estourasse a lista, o app abriria com "undefined" no lugar do recado. */
const vistas = new Set();
for (let i = 0; i < 365; i++) {
  const m = mensagemDoDia(new Date(2026, 0, 1 + i));
  if (typeof m !== "string" || !m) { f++; console.log("FALHOU  frase vazia no dia " + i); break; }
  vistas.add(m);
}
conf("um ano sem frase vazia", vistas.size > 0, true);
conf("todas as frases aparecem no ano", vistas.size, MENSAGENS.length);

// Data anterior a 1970 daria índice negativo, e lista[-3] é undefined.
conf("data antiga não quebra", typeof mensagemDoDia(dia(1969, 1, 1)), "string");

/* Não são citações: nenhuma frase pode se apresentar como fala de
   alguém. Atribuir aspas a uma pessoa real que não disse aquilo é
   inventar fala, e isso não se faz nem numa tela interna. */
conf("nenhuma frase cita alguém", MENSAGENS.some((m) => /musk|elon|" |disse/i.test(m)), false);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
