/* Alocação de recurso no Plano de Compras: MAT, MO e MAT/MO.
 *
 * Roda com: node web/src/__testes__/plano-alocacao.test.mjs
 *
 * As funções são EXTRAÍDAS do App.jsx e executadas de verdade — não
 * reescritas aqui. Teste que reimplementa a regra passa mesmo quando a
 * tela quebra, que é exatamente o erro que este arquivo existe pra pegar.
 *
 * O que está em jogo: o item do executivo não é produto OU serviço. O
 * spot de sobrepor tem R$ 182 de material e R$ 180 de mão de obra, e o
 * campo `tipo` só comporta uma escolha. Enquanto a tela decidia por ele,
 * a mão de obra de 88 itens da 2519 ficava fora da conta.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "App.jsx"), "utf8");
const pega = (marca, fim = "\n}\n") => {
  const i = src.indexOf(marca);
  if (i === -1) throw new Error(`não achei no App.jsx: ${marca}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};
// Mesma guarda do pega(): marca que sumiu tem que dizer o nome, senão o
// slice devolve meio arquivo e o erro vira "Unexpected token '<'".
const trecho = (de, ate) => {
  const i = src.indexOf(de), f = src.indexOf(ate);
  if (i === -1) throw new Error(`não achei no App.jsx o início: ${de}`);
  if (f === -1) throw new Error(`não achei no App.jsx o fim: ${ate}`);
  return src.slice(i, f);
};

const { alocacaoDoItem, casaAloc, parcelasDoItem, matchesFilter, ALOC_MAT, ALOC_MO, ALOC_AMBOS, FILTROS_ALOC } =
  eval(`(function () {
    ${trecho("const ALOC_MAT =", "function TagAloc")}
    ${pega("function parcelasDoItem(")}
    ${pega("function itemAlertas(")}
    ${pega("function matchesFilter(")}
    return { alocacaoDoItem, casaAloc, parcelasDoItem, matchesFilter, ALOC_MAT, ALOC_MO, ALOC_AMBOS, FILTROS_ALOC };
  })()`);

let f = 0;
const conf = (n, obtido, esperado) => {
  const ok = String(obtido) === String(esperado);
  if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(52)} ${String(obtido).padEnd(10)} ${ok ? "" : "esperava " + esperado}`);
};

/* ---- 1. a alocação sai das PARCELAS, não do campo `tipo` ---- */
const spot = { tipo: "produto", desc: "Spot de sobrepor Loyo Up MR16", totalMaterial: 182, totalMO: 180, custo: 362 };
const so_mat = { tipo: "produto", desc: "Cuba", totalMaterial: 900, totalMO: 0, custo: 900 };
const so_mo = { tipo: "servico", desc: "Instalação de cortinas", totalMaterial: 0, totalMO: 1200, custo: 1200 };
// O caso que motivou a mudança: marcado como serviço, mas com material.
const servico_com_material = { tipo: "servico", desc: "Marcenaria com insumo", totalMaterial: 500, totalMO: 0, custo: 500 };

conf("item com as duas parcelas é MAT/MO", alocacaoDoItem(spot), ALOC_AMBOS);
conf("só material é MAT", alocacaoDoItem(so_mat), ALOC_MAT);
conf("só mão de obra é MO", alocacaoDoItem(so_mo), ALOC_MO);
conf("serviço COM material é MAT (não segue o tipo)", alocacaoDoItem(servico_com_material), ALOC_MAT);

/* ---- 2. sem coluna de parcela, cai no tipo e marca estimado ---- */
const pdf_prod = { tipo: "produto", desc: "veio de PDF", custo: 300 };
const pdf_serv = { tipo: "servico", desc: "veio de PDF", custo: 300 };
conf("sem parcela, produto vira MAT", alocacaoDoItem(pdf_prod), ALOC_MAT);
conf("sem parcela, serviço vira MO", alocacaoDoItem(pdf_serv), ALOC_MO);
conf("e a linha fica marcada como estimada", parcelasDoItem(pdf_prod).estimado, true);

/* ---- 3. os chips são PARTIÇÃO: as três contas fecham com o total ---- */
const lista = [spot, so_mat, so_mo, servico_com_material, pdf_prod, pdf_serv];
const conta = (id) => lista.filter((it) => casaAloc(it, id)).length;
conf("MAT + MO + MAT/MO = total da lista", conta(ALOC_MAT) + conta(ALOC_MO) + conta(ALOC_AMBOS), lista.length);
conf('"todos" traz a lista inteira', conta("todos"), lista.length);
conf("nenhum item cai em dois chips", conta(ALOC_MAT) + conta(ALOC_MO) + conta(ALOC_AMBOS), conta("todos"));
conf("os chips declarados são 4", FILTROS_ALOC.length, 4);

/* ---- 4. o filtro de situação segue a alocação, não o tipo ---- */
// Era aqui que a tela se contradizia: a linha aparecia como MAT na lista
// e sumia ao filtrar "Liberado p/ compra", porque `tipo` dizia serviço.
conf("serviço-com-material passa em 'aguardando'", matchesFilter({ ...servico_com_material }, "aguardando"), true);
conf("serviço-com-material passa em 'liberado'", matchesFilter({ ...servico_com_material, liberado: true }, "liberado"), true);
conf("MO puro NÃO entra no fluxo de compras", matchesFilter({ ...so_mo, liberado: true }, "liberado"), false);
conf("MAT/MO entra no fluxo de compras", matchesFilter({ ...spot, liberado: true }, "liberado"), true);

/* ---- 5. avulso: declara a própria alocação e não move total nenhum ---- */
// A Priscila decidiu que a avulsa registra só o pedido. Sem valor, ela
// não pode empurrar o total da verba nem o CMV — é a garantia de que um
// pedido não vira orçamento sem ninguém ter orçado.
const avulso_mat = { avulso: true, alocacao: ALOC_MAT, desc: "Spot que quebrou", qtdExecutivo: 4, custo: null };
const avulso_mo = { avulso: true, alocacao: ALOC_MO, desc: "Reinstalação", qtdExecutivo: 1, custo: null };
const avulso_ambos = { avulso: true, alocacao: ALOC_AMBOS, desc: "Bancada + montagem", qtdExecutivo: 1, custo: null };

conf("avulso MAT respeita o que foi declarado", alocacaoDoItem(avulso_mat), ALOC_MAT);
conf("avulso MO respeita o que foi declarado", alocacaoDoItem(avulso_mo), ALOC_MO);
conf("avulso MAT/MO respeita o que foi declarado", alocacaoDoItem(avulso_ambos), ALOC_AMBOS);

const p = parcelasDoItem(avulso_mat);
conf("avulso não soma material", p.material, 0);
conf("avulso não soma mão de obra", p.mo, 0);

const grupo = [spot, so_mat, so_mo];
const matAntes = grupo.reduce((a, it) => a + parcelasDoItem(it).material, 0);
const moAntes = grupo.reduce((a, it) => a + parcelasDoItem(it).mo, 0);
const comAvulso = [...grupo, avulso_mat, avulso_ambos];
conf("total MAT do grupo não muda com avulso", comAvulso.reduce((a, it) => a + parcelasDoItem(it).material, 0), matAntes);
conf("total MO do grupo não muda com avulso", comAvulso.reduce((a, it) => a + parcelasDoItem(it).mo, 0), moAntes);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
