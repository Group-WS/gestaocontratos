/* Casar item da obra com insumo do Sienge.
 *
 * Roda com: node web/src/__testes__/sienge.test.mjs
 *
 * O erro caro aqui não é errar o casamento: é casar com CONFIANÇA errada.
 * Marcar de verde uma peça que não é a mesma faz alguém lançar compra no
 * insumo errado; marcar de vermelho o que já existe faz cadastrar um
 * duplicado, e a base do Sienge incha com o mesmo produto em dois códigos.
 */
import { casarInsumo, semelhanca, descricaoSienge, agruparPorMae, acharMaes, ordenarDetalhes, partesDoInsumo, podeAssociarSozinho, lerListaDeProdutos, lerListaDeProdutosPDF, lerCotacaoPDF, norm, VERDE, LARANJA, VERMELHO } from "../lib/sienge.js";

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(56)} ${String(o).padEnd(12)} ${ok ? "" : "esperava " + e}`); };

const base = [
  { codigo: 1, descricao: "CUBA DE APOIO DECA L-1043" },
  { codigo: 2, descricao: "CUBA DE EMBUTIR DECA" },
  { codigo: 3, descricao: "TORNEIRA DOCOL LOFT MESA BICA ALTA" },
  { codigo: 4, descricao: "SPOT DE EMBUTIR LED 7W 3000K BRANCO" },
  { codigo: 5, descricao: "KIT DE INSTALAÇÃO PARA BANHEIRA" },
  { codigo: 6, descricao: "KIT DE INSTALAÇÃO PARA CHUVEIRO" },
];

/* ---- 1. igual é verde, mesmo escrito diferente ---- */
// A mesma peça vem em caixa, acento e pontuação diferentes entre planilhas.
conf("texto idêntico", casarInsumo("CUBA DE APOIO DECA L-1043", base).status, VERDE);
conf("caixa diferente", casarInsumo("cuba de apoio deca l-1043", base).status, VERDE);
conf("acento sobrando", casarInsumo("Kit de instalação para banheira", base).status, VERDE);
conf("acento faltando", casarInsumo("Kit de instalacao para banheira", base).status, VERDE);

/* ---- 2. parecido é laranja, e mostra alternativas ---- */
const ap = casarInsumo("Cuba de apoio Deca", base);
conf("parecido não vira verde", ap.status, LARANJA);
conf("... e aponta o mais próximo", ap.insumo.codigo, 1);
conf("traz a alternativa pra conferir", ap.alternativas.length >= 1, true);
// "Cuba de embutir Deca" fica de fora: 0,50, abaixo do corte. É o que se
// quer — embutir e apoio são peças diferentes e não competem.
conf("não oferece peça de outro tipo", ap.alternativas.length, 1);

// Quando existem duas de verdade parecidas, as duas aparecem, em ordem.
const doisSpots = [
  { codigo: 10, descricao: "SPOT DE EMBUTIR LED 7W 3000K BRANCO" },
  { codigo: 11, descricao: "SPOT DE EMBUTIR LED 7W 3000K PRETO" },
];
const dois = casarInsumo("Spot de embutir LED 7W 3000K", doisSpots);
// Uma sugestão só transformaria a conferência num sim/não cego.
conf("as duas parecidas aparecem", dois.alternativas.length, 2);
conf("em ordem de semelhança",
  dois.alternativas[0].score >= dois.alternativas[1].score, true);

/* ---- 3. o que NÃO pode casar ---- */
// Apoio e embutir são peças diferentes; casar as duas manda comprar errado.
conf("apoio não casa de verde com embutir",
  casarInsumo("Cuba de embutir Deca", base).insumo.codigo, 2);
// Palavra sem valor não pode aproximar coisas distintas: "kit", "de",
// "para" e "instalação" são iguais nas duas linhas.
const kit = casarInsumo("Kit de instalação para bidê", base);
conf("banheira e chuveiro não colam por 'kit de instalação para'",
  kit.status, VERMELHO);
conf("produto que não existe é vermelho",
  casarInsumo("Bancada de mármore Carrara 2,40m", base).status, VERMELHO);
conf("vermelho não inventa insumo", casarInsumo("Coisa nenhuma", base).insumo, null);
conf("descrição vazia é vermelho", casarInsumo("", base).status, VERMELHO);
conf("base vazia é vermelho", casarInsumo("Cuba de apoio Deca", []).status, VERMELHO);

/* ---- 4. a semelhança é simétrica e limitada ---- */
conf("igual a si mesmo é 1", semelhanca("Torneira Docol Loft", "Torneira Docol Loft"), 1);
conf("simétrica", semelhanca("Cuba Deca", "Deca Cuba"), 1);
conf("nada em comum é 0", semelhanca("Torneira", "Bancada"), 0);
conf("normaliza acento e caixa", norm("Instalação ELÉTRICA"), "instalacao eletrica");

/* ---- 5. a descrição no padrão da casa ---- */
conf("os cinco campos",
  descricaoSienge({ marca: "Deca", desc: "Cuba de apoio", modelo: "L-1043", cor: "Branco", codigo: "77012" }),
  "DECA / CUBA DE APOIO / L-1043 / BRANCO / 77012");
// Campo que não existe é PULADO: separador sobrando entra no cadastro do
// Sienge e fica lá pra sempre.
conf("campo faltando é pulado, não vira vazio",
  descricaoSienge({ marca: "Docol", desc: "Torneira de mesa", codigo: "00123" }),
  "DOCOL / TORNEIRA DE MESA / 00123");
conf("só a descrição também serve",
  descricaoSienge({ desc: "Spot de embutir" }), "SPOT DE EMBUTIR");
conf("nada dentro não gera separador", descricaoSienge({}), "");
conf("espaço em branco não conta", descricaoSienge({ marca: "  ", desc: "Cuba" }), "CUBA");

/* ---- 6. mãe e detalhe: a estrutura real da base ---- */
// O CÓDIGO é a mãe e ele se repete. Debaixo do 275 (AR CONDICIONADO)
// moram dezenas de variantes. Tratar cada linha como insumo solto fazia a
// escolha virar uma lista de textos quase iguais, onde a pessoa compara
// "9.000" com "18.000" no meio de uma frase.
const arCond = [
  { codigo: 275, descricao: "AR CONDICIONADO / ELECTROLUX / SPLIT 9.000 BTUS QUENTE/FRIO" },
  { codigo: 275, descricao: "AR CONDICIONADO / ELECTROLUX / SPLIT 18.000 BTUS QUENTE/FRIO" },
  { codigo: 275, descricao: "AR CONDICIONADO / LG / DUAL INVERTER 12.000 BTUS" },
  { codigo: 6050, descricao: "CONDENSADORA / ELECTROLUX / SPLIT 9.000 BTUs" },
];
conf("separa mãe de detalhe", partesDoInsumo(arCond[0].descricao).mae, "AR CONDICIONADO");
conf("... e o resto é o detalhe", partesDoInsumo(arCond[0].descricao).detalhe,
  "ELECTROLUX / SPLIT 9.000 BTUS QUENTE/FRIO");
conf("descrição sem barra é só mãe", partesDoInsumo("ESTILETE").mae, "ESTILETE");

const gr = agruparPorMae(arCond);
conf("duas mães", gr.length, 2);
conf("o código 275 junta as três variantes",
  gr.find((g) => g.codigo === "275").variantes.length, 3);
conf("a mãe é nomeada pelo primeiro segmento",
  gr.find((g) => g.codigo === "275").nome, "AR CONDICIONADO");

/* ---- 7. a capacidade não pode ser jogada fora ---- */
// "9.000" e "18.000" empatavam em 100%: o ponto virava espaço, "9" e "18"
// eram descartados por serem curtos, e sobrava "000" nos dois. É
// justamente o que mais distingue um ar-condicionado do outro.
const alvo = "Ar-condicionado Electrolux Split 18.000 BTUs Quente/Frio";
const maeCerta = acharMaes(alvo, gr)[0];
conf("acha a mãe certa", maeCerta.grupo.codigo, "275");
const det = ordenarDetalhes(alvo, maeCerta.grupo);
conf("18.000 vem em primeiro", det[0].insumo.descricao.includes("18.000"), true);
conf("... com tudo batendo", det[0].faltaram.length, 0);
conf("9.000 fica atrás", det[1].insumo.descricao.includes("9.000"), true);
conf("... e diz que faltou a capacidade", det[1].faltaram.includes("18000"), true);
conf("o de 9.000 não empata com o de 18.000", det[0].score > det[1].score, true);
// Número curto entra: "18" e "220v" distinguem produto e eram descartados
// pela regra de tamanho junto com "de" e "da".
conf("número de dois dígitos conta", norm("18.000 BTUS"), "18000 btus");
conf("vírgula decimal também junta", norm("2,5 TR"), "25 tr");

/* ---- 8. a mãe errada não pode ganhar ---- */
// Condensadora e ar-condicionado são coisas diferentes no Sienge.
const alvoCond = "Condensadora Electrolux Split 9.000";
conf("condensadora acha a própria mãe", acharMaes(alvoCond, gr)[0].grupo.codigo, "6050");
conf("mãe nenhuma quando nada casa", acharMaes("Bancada de mármore", gr).length, 0);
conf("base vazia não tem mãe", agruparPorMae([]).length, 0);

/* ---- 9. associar em massa só onde não sobra dúvida ---- */
// Aceitar a melhor sugestão de qualquer jeito seria rápido e errado: a
// linha de 9.000 viraria a de 18.000 sem ninguém ver, e o erro só aparece
// quando o equipamento chega na obra.
conf("associa sozinho quando bate tudo", podeAssociarSozinho(det), true);
conf("... e o que bate é o de 18.000", det[0].insumo.descricao.includes("18.000"), true);
const soParecido = ordenarDetalhes("Ar-condicionado Electrolux Split 22.000 BTUs", maeCerta.grupo);
conf("não associa sozinho faltando a capacidade", podeAssociarSozinho(soParecido), false);
conf("... porque faltou 22000", soParecido[0].faltaram.includes("22000"), true);
conf("sem variante nenhuma não associa", podeAssociarSozinho([]), false);
conf("lista nula não associa", podeAssociarSozinho(null), false);

/* ---- 10. a lista de produtos que a pessoa sobe ---- */
// Aqui o arquivo não é relatório do Sienge: é o que ela tem na mão — uma
// lista de fornecedor, um recorte do executivo, uma cotação. A mesma
// coisa se chama Descrição num lugar, Insumo noutro e Produto num terceiro.
const lista = lerListaDeProdutos([
  ["Lista de compras — Salt 1401"],
  ["Descrição", "Marca", "Modelo", "Cor", "Código"],
  ["Arandela Thin", "Usina", "19970-900LED3", "Dourado", "DR-M"],
  ["Spot de embutir", "Nordecor", null, null, "6730"],
]);
conf("lê dois produtos", lista.length, 2);
conf("pega a descrição", lista[0].desc, "Arandela Thin");
conf("e os campos que existem", lista[0].marca, "Usina");
// Campo que não existe fica vazio em vez de virar separador solto no
// cadastro do Sienge.
conf("campo ausente fica nulo", lista[1].modelo, null);
conf("... e some da descrição gerada",
  descricaoSienge(lista[1]), "NORDECOR / SPOT DE EMBUTIR / 6730");

// O cabeçalho se chama de vários jeitos.
["Insumo", "Produto", "Item"].forEach((nome) => {
  conf(`cabeçalho "${nome}" também serve`,
    lerListaDeProdutos([[nome], ["Cuba de apoio"]]).length, 1);
});
// Sem coluna reconhecida, devolve nada — em vez de tratar a primeira
// coluna como descrição e gerar uma lista de lixo.
conf("sem coluna conhecida não inventa", lerListaDeProdutos([["a", "b"], ["c", "d"]]).length, 0);
conf("planilha vazia não quebra", lerListaDeProdutos([]).length, 0);
conf("linha sem descrição é pulada",
  lerListaDeProdutos([["Descrição"], [""], ["Cuba"]]).length, 1);

/* ---- 11. a mesma lista, mas em PDF ---- */
// O extrator cola as colunas e quebra a descrição em várias linhas. O
// texto abaixo é do "Insumos Orçados" real da 2307.
const pdfTxt = [
  "Insumos Orçados", "Obra", "2307 - Bella Vista",
  "CódigoInsumoUn.QuantidadePreço unitárioPreço totalData do preço",
  "405MOBÍLIA SOLTA - POLTRONA / Detalhe: DESTACK /",
  "POLTRONA TORII / MADEIRA NATURAL (LÂMINA) / COURO",
  "MEL",
  "un1,00007.008,85707.008,8630/08/2024",
  "419MOBÍLIA SOLTA - PUFF / Detalhe: POLLUS / PUFF VEGAS LX /",
  // Esta linha parece um item novo — "50" seguido de "X" maiúsculo — e
  // partia a descrição em dois pedaços, os dois sem preço.
  "50X50X45CM / TECIDO 1546",
  "un2,00001.200,00002.400,0030/08/2024",
].join("\n");
const pl = lerListaDeProdutosPDF(pdfTxt);
conf("PDF: dois itens, não quatro", pl.length, 2);
conf("PDF: a medida não virou item", pl.some((x) => /^50X/.test(x.desc)), false);
conf("PDF: descrição inteira, das três linhas",
  pl[0].desc, "MOBÍLIA SOLTA - POLTRONA / DESTACK / POLTRONA TORII / MADEIRA NATURAL (LÂMINA) / COURO MEL");
// "Detalhe:" é rótulo, não conteúdo: aparece em toda linha e, contado
// como palavra, aproximaria produtos que não têm nada a ver.
conf("PDF: 'Detalhe:' sai da descrição", /Detalhe/.test(pl[0].desc), false);
conf("PDF: quantidade da linha colada", pl[0].qtd, 1);
conf("PDF: unidade", pl[0].un, "un");
conf("PDF: o segundo item ficou inteiro",
  /50X50X45CM/.test(pl[1].desc) && pl[1].qtd === 2, true);
conf("PDF: código do insumo", pl[1].codigoSienge, "419");
conf("PDF vazio não quebra", lerListaDeProdutosPDF("").length, 0);

/* ---- 12. cotação de fornecedor ---- */
// Cada fornecedor faz do seu jeito. O texto é da cotação real da Macrosul
// (2421), com os quatro casos que quebraram a primeira versão.
const cot = [
  "NÃO É DOCUMENTO FISCAL - NÃO É VÁLIDO COMO RECIBO",
  "N° do Documento:", "24187",           // número do documento: parece código
  "CódigoDescriçãoTotalDescontoItemPreço",
  "10228.B", "MESA ENTRE 3,00X1,10", "AMENDOA/.=1",
  "1,00103,61UN10.257,39110.361,00",
  "TAMPO LAMINADO / CHANFRO 50mm / RAIO 20",
  "80011", "SOFÁ ARAÇÁ C 2,50 x P 1,30 x A",
  "074",                                  // o MODELO, e ele parece código
  "./650=1",                              // acabamento vazio: só pontuação
  "1,004.515,50UN4.515,5049.031,00",
  "20130", "BANQUETA TERTÚLIA C/", "ENCOSTO ESTOFADO - BAIXA", "AMENDOA/616=2",
  "2,001.320,00UN1.320,00131.320,00",
  "19.171,11", "0,00Desconto do subtotal:", "Valor líquido:",  // rodapé
].join("\n");
const q = lerCotacaoPDF(cot);
conf("três produtos", q.length, 3);
// "24187" tem dígitos e cara de código, mas não tem linha de valores.
conf("número do documento não virou item", q.some((x) => x.codigo === "24187"), false);
// "074" é o modelo do sofá: sem esta regra ele abria item novo e o SOFÁ
// ARAÇÁ inteiro sumia da lista.
conf("o modelo não virou item", q.some((x) => x.codigo === "074"), false);
conf("o sofá sobreviveu", /SOFÁ ARAÇÁ/.test(q[1].desc), true);
conf("... com o modelo dentro da descrição", /074/.test(q[1].desc), true);
// "./650=1": acabamento é só pontuação — não há cor.
conf("acabamento vazio não vira cor", q[1].cor, null);
conf("cor de verdade é lida", q[0].cor, "AMENDOA");
// Em "61UN10" não há fronteira entre dígito e letra: com \b a linha de
// valores nunca casava e ia inteira pra dentro da descrição.
conf("linha de valores não entra na descrição", /UN10/.test(q[0].desc), false);
conf("quantidade do acabamento", q[0].qtd, 1);
conf("quantidade de duas unidades", q[2].qtd, 2);
// Sem próximo código pra fechar, o último item engolia o rodapé.
conf("o rodapé não vira especificação do último", q[2].especificacao, null);
conf("mas a observação de verdade entra", /TAMPO LAMINADO/.test(q[0].especificacao), true);
conf("cotação vazia não quebra", lerCotacaoPDF("").length, 0);

/* ---- O descritivo: FORNECEDOR / DESCRICAO / COR / ESPECIFICACAO / CODIGO ----
   O fornecedor abre o detalhe porque a cotacao inteira e' de uma casa so, e
   e' assim que a base do Sienge escreve. Errar a ORDEM aqui nao quebra nada
   na hora: quebra depois, quando o detalhe ja esta cadastrado e ninguem
   reescreve cinquenta linhas na mao. */
conf("fornecedor abre e codigo fecha",
  descricaoSienge({ fornecedor: "Macrosul", desc: "Mesa lateral Tropicana", cor: "Amendoa",
    especificacao: "Somente base e estrutura para tampo de pedra", codigo: "50049" }),
  "MACROSUL / MESA LATERAL TROPICANA / AMENDOA / SOMENTE BASE E ESTRUTURA PARA TAMPO DE PEDRA / 50049");

conf("marca diferente vem logo depois",
  descricaoSienge({ fornecedor: "Macrosul", marca: "Usina", desc: "Arandela Thin", modelo: "DR-M" }),
  "MACROSUL / USINA / ARANDELA THIN / DR-M");

// "MACROSUL / MACROSUL / CADEIRA" seria ruido dentro do cadastro.
conf("marca igual ao fornecedor nao repete",
  descricaoSienge({ fornecedor: "Macrosul", marca: "MACROSUL", desc: "Cadeira Cardeal" }),
  "MACROSUL / CADEIRA CARDEAL");

conf("sem fornecedor continua funcionando",
  descricaoSienge({ marca: "Usina", desc: "Arandela Thin", modelo: "DR-M" }),
  "USINA / ARANDELA THIN / DR-M");

/* ---- Planilha SEM cabecalho ----
   A de climatizacao comeca no titulo do grupo e emenda nas linhas, sem
   nunca escrever "Descricao". Sem nome, quem identifica a coluna e' o
   conteudo — e o risco aqui e' engolir o titulo do grupo como se fosse
   produto, que viraria um detalhe "CLIMATIZACAO/ EXAUSTAO" no Sienge. */
const semCab = [
  [6, "CLIMATIZAÇÃO/ EXAUSTÃO", null, 0, 0, 0, 0],
  ["5.1", "Ar-Condicionado Split Cassete 1 Via Inverter WI-FI Conect 18.000 BTUs Quente/Frio 220V", "ZT-W18GTTAA", "https://www.lg.com/br/x", "Living", 2, "un "],
  [null, "LG / AR CONDICI"],
  ["5.3", "Ar-Condicionado LG AI Dual Inverter Compact 12.000 BTU Quente/Frio 220V", "S3-W12JAQAL", "https://www.lg.com/br/y", "Cozinha", 1, "un "],
];
const sc = lerListaDeProdutos(semCab);
conf("planilha sem cabeçalho é lida", sc.length, 2);
conf("o título do grupo não vira produto", sc.some((l) => /CLIMATIZ/i.test(l.desc)), false);
// Linha solta, sem modelo nem unidade: e' anotacao, nao produto.
conf("a linha solta não vira produto", sc.some((l) => l.desc === "LG / AR CONDICI"), false);
conf("o modelo do fabricante é achado", sc[0].modelo, "ZT-W18GTTAA");
// "5.1" tem numero e nao tem letra — nao pode ser confundido com modelo.
conf("o código do item não vira modelo", sc[1].modelo, "S3-W12JAQAL");
conf("a quantidade vem junto", sc[0].qtd, 2);
conf("a unidade vem junto", sc[0].un, "un");
conf("o link não vira descrição", /^https?:/.test(sc[0].desc), false);

// Com cabecalho o caminho antigo continua valendo — nada de cair no palpite.
const comCab = [
  ["Item", "Descrição", "Marca", "Modelo"],
  ["1", "Spot de embutir LED 7W", "Usina", "DR-M"],
];
conf("com cabeçalho segue pelo caminho antigo", lerListaDeProdutos(comCab)[0].marca, "Usina");

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
