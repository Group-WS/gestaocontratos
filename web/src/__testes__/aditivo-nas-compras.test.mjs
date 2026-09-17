/* O aditivo aprovado chegando em Compras de Produtos.
 *
 * Roda com: node web/src/__testes__/aditivo-nas-compras.test.mjs
 *
 * Relato dela em 17/09/2026, com o aditivo 2450/1 (descrição "cor papel",
 * especificação interna "suvinil - cor teste", alocação MAT, custo 15,99):
 *   1. no Plano de Compras veio o texto do cliente, e não a especificação
 *      interna;
 *   2. sendo MAT, ele deveria aparecer em Compras de Produtos, em "Sem canal".
 *
 * E a armadilha que a correção tinha que evitar: o item do aditivo não mora
 * na planilha, então gravar a compra dele pelo índice se perdia calado. O
 * estado de compra dele tem endereço próprio (`comprasAditivo`, na verba).
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
  const padraoDaDescricao = () => null;
  const verbaPorNome = (n) => (String(n || "").toUpperCase().includes("PINTURA") ? "18" : null);
  /* A EAP precisa ter as verbas do teste: sem ela normalizarCategorias
     nao tem onde encaixar a verba, e nunca chega a juntar duas iguais. */
  const eapPadrao = () => [{ num: "18", nome: "Pintura" }, { num: "21", nome: "Móveis Sob Medida" }];
  const parseNumAd = (v) => {
    let s = String(v ?? "").replace(/[^\\d.,-]/g, "").trim();
    if (!s) return 0;
    if (s.includes(",")) s = s.replace(/\\./g, "").replace(",", ".");
    const n = parseFloat(s); return isNaN(n) ? 0 : n;
  };
  const cent = (n) => Math.round(n * 100);
  const totalItem = (i) => cent(parseNumAd(i.qtd) * parseNumAd(i.valor)) / 100;
  const totalGrupo = (g) => (g.itens || []).reduce((a, i) => a + cent(totalItem(i)), 0) / 100;
  const custoItem = (i) => cent(parseNumAd(i.qtd) * parseNumAd(i.custo)) / 100;
  const temCusto = (i) => parseNumAd(i.custo) > 0;
  ${trecho("const ALOC_MAT =", "/* =====[ FIM DO MODELO PURO")}
  ${bloco("function parcelasDoItem(")}
  ${bloco("function parcelasDaPlanilha(")}
  ${bloco("function liberadoParaCompra(")}
  ${bloco("function produtosMAT(")}
  ${bloco("function normalizarCategorias(")}
  return { itensDeAditivo, categoriasComAditivos, produtosMAT, normalizarCategorias };
})()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(58)} ${String(o).padEnd(24)} ${ok ? "" : "esperava " + e}`); };

// O aditivo 2450/1 como está no banco (conferido em 17/09/2026, só leitura).
const aditivo = {
  id: "a1", numero: "2450/1", status: "aprovado",
  doc: { adicao: [{ id: "g1", num: "1", nome: "Pintura", verba: "18", itens: [
    { id: "i1", descricao: "cor papel ", espec: "suvinil - cor teste ", alocacao: "MAT", custo: "15,99", valor: "1500", qtd: "1", unidade: "un", ambiente: "" },
  ] }], supressao: [] },
};
const idDoItem = "aditivo-a1-g1-i1";
const planilha = () => [
  { num: "18", nome: "Pintura", itens: [{ desc: "Tinta acrílica", codigo: "18.1", totalMaterial: 200, liberadoCompra: { em: "x" } }] },
  { num: "21", nome: "Móveis Sob Medida", itens: [] },
];
const doAditivo = (cats) => (cats.find((c) => c.num === "18")?.itens || []).find((it) => it.aditivo);

/* ---- 1. A especificação INTERNA vai pro campo que as telas mostram ---- */
const [x] = M.itensDeAditivo([aditivo]);
conf("nome da linha vem da descrição", x?.item.desc, "cor papel");
conf("especificação é a INTERNA, não a do cliente", x?.item.especificacao, "suvinil - cor teste");
conf("o id do item é estável", x?.item.id, idDoItem);

/* ---- 2. Chega em Compras de Produtos, em "Sem canal" ----
   Sem canal = aparece na lista e ainda não tem canalCompra. */
const juntas = M.categoriasComAditivos(planilha(), [aditivo]);
const linhas = M.produtosMAT({ categorias: juntas });
const linhaAd = linhas.find((r) => r.it.aditivo);
conf("o item de aditivo entra nas Compras", !!linhaAd, true);
conf("entra como material (MAT)", linhaAd?.aloc, "MAT");
conf("com o valor do custo, não do preço de venda", linhaAd?.material, 15.99);
conf("e sem canal escolhido", linhaAd?.it.canalCompra ?? "sem canal", "sem canal");
/* O índice do aditivo fica além da planilha: é por isso que ele precisa de
   endereço próprio pra gravar. */
conf("índice do aditivo fica depois dos itens reais", linhaAd?.itemIdx, 1);

/* ---- 3. O estado de compra volta pro item ---- */
const comCompra = planilha();
comCompra[0].comprasAditivo = { [idDoItem]: { canalCompra: "sienge", solicitado: true } };
const ad = doAditivo(M.categoriasComAditivos(comCompra, [aditivo]));
conf("canal escolhido aparece no item", ad?.canalCompra, "sienge");
conf("solicitado aparece no item", ad?.solicitado, true);

/* Guardado em OUTRA verba (o grupo mudou de verba depois da compra), vale
   igual: a busca é pelo id, em todas as verbas. */
const emOutra = planilha();
emOutra[1].comprasAditivo = { [idDoItem]: { comprado: true } };
conf("estado guardado em outra verba ainda vale", doAditivo(M.categoriasComAditivos(emOutra, [aditivo]))?.comprado, true);

/* ---- 4. A compra NUNCA reescreve o que é do aditivo ----
   Descrição, espec, custo e alocação vêm do documento aprovado. */
const tentaReescrever = planilha();
tentaReescrever[0].comprasAditivo = { [idDoItem]: {
  desc: "OUTRA COISA", especificacao: "outra espec", custo: 99999, totalMaterial: 99999, alocacaoManual: "MO", comprado: true } };
const protegido = doAditivo(M.categoriasComAditivos(tentaReescrever, [aditivo]));
conf("descrição continua a do documento", protegido?.desc, "cor papel");
conf("especificação continua a do documento", protegido?.especificacao, "suvinil - cor teste");
conf("custo continua o do documento", protegido?.custo, 15.99);
conf("alocação continua a do documento", protegido?.alocacaoManual, "MAT");
conf("mas o comprado passa", protegido?.comprado, true);

/* ---- 5. Nada disso toca a planilha ---- */
const intacta = planilha();
M.categoriasComAditivos(intacta, [aditivo]);
conf("a planilha original não ganha item", intacta[0].itens.length, 1);

/* ---- 6. Juntar duas verbas não perde compra de nenhuma ---- */
const duplicadas = [
  { num: "18", nome: "Pintura", itens: [], comprasAditivo: { a: { comprado: true } } },
  { num: "18", nome: "Pintura", itens: [], comprasAditivo: { b: { solicitado: true } } },
];
const norm = M.normalizarCategorias(duplicadas);
const pintura = norm.find((c) => c.nome === "Pintura") || {};
conf("juntar mantém a compra da primeira", !!pintura.comprasAditivo?.a, true);
conf("juntar mantém a compra da segunda", !!pintura.comprasAditivo?.b, true);

/* ---- 7. As telas ---- */
const linhaPlano = bloco("function LinhaPlano(");
conf("o Plano mostra a especificação do aditivo", /item\.aditivo[\s\S]*item\.especificacao && <div className="det-espec">/.test(linhaPlano), true);
const compras = src.slice(src.indexOf("function ComprasView("), src.indexOf("/* A situacao do produto no Sienge"));
conf("as Compras juntam os aditivos", compras.includes("categoriasComAditivos(obraCrua.categorias, obraCrua.aditivos)"), true);
conf("linha de aditivo não oferece troca", compras.includes("onAbrirTroca={r.it.aditivo ? undefined"), true);
conf("o App entrega o endereço às Compras", /<ComprasView [^>]*onCompraAditivo=\{atualizarCompraDeAditivo\}/.test(src), true);
conf("o App entrega o endereço ao Plano", /<ComparativoView [^>]*onCompraAditivo=\{atualizarCompraDeAditivo\}/.test(src), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
