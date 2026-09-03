/* O CATALOGO.
 *
 * Duas coisas aqui erram em silencio: o subgrupo, que classifica errado
 * e ninguem percebe ate' procurar; e a emenda de dinheiro entre o banco
 * (centavos) e o item da obra (reais), que ja' inflou custo em milhoes
 * neste app uma vez. */
import assert from "node:assert";
import { subgrupoDe, centavos, reais, produtoParaItem, filtrarProdutos,
         porPrateleira, precoVelho, mesesDesde } from "../lib/catalogoModelo.js";

let ok = 0;
const t = (nome, f) => { f(); console.log("ok  ", nome); ok++; };

/* --- os 56 produtos reais dela, um de cada tipo --- */
t("Iluminacao: cada familia cai no seu subgrupo", () => {
  const e = (d, s) => assert.strictEqual(subgrupoDe(d, "05"), s, d);
  e("SPOT EMBUTIDO POWERUS 3 LEDS BRANCO 6W 3000K", "Spots");
  e("SPOT SOBREPOR REDONDOD LOYO UP MR16 BRANCO", "Spots");
  e("Lâmpada LED SOF dicróica MR16 40° | 7W – 3000K", "Lâmpadas");
  e("FITA LED NOR 2835 12V 8W 3000K", "Fitas LED");
  e("FONTE SLIM 12V 24W", "Fontes");
  e("PERFIL PARA LED DE SOBREPOR", "Perfis");
});

t("o mais especifico ganha: perfil de LED e' perfil, nao fita", () =>
  assert.strictEqual(subgrupoDe("PERFIL LED MINI NEON FLEX 12V 8W 3000K", "05"), "Perfis"));

t("Loucas e Metais: as nove familias", () => {
  const e = (d, s) => assert.strictEqual(subgrupoDe(d, "27"), s, d);
  e("Cuba de embutir Tramontina Lavínia 56 BL em Aço Inox", "Cubas e tanques");
  e("Tanque de Encaixe Tramontina Hera 34 L", "Cubas e tanques");
  e("Chuveiro Q200 de teto DocolHeaven cromado", "Chuveiros e duchas");
  e("Ducha higiênica com registro e derivação Lift cromado", "Chuveiros e duchas");
  e("Acabamento para registro Lift cromado", "Acabamentos de registro");
  e("Monocomando de mesa para cozinha Gali cromado", "Torneiras e monocomandos");
  e("Torneira para cozinha bica alta Gali", "Torneiras e monocomandos");
  e("Papeleira Trip cromado", "Acessórios de banho");
  e("Cabide de parede para lavatório Hope cromado", "Acessórios de banho");
  e("SIFÃO - 01 POR CUBA/ ENGATE FLEXÍVEL", "Complementos hidráulicos");
});

/* Vieram do catalogo real da BRACCI (343 produtos): termos que a lista
   original nao cobria e ficaram sem subgrupo ate essa extracao mostrar
   os numeros reais (43 toalheiros, 13 ganchos, 11 prateleiras, 7
   banheiras). */
t("Loucas e Metais: familias que vieram do catalogo BRACCI", () => {
  const e = (d, s) => assert.strictEqual(subgrupoDe(d, "27"), s, d);
  e("TOALHEIRO ROSTO CROMADO VERCCI", "Acessórios de banho");
  e("TOALHEIRO DUPLO PRETO FOSCO VERCCI", "Acessórios de banho");
  e("GANCHO SIMPLES DOURADO VERCCI", "Acessórios de banho");
  e("PORTA PAPEL HIGIENICO CROMADO VERCCI", "Acessórios de banho");
  e("PRATELEIRA VIDRO VERCCI CROMADA", "Acessórios de banho");
  e("BANHEIRA DE HIDROMASSAGEM 1,70M", "Banheiras");
});

t("ducha COM registro e' ducha, e nao acabamento de registro", () =>
  assert.strictEqual(subgrupoDe("Ducha higiênica com registro e derivação Lift", "27"), "Chuveiros e duchas"));

t("Moveis Soltos: colchao", () => {
  ["Colchão Solteiro 88x188cm", "Colchão Queen 158x198cm", "Colchão King 193x203cm"]
    .forEach((d) => assert.strictEqual(subgrupoDe(d, "24"), "Colchões", d));
});

t("sem padrao que case fica SEM subgrupo — nao inventa 'Outros'", () => {
  assert.strictEqual(subgrupoDe("Peça que ninguém previu", "05"), null);
  assert.strictEqual(subgrupoDe("Spot embutido", "99"), null);   // verba sem regra
  assert.strictEqual(subgrupoDe("", "05"), null);
});

/* --- dinheiro: a emenda entre centavos e reais --- */
t("centavos e reais fecham nos dois sentidos", () => {
  assert.strictEqual(centavos(1234.56), 123456);
  assert.strictEqual(reais(123456), 1234.56);
  assert.strictEqual(centavos("223.38"), 22338);
  assert.strictEqual(centavos(null), null);
  assert.strictEqual(reais(null), null);
});

