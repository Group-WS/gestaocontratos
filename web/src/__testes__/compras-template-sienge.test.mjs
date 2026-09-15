/* O template do Sienge nas Compras (etapa Sienge, barra de cada grupo).
 *
 * Roda com: node web/src/__testes__/compras-template-sienge.test.mjs
 *
 * É o mesmo CSV do Gerador de códigos, e a associação na linha é a mesma
 * do Gerador (EscolhaSienge). A forma do arquivo já é guardada pelo teste
 * template-sienge; este guarda QUEM entra nele e COM O QUÊ:
 *
 *   - como no Gerador, só fica de fora o que a pessoa marcou como variante
 *     já cadastrada; o resto vai como detalhe novo — o sem insumo mãe com
 *     o código do insumo em branco;
 *   - a mãe escolhida na busca (fora das candidatas) vale;
 *   - a descrição e os códigos são os que a pessoa digitou na linha;
 *   - sem código digitado, o auxiliar é o do fornecedor, ou um gerado do
 *     próprio item — o mesmo a cada download.
 */
import fs from "node:fs";
import {
  codigoAuxiliarDe, descricaoSienge, limparTemplate, auxiliarEstavel,
  montarTemplateSienge, CABECALHO_TEMPLATE_SIENGE,
} from "../lib/sienge.js";

