/* Leitor do PDF do Sienge, e a conferência contra a planilha.
 *
 * Roda com: node web/src/__testes__/sienge-pedido.test.mjs
 *
 * A pergunta que isso responde: faltou lançar alguma compra no Sienge?
 * Sienge é onde a compra existe de verdade — enquanto ela não estiver
 * lá, ela não foi feita, por mais marcada que esteja no app.
 *
 * O texto abaixo é o de uma solicitação real (2307, nº 23393), com o
 * cabeçalho de página no meio — que é onde a leitura por POSIÇÃO quebra.
 */
import { parsePedidoSienge, parsePedidoSiengeExcel, conferirComSienge } from "../lib/siengePedido.js";
import { cobertura } from "../lib/sienge.js";

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(56)} ${String(o).padEnd(10)} ${ok ? "" : "esperava " + e}`); };

const cab = [
  "Solicitações de Compra", "Solicitação", "23393",
  "Data da solicitação", "17/08/2026",
  "Obra", "2307 - Condimínio Bella Vista Residence Club, Quadra F, Lote12",
  "Solicitante", "Valentina Thomé",
  "Insumo", "Autorização", "Und.", "Qtd. prevista", "Qtd. atendida", "Saldo",
  "Dt. entrega", "UC", "Referência", "Item apropriado", "Qtd. aprop.",
];
const item = (cod, desc, qtd, verba) => [
  `${cod} - ${desc}`, "Sim", "un", `${qtd},0000`, "0,0000", `${qtd},0000`,
  "17/08/2026", "1", "04.003.000.001", verba, `${qtd},0000`,
];
const texto = [
  ...cab,
  ...item("405", "MOBÍLIA SOLTA -POLTRONA / DESTACK /POLTRONA TORII", 1, "Móveis soltos [MAT/MO]"),
  ...item("405", "MOBÍLIA SOLTA -POLTRONA / CENTURY /POLTRONA NORAH", 3, "Móveis soltos [MAT/MO]"),
  // A partir daqui o cabeçalho da página se repete — é o que quebra
  // qualquer leitura que conte linhas.
  ...cab,
  ...item("3058", "LUMINÁRIA - SPOT DE EMBUTIR / NORDECOR / 6W 3000K", 12, "Iluminação [MAT]"),
].join("\n");

const r = parsePedidoSienge(texto);

/* ---- 1. o cabeçalho ---- */
conf("número da solicitação", r.numero, "23393");
conf("código da obra", r.obraCodigo, "2307");
conf("solicitante", r.solicitante, "Valentina Thomé");

/* ---- 2. os itens, apesar do cabeçalho no meio ---- */
// A linha da OBRA tem a mesma cara de um item ("2307 - Condomínio...") e
// se repete a cada página: num PDF de 8 páginas ela virava 8 itens
// fantasmas, todos sem quantidade — o único sinal de que algo ia mal.
conf("três itens, e nenhum fantasma", r.itens.length, 3);
conf("a linha da obra não virou item",
  r.itens.some((i) => /Condim/.test(i.descricao)), false);
conf("todos com quantidade", r.itens.filter((i) => i.qtdPrevista != null).length, 3);
conf("todos com verba", r.itens.filter((i) => i.verba).length, 3);

conf("quantidade do primeiro", r.itens[0].qtdPrevista, 1);
conf("quantidade do terceiro", r.itens[2].qtdPrevista, 12);
conf("unidade", r.itens[0].un, "un");
conf("código do insumo", r.itens[0].codigo, "405");
// O Sienge já diz a verba E a alocação — informação que a planilha às
// vezes não traz.
conf("verba sem o colchete", r.itens[0].verba, "Móveis soltos");
conf("alocação MAT/MO vira AMBOS", r.itens[0].alocacao, "AMBOS");
conf("alocação MAT continua MAT", r.itens[2].alocacao, "MAT");
conf("autorização lida", r.itens[0].autorizado, true);

/* ---- 3. a conferência: o que faltou lançar ---- */
const produtos = [
  { it: { desc: "Poltrona Torii Destack madeira natural" } },      // está no Sienge
  { it: { desc: "Spot de embutir Nordecor 6W 3000K" } },           // está no Sienge
  { it: { desc: "Cuba de apoio Deca L-1043" } },                   // NÃO está
];
const c = conferirComSienge(produtos, r.itens, cobertura);
conf("achou os que estão nos dois", c.confirmados.length, 2);
// Este é o risco que o upload existe pra pegar: alguém achou que pediu.
conf("aponta o que falta lançar", c.faltaLancar.length, 1);
conf("... e diz qual", c.faltaLancar[0].it.desc, "Cuba de apoio Deca L-1043");
// Compra que nasceu fora da planilha aparece, em vez de sumir.
conf("o que está só no Sienge fica visível", c.naoListados.length, 1);
conf("... e é a poltrona Norah", /NORAH/.test(c.naoListados[0].descricao), true);

// Nenhum item do Sienge pode ser usado duas vezes: senão dois produtos
// parecidos dariam ambos por confirmados com a mesma linha.
const dobrado = conferirComSienge(
  [{ it: { desc: "Poltrona Torii Destack" } }, { it: { desc: "Poltrona Torii Destack" } }],
  r.itens, cobertura);
conf("uma linha do Sienge confirma um produto só", dobrado.confirmados.length, 1);
conf("... e o segundo cai em falta lançar", dobrado.faltaLancar.length, 1);

/* ---- 4. os casos vazios ---- */
conf("sem PDF, tudo falta lançar", conferirComSienge(produtos, [], cobertura).faltaLancar.length, 3);
conf("sem produtos, tudo é não listado", conferirComSienge([], r.itens, cobertura).naoListados.length, 3);
conf("texto vazio não quebra", parsePedidoSienge("").itens.length, 0);

/* ---- 5. o mesmo relatório em Excel ---- */
// Excel é melhor que PDF aqui: no PDF cada campo vem como linha solta e
// a leitura depende de reconhecer o formato; na planilha cada coisa já
// está na sua coluna.
const planilha = [
  ["Solicitações de Compra"], ["Solicitação", "23393"],
  ["Obra", "2307 - Bella Vista"], ["Solicitante", "Valentina Thomé"], [],
  ["Insumo", "Und.", "Qtd. prevista", "Qtd. atendida", "Item apropriado"],
  ["405 - MOBÍLIA SOLTA -POLTRONA / DESTACK /POLTRONA TORII", "un", "1,0000", "0,0000", "Móveis soltos [MAT/MO]"],
  ["3058 - LUMINÁRIA - SPOT DE EMBUTIR / NORDECOR 6W", "un", "12,0000", "0,0000", "Iluminação [MAT]"],
];
const x = parsePedidoSiengeExcel(planilha);
conf("Excel: número da solicitação", x.numero, "23393");
conf("Excel: obra", x.obraCodigo, "2307");
conf("Excel: dois itens", x.itens.length, 2);
conf("Excel: quantidade", x.itens[1].qtdPrevista, 12);
conf("Excel: verba", x.itens[0].verba, "Móveis soltos");
conf("Excel: alocação", x.itens[0].alocacao, "AMBOS");

// As colunas são achadas pelo NOME: o Sienge deixa escolher quais
// exportar, então a mesma tela gera arquivos com ordem diferente.
const trocada = [
  ["Item apropriado", "Qtd. prevista", "Insumo", "Und."],
  ["Iluminação [MAT]", "5,0000", "3058 - LUMINÁRIA - SPOT", "un"],
];
const y = parsePedidoSiengeExcel(trocada);
conf("ordem das colunas não importa", y.itens[0].qtdPrevista, 5);
conf("... e a descrição vem certa", y.itens[0].codigo, "3058");
// "Qtd. prevista" antes de "Qtd." solto: pegar a primeira daria a
// coluna de atendida e a conferência acusaria falta onde não há.
const tresQtd = [
  ["Insumo", "Qtd. atendida", "Qtd. prevista"],
  ["405 - POLTRONA", "0,0000", "7,0000"],
];
conf("pega a prevista, não a atendida", parsePedidoSiengeExcel(tresQtd).itens[0].qtdPrevista, 7);
conf("planilha vazia não quebra", parsePedidoSiengeExcel([]).itens.length, 0);
conf("planilha sem cabeçalho conhecido não inventa item",
  parsePedidoSiengeExcel([["a", "b"], ["c", "d"]]).itens.length, 0);

/* ---- 6. célula vazia não pode virar coluna ---- */
// A planilha vem com array ESPARSO: célula vazia é um buraco, não um
// valor. `findIndex` não pula buraco, e `/^und/.test(undefined)` testa a
// string "undefined" — que começa com "und". A coluna de unidade casava
// com a primeira célula VAZIA do cabeçalho, e toda unidade voltava nula.
const esparso = [];
esparso[0] = "Insumo";
esparso[2] = "Und.";           // índices 1 e 3 ficam como buraco
esparso[4] = "Qtd. prevista";
const linha = [];
linha[0] = "406 - CADEIRA / WAMOVEL";
linha[2] = "un";
linha[4] = "6,0000";
const esp = parsePedidoSiengeExcel([esparso, linha]);
conf("buraco no cabeçalho não vira coluna", esp.itens[0].un, "un");
conf("... e a quantidade vem da coluna certa", esp.itens[0].qtdPrevista, 6);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
