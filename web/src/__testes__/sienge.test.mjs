/* Casar item da obra com insumo do Sienge.
 *
 * Roda com: node web/src/__testes__/sienge.test.mjs
 *
 * O erro caro aqui não é errar o casamento: é casar com CONFIANÇA errada.
 * Marcar de verde uma peça que não é a mesma faz alguém lançar compra no
 * insumo errado; marcar de vermelho o que já existe faz cadastrar um
 * duplicado, e a base do Sienge incha com o mesmo produto em dois códigos.
 */
import { casarInsumo, semelhanca, descricaoSienge, agruparPorMae, acharMaes, ordenarDetalhes, partesDoInsumo, podeAssociarSozinho, norm, VERDE, LARANJA, VERMELHO } from "../lib/sienge.js";

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

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