t("centavo nao se perde no arredondamento", () =>
  assert.strictEqual(centavos(0.07 * 3), 21));   // 0.21000000000000002

t("o item da obra sai em REAIS, nao em centavos", () => {
  const it = produtoParaItem({ id: "x", descricao: "SPOT", precoRef: 12345, fornecedor: "Nordecor" }, 4);
  assert.strictEqual(it.custoUnitario, 123.45);
  assert.strictEqual(it.totalMaterial, 493.8);
  assert.strictEqual(it.custoMaterial, 123.45);
});

t("produto de catalogo entra como MATERIAL, e nao comprado", () => {
  const it = produtoParaItem({ id: "x", descricao: "SPOT", precoRef: 100 });
  assert.strictEqual(it.tipo, "produto");
  assert.strictEqual(it.custoMO, null);
  assert.strictEqual(it.comprado, undefined);
});

t("produto sem preco vira linha sem custo, e nao linha zerada", () => {
  const it = produtoParaItem({ id: "x", descricao: "SIFÃO", precoRef: null }, 2);
  assert.strictEqual(it.custoUnitario, null);
  assert.strictEqual(it.totalMaterial, null);
});

t("a linha guarda de onde veio", () =>
  assert.strictEqual(produtoParaItem({ id: "abc", descricao: "X" }).doCatalogo, "abc"));

/* --- preco a mao envelhece --- */
t("preco velho se anuncia", () => {
  const hoje = new Date().toISOString().slice(0, 10);
  const antigo = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
  assert.strictEqual(precoVelho(hoje), false);
  assert.strictEqual(precoVelho(antigo), true);
  assert.ok(mesesDesde(antigo) >= 12);
  assert.strictEqual(precoVelho(null), false);   // sem data, nao acusa
});

/* --- busca e prateleira --- */
const CAT = [
  { id: 1, verba: "05", subgrupo: "Spots", descricao: "SPOT EMBUTIDO POWERUS", fornecedor: "NORDECOR", ativo: true },
  { id: 2, verba: "05", subgrupo: "Fontes", descricao: "FONTE 12V 100W", fornecedor: "NORDECOR", ativo: true },
  { id: 3, verba: "05", subgrupo: null, descricao: "Peça sem classificar", fornecedor: "MK", ativo: true },
  { id: 4, verba: "27", subgrupo: "Torneiras e monocomandos", descricao: "Torneira Gali", fornecedor: "Docol", ativo: true },
  { id: 5, verba: "27", subgrupo: "Torneiras e monocomandos", descricao: "Item desativado", fornecedor: "Docol", ativo: false },
];

t("busca ignora acento e caixa", () =>
  assert.deepStrictEqual(filtrarProdutos(CAT, { termo: "PEÇA" }).map((p) => p.id), [3]));

t("desativado nao aparece", () =>
  assert.deepStrictEqual(filtrarProdutos(CAT, { fornecedor: "Docol" }).map((p) => p.id), [4]));

t("filtra por verba e por subgrupo", () => {
  assert.strictEqual(filtrarProdutos(CAT, { verba: "05" }).length, 3);
  assert.deepStrictEqual(filtrarProdutos(CAT, { verba: "05", subgrupo: "Fontes" }).map((p) => p.id), [2]);
});

t("o que falta classificar fica por ULTIMO, e nao some", () => {
  const p = porPrateleira(filtrarProdutos(CAT, { verba: "05" }));
  assert.deepStrictEqual(p[0].subgrupos.map((s) => s.nome), ["Fontes", "Spots", ""]);
});

console.log(`\nOK — ${ok} casos`);

/* ---------- AS DUAS DESCRICOES ---------- */
import { descricaoDoExecutivo, descricaoDoCriativo, descricaoDoCriativoEn } from "../lib/catalogoModelo.js";
{
  let ok2 = 0;
  const t2 = (nome, f) => { f(); console.log("ok  ", nome); ok2++; };
  const cheio = {
    descricao: "SPOT EMBUTIDO POWERUS 3 LEDS BRANCO 6W 3000K",
    descricaoCriativo: "Spot embutido branco",
    descricaoEn: "Recessed white spotlight",
  };

  t2("o executivo leva a descricao tecnica", () =>
    assert.strictEqual(descricaoDoExecutivo(cheio), "SPOT EMBUTIDO POWERUS 3 LEDS BRANCO 6W 3000K"));

  t2("o criativo leva a curta", () =>
    assert.strictEqual(descricaoDoCriativo(cheio), "Spot embutido branco"));

  t2("sem a curta, o criativo usa a tecnica — nao fica vazio", () =>
    assert.strictEqual(descricaoDoCriativo({ descricao: "SPOT X" }), "SPOT X"));

  t2("curta em branco conta como ausente", () =>
    assert.strictEqual(descricaoDoCriativo({ descricao: "SPOT X", descricaoCriativo: "   " }), "SPOT X"));

  t2("em ingles: a inglesa, senao a curta, senao a tecnica", () => {
    assert.strictEqual(descricaoDoCriativoEn(cheio), "Recessed white spotlight");
    assert.strictEqual(descricaoDoCriativoEn({ descricao: "A", descricaoCriativo: "B" }), "B");
    assert.strictEqual(descricaoDoCriativoEn({ descricao: "A" }), "A");
  });

  t2("o item da obra continua saindo com a tecnica", () => {
    const it = produtoParaItem({ ...cheio, id: "x", precoRef: 100 });
    assert.strictEqual(it.desc, "SPOT EMBUTIDO POWERUS 3 LEDS BRANCO 6W 3000K");
  });

  t2("a busca acha pelos DOIS textos", () => {
    const l = [{ id: 1, verba: "05", descricao: "SPOT EMBUTIDO POWERUS", descricaoCriativo: "Luminária discreta", ativo: true }];
    assert.strictEqual(filtrarProdutos(l, { termo: "discreta" }).length, 1);
    assert.strictEqual(filtrarProdutos(l, { termo: "POWERUS" }).length, 1);
  });

  console.log(`OK — mais ${ok2} casos`);
}

