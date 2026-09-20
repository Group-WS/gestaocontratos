/* Espaco e raio saem de uma grade, nao de um numero escolhido a olho.
 *
 * Roda com: node web/src/__testes__/css-escala-de-geometria.test.mjs
 *
 * Ate' 20/09/2026 o app usava TODO inteiro de 1px a 20px como espacamento
 * — 26 valores distintos — e 14 raios diferentes, incluindo 3, 5, 7 e 9px.
 * Nada disso se ve' de perto: o que se ve' e' que nada rima com nada, e um
 * app sem ritmo parece montado a mao.
 *
 * A grade do espaco:
 *   1 e 2px  ficam como estao — e' o vao de dentro de selo, e arredondar
 *            pra zero tira a altura dele
 *   abaixo de 8   par
 *   ate' 24       multiplo de 4
 *   acima de 24   multiplo de 8
 *
 * O raio sai sempre de token (--radius-sm|md|lg|xl|2xl|pill). 50% continua
 * valendo: circulo se escreve assim, e nao e' degrau de escala.
 *
 * Os documentos que viram papel (.doc-*, o escopo impresso) ficam de fora
 * das duas: a escala deles e' medida em folha A4, nao na tela.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FOLHAS } from "./fonte.mjs";

const aqui = path.dirname(fileURLToPath(import.meta.url));
let f = 0;
const conf = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) f++;
  console.log(`${ok ? "ok    " : "FALHOU"}  ${nome.padEnd(52)}${ok ? "" : `${JSON.stringify(obtido)} esperava ${JSON.stringify(esperado)}`}`);
};

const PAPEL = /\.(doc-|ad-page|ad-doc|ad-dt|ad-sectitle|ad-saldo|ad-cond|ad-prevalencia|rel-doc)/;
const REGRA = /(?<sel>[^{}]*?)\{(?<corpo>[^{}]*)\}/gs;
const PROP = /\b(padding|margin|gap|row-gap|column-gap)(-top|-right|-bottom|-left)?: *([^;}]+)/g;

const naGrade = (v) =>
  v <= 2 ? true : v < 8 ? v % 2 === 0 : v <= 24 ? v % 4 === 0 : v % 8 === 0;

const foraDaGrade = [];
const raioSolto = [];
for (const folha of FOLHAS.filter((x) => x !== "design-system.css")) {
  const t = fs.readFileSync(path.join(aqui, "..", "estilos", folha), "utf8");
  for (const m of t.matchAll(REGRA)) {
    const sel = m.groups.sel.split("*/").pop();
    if (PAPEL.test(sel)) continue;
    const corpo = m.groups.corpo;

    for (const px of corpo.matchAll(/border-radius: *([0-9.]+)px/g)) {
      raioSolto.push(`${folha}: ${sel.trim().slice(0, 40)} -> ${px[1]}px`);
    }
    for (const pm of corpo.matchAll(PROP)) {
      const valor = pm[3];
      if (/calc\(|var\(|clamp\(|%/.test(valor)) continue;
      for (const nm of valor.matchAll(/-?(\d+)px/g)) {
        const v = Number(nm[1]);
        if (v !== 0 && !naGrade(v)) {
          foraDaGrade.push(`${folha}: ${sel.trim().slice(0, 36)} -> ${pm[1]}: ${v}px`);
        }
      }
    }
  }
}

if (raioSolto.length) raioSolto.slice(0, 6).forEach((s) => console.log("        " + s));
conf("todo raio sai de token", raioSolto.length, 0);

if (foraDaGrade.length) foraDaGrade.slice(0, 8).forEach((s) => console.log("        " + s));
conf("todo espaco cai na grade", foraDaGrade.length, 0);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
