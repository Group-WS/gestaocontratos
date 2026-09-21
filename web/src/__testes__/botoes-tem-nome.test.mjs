/* Todo botao precisa dizer o que e'.
 *
 * Roda com: node web/src/__testes__/botoes-tem-nome.test.mjs
 *
 * Botao com texto dentro ja' se apresenta sozinho. O problema e' o que so'
 * tem icone: pra quem enxerga, um X e' obviamente "fechar"; pra um leitor
 * de tela sem aria-label, e' "botao" e nada mais — a pessoa tem de clicar
 * pra descobrir. Eram oito assim, todos de fechar.
 *
 * `title` conta como nome de ultimo recurso e este teste aceita, mas nao e'
 * a mesma coisa: no celular ele nunca aparece, porque nao ha' hover.
 *
 * O nome pode vir de tres lugares: texto solto, uma string dentro de
 * expressao ({salvando ? "Salvando…" : "Salvar"}), ou um filho com texto
 * ({titulo} dentro de um span). Os tres contam.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const ARQUIVOS = ["App.jsx", "Catalogo.jsx", "Apresentacao.jsx", "AuthGate.jsx"];
/* Ler a abertura da tag com [^>]* NAO funciona, e este teste ja' passou
   um tempo mentindo por causa disso: `onClick={() => x()}` tem um `>` na
   seta, entao a regex fechava a tag no meio do atributo e o "dentro" do
   botao vinha errado — botao mudo com arrow function passava batido.
   Aqui a abertura e' percorrida a mao, contando chave e aspas, ate' o `>`
   que de fato fecha a tag. */
function botoes(src) {
  const achados = [];
  for (let i = src.indexOf("<button"); i !== -1; i = src.indexOf("<button", i + 1)) {
    if (/[\w-]/.test(src[i + 7] || "")) continue;      // <buttonX
    let j = i + 7, chaves = 0, aspas = null;
    for (; j < src.length; j++) {
      const c = src[j];
      if (aspas) { if (c === aspas) aspas = null; continue; }
      if (c === '"' || c === "'" || c === "`") { aspas = c; continue; }
      if (c === "{") chaves++;
      else if (c === "}") chaves--;
      else if (c === ">" && chaves === 0) break;
    }
    const attrs = src.slice(i + 7, j);
    const fim = src.indexOf("</button>", j);
    if (fim === -1) continue;
    achados.push({ attrs, dentro: src.slice(j + 1, fim), index: i });
  }
  return achados;
}

const mudos = [];
let comNome = 0;
for (const arq of ARQUIVOS) {
  const t = fs.readFileSync(path.join(aqui, "..", arq), "utf8");
  for (const m of botoes(t)) {
    const { attrs, dentro } = m;
    if (/\baria-label=/.test(attrs) || /\btitle=/.test(attrs)) { comNome++; continue; }
    /* Tira os elementos autofechados — sao os icones, <X size={13} />. Se
       depois disso nao sobra nada, o botao e' so' icone. Se sobra qualquer
       coisa (texto solto, {a.descricao}, um <span> com o titulo dentro),
       ha' nome: pode vir do dado, mas existe em tempo de execucao. */
    const semIcones = dentro.replace(/<[A-Za-z][^>]*\/>/g, "").trim();
    if (semIcones.length > 0) { comNome++; continue; }
    mudos.push(`${arq}:${t.slice(0, m.index).split("\n").length}  ${attrs.trim().replace(/\s+/g, " ").slice(0, 60)}`);
  }
}

let f = 0;
if (mudos.length) {
  f++;
  console.log(`FALHOU  ${mudos.length} botao(oes) sem nome — so' icone, sem aria-label nem title:`);
  mudos.forEach((s) => console.log("        " + s));
} else {
  console.log(`ok      os ${comNome} botoes dizem o que sao`);
}

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
