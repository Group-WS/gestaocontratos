/* Casar item da obra com insumo do Sienge.
 *
 * Roda com: node web/src/__testes__/sienge.test.mjs
 *
 * O erro caro aqui não é errar o casamento: é casar com CONFIANÇA errada.
 * Marcar de verde uma peça que não é a mesma faz alguém lançar compra no
 * insumo errado; marcar de vermelho o que já existe faz cadastrar um
 * duplicado, e a base do Sienge incha com o mesmo produto em dois códigos.
 */
import { casarInsumo, semelhanca, descricaoSienge, norm, VERDE, LARANJA, VERMELHO } from "../lib/sienge.js";

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

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
