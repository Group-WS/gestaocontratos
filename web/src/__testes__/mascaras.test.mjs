/* Testes das máscaras de digitação das células.
 *
 * Roda com: node web/src/__testes__/mascaras.test.mjs
 *
 * Guardam duas decisões que é fácil desfazer sem perceber:
 *
 *   1. Dinheiro usa centavos da direita ("123456" -> 1.234,56) e quantidade
 *      NÃO ("12" tem que continuar 12, não virar 0,12). Unificar as duas
 *      quebra uma das telas.
 *   2. "1234.56" com ponto do teclado numérico vale 1234,56. Antes da
 *      máscara isso virava 123456 — cem vezes maior, sem aviso.
 */
const src = (await import("fs")).readFileSync(new URL("../App.jsx", import.meta.url),"utf8");
const pega = (n) => { const i=src.indexOf(`function ${n}(`); return src.slice(i, src.indexOf("\n}\n", i)+2); };
const parseBRL = (t) => { if(t==null||t==="")return null; if(typeof t==="number")return Number.isFinite(t)?t:null;
  const n=Number(String(t).replace(/[^\d,.-]/g,"").replace(/\./g,"").replace(",",".")); return Number.isFinite(n)?n:null; };
const mascaraMoeda = eval(`(${pega("mascaraMoeda")})`);
const mascaraNumero = eval(`(${pega("mascaraNumero")})`);

let falhas = 0;
const conf = (nome, obtido, esperado) => {
  const ok = String(obtido) === String(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome.padEnd(34)} ${String(obtido).padEnd(12)} ${ok ? "" : "esperava " + esperado}`);
};

console.log("=== MOEDA: centavos da direita ===");
let t = "";
for (const d of "123456") { t = mascaraMoeda(t + d).texto; }
conf("digitando 1-2-3-4-5-6", t, "1.234,56");
conf("valor de 123456", mascaraMoeda("123456").valor, 1234.56);
conf("um digito", mascaraMoeda("1").texto, "0,01");
conf("dois digitos", mascaraMoeda("12").texto, "0,12");
conf("vazio", mascaraMoeda("").texto, "");
conf("vazio -> valor null", mascaraMoeda("").valor, "null");
conf("ignora letras", mascaraMoeda("R$ 1a2b3c").texto, "1,23");
conf("armadilha 1234.56", mascaraMoeda("1234.56").valor, 1234.56);

console.log("\n=== NUMERO: quantidade ===");
conf("12 continua 12", mascaraNumero("12").valor, 12);
conf("nao vira 0,12", mascaraNumero("12").texto, "12");
conf("decimal com virgula", mascaraNumero("9,45").valor, 9.45);
conf("segunda virgula ignorada", mascaraNumero("9,4,5").texto, "9,45");
conf("letra descartada", mascaraNumero("9a4").texto, "94");

console.log(falhas === 0 ? "\nOK — todas passaram" : `\n${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