/* ---------- ACABAMENTOS METALICOS (cor de torneira/puxador/ferragem) ---------- */
{
  let ok3 = 0;
  const t3 = (nome, f) => { f(); console.log("ok  ", nome); ok3++; };

  t3("a cor do metal cai em Acabamentos metalicos, nao em Torneiras", () => {
    ["ACABAMENTO METAL PRETO (BP)", "ACABAMENTO METAL CROMADO (C)",
     "ACABAMENTO METAL DOURADO ESCOVADO (BG)", "ACABAMENTO METAL BRANCO (W)"]
      .forEach((d) => assert.strictEqual(subgrupoDe(d, "27"), "Acabamentos metálicos", d));
  });

  t3("peca de verdade continua caindo onde caia antes", () => {
    assert.strictEqual(subgrupoDe("Torneira Lift cromada", "27"), "Torneiras e monocomandos");
    assert.strictEqual(subgrupoDe("Acabamento para registro Lift cromado", "27"), "Acabamentos de registro");
    assert.strictEqual(subgrupoDe("SIFÃO - 01 POR CUBA", "27"), "Complementos hidráulicos");
  });

  console.log(`OK — mais ${ok3} casos`);
}

/* ---------- DESCRICAO REPETIDA ---------- */
import { normalizarDescricao, duplicatasDe } from "../lib/catalogoModelo.js";
{
  let ok4 = 0;
  const t4 = (nome, f) => { f(); console.log("ok  ", nome); ok4++; };

  t4("acento, caixa e espaco sobrando nao contam como diferenca", () => {
    assert.strictEqual(normalizarDescricao("MDF Freijó"), "mdf freijo");
    assert.strictEqual(normalizarDescricao("  mdf   FREIJÓ.  "), "mdf freijo");
    assert.strictEqual(normalizarDescricao("MDF Freijó"), normalizarDescricao("  mdf   freijó.  "));
  });

  t4("pontuacao no fim, mesmo seguida de espaco, e' cortada", () => {
    /* Bug real: cortar a pontuacao ANTES de aparar o espaco deixava
       "freijo.  " sem cortar nada, porque o "$" ancorava no espaco. */
    assert.strictEqual(normalizarDescricao("Torneira Lift.   "), "torneira lift");
    assert.strictEqual(normalizarDescricao("Torneira Lift..."), "torneira lift");
  });

  t4("vazio fica vazio, nao quebra", () => {
    assert.strictEqual(normalizarDescricao(""), "");
    assert.strictEqual(normalizarDescricao(null), "");
  });

  const CAT = [
    { id: 1, descricao: "MDF Freijó", ativo: true },
    { id: 2, descricao: "  mdf   freijó.  ", ativo: true },
    { id: 3, descricao: "MDF Freijó", ativo: false },
    { id: 4, descricao: "MDF Carvalho", ativo: true },
  ];

  t4("acha a duplicata ignorando maiuscula/acento/espaco", () =>
    assert.deepStrictEqual(duplicatasDe(CAT, "mdf FREIJO").map((p) => p.id).sort(), [1, 2]));

  t4("o proprio item nao conta como duplicata dele mesmo", () =>
    assert.deepStrictEqual(duplicatasDe(CAT, "MDF Freijó", { excetoId: 1 }).map((p) => p.id), [2]));

  t4("desativado (ja' resolvido antes) nao acusa de novo", () =>
    assert.ok(!duplicatasDe(CAT, "MDF Freijó", { excetoId: 1 }).some((p) => p.id === 3)));

  t4("descricao diferente nao acusa nada", () =>
    assert.deepStrictEqual(duplicatasDe(CAT, "Vidro temperado"), []));

  t4("descricao vazia nao acusa o catalogo inteiro", () =>
    assert.deepStrictEqual(duplicatasDe(CAT, ""), []));

  console.log(`OK — mais ${ok4} casos`);
}
