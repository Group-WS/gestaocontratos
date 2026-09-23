/* Editar no Executivo grava no produto certo — não na posição.
 *
 * Roda com: node web/src/__testes__/editar-executivo-casa-produto.test.mjs
 *
 * O DEFEITO (achado em 19/09/2026 a partir do relato de um usuário: "ele
 * estava editando informações dentro do Executivo, porém na conferência os
 * itens que ele estava alterando não estavam indo para lá... a gente estava
 * encaminhando para compra produtos errados").
 *
 * `editarItemExecutivo` aplicava o MESMO índice nas duas listas:
 *
 *     const aplicar = (lista) => (lista||[]).map((it, i) => (i === idx ? … : it));
 *     { itensPlanilhaExecutivo: aplicar(...), itens: aplicar(...) }
 *
 * Só que elas têm tamanhos diferentes. `itensPlanilhaExecutivo` é a planilha
 * como veio; `itens` é a lista de trabalho, e nas verbas de contrato (05, 20,
 * 24, 27, 28) cada produto vira DUAS linhas — material e mão de obra. Da
 * primeira linha partida em diante, a mesma posição aponta para produtos
 * diferentes.
 *
 * Medido nas quatro obras vivas naquele dia: 470 itens expostos. Editar
 * "Spot de Embutir LOYO" na 2498 gravava em "Downlight Led Powerus". A Conf.
 * Executivo seguia mostrando a planilha certa e a COMPRA saía com o produto
 * errado — ninguém via acontecer.
 *
 * A regra que ela aprovou: o que IDENTIFICA o produto vale nas duas linhas;
 * o que é dinheiro fica na linha dona do valor.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(aqui, "..", "App.jsx"), "utf8");

const bloco = (assinatura, fim = "\n}\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei em App.jsx: ${assinatura}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};
const linha = (comeco) => {
  const i = src.indexOf(comeco);
  if (i === -1) throw new Error(`não achei em App.jsx: ${comeco}`);
  return src.slice(i, src.indexOf("\n", i) + 1);
};

const M = eval("(function () {\n"
  + linha("const chaveDescricao =")
  + bloco("const CAMPOS_DO_PRODUTO = new Set(", "]);\n")
  + bloco("const somenteIdentidade =", ";\n")
  + "  return { chaveDescricao, CAMPOS_DO_PRODUTO, somenteIdentidade };\n"
  + "})()");

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(62)} ${String(o).padEnd(8)} ${ok ? "" : "esperava " + e}`); };

/* ============================================================
   1. O QUE VAZA PRA LINHA DE MÃO DE OBRA, E O QUE NÃO VAZA
   ============================================================ */
const so = M.somenteIdentidade;

conf("a descrição vale nas duas linhas", "desc" in so({ desc: "Spot novo" }), true);
conf("o fornecedor também", "marca" in so({ marca: "LOYO" }), true);
conf("o ambiente também", "ambiente" in so({ ambiente: "Sala" }), true);
conf("a especificação também", "especificacao" in so({ especificacao: "GU10" }), true);
/* Remover o produto tem que levar as duas linhas: material sem a mão de obra
   dele é meia obra contratada sem nada para instalar. */
conf("remover leva as duas linhas", "excluido" in so({ excluido: true }), true);
conf("... com a justificativa junto", "excluidoMotivo" in so({ excluidoMotivo: "saiu do escopo" }), true);

/* DINHEIRO NÃO VAZA. A linha de mão de obra vira CONTRATO; receber o custo
   do material ali dobraria o valor da obra em dois lugares diferentes. */
conf("o custo NÃO vai pra linha de mão de obra", "custo" in so({ custo: 1000 }), false);
conf("o custo de material também não", "custoMaterial" in so({ custoMaterial: 800 }), false);
conf("nem o total", "totalMaterial" in so({ totalMaterial: 800 }), false);
conf("nem a quantidade", "qtdExecutivo" in so({ qtdExecutivo: 3 }), false);
/* O CÓDIGO é próprio de cada linha: a de mão de obra ganha um novo na
   separação. Sobrescrever juntaria as duas de volta no Sienge. */
conf("o código NÃO vaza — a linha de MO tem o dela", "codigo" in so({ codigo: "16.11" }), false);

/* Patch misto: separa certo, sem perder o que é identidade. */
{
  const r = so({ desc: "Spot novo", custo: 999, marca: "LOYO", qtdExecutivo: 4 });
  conf("patch misto guarda só a identidade", Object.keys(r).sort().join(","), "desc,marca");
}
conf("patch vazio não vira nada", Object.keys(so({})).length, 0);
conf("patch nulo não quebra", Object.keys(so(null)).length, 0);

/* ============================================================
   2. O CASAMENTO É POR PRODUTO
   ============================================================ */
const corpo = bloco("  function editarItemExecutivo(catNum, idx, patch) {", "\n  }\n");

/* A planilha é o que a tela mostra: ali a posição É a verdade. */
conf("na planilha, a posição continua valendo",
  corpo.includes("(c.itensPlanilhaExecutivo || []).map((it, i) => (i === idx ? mexer(it, false) : it))"), true);
/* Na lista de trabalho, quem manda é o produto. */
conf("na lista de trabalho, quem manda é a descrição",
  corpo.includes("chaveDescricao(it.desc) === chaveBase"), true);
conf("a descrição de referência vem do item que a tela editou",
  corpo.includes("const base = (c.itensPlanilhaExecutivo || [])[idx];"), true);
/* `separadoDe` é a marca que `partirMaoDeObra` deixa na linha de mão de
   obra — é ela que decide quem recebe o patch inteiro. */
conf("a linha de mão de obra só recebe a identidade",
  corpo.includes("mexer(it, !!it.separadoDe)"), true);

/* SEM PAR, NÃO GRAVA. Melhor não gravar do que gravar no vizinho: era
   exatamente isso que fazia a compra sair errada. */
conf("sem produto correspondente, a lista fica intacta",
  corpo.includes("(it) => chaveBase != null && chaveDescricao(it.desc) === chaveBase"), true);

/* O ID DA LINHA GANHA DA DESCRIÇÃO (ADR-007, 23/09/2026). Na obra 9999, quatro
   "Painel de embutir ECO 18W" (um por ambiente) recebiam a edição de um só. */
conf("com id, o alvo é a linha exata",
  corpo.includes("? (it) => it.idLinha === base.idLinha"), true);
conf("e o id não se edita",
  corpo.includes('Object.prototype.hasOwnProperty.call(patch, "idLinha")'), true);

/* E O ÍNDICE NÃO PODE VOLTAR. Esta linha existe para que um copiar-e-colar
   futuro não reintroduza o defeito mais caro do app. */
conf("o índice não é mais usado na lista de trabalho",
  /itens:[^\n]*\(it, i\) => \(i === idx/.test(corpo), false);
conf("não existe mais o `aplicar` que servia as duas listas",
  corpo.includes("const aplicar = (lista)"), false);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
