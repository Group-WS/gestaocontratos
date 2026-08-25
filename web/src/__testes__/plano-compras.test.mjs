/* Testes da seleção do Plano de Compras.
 *
 * Roda com: node web/src/__testes__/plano-compras.test.mjs
 *
 * Guardam três decisões:
 *
 *   1. Um item tem DUAS parcelas, não um destino. O Spot de R$ 362 é
 *      R$ 182 de material (Compras) + R$ 180 de mão de obra (Contratos).
 *      Antes o app carimbava "produto" e mandava os R$ 362 pra Compras,
 *      sumindo com a mão de obra: na 2519 são 88 itens e R$ 1,5 mi.
 *   2. Quando a planilha não trouxe as colunas (importação por PDF), o
 *      app cai no palpite antigo — produto é tudo material — mas marca a
 *      linha como estimada, pra ninguém ler palpite como número lançado.
 *   3. Sugestão é sugestão: assim que alguém clica, `compraDecidida` fica
 *      de pé e a sugestão sai de cena — inclusive quando a decisão foi
 *      "não". Sem isso, a linha recusada voltaria marcada no próximo
 *      render, e a pessoa desmarcaria a mesma coisa pra sempre.
 */
const src = (await import("fs")).readFileSync(new URL("../App.jsx", import.meta.url), "utf8");

/* Recorta PEÇAS NOMEADAS do App.jsx pra rodar de verdade.

   Não fatiar intervalo. Este teste já quebrou duas vezes cortando "de X
   até Y": primeiro quando CategoriaBlock foi substituído, depois quando
   um componente novo apareceu entre parcelasDoItem e GrupoPlano — nas
   duas o eval recebeu JSX e morreu com "Unexpected token '<'", que não
   diz nada sobre a causa.

   Pedaço nomeado só quebra quando a função que ele nomeia some de fato,
   e aí o erro diz qual. */
const bloco = (assinatura, fim = "\n}\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei no App.jsx: ${assinatura}`);
  const f = src.indexOf(fim, i);
  if (f === -1) throw new Error(`não achei o fim de: ${assinatura}`);
  return src.slice(i, f + fim.length);
};
const ate = (assinatura, terminador) => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei no App.jsx: ${assinatura}`);
  const f = src.indexOf(terminador, i);
  if (f === -1) throw new Error(`não achei o fim de: ${assinatura}`);
  return src.slice(i, f + terminador.length);
};

const codigo = [
  src.match(/^const ehProduto = .*$/m)[0],
  bloco("function parcelasDoItem("),
  bloco("function parcelasDaPlanilha("),
  ate("const VERBAS_DE_COMPRA = new Set([", "]);"),
  ate("const sugeridoParaCompra =", "VERBAS_DE_COMPRA.has(catNum);"),
].join("\n");

const { parcelasDoItem, sugeridoParaCompra, VERBAS_DE_COMPRA } = eval(`(function () {
  ${src.match(/^const ALOC_MAT = .*$/m)[0]}
  ${codigo}
  return { parcelasDoItem, sugeridoParaCompra, VERBAS_DE_COMPRA };
})()`);

let falhas = 0;
const conf = (nome, obtido, esperado) => {
  const ok = String(obtido) === String(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome.padEnd(52)} ${String(obtido).padEnd(10)} ${ok ? "" : "esperava " + esperado}`);
};

// o item do exemplo da Priscila
const spot = {
  tipo: "produto", codigo: "5.12", desc: "Spot de Sobrepor Redondo Loyo Up MR16",
  qtdExecutivo: 1, custo: 362, custoMaterial: 182, custoMO: 180,
  totalMaterial: 182, totalMO: 180,
};

console.log("=== AS DUAS PARCELAS ===");
conf("material do spot", parcelasDoItem(spot).material, 182);
conf("mão de obra do spot", parcelasDoItem(spot).mo, 180);
conf("nada estimado quando a planilha trouxe", parcelasDoItem(spot).estimado, false);

// quantidade multiplica quando só veio o unitário
const semTotais = { ...spot, totalMaterial: null, totalMO: null, qtdExecutivo: 3 };
conf("total sai do unitário × quantidade", parcelasDoItem(semTotais).material, 546);

console.log("\n=== SEM AS COLUNAS (PDF): PALPITE DECLARADO ===");
const soTotal = { tipo: "produto", custo: 500, qtdExecutivo: 1, custoMaterial: null, custoMO: null, totalMaterial: null, totalMO: null };
conf("produto vira tudo material", parcelasDoItem(soTotal).material, 500);
conf("e nada de mão de obra", parcelasDoItem(soTotal).mo, 0);
conf("marcado como estimado", parcelasDoItem(soTotal).estimado, true);
const servico = { ...soTotal, tipo: "servico" };
conf("serviço vira tudo mão de obra", parcelasDoItem(servico).mo, 500);
conf("e nada de material", parcelasDoItem(servico).material, 0);

console.log("\n=== A SUGESTÃO ===");
conf("verba de compra + material = sugerido", sugeridoParaCompra(spot, "05"), true);
conf("verba fora da lista não sugere", sugeridoParaCompra(spot, "03"), false);
conf("móveis soltos sugere", sugeridoParaCompra(spot, "24"), true);
conf("as duas verbas novas entraram", VERBAS_DE_COMPRA.has("33") && VERBAS_DE_COMPRA.has("34"), true);
// serviço puro não tem o que comprar
const soMO = { tipo: "servico", custo: 900, qtdExecutivo: 1, totalMaterial: 0, totalMO: 900 };
conf("item só de mão de obra não sugere", sugeridoParaCompra(soMO, "05"), false);
// linha de título nomeia um conjunto, não é item
conf("linha de título não sugere", sugeridoParaCompra({ ...spot, ehTitulo: true }, "05"), false);

console.log("\n=== DECIDIDO SAI DE CENA ===");
conf("aceito para de ser sugestão", sugeridoParaCompra({ ...spot, compraDecidida: true, liberado: true }, "05"), false);
// o caso que importa: recusar tem que grudar, senão a linha volta marcada
conf("RECUSADO para de ser sugestão", sugeridoParaCompra({ ...spot, compraDecidida: true, liberado: false }, "05"), false);

console.log(falhas === 0 ? "\nTUDO OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
