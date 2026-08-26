/* Dashboard MO: o que entra e quanto vale.
 *
 * Roda com: node web/src/__testes__/dashboard-mo.test.mjs
 *
 * A lista de mão de obra era `it.tipo !== "produto"` — um campo de uma
 * escolha só. O spot de sobrepor (R$ 182 de material + R$ 180 de mão de
 * obra) era carimbado "produto" e os R$ 180 dele nunca chegavam em
 * Contratos. Na 2519 isso são 88 itens.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "App.jsx"), "utf8");
const bloco = (assinatura, fim = "\n}\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei no App.jsx: ${assinatura}`);
  const f = src.indexOf(fim, i);
  if (f === -1) throw new Error(`não achei o fim de: ${assinatura}`);
  return src.slice(i, f + fim.length);
};
const trecho = (de, ate) => {
  const i = src.indexOf(de), f = src.indexOf(ate);
  if (i === -1 || f === -1) throw new Error(`não achei o intervalo: ${de} .. ${ate}`);
  return src.slice(i, f);
};

const { servicosMO, produtosMAT } = eval(`(function () {
  /* Sem padrao da empresa: estes testes verificam o que a PLANILHA e as
     regras de verba decidem. O padrao por descricao tem teste proprio em
     alocacao-padrao.test.mjs. */
  const padraoDaDescricao = () => null;
  const verbaPorNome = (n) => ({ "Gesso e Drywall": "10", "Pintura": "18", "Serralheria": "22",
    "Instalações Elétricas e Iluminação": "05", "Execução e Mão de Obra": "32" })[n] || null;
  ${trecho("const ALOC_MAT =", "/* =====[ FIM DO MODELO PURO")}
  ${bloco("function parcelasDoItem(")}
  ${bloco("function parcelasDaPlanilha(")}
  ${bloco("function servicosMO(")}
  ${bloco("function produtosMAT(")}
  return { servicosMO, produtosMAT };
})()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(52)} ${String(o).padEnd(12)} ${ok ? "" : "esperava " + e}`); };

const obra = { categorias: [
  { num: "05", nome: "Instalações Elétricas e Iluminação", itens: [
    // O caso que motivou tudo: tipo diz "produto", mas tem MO.
    { desc: "Spot de sobrepor", tipo: "produto", totalMaterial: 182, totalMO: 180, custo: 362 },
    { desc: "Luminária", tipo: "produto", totalMaterial: 900, totalMO: 0, custo: 900 },
  ] },
  { num: "18", nome: "Pintura", itens: [
    { desc: "Pintura 3 demãos", tipo: "servico", totalMaterial: 0, totalMO: 23385, custo: 23385 },
    { desc: "TÍTULO DO BLOCO", ehTitulo: true, custo: 0 },
  ] },
  { num: "10", nome: "Gesso e Drywall", itens: [
    { desc: "Forro de gesso", tipo: "servico", totalMaterial: 0, totalMO: 5173.5, custo: 5173.5 },
  ] },
] };

const rows = servicosMO(obra);
conf("entra quem TEM mão de obra", rows.length, 3);
conf("... incluindo o item marcado como produto",
  rows.some((r) => r.it.desc === "Spot de sobrepor"), true);
conf("material puro fica de fora", rows.some((r) => r.it.desc === "Luminária"), false);
conf("linha de título fica de fora", rows.some((r) => r.it.ehTitulo), false);

// O valor que viaja é a PARCELA de mão de obra, não o custo do item:
// mandar os R$ 362 do spot pro contrato cobraria o material duas vezes.
const spot = rows.find((r) => r.it.desc === "Spot de sobrepor");
conf("o valor é a parcela de MO, não o custo", spot.mo, 180);
conf("... e não os 362 do item inteiro", spot.mo === spot.it.custo, false);

conf("o orçado é a soma das parcelas", rows.reduce((a, r) => a + r.mo, 0), 180 + 23385 + 5173.5);
// O contrato pode juntar verbas diferentes — o mesmo fornecedor às vezes
// pega gesso e pintura.
conf("a seleção atravessa verbas", new Set(rows.map((r) => r.catNum)).size, 3);
conf("cada linha sabe de que verba veio", spot.catNum, "05");
// A chave tem que ser única, senão duas linhas viram uma na seleção.
conf("chave única por serviço", new Set(rows.map((r) => r.chave)).size, rows.length);

/* ---- o espelho: Compras de Produtos ---- */
// A lista de compras tinha o MESMO defeito, do outro lado: era
// `tipo === "produto"`, então item marcado como serviço com material
// lançado nunca aparecia pra comprar.
const prods = produtosMAT(obra);
// Spot (182 de material) e luminária (900). Pintura e gesso são MO pura.
conf("entra quem TEM material", prods.length, 2);
conf("... incluindo o item com as duas parcelas",
  prods.some((r) => r.it.desc === "Spot de sobrepor"), true);
conf("serviço puro fica de fora", prods.some((r) => r.it.desc === "Pintura 3 demãos"), false);
conf("linha de título fica de fora", prods.some((r) => r.it.ehTitulo), false);
// O valor que viaja é a PARCELA de material: mandar os R$ 362 do spot
// pra compra pagaria a mão de obra dele como se fosse mercadoria.
const spotC = prods.find((r) => r.it.desc === "Spot de sobrepor");
conf("o valor é a parcela de material", spotC.material, 182);
conf("... e não o custo do item", spotC.material === spotC.it.custo, false);
// Nenhum item pode aparecer nas DUAS telas com o valor cheio — cada uma
// leva a sua parcela, e as duas somadas dão o item.
const moDoSpot = rows.find((r) => r.it.desc === "Spot de sobrepor");
conf("as duas telas somadas dão o item inteiro", spotC.material + moDoSpot.mo, 362);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
