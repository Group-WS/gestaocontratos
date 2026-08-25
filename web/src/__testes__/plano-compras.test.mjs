/* Testes da seleção do Plano de Compras.
 *
 * Roda com: node web/src/__testes__/plano-compras.test.mjs
 *
 * Guardam duas decisões:
 *
 *   1. Um item tem DUAS parcelas, não um destino. O Spot de R$ 362 é
 *      R$ 182 de material (Compras) + R$ 180 de mão de obra (Contratos).
 *      Antes o app carimbava "produto" e mandava os R$ 362 pra Compras,
 *      sumindo com a mão de obra: na 2519 são 88 itens e R$ 1,5 mi.
 *   2. Quando a planilha não trouxe as colunas (importação por PDF), o
 *      app cai no palpite antigo — produto é tudo material — mas marca a
 *      linha como estimada, pra ninguém ler palpite como número lançado.
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
].join("\n");

const { parcelasDoItem } = eval(`(function () {
  // Sem padrao da empresa: aqui se testa o que a planilha decide.
  const padraoDaDescricao = () => null;
  ${src.match(/^const ALOC_MAT = .*$/m)[0]}
  ${codigo}
  return { parcelasDoItem };
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

console.log(falhas === 0 ? "\nTUDO OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
