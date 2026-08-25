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

const api = eval(`(function () {
    const verbaPorNome = (n) => ({
      "Instalações Elétricas e Iluminação": "05", "Climatização / Exaustão": "20",
      "Móveis Soltos": "24", "Louças, Metais e Equipamentos Especiais": "27",
      "Execução e Mão de Obra": "32", "Pintura": "18", "Serralheria": "22",
    })[n] || null;
    ${trecho("const ALOC_MAT =", "function TagAloc")}
    ${pega("function parcelasDoItem(")}
    ${pega("function parcelasDaPlanilha(")}
    ${pega("function itemAlertas(")}
    ${pega("function matchesFilter(")}
    return { alocacaoDoItem, casaAloc, parcelasDoItem, matchesFilter, partirMaoDeObra,
             separarMOnasVerbasDeContrato, separaMOautomatico, achaVerbaMO,
             ALOC_MAT, ALOC_MO, ALOC_AMBOS, FILTROS_ALOC, ROTULO_ALOC, NOME_ALOC };
  })()`);
const { alocacaoDoItem, casaAloc, parcelasDoItem, matchesFilter, partirMaoDeObra,
        separarMOnasVerbasDeContrato, separaMOautomatico,
        ALOC_MAT, ALOC_MO, ALOC_AMBOS, FILTROS_ALOC, ROTULO_ALOC, NOME_ALOC } = api;

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

/* ---- 6. correção na mão: manda na classificação E no dinheiro ---- */
// O que a planilha traz é leitura, não decreto. Item lançado inteiro na
// coluna de material às vezes é serviço, e só quem conhece a obra sabe.
const spot_pra_mo = { ...spot, alocacaoManual: ALOC_MO };
const spot_pra_mat = { ...spot, alocacaoManual: ALOC_MAT };
const spot_devolvido = { ...spot, alocacaoManual: ALOC_AMBOS };

conf("correção manual ganha das parcelas", alocacaoDoItem(spot_pra_mo), ALOC_MO);
conf("... e ganha até do que o avulso declarou", alocacaoDoItem({ ...avulso_mat, alocacaoManual: ALOC_MO }), ALOC_MO);

conf("virou MO: material zera", parcelasDoItem(spot_pra_mo).material, 0);
conf("virou MO: mão de obra recebe o total", parcelasDoItem(spot_pra_mo).mo, 362);
conf("virou MAT: material recebe o total", parcelasDoItem(spot_pra_mat).material, 362);
conf("virou MAT: mão de obra zera", parcelasDoItem(spot_pra_mat).mo, 0);
conf("MAT/MO devolve a divisão da planilha", parcelasDoItem(spot_devolvido).material, 182);
conf("... nos dois lados", parcelasDoItem(spot_devolvido).mo, 180);
conf("a linha fica marcada como corrigida", parcelasDoItem(spot_pra_mo).manual, true);
conf("sem correção, nada de manual", parcelasDoItem(spot).manual, undefined);

/* A garantia que importa: correção move dinheiro de coluna, NUNCA cria
   nem destrói. Se o total do grupo mudasse, uma reclassificação passaria
   a mexer no teto de gastos sem ninguém ter gastado nada. */
const soma = (l) => l.reduce((a, it) => a + parcelasDoItem(it).material + parcelasDoItem(it).mo, 0);
const antes = [spot, so_mat, so_mo];
const depois = [spot_pra_mo, so_mat, { ...so_mo, alocacaoManual: ALOC_MAT }];
conf("MAT+MO do grupo é o mesmo depois de corrigir", soma(depois), soma(antes));
conf("mas o dinheiro trocou de coluna", depois.reduce((a, it) => a + parcelasDoItem(it).material, 0), 900 + 1200);

/* ---- 7. nenhum insumo pode ficar sem alocação ---- */
// Insumo sem alocação não entra em Compras nem vira contrato: some das
// duas pontas sem aparecer em relatório de erro nenhum.
const degenerados = [
  {}, { desc: "só nome" }, { custo: 0 }, { custo: null, tipo: undefined },
  { tipo: "produto" }, { tipo: "servico" }, { totalMaterial: 0, totalMO: 0 },
  { avulso: true }, { qtdExecutivo: 3, un: "un" },
];
const semAloc = degenerados.filter((it) => !alocacaoDoItem(it));
conf("nenhum item degenerado fica sem alocação", semAloc.length, 0);
conf("item vazio cai em MAT (passa pela conferência de compra)", alocacaoDoItem({}), ALOC_MAT);

