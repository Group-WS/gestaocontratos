/* O resumo de uma importação, antes de aplicar (23/09/2026).
 *
 * Roda com: node web/src/__testes__/importacao-resumo.test.mjs
 *
 * Importar troca SÓ as verbas que vieram no arquivo; as outras ficam com a
 * importação anterior (decisão de 23/09/2026: manter e avisar). O aviso só
 * serve se contar a verdade — este teste prova que o resumo diz exatamente
 * o que `aplicarItensNasVerbas` vai fazer.
 */
import { resumoDaImportacao, linhasDoAviso, formatoDoArquivo } from "../lib/importacaoResumo.js";

let f = 0;
const conf = (n, o, e) => {
  const ok = JSON.stringify(o) === JSON.stringify(e);
  if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(60)} ${JSON.stringify(o).slice(0, 40).padEnd(40)} ${ok ? "" : "esperava " + JSON.stringify(e)}`);
};

const item = (num, extra = {}) => ({ num, desc: "x", ...extra });
const CATS = [
  { num: "02", nome: "Serviços Complementares", itensPlanilha: [item("02"), item("02"), item("02")] },
  { num: "05", nome: "Elétrica", itensPlanilha: [item("05")] },
  { num: "07", nome: "Incêndio", itensPlanilha: [item("07"), item("07")] },
  { num: "09", nome: "Gás", itensPlanilha: [] },
  { num: "—", nome: "AUTOMAÇÃO X", foraDaEapPadrao: true, itensPlanilha: [item(null, { foraDoPadrao: true })] },
];

/* ---- 1. Primeira importação: nada a avisar ---- */
const vazias = CATS.map((c) => ({ ...c, itensPlanilha: [] }));
let r = resumoDaImportacao(vazias, [item("02"), item("09")], "itensPlanilha");
conf("primeira importação: não havia conteúdo", r.haviaConteudo, false);
conf("... e as verbas do arquivo contam como trocadas", r.trocadas.map((v) => v.num), ["02", "09"]);

/* ---- 2. Reimportação parcial ---- */
r = resumoDaImportacao(CATS, [item("02"), item("09"), item("09")], "itensPlanilha");
conf("havia conteúdo", r.haviaConteudo, true);
conf("itens do arquivo", r.nItens, 3);
conf("itens de antes (todas as verbas, fora do padrão inclusive)", r.itensAntes, 7);
conf("trocadas: só as que vieram no arquivo", r.trocadas.map((v) => [v.num, v.antes, v.depois]), [["02", 3, 1], ["09", 0, 2]]);
conf("mantidas: tinham itens e não vieram", r.mantidas.map((v) => [v.num, v.itens]), [["05", 1], ["07", 2], ["—", 1]]);
conf("verba vazia que não veio não aparece em nada",
  [...r.trocadas, ...r.mantidas].some((v) => v.num === "09" && v.itens === 0), false);

/* ---- 3. Grupo fora da EAP: casa pelo nome ---- */
r = resumoDaImportacao(CATS, [item(null, { foraDoPadrao: true, grupoOriginal: "AUTOMAÇÃO X" }),
  item(null, { foraDoPadrao: true, grupoOriginal: "SONORIZAÇÃO" })], "itensPlanilha");
conf("grupo fora que já existia é trocado",
  r.trocadas.find((v) => v.nome === "AUTOMAÇÃO X"), { num: "—", nome: "AUTOMAÇÃO X", antes: 1, depois: 1 });
conf("grupo fora novo entra como trocado, sem itens antes",
  r.trocadas.find((v) => v.nome === "SONORIZAÇÃO"), { num: "—", nome: "SONORIZAÇÃO", antes: 0, depois: 1 });

/* ---- 4. Contrato: verba com valor e sem item também é tocada ---- */
r = resumoDaImportacao(CATS, [], "itensPlanilha", ["05"]);
conf("verba só com valor (numsExtras) conta como trocada", r.trocadas.map((v) => [v.num, v.depois]), [["05", 0]]);

/* ---- 5. O texto do aviso ---- */
r = resumoDaImportacao(CATS, [item("02")], "itensPlanilha");
const linhas = linhasDoAviso(r);
conf("abre com o que chega e o que havia", linhas[0], "O arquivo traz 1 item. Hoje a obra tem 7 itens deste documento.");
conf("diz o que é trocado", linhas[1], "Serão trocadas 1 verba: 02 Serviços Complementares.");
conf("e o que fica, com a contagem",
  linhas[2], "Ficam como estão 3 verbas que não vieram no arquivo (4 itens da importação anterior): 05 Elétrica, 07 Incêndio, AUTOMAÇÃO X.");
const muitas = resumoDaImportacao(
  Array.from({ length: 10 }, (_, i) => ({ num: String(i + 10), nome: `V${i}`, itensPlanilha: [item(String(i + 10))] })),
  [], "itensPlanilha", ["99"]);
conf("lista longa corta e diz quantas faltam", /e mais 4\.$/.test(linhasDoAviso(muitas).at(-1)), true);
const tudo = resumoDaImportacao(CATS.slice(0, 2), [item("02"), item("05")], "itensPlanilha");
conf("quando nada fica, diz isso", linhasDoAviso(tudo)[2], "Nenhuma verba fica com dado da importação anterior.");

/* ---- 6. Formato ---- */
conf("extensão do arquivo", [formatoDoArquivo("Planilha Final.XLSX"), formatoDoArquivo("contrato.pdf"), formatoDoArquivo("sem")], ["xlsx", "pdf", null]);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exitCode = f === 0 ? 0 : 1;
