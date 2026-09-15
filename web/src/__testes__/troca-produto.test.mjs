/* Troca de produto nas Compras: o original fica riscado sem contar no
 * material (a mão de obra dele continua), e a linha nova conta com o
 * próprio custo, sempre como produto.
 *
 * Roda com: node web/src/__testes__/troca-produto.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "App.jsx"), "utf8");
const trecho = (de, ate) => {
  const i = src.indexOf(de), f = src.indexOf(ate);
  if (i === -1 || f === -1) throw new Error(`não achei o intervalo: ${de} .. ${ate}`);
  return src.slice(i, f);
};
const bloco = (assinatura, fim = "\n}\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei no App.jsx: ${assinatura}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};
const M = eval(`(function () {
  const padraoDaDescricao = (d) => (/instala/i.test(d || "") ? ALOC_MO : null);
  const verbaPorNome = () => null;
  const subgrupoDe = () => null;
  ${trecho("const ALOC_MAT =", "/* =====[ FIM DO MODELO PURO")}
  ${bloco("function parcelasDoItem(")}
  ${bloco("function parcelasDaPlanilha(")}
  ${bloco("function produtosMAT(")}
  return { parcelasDoItem, alocacaoDoItem, produtosMAT, resumoDaObra, ALOC_MAT };
})()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(56)} ${String(o).padEnd(10)} ${ok ? "" : "esperava " + e}`); };

const cat = { num: "05", nome: "Instalações Elétricas e Iluminação", itens: [
  { codigo: "5.12", desc: "Fita LED 3000K", un: "m", qtdExecutivo: 25, totalMaterial: 1250, totalMO: 300,
    troca: { em: "2026-09-15T12:00:00Z", aprovadoPor: { email: "b@groupws.com.br", nome: "Barbara" }, motivo: "descontinuada", novas: ["5.12-T"] } },
  { codigo: "5.12-T", desc: "Instalação fácil: fita LED 9,6W/m", un: "m", qtdExecutivo: 25, custoMaterial: 58, totalMaterial: 1450, totalMO: 0, trocaDe: "5.12" },
  { codigo: "5.13", desc: "Perfil de alumínio", un: "un", qtdExecutivo: 12, totalMaterial: 876, totalMO: 0 },
] };
const orig = M.parcelasDoItem(cat.itens[0], cat);
conf("o trocado não conta material", orig.material, 0);
conf("mas guarda o valor de antes", orig.materialOriginal, 1250);
conf("a mão de obra dele continua", orig.mo, 300);
const nova = M.parcelasDoItem(cat.itens[1], cat);
conf("a linha nova conta com o próprio custo", nova.material, 1450);
conf("mesmo com descrição que a regra mandaria pra MO", M.alocacaoDoItem(cat.itens[1], cat), M.ALOC_MAT);
const linhas = M.produtosMAT({ categorias: [cat] });
conf("o trocado continua na lista das Compras", linhas.length, 3);
conf("riscado, com o valor de antes pra mostrar", `${linhas[0].material}|${linhas[0].materialOriginal}`, "0|1250");
const r = M.resumoDaObra({ codigo: "1", nome: "Teste", categorias: [cat] }, new Date(2026, 8, 15));
conf("no total da obra, o custo novo substitui o antigo", r.mat.total, 1450 + 876);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