const src = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const bloco = (a) => {
  const i = src.indexOf(a);
  if (i === -1) throw new Error(`não achei no App.jsx: ${a}`);
  return src.slice(i, src.indexOf("\n}\n", i) + 3);
};
const M = new Function("codigoAuxiliarDe", "descricaoSienge", "limparTemplate", "auxiliarEstavel", `
  ${bloco("function situacaoNoSienge(")}
  ${bloco("function descritivoDoItem(")}
  ${bloco("function auxiliaresDoGrupo(")}
  ${bloco("function templateComprasDoGrupo(")}
  return { situacaoNoSienge, descritivoDoItem, auxiliaresDoGrupo, templateComprasDoGrupo };
`)(codigoAuxiliarDe, descricaoSienge, limparTemplate, auxiliarEstavel);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(58)} ${String(o).slice(0, 40).padEnd(42)} ${ok ? "" : "esperava " + e}`); };

const CADEIRA = { codigo: "406", nome: "MOBILIA SOLTA - CADEIRA", variantes: [] };
const BANCO = { codigo: "408", nome: "MOBÍLIA SOLTA - BANCO", variantes: [] };
const BASE = [CADEIRA, BANCO]; // a base inteira, agrupada por mãe (é onde a busca procura)
const casou = () => ({ maes: [{ grupo: CADEIRA, score: 0.8 }], detalhes: [] });
const SEM_MAE = { maes: [], detalhes: [] };
const produto = (chave, it = {}) => ({ chave, it: { codigo: "24.3", desc: "Cadeira Eiffel", marca: "Rivatti", ...it } });
const grupo = (...pares) => {
  const itens = pares.map(([p]) => p);
  const casamentos = new Map(pares.filter(([, c]) => c).map(([p, c]) => [p.chave, c]));
  return M.templateComprasDoGrupo(itens, casamentos, BASE, M.auxiliaresDoGrupo(itens, "2450"));
};

/* ---- 1. a situação, igual ao Gerador ---- */
conf("sem variante marcada, vai como detalhe novo", M.situacaoNoSienge(produto("a").it, casou(), BASE).status, "aproximado");
conf("variante marcada é a já cadastrada", M.situacaoNoSienge(produto("a", { detalheSienge: "X" }).it, casou(), BASE).status, "exato");
conf("sem mãe", M.situacaoNoSienge(produto("a").it, SEM_MAE, BASE).status, "sem");
conf("sem escolha, fica a primeira candidata", M.situacaoNoSienge(produto("a").it, casou(), BASE).mae?.codigo, "406");
conf("a mãe da busca vale, mesmo fora das candidatas",
  M.situacaoNoSienge(produto("a", { maeSienge: "408" }).it, casou(), BASE).mae?.codigo, "408");

/* ---- 2. quem entra no CSV ---- */
conf("variante marcada fica fora", grupo([produto("a", { detalheSienge: "X" }), casou()]).length, 0);
conf("produto ainda não associado fica fora", grupo([produto("a"), null]).length, 0);
const nova = grupo([produto("a"), casou()]);
conf("sem variante marcada entra", nova.length, 1);
conf("... com o insumo mãe", nova[0].maeCodigo, "406");
conf("... e o nome dele", nova[0].maeNome, "MOBILIA SOLTA - CADEIRA");
const semMae = grupo([produto("a"), SEM_MAE]);
conf("sem mãe entra com o código do insumo em branco", semMae.length === 1 && semMae[0].maeCodigo === "", true);
conf("a mãe da busca vai pro CSV", grupo([produto("a", { maeSienge: "408" }), casou()])[0].maeCodigo, "408");

/* ---- 3. descrição e códigos: o que foi digitado na linha ---- */
conf("sem edição vai o descritivo gerado", nova[0].descricaoDetalhe,
  descricaoSienge({ marca: "Rivatti", desc: "Cadeira Eiffel" }));
conf("a descrição editada na linha é a que vai",
  grupo([produto("a", { descritivoSienge: "RIVATTI / CADEIRA EIFFEL / BRANCA" }), casou()])[0].descricaoDetalhe,
  "RIVATTI / CADEIRA EIFFEL / BRANCA");
conf("código do detalhe digitado vai", grupo([produto("a", { codigoDetalheSienge: "12" }), casou()])[0].codigoDetalhe, "12");
conf("sem digitar, o código do detalhe sai em branco", nova[0].codigoDetalhe, "");
conf("auxiliar digitado vale primeiro",
  grupo([produto("a", { codigoAuxSienge: "AUX-9", codigoFornecedor: "3.650.3910" }), casou()])[0].codigoAuxDetalhe, "AUX-9");
conf("depois o do fornecedor", grupo([produto("a", { codigoFornecedor: "3.650.3910" }), casou()])[0].codigoAuxDetalhe, "3.650.3910");
conf("sem nenhum, um gerado de 5 dígitos", /^\d{5}$/.test(nova[0].codigoAuxDetalhe), true);
conf("... o mesmo a cada download", grupo([produto("a"), casou()])[0].codigoAuxDetalhe, nova[0].codigoAuxDetalhe);
const aux = M.auxiliaresDoGrupo([produto("a"), produto("b", { codigoFornecedor: "X1" })], "2450");
conf("a tela sabe qual auxiliar foi gerado", aux.get("a").gerado === true && aux.get("b").gerado === false, true);

/* ---- 4. o mesmo produto em dois ambientes é um detalhe só ---- */
conf("o mesmo produto duas vezes vira uma linha",
  grupo([produto("a", { ambiente: "Sala" }), casou()], [produto("b", { ambiente: "Varanda" }), casou()]).length, 1);

/* ---- 5. e sai no formato do Sienge ---- */
const csv = montarTemplateSienge([...nova, ...semMae]).split("\r\n").filter(Boolean);
conf("cabeçalho do template", csv[0], CABECALHO_TEMPLATE_SIENGE);
conf("seis colunas em cada linha", csv.every((l) => l.split(";").length === 6), true);

/* ---- 6. a especificação entra no descritivo, e o código dela vai pro fim ---- */
conf("o exemplo dela", M.descritivoDoItem({ marca: "Corbelli", desc: "Mesa lareral orbita", especificacao: "6299 - laca branca + metal amendoa" }),
  "CORBELLI / MESA LARERAL ORBITA / LACA BRANCA + METAL AMENDOA / 6299");
conf("especificação sem código entra inteira",
  M.descritivoDoItem({ marca: "Rivatti", desc: "Cadeira rio", especificacao: "laca metalizada bronze + tecido 2513" }),
  "RIVATTI / CADEIRA RIO / LACA METALIZADA BRONZE + TECIDO 2513");
conf("com código do fornecedor, a especificação fica como veio",
  M.descritivoDoItem({ marca: "X", desc: "Mesa", especificacao: "6299 - laca", codigoFornecedor: "A1" }), "X / MESA / 6299 - LACA / A1");
conf("o que a pessoa editou não muda",
  M.descritivoDoItem({ desc: "Mesa", especificacao: "6299 - laca", descritivoSienge: "MINHA DESCRIÇÃO" }), "MINHA DESCRIÇÃO");

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
