/* A trava de edição vence, e a tela tem que concordar com isso.
 *
 * Roda com: node web/src/__testes__/trava-vencida.test.mjs
 *
 * Em 17/09/2026 a tarja dentro da obra dizia "alexandre está editando desde
 * 10:47" às 13:02 — 136 minutos depois, com o cadeado da barra lateral já
 * apagado. O vencimento estava aplicado ao ASSUMIR a trava (`pegarEdicao`) e
 * ao listar o cadeado (`listarTravas`), mas não ao LER a obra. Quem olhava
 * achava que não podia mexer, e podia.
 *
 * O arquivo é fatiado em vez de importado: `dadosObra.js` puxa o cliente do
 * Supabase logo na primeira linha, e o Node não resolve esse import fora do
 * Vite.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "lib", "dadosObra.js"), "utf8");
const bloco = (assinatura, fim = "\n}\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei em dadosObra.js: ${assinatura}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};
const linha = (comeco) => {
  const i = src.indexOf(comeco);
  if (i === -1) throw new Error(`não achei em dadosObra.js: ${comeco}`);
  return src.slice(i, src.indexOf("\n", i) + 1);
};

const M = eval(`(function () {
  ${linha("export const MINUTOS_ATE_TRAVA_EXPIRAR").replace("export ", "")}
  ${bloco("export function travaViva(").replace("export ", "")}
  return { travaViva, MINUTOS_ATE_TRAVA_EXPIRAR };
})()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(58)} ${String(o).padEnd(12)} ${ok ? "" : "esperava " + e}`); };

const minutosAtras = (m) => new Date(Date.now() - m * 60_000).toISOString();

conf("prazo continua 30 minutos", M.MINUTOS_ATE_TRAVA_EXPIRAR, 30);
conf("acabou de pegar, vale", M.travaViva(new Date().toISOString()), true);
conf("29 minutos, ainda vale", M.travaViva(minutosAtras(29)), true);
conf("31 minutos, venceu", M.travaViva(minutosAtras(31)), false);
conf("o caso real (136 min) venceu", M.travaViva(minutosAtras(136)), false);

/* Sem data não há trava: `liberarEdicao` zera os dois campos juntos, e linha
   antiga pode ter e-mail sem data. Nos dois casos a obra está livre. */
conf("sem data, não é trava", M.travaViva(null), false);
conf("data vazia, não é trava", M.travaViva(""), false);
conf("data undefined, não é trava", M.travaViva(undefined), false);
conf("data sem sentido, não é trava", M.travaViva("qualquer coisa"), false);

/* Relógio adiantado no cliente devolveria data no futuro. Ainda é trava viva:
   soltar cedo demais deixa duas pessoas gravando por cima uma da outra, que é
   pior do que esperar. */
conf("data no futuro ainda é trava", M.travaViva(minutosAtras(-5)), true);

/* A leitura da obra tem que usar a mesma régua do cadeado da lista lateral —
   é a divergência entre as duas que criou o caso de 17/09. */
conf("a leitura da obra aplica a régua", /editandoPor: travaViva\(/.test(src), true);
conf("listarTravas continua filtrando por data", /gte\("editando_desde", limite\)/.test(src), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
