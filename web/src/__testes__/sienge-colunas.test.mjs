/* As colunas laterais da planilha de detalhes.
 *
 * O leitor sem cabecalho pegava so' a descricao e jogava fora o resto.
 * A planilha "DETALHES 2439" tem cinco colunas: codigo, nome,
 * especificacao, fornecedor e ambiente -- e as tres ultimas sao
 * exatamente o que falta pro descritivo do Sienge sair completo. */
import assert from "node:assert";
import { lerListaSemCabecalho } from "../lib/sienge.js";

/* Recorte real do arquivo dela, inclusive as armadilhas: titulo de
   grupo, linha de zeros, link no lugar da especificacao, e a primeira
   linha com descricao e especificacao IDENTICAS. */
const PLANILHA = [
  ["16", "MOVEIS SOLTOS", "0", "0", "0"],
  ["16.1", "0", "0", "", "3"],
  ["16.3", "DELUCCI / BANQUETA KOYOTO / ESTRUTURA EM MADEIRA MACIÇA / CARVALHO NOGAL",
          "DELUCCI / BANQUETA KOYOTO / ESTRUTURA EM MADEIRA MACIÇA / CARVALHO NOGAL", "delucci", "Living"],
  ["16.4", "Cadeira Kyoto Mista", "https://www.moveisdelucci.com.br/produtos/163", "delucci", "Living"],
  ["16.5", "Carro bar sancho", "Estrutura metálica cor: champagne / Bandeja com espelho prata", "Casa Cristallo", "Living"],
  ["16.6", "MESA SOLEIDE 2400 x 1100 x 760 TAMPO BIPARTIDO", "TAMPO E BASE EM LÂMINA COR: CARVALHO NOGAL", "Wamóvel", "Living"],
  ["16.17", "Cama com cabeceira Miralle inteira - Tamanho queen", "Grupo 1 / tecido cor: rivera areia + estrutura com pés em laca", "Casalecchi", "Suíte Master"],
  ["16.18", "Colchão Köln - Tamanho queen", "0", "Reveev", "Suíte Master"],
  ["16.22", "CABECEIRA LEBLON COR: OFF-WHITE TAMANHO CASAL", "BASE E CABECEIRA EM TECIDO COR: RIVERA CRU", "Casalecchi", "Dormitório"],
  ["16.24", "Espelho omega - Tamanho G", "L 0,60 x A 1,38 x P 0,04 / pintura laca cor: champagne", "Iummi", "Dormitório"],
];

const r = lerListaSemCabecalho(PLANILHA);
let ok = 0;
const t = (nome, f) => { f(); console.log("ok  ", nome); ok++; };

t("titulo de grupo e linha de zeros ficam de fora", () =>
  assert.strictEqual(r.length, 8));

t("le o fornecedor de cada linha, nao um so' pro arquivo todo", () => {
  assert.deepStrictEqual(r.map((x) => x.fornecedor),
    ["delucci", "delucci", "Casa Cristallo", "Wamóvel", "Casalecchi", "Reveev", "Casalecchi", "Iummi"]);
});

t("separa ambiente de fornecedor — as duas colunas tem o mesmo formato", () => {
  assert.deepStrictEqual([...new Set(r.map((x) => x.ambiente))],
    ["Living", "Suíte Master", "Dormitório"]);
});

t("a especificacao e' a segunda coluna de frase", () =>
  assert.match(r[3].especificacao, /LÂMINA COR: CARVALHO NOGAL/));

t("zero nao vira especificacao — e' celula vazia disfarcada", () =>
  assert.strictEqual(r[5].especificacao, null));

t("link nao entra no descritivo", () =>
  assert.strictEqual(r[1].especificacao, null));

t("especificacao igual a descricao nao repete", () =>
  assert.strictEqual(r[0].especificacao, null));

t("a descricao continua sendo a descricao", () => {
  assert.match(r[2].desc, /^Carro bar sancho$/);
  assert.match(r[4].desc, /Cama com cabeceira Miralle/);
});

t("planilha SEM coluna lateral nao inventa fornecedor", () => {
  const simples = [
    ["1", "Cadeira Kyoto Mista em madeira maciça", "un", 3],
    ["2", "Mesa de centro redonda em carvalho", "un", 1],
    ["3", "Poltrona giratoria com base metalica", "un", 2],
  ];
  const s = lerListaSemCabecalho(simples);
  assert.strictEqual(s.length, 3);
  s.forEach((x) => assert.strictEqual(x.fornecedor, null));
});

console.log(`\nOK — ${ok} casos`);

/* O fornecedor abre o detalhe -- mas so' UMA vez. */
import { descricaoSienge } from "../lib/sienge.js";
{
  let ok2 = 0;
  const t2 = (nome, f) => { f(); console.log("ok  ", nome); ok2++; };

  t2("descricao que ja abre com o fornecedor nao repete", () =>
    assert.strictEqual(
      descricaoSienge({ fornecedor: "delucci", desc: "DELUCCI / BANQUETA KOYOTO / CARVALHO" }),
      "DELUCCI / BANQUETA KOYOTO / CARVALHO"));

  t2("descricao que NAO abre com ele continua recebendo o prefixo", () =>
    assert.strictEqual(
      descricaoSienge({ fornecedor: "Casa Cristallo", desc: "Carro bar sancho" }),
      "CASA CRISTALLO / CARRO BAR SANCHO"));

  t2("nome parecido nao conta como o mesmo", () =>
    assert.strictEqual(
      descricaoSienge({ fornecedor: "Deluccia", desc: "DELUCCI / BANQUETA" }),
      "DELUCCIA / DELUCCI / BANQUETA"));

  t2("marca igual ao fornecedor continua colapsando", () =>
    assert.strictEqual(
      descricaoSienge({ fornecedor: "Macrosul", marca: "MACROSUL", desc: "Mesa lateral" }),
      "MACROSUL / MESA LATERAL"));

  t2("sem fornecedor, a marca ainda abre", () =>
    assert.strictEqual(
      descricaoSienge({ marca: "Docol", desc: "Torneira de mesa" }),
      "DOCOL / TORNEIRA DE MESA"));

  console.log(`OK — mais ${ok2} casos`);
}