/* ---- 8. os dois rótulos deixaram de colidir ---- */
// "MAT E MO" (tudo) e "MAT/MO" (as duas parcelas) ficavam lado a lado na
// mesma fila, indistinguíveis. Barra = tudo; mais = na mesma linha.
conf("chip que mostra tudo se chama MAT/MO", FILTROS_ALOC[0].label, "MAT/MO");
conf("a etiqueta das duas parcelas usa +", ROTULO_ALOC.AMBOS, "MAT+MO");
conf("nenhum rótulo de filtro se repete", new Set(FILTROS_ALOC.map((x) => x.label)).size, FILTROS_ALOC.length);

/* ---- 9. separar a MO em linha própria ---- */
const par = partirMaoDeObra({ ...spot, codigo: "5.12" }, "05", "32", "32.mo1");
conf("o original fica só com o material", parcelasDoItem(par.original).material, 182);
conf("... e sem mão de obra", parcelasDoItem(par.original).mo, 0);
conf("a linha nova leva só a mão de obra", parcelasDoItem(par.linhaMO).mo, 180);
conf("... e nada de material", parcelasDoItem(par.linhaMO).material, 0);
conf("mesma descrição", par.linhaMO.desc, spot.desc);
conf("total preservado (182 + 180 = 362)",
  parcelasDoItem(par.original).material + parcelasDoItem(par.linhaMO).mo, 362);
conf("as duas pontas do vínculo existem",
  !!par.original.moSeparada && par.linhaMO.separadoDe.codigo === "5.12", true);
// Compra é do material; levar junto o que já foi comprado faria a mesma
// compra aparecer duas vezes.
conf("a linha de MO não herda a compra",
  [par.linhaMO.comprado, par.linhaMO.liberado, par.linhaMO.compraDecidida].filter(Boolean).length
  + [par.linhaMO.valorComprado, par.linhaMO.qtdComprada, par.linhaMO.sienge].filter((x) => x != null).length, 0);
conf("não separa duas vezes", partirMaoDeObra(par.original, "05", "32", "32.mo2"), null);
conf("não separa quem não tem MO", partirMaoDeObra(so_mat, "24", "32", "32.mo1"), null);

/* ---- 10. as verbas em que a MO é sempre contratada ---- */
conf("iluminação separa sozinha", separaMOautomatico("05", "Instalações Elétricas e Iluminação"), true);
conf("climatização separa sozinha", separaMOautomatico("20", "Climatização / Exaustão"), true);
conf("móveis soltos separa sozinho", separaMOautomatico("24", "Móveis Soltos"), true);
conf("louças e metais separa sozinho", separaMOautomatico("27", "Louças, Metais e Equipamentos Especiais"), true);
conf("pintura NÃO separa sozinha", separaMOautomatico("18", "Pintura"), false);
// A EAP renumerou uma vez: casar por número cru marcaria o grupo errado.
conf("decide pelo nome, não pelo número velho", separaMOautomatico("06", "Climatização / Exaustão"), true);

const cats = [
  { num: "05", nome: "Instalações Elétricas e Iluminação", itens: [{ ...spot, codigo: "5.12" }, { ...so_mat, codigo: "5.13" }] },
  { num: "18", nome: "Pintura", itens: [{ ...spot, codigo: "18.1" }] },
  { num: "32", nome: "Execução e Mão de Obra", itens: [] },
];
const r = separarMOnasVerbasDeContrato(cats);
const mo32 = r.categorias.find((c) => c.num === "32").itens;
conf("separou 1 item (só o da iluminação)", r.separados, 1);
conf("a linha foi pra verba de mão de obra", mo32.length, 1);
conf("... com o valor da MO", parcelasDoItem(mo32[0]).mo, 180);
conf("pintura ficou intacta", !!r.categorias.find((c) => c.num === "18").itens[0].moSeparada, false);

// Rodar de novo não pode duplicar: o item já separado não separa outra vez.
const r2 = separarMOnasVerbasDeContrato(r.categorias);
conf("rodar de novo não duplica", r2.separados, 0);

// O dinheiro total da obra não muda ao separar — só troca de verba.
const totalDe = (cs) => cs.reduce((a, c) => a + (c.itens || []).reduce((b, it) => {
  const pp = parcelasDoItem(it); return b + pp.material + pp.mo;
}, 0), 0);
conf("total da obra não muda ao separar", totalDe(r.categorias), totalDe(cats));

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
