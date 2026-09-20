/* A cascata do app mora na ORDEM dos imports do main.jsx.
 *
 * Roda com: node web/src/__testes__/css-ordem-dos-estilos.test.mjs
 *
 * Este teste substitui o css-sem-crase, que vigiava outra coisa: ate'
 * 20/09/2026 as 3.114 linhas de CSS viviam num template literal dentro do
 * App.jsx, e uma crase num comentario fechava a string no meio, derrubando
 * o build. Aconteceu duas vezes, sempre por comentario. Fora do template,
 * crase e' um caractere comum e o problema deixou de existir.
 *
 * O que passou a doer e' outra coisa, e nao levanta erro nenhum: nenhuma
 * dessas camadas usa !important — quem vence e' quem vem DEPOIS. Trocar
 * duas linhas de import de lugar re-veste o app inteiro em silencio.
 * componentes.css so' funciona porque vem depois das telas; celular.css
 * so' funciona porque vem por ultimo.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FOLHAS } from "./fonte.mjs";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const ler = (...p) => fs.readFileSync(path.join(aqui, "..", ...p), "utf8");

let f = 0;
const conf = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) f++;
  console.log(`${ok ? "ok    " : "FALHOU"}  ${nome.padEnd(56)}${ok ? "" : `${JSON.stringify(obtido)} esperava ${JSON.stringify(esperado)}`}`);
};

const app = ler("App.jsx");
const main = ler("main.jsx");

/* 1. O CSS nao volta pra dentro do JSX. */
conf("nenhum <style> voltou pro App.jsx", app.includes("<style>{`"), false);

/* 2. Toda folha declarada existe mesmo. */
FOLHAS.forEach((folha) => {
  conf(`${folha} existe`, fs.existsSync(path.join(aqui, "..", "estilos", folha)), true);
});

/* 3. A ordem no main.jsx e' exatamente a da cascata — e nenhuma folha
      entrou sem passar por aqui. */
const importada = [...main.matchAll(/import "\.\/estilos\/([^"]+)";/g)].map((m) => m[1]);
conf("a ordem dos imports e' a da cascata", importada, FOLHAS);

/* 4. As duas ultimas sao as que vencem pela ordem, e e' de proposito. */
conf("componentes.css vem depois de telas.css",
  importada.indexOf("componentes.css") > importada.indexOf("telas.css"), true);
conf("celular.css e' o ultimo",
  importada[importada.length - 1], "celular.css");

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
