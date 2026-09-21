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
  ${bloco("function liberadoParaCompra(")}
  ${bloco("function parcelasDoItem(")}
  ${bloco("function parcelasDaPlanilha(")}
  ${bloco("function produtosMAT(")}
  return { parcelasDoItem, alocacaoDoItem, produtosMAT, resumoDaObra, ALOC_MAT, linhasDaTroca, origemDaTroca, rotuloDoItem, codigoVisivel };
})()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(56)} ${String(o).padEnd(10)} ${ok ? "" : "esperava " + e}`); };

const cat = { num: "05", nome: "Instalações Elétricas e Iluminação", itens: [
  { codigo: "5.12", desc: "Fita LED 3000K", un: "m", qtdExecutivo: 25, totalMaterial: 1250, totalMO: 300,
    troca: { em: "2026-09-15T12:00:00Z", aprovadoPor: { email: "b@groupws.com.br", nome: "Barbara" }, motivo: "descontinuada", novas: ["5.12-T"] } },
  { codigo: "5.12-T", desc: "Instalação fácil: fita LED 9,6W/m", un: "m", qtdExecutivo: 25, custoMaterial: 58, totalMaterial: 1450, totalMO: 0, trocaDe: "5.12", trocaEm: "2026-09-15T12:00:00Z" },
  { codigo: "5.13", desc: "Perfil de alumínio", un: "un", qtdExecutivo: 12, totalMaterial: 876, totalMO: 0 },
] };
/* Fixtures de antes da liberação (16/09/2026). Este teste trata da
   TROCA, não da liberação: marcadas como liberadas pra continuarem
   chegando na tela de Compras. */
cat.itens.forEach((it) => { it.liberadoCompra = { em: "2026-09-16" }; });
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

conf("a troca acha a linha nova pelo instante", M.linhasDaTroca(cat.itens, cat.itens[0]).map((x) => x.codigo).join(), "5.12-T");
conf("e a linha nova acha o original", M.origemDaTroca(cat.itens, cat.itens[1])?.codigo, "5.12");

/* A primeira troca gravada (obra 2450, 15/09): o item não tinha código, a
   linha nova saiu "null-T", sem trocaDe e com custo zero (estava em estoque).
   Ela tem que aparecer e ficar ligada ao original. */
const semCodigo = { num: "05", nome: "Instalações Elétricas e Iluminação", itens: [
  { codigo: null, desc: "Fita LED 2835 NOR 138LEDS/M – 12V | 11,5W/M – IP66 5m/rl 3000K", un: "rl", qtdExecutivo: 4, custoMaterial: 200, canalCompra: "sienge",
    troca: { em: "2026-09-15T19:54:59.124Z", aprovadoPor: { nome: "Barbara Franco" }, motivo: "Produto em estoque", novas: ["null-T"] } },
  { codigo: "null-T", desc: "Neoon Flex SKY67 - 25m", un: "cx", qtdExecutivo: 1, custoMaterial: 0, totalMaterial: 0, totalMO: 0,
    canalCompra: "sienge", trocaDe: null, trocaEm: "2026-09-15T19:54:59.124Z" },
] };
semCodigo.itens.forEach((it) => { it.liberadoCompra = { em: "2026-09-16" }; });
const linhas2 = M.produtosMAT({ categorias: [semCodigo] });
conf("a linha nova de custo zero aparece nas Compras", linhas2.length, 2);
conf("ligada ao original sem código", M.linhasDaTroca(semCodigo.itens, semCodigo.itens[0]).length, 1);
conf("o original sem código é chamado pela descrição", M.rotuloDoItem(semCodigo.itens[0]).startsWith("Fita LED 2835"), true);
conf("o código null-T não aparece na coluna", M.codigoVisivel(semCodigo.itens[1]), "");

// Na tela (15/09): a troca mostra quantidade × valor unitário, e o item do
// Sienge se marca solicitado e comprado fora da etapa Sienge também.
const linhaCompra = src.slice(src.indexOf("function LinhaCompra("), src.indexOf("MÓDULO CONTRATOS"));
conf("a linha nova mostra qtd × valor unitário", /\{qtdFmt\} \{it\.un\} × \{fmtBRL\(it\.custoMaterial/.test(linhaCompra), true);
conf("a riscada mostra como era", linhaCompra.includes("antes: {qtdFmt} {it.un} ×"), true);
conf("fora da etapa Sienge dá pra marcar solicitado", linhaCompra.includes('!noSienge && it.canalCompra === "sienge"'), true);
conf("a riscada mostra 'trocado' no lugar dos status", /<td colSpan=\{nCols - 5\}[\s\S]{0,200}troca-pill[\s\S]{0,300}> trocado/.test(linhaCompra), true);

/* ---- A BARRA DO GRUPO NAS COMPRAS (18/09/2026) ----
 *
 * Ela trocou um produto na verba 24 e a barra continuou dizendo "tudo
 * solicitado", escondendo o item novo que entrou pendente: o total de
 * produtos já descartava a linha trocada, mas os contadores de solicitado e
 * comprado não. A linha antiga estava solicitada de antes — 22 solicitados
 * + 1 trocada fechavam os 23.
 *
 * Uma lista só para todos os contadores: é quando cada um filtra do seu
 * jeito que a barra afirma duas coisas.
 */
conf("uma lista só de ativos alimenta os contadores",
  src.includes("const ativos = g.itens.filter((r) => !r.it.troca);"), true);
conf("o total de produtos vem dela", src.includes("const nItens = ativos.length;"), true);
conf("os solicitados também", src.includes("const nSolicitados = ativos.filter((r) => estaSolicitado(r.it)).length;"), true);
conf("os comprados também", src.includes("const nComprados = ativos.filter((r) => r.it.comprado).length;"), true);
conf("e o valor comprado", src.includes("const valorComprado = ativos.reduce((t, r) => t + (r.it.comprado ? r.material : 0), 0);"), true);
/* Linha trocada não se cadastra no Sienge: exigir insumo nela fazia a verba
   inteira parecer não associada. */
conf("a associação do grupo ignora a trocada", src.includes("const grupoAssociado = ativos.every((r) => casamentos.has(r.chave));"), true);

/* O SELO DE TROCA na barra: "sinalizar no grupo se teve alguma troca". */
conf("a barra conta as trocas", src.includes("const nTrocas = g.itens.length - ativos.length;"), true);
conf("e mostra o selo quando houve", /\{nTrocas > 0 && \(/.test(src), true);
conf("com o plural certo", src.includes('{nTrocas === 1 ? "1 troca" : `${nTrocas} trocas`}'), true);
conf("e o selo é um Badge de aviso", src.includes('<Badge tone="warning" title={nTrocas === 1'), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
