/* Tamanho de fonte sai do token, nao de um numero solto.
 *
 * Roda com: node web/src/__testes__/css-escala-de-tipo.test.mjs
 *
 * Ate' 20/09/2026 o app tinha QUARENTA E CINCO tamanhos de fonte, e 87% do
 * uso cabia entre 9,5px e 13px — oito degraus dentro de tres pixels e meio.
 * O olho nao ordena o que so' difere meio pixel, entao tudo abaixo do
 * titulo lia como "texto cinza pequeno". Era a maior causa do ar amador.
 *
 * Agora sao sete degraus, todos em design-system.css. Um px solto numa
 * regra nova nao quebra nada e nao levanta erro — so' comeca a desfazer a
 * escala de novo, um valor por vez. E' exatamente assim que os 45
 * apareceram.
 *
 * A EXCECAO sao os documentos que viram papel (.doc-*, o escopo impresso):
 * eles tem escala propria, medida em folha A4, e nao seguem a da tela.
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

const DEGRAUS = ["--t-micro", "--t-meta", "--t-body", "--t-section", "--t-title", "--t-stat", "--t-display"];

/* 1. Os sete degraus existem, e so' eles. */
const ds = fs.readFileSync(path.join(aqui, "..", "estilos", "design-system.css"), "utf8");
const declarados = [...ds.matchAll(/^\s*(--t-[a-z]+):/gm)].map((m) => m[1]);
conf("os sete degraus estao declarados", declarados.sort(), [...DEGRAUS].sort());

/* 2. Nenhum px solto nas folhas do app, fora do papel. */
const soltos = [];
for (const folha of FOLHAS.filter((x) => x !== "design-system.css")) {
  const t = fs.readFileSync(path.join(aqui, "..", "estilos", folha), "utf8");
  for (const m of t.matchAll(REGRA)) {
    const sel = m.groups.sel.split("*/").pop();
    if (PAPEL.test(sel)) continue;
    for (const px of m.groups.corpo.matchAll(/font-size: *([0-9.]+)px/g)) {
      soltos.push(`${folha}: ${sel.trim().slice(0, 44)} -> ${px[1]}px`);
    }
  }
}
if (soltos.length) soltos.slice(0, 8).forEach((s) => console.log("        " + s));
conf("nenhum font-size em px fora do papel", soltos.length, 0);

/* 3. Todo token usado e' um dos sete — nao vale inventar --t-medio. */
const usados = new Set();
for (const folha of FOLHAS) {
  const t = fs.readFileSync(path.join(aqui, "..", "estilos", folha), "utf8");
  for (const m of t.matchAll(/font-size: var\((--t-[a-z]+)\)/g)) usados.add(m[1]);
}
conf("nenhum degrau inventado", [...usados].filter((u) => !DEGRAUS.includes(u)), []);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
