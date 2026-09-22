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
   arquivo garante (acento, pontuação, separador de milhar) é dele.

   O caminho testado é o MESMO que as cinco telas usam: `casaItem`, com o
   cache do texto (WeakMap) e o do termo. Testar só o `textoDoItem` deixaria
   o cache — que é onde mora o risco de mostrar resultado velho — sem prova. */
const M = eval(`(function () {
  ${linha("const codigoVisivel =")}
  ${bloco("function textoDoItem(")}
  ${linha("const textoBuscavelDoItem =")}
  ${bloco("function textoBuscavel(")}
  ${linha("let termoBuscado =")}
  ${linha("let palavrasBuscadas =")}
  ${bloco("function palavrasDoTermo(")}
  ${bloco("function casaItem(")}
  return { textoDoItem, textoBuscavel, casaItem };
})()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(58)} ${String(o).padEnd(12)} ${ok ? "" : "esperava " + e}`); };

const casa = (it, termo, cat) => M.casaItem(it, cat, termo);
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
/* Pedido dela em 22/09/2026: "precisa buscar tudo que tem na listagem". O
   fornecedor, o ambiente e a especificação também aparecem nas duas colunas —
   antes só o do item solto era lido. */
conf("acha o fornecedor da coluna do vendido", casa({ a: { marca: "Deca" }, b: null }, "deca"), true);
conf("acha o ambiente da coluna do executivo", casa({ a: null, b: { ambiente: "Lavabo" } }, "lavabo"), true);
conf("acha a especificação da coluna do executivo", casa({ b: { especificacao: "com ducha higiênica" } }, "ducha"), true);

/* O que veio do Sienge aparece na linha das Compras e da Conf. Executivo:
   a descrição do detalhe, os códigos e a unidade. */
conf("acha pela descrição do detalhe no Sienge", casa({ desc: "Cuba", detalheSienge: "CUBA INOX 40X34 TRAMONTINA" }, "tramontina"), true);
conf("acha pelo descritivo editado à mão", casa({ desc: "Cuba", descritivoSienge: "cuba redonda escovada" }, "escovada"), true);
conf("acha pelo código do detalhe no Sienge", casa({ desc: "Cuba", codigoDetalheSienge: "99871" }, "99871"), true);
conf("acha pelo código auxiliar", casa({ desc: "Cuba", codigoAuxSienge: "AUX-450" }, "aux 450"), true);
conf("acha pela unidade", casa({ desc: "Cabo flexível", un: "rolo" }, "rolo"), true);
conf("acha pelo canal de compra", casa({ desc: "Cuba", canalCompra: "mehoo" }, "mehoo"), true);

/* ---- 3b. O cache não pode devolver texto velho ----
   O texto normalizado fica num WeakMap por item. Editar o item cria OUTRO
   objeto (o app grava imutável), então o texto novo tem que valer; e o mesmo
   item lido com outra verba não pode responder pela verba da primeira vez. */
const antes = { desc: "Cuba de apoio" };
conf("cache: acha antes de editar", casa(antes, "apoio"), true);
const depois = { ...antes, desc: "Cuba de embutir" };
conf("cache: item editado vale pelo texto novo", casa(depois, "embutir"), true);
conf("cache: e não pelo texto antigo", casa(depois, "apoio"), false);
const compartilhado = { desc: "Luminária" };
conf("cache: acha pela primeira verba", casa(compartilhado, "eletrica", { num: "05", nome: "Elétrica" }), true);
conf("cache: e pela segunda verba, no mesmo item", casa(compartilhado, "iluminacao", { num: "06", nome: "Iluminação" }), true);

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

/* ---- 8. Trava de desenho ----
   O campo é o `Input` do design system (com ícone e rótulo acessível), e o
   CSS caseiro que o alinhava na barra (.busca-lista/.busca-conta) foi
   embora com a migração — não pode voltar. */
const campoBusca = src.slice(src.indexOf("function CampoBusca("), src.indexOf("function contaItensDaObra("));
conf("CampoBusca usa o Input do DS", campoBusca.includes("<Input "), true);
conf("CampoBusca tem rótulo acessível", campoBusca.includes('aria-label="Buscar"'), true);
const css = src.slice(src.indexOf("<style>{`"), src.indexOf("`}</style>"));
conf(".busca-lista não existe mais no CSS", css.includes(".busca-lista {"), false);
conf(".busca-conta não existe mais no CSS", css.includes(".busca-conta {"), false);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
