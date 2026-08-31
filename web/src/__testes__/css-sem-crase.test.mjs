/* Crase dentro do CSS quebra o build.
 *
 * Roda com: node web/src/__testes__/css-sem-crase.test.mjs
 *
 * O CSS do app vive num template literal — `<style>{`...`}</style>` — e
 * dentro dele a crase FECHA a string. Uma crase num comentário, escrita
 * pra citar uma propriedade, encerra o CSS no meio e o resto do arquivo
 * vira JavaScript inválido.
 *
 * Isso já derrubou o build duas vezes, e as duas por comentário: "`flex:
 * 1`", "`title`". O erro que aparece é "Expected } but found margin",
 * apontando pro comentário — que parece inofensivo e por isso não é o
 * primeiro lugar onde se olha.
 *
 * Este teste é mais rápido que o build e falha dizendo a linha.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const arq = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "App.jsx");
const linhas = fs.readFileSync(arq, "utf8").split("\n");

/* Onde o CSS começa e termina. `<style>{` abre e `}</style>` fecha — e
   entre os dois nenhuma crase pode existir, nem em comentário. */
const abre = linhas.findIndex((l) => l.includes("<style>{`"));
const fecha = linhas.findIndex((l, i) => i > abre && l.includes("`}</style>"));

let f = 0;
if (abre === -1 || fecha === -1) {
  console.log("FALHOU  não achei o bloco <style> no App.jsx");
  f++;
} else {
  const culpadas = [];
  for (let i = abre + 1; i < fecha; i++) {
    if (linhas[i].includes("`")) culpadas.push(`${i + 1}: ${linhas[i].trim().slice(0, 80)}`);
  }
  if (culpadas.length) {
    f++;
    console.log(`FALHOU  ${culpadas.length} crase(s) dentro do CSS — elas fecham o template e quebram o build:`);
    culpadas.forEach((c) => console.log("        App.jsx:" + c));
  } else {
    console.log(`ok      nenhuma crase entre as linhas ${abre + 1} e ${fecha + 1} do CSS`);
  }
}

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
