/* Remover item do executivo pede justificativa.
 *
 * Roda com: node web/src/__testes__/remocao-justificada.test.mjs
 *
 * Pedido dela em 18/09/2026 (ADR-005, fatia 3): "Sempre que for removido um
 * item, precisa abrir o campo de observacao abaixo para justificativa. Essa
 * observacao tem que aparecer na tela de conferencia executivo."
 *
 * Por que é campo obrigatório e não um "tem certeza?": remover item do
 * executivo tira dinheiro da obra e some com a linha das telas de compra.
 * Quem olhar depois — o cliente, o executivo, a Mehoo — precisa achar o porquê
 * sem perguntar para ninguém.
 *
 * Duas coisas aqui não podem quebrar:
 *   1. o AUTOR é carimbado por quem grava, não pela tela — não pode existir
 *      caminho em que a justificativa chega sem nome.
 *   2. trazer de volta LIMPA a justificativa: ela valia para aquela remoção,
 *      não para sempre.
 */
import fs from "node:fs";

const src = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(58)} ${String(o).padEnd(10)} ${ok ? "" : "esperava " + e}`); };

/* ---- 1. O botão abre o campo, não exclui ---- */
conf("o botão de remover abre a justificativa",
  src.includes("onClick={() => (it.excluido\n                                          ? onEditarItem(c.num, i, { excluido: false })\n                                          : setRemovendo(`${c.num}:${i}`))}"), true);
conf("e a dica diz que vai pedir motivo",
  src.includes('rotulo={it.excluido ? "Trazer de volta" : "Remover do executivo (pede justificativa)"}'), true);
conf("o campo abre embaixo da linha que vai sair", src.includes(`<TableRow className="bg-danger/10 hover:bg-danger/10">`), true);

/* ---- 2. Sem texto não remove ---- */
conf("o motivo é obrigatório", src.includes("const vale = motivo.trim().length >= 10;"), true);
conf("e o botão fica travado sem ele", src.includes('<Button variant="danger" type="button" disabled={!vale}'), true);
conf("a tela diz o que falta", src.includes("Escreva o motivo para remover."), true);

/* ---- 3. QUEM GRAVA CARIMBA O AUTOR ----
   Se o nome viesse da tela, bastaria um caminho novo chamando `onEditarItem`
   com `excluido: true` para a justificativa chegar sem autor. */
conf("o autor é carimbado por quem grava",
  src.includes("patch = { ...patch, excluido: true, excluidoPor: usuario, excluidoEm: new Date().toISOString() };"), true);
conf("a tela só manda o motivo", src.includes("onEditarItem(c.num, i, { excluidoMotivo: motivo });"), true);

/* ---- 4. Trazer de volta limpa tudo ---- */
conf("desfazer limpa a justificativa",
  src.includes("patch = { ...patch, excluidoMotivo: null, excluidoPor: null, excluidoEm: null };"), true);

/* ---- 5. E aparece na Conf. Executivo ---- */
conf("a Conf. Executivo mostra a justificativa", src.includes("Removido do executivo"), true);
conf("... com quem removeu", src.includes("{x.it.excluidoPor ? <span className=\"text-text-mute\"> · {x.it.excluidoPor}</span> : null}"), true);
conf("... e diz quando não tem (removido antes desta regra)",
  src.includes("sem justificativa registrada"), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
