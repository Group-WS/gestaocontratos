/* Busca por insumo dentro da obra.
 *
 * Roda com: node web/src/__testes__/busca-por-insumo.test.mjs
 *
 * Pedido dela em 17/09/2026: um campo de filtro por insumo nas cinco telas da
 * obra. A regra que governa tudo é que a busca é LENTE, não recorte — ela
 * muda o que aparece, nunca o que vale.
 *
 * Duas coisas aqui não podem quebrar nunca:
 *   1. termo vazio ou com uma letra NÃO filtra (se filtrar, as cinco telas
 *      abrem em branco);
 *   2. o Executivo continua escondendo a linha em vez de filtrar o array —
 *      lá o índice da lista é o que grava no banco.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { norm as normSienge } from "../lib/sienge.js";

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "App.jsx"), "utf8");
const bloco = (assinatura, fim = "\n}\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei no App.jsx: ${assinatura}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};
const linha = (comeco) => {
  const i = src.indexOf(comeco);
  if (i === -1) throw new Error(`não achei no App.jsx: ${comeco}`);
  return src.slice(i, src.indexOf("\n", i) + 1);
};

/* `normSienge` vem do lib de verdade, não de um stub: metade do que este
   arquivo garante (acento, pontuação, separador de milhar) é dele. */
const M = eval(`(function () {
  ${linha("const codigoVisivel =")}
  ${bloco("function textoDoItem(")}
  ${bloco("function casaBusca(")}
  return { textoDoItem, casaBusca };
})()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(58)} ${String(o).padEnd(12)} ${ok ? "" : "esperava " + e}`); };

const casa = (it, termo, cat) => M.casaBusca(M.textoDoItem(it, cat), termo);
const cuba = { desc: "Cuba de apoio em Inox", codigo: "12.03", marca: "Rivatti", ambiente: "Cozinha", especificacao: "Obs: chegar montada" };

/* ---- 1. O termo que NÃO filtra ----
   É a inversão em relação ao `acharNoExecutivo`, que devolve lista vazia com
   termo curto porque lá é sugestão. Aqui é filtro de lista: sem termo, mostre
   tudo. Se algum destes virar false, a tela abre em branco. */
conf("termo vazio não filtra", casa(cuba, ""), true);
conf("só espaço não filtra", casa(cuba, "   "), true);
conf("uma letra não filtra", casa(cuba, "c"), true);
conf("undefined não filtra", casa(cuba, undefined), true);
conf("null não filtra", casa(cuba, null), true);
conf("pontuação sozinha não filtra", casa(cuba, "-"), true);
conf("duas letras já filtram", casa(cuba, "zz"), false);

/* ---- 2. Como o termo casa ---- */
conf("acha por pedaço do meio", casa(cuba, "apoio"), true);
conf("acha por começo de palavra", casa(cuba, "cub"), true);
conf("não acha o que não está lá", casa(cuba, "torneira"), false);
conf("acha sem acento no termo", casa({ desc: "Gavetões" }, "gavetoes"), true);
conf("acha com acento no termo", casa({ desc: "GAVETOES" }, "gavetões"), true);
conf("ignora a caixa", casa(cuba, "INOX"), true);
conf("duas palavras fora de ordem", casa(cuba, "inox cuba"), true);
conf("todas as palavras precisam casar", casa(cuba, "cuba granito"), false);

/* ---- 3. Um caso por campo — cada um foi uma decisão ---- */
conf("acha pelo código", casa(cuba, "12.03"), true);
conf("acha pelo fornecedor (campo marca)", casa(cuba, "rivatti"), true);
conf("acha pelo ambiente", casa(cuba, "cozinha"), true);
conf("acha pela especificação/obs", casa(cuba, "montada"), true);
conf("acha pelo nome da verba", casa(cuba, "marcenaria", { num: "21", nome: "Marcenaria" }), true);
conf("sem a verba, não acha por ela", casa(cuba, "marcenaria"), false);
conf("acha pelo número da verba", casa(cuba, "21", { num: "21", nome: "Marcenaria" }), true);

/* A Conf. Executivo põe o vendido e o executivo lado a lado na mesma linha. */
conf("acha na coluna do vendido (a.desc)", casa({ a: { desc: "Cuba" }, b: null }, "cuba"), true);
conf("acha na coluna do executivo (b.desc)", casa({ a: null, b: { desc: "Cuba" } }, "cuba"), true);

/* ---- 4. Dinheiro NÃO entra ----
   Com `custo` na lista, buscar "1000" traria tudo que custa mil. */
conf("não acha pelo custo", casa({ desc: "Cuba", custo: 1000, qtdVendida: 3 }, "1000"), false);

/* ---- 5. O que o normSienge garante ----
   O separador de milhar sai antes: "9.000 BTUS" e "18.000 BTUS" deixam de ser
   a mesma palavra. É o bug documentado em lib/sienge.js:16-22. */
conf("9000 acha 9.000 BTUS", casa({ desc: "Ar-condicionado 9.000 BTUS" }, "9000"), true);
conf("9000 NÃO acha 18.000 BTUS", casa({ desc: "Ar-condicionado 18.000 BTUS" }, "9000"), false);
conf("com ponto acha do mesmo jeito", casa({ desc: "Ar-condicionado 9.000 BTUS" }, "9.000"), true);

/* ---- 6. Não quebrar com o que vem do banco ----
   Item vindo de PDF não tem ambiente; 198 dos 269 itens da 2450 não têm
   código; o "null-T1" é o código de quem nasceu de uma troca. */
conf("item sem nada não quebra", casa({}, "cuba"), false);
conf("item undefined não quebra", casa(undefined, "cuba"), false);
conf("código null não quebra", casa({ desc: "Cuba", codigo: null, ambiente: null }, "cuba"), true);
conf("código de troca não vira texto buscável", casa({ desc: "Cuba", codigo: "null-T1" }, "null"), false);
conf("cat undefined não quebra", M.textoDoItem({ desc: "Cuba" }, undefined), "Cuba");

/* ---- 7. Trava de origem: o índice do Executivo ----
   Em `ExecutivoView` o `i` do map é POSICIONAL e é ele que grava
   (`onEditarItem(c.num, i, ...)`). Se alguém trocar o `return null` por um
   `.filter()`, a edição passa a gravar na linha de baixo — sem erro na tela e
   sem ninguém perceber até conferir a planilha. */
const execAteOFim = src.slice(src.indexOf("function ExecutivoView("), src.indexOf("function ExecutivoView(") + 25000);
conf("Executivo ainda mapeia o array inteiro", execAteOFim.includes("{itens.map((it, i) => {"), true);
conf("Executivo NÃO filtra o array de itens", /itensPlanilhaExecutivo \|\| \[\]\)\.filter\(/.test(execAteOFim), false);

/* ---- 8. Trava de CSS ----
   O CSS vive num template literal; a regra precisa existir e vir depois do
   restyle do design system, senão o campo desalinha dentro da barra. */
const css = src.slice(src.indexOf("<style>{`"), src.indexOf("`}</style>"));
conf(".busca-lista existe no CSS", css.includes(".busca-lista {"), true);
conf(".busca-conta existe no CSS", css.includes(".busca-conta {"), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
