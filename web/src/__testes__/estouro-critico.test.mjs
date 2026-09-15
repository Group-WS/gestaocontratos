/* O alerta "N categorias em estouro crítico" do Dashboard da obra abre a
 * lista, e cada categoria diz por que está ali.
 *
 * Roda com: node web/src/__testes__/estouro-critico.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "App.jsx"), "utf8");
const bloco = (assinatura, fim = "\n}\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei no App.jsx: ${assinatura}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};
const M = eval(`(function () {
  ${bloco("function categoriaStatus(")}
  ${bloco("function motivoDoEstouro(")}
  return { categoriaStatus, motivoDoEstouro };
})()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(50)} ${String(o).padEnd(24)} ${ok ? "" : "esperava " + e}`); };

conf("32% acima é crítico", M.categoriaStatus({ vendido: 1000, executivo: 1320 }), "critico");
conf("e diz quanto passou", M.motivoDoEstouro({ vendido: 1000, executivo: 1320 }), "+32% sobre o vendido");
conf("15% ainda não é crítico", M.categoriaStatus({ vendido: 1000, executivo: 1150 }), "atencao");
conf("executivo sem vendido é crítico", M.categoriaStatus({ vendido: 0, executivo: 500 }), "critico");
conf("e diz que não tem vendido", M.motivoDoEstouro({ vendido: 0, executivo: 500 }), "sem valor vendido");
conf("fora do escopo diz isso", M.motivoDoEstouro({ foraDeEscopoCategoria: true, vendido: 0, executivo: 0 }), "fora do escopo vendido");
// Fora da EAP e vazia não é estouro (a obra 2450 tinha quatro assim, todas em branco).
conf("fora da EAP e vazia não acende o alerta", M.categoriaStatus({ foraDeEscopoCategoria: true, vendido: 0, executivo: 0 }), "vazio");
conf("fora da EAP com item continua crítica", M.categoriaStatus({ foraDeEscopoCategoria: true, vendido: 0, executivo: 0, itens: [{ desc: "x" }] }), "critico");
conf("fora da EAP com valor continua crítica", M.categoriaStatus({ foraDeEscopoCategoria: true, vendido: 0, executivo: 800 }), "critico");
conf("dentro da EAP e vazia é vazia", M.categoriaStatus({ vendido: 0, executivo: 0 }), "vazio");
conf("o Dashboard abre a lista pelo alerta", /chave: "criticos", detalhe: categoriasCriticas/.test(src), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
