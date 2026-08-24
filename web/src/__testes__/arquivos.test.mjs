/* Testes do que decide se um anexo sobe ou não.
 *
 * Roda com: node web/src/__testes__/arquivos.test.mjs
 *
 * Duas coisas aqui só aparecem em produção, com o arquivo real da
 * pessoa na mão — e as duas já derrubaram upload calado antes:
 *
 *   1. O caminho no Storage não aceita acento nem espaço, e nome de
 *      caderno da equipe tem os dois ("Caderno Especificação v2.pdf").
 *      Se o saneamento afrouxar, o upload volta a falhar com uma frase
 *      em inglês que não diz o que fazer.
 *   2. "Bucket not found" não é defeito do arquivo: é a migração que
 *      não rodou. Essa mensagem tem que continuar dizendo QUAL SQL
 *      rodar, senão vira chamado.
 */
const src = (await import("fs")).readFileSync(new URL("../lib/arquivos.js", import.meta.url), "utf8");
const pega = (n) => { const i = src.indexOf(`function ${n}(`); return src.slice(i, src.indexOf("\n}\n", i) + 2); };
const nomeSeguro = eval(`(${pega("nomeSeguro")})`);
const explicar = eval(`(${pega("explicar")})`);

let falhas = 0;
const conf = (nome, obtido, esperado) => {
  const ok = String(obtido) === String(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome.padEnd(40)} ${String(obtido).padEnd(38)} ${ok ? "" : "esperava " + esperado}`);
};
const contem = (nome, texto, trecho) => {
  const ok = String(texto).includes(trecho);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome.padEnd(40)} ${ok ? "" : "não contém “" + trecho + "”: " + texto}`);
};

console.log("=== NOME DO ARQUIVO NO CAMINHO ===");
conf("acento vira letra simples", nomeSeguro("Especificação.pdf"), "Especificacao.pdf");
conf("espaço vira traço", nomeSeguro("Caderno de Projeto.pdf"), "Caderno-de-Projeto.pdf");
conf("acento + espaço juntos", nomeSeguro("Caderno Especificação v2.pdf"), "Caderno-Especificacao-v2.pdf");
conf("parêntese e cerquilha saem", nomeSeguro("obra (2519) #final.pdf"), "obra-2519-final.pdf");
conf("traços repetidos viram um", nomeSeguro("a   b.pdf"), "a-b.pdf");
conf("nome já simples não muda", nomeSeguro("caderno_01.pdf"), "caderno_01.pdf");

// O corte é pelo FIM: o que interessa num nome longo é a parte final
// (versão e extensão), não o prefixo repetido de todos eles.
const longo = "x".repeat(120) + "-final.pdf";
conf("nome longo cabe em 80", nomeSeguro(longo).length, 80);
contem("nome longo mantém a extensão", nomeSeguro(longo), ".pdf");

// Um nome só de acento e símbolo não pode virar caminho vazio nem só
// traços — o Storage rejeita, e o erro não diria o motivo.
console.log("=== NOME QUE SOBRA POUCO ===");
conf("só símbolos vira traço, não vazio", nomeSeguro("###.pdf"), "-.pdf");

console.log("=== O ERRO EXPLICA O QUE FAZER ===");
contem("bucket faltando aponta o SQL", explicar({ message: "Bucket not found" }), "supabase/arquivos.sql");
contem("arquivo grande fala do limite", explicar({ message: "The object exceeded the maximum allowed size" }), "50 MB");
contem("tipo recusado lista o que vale", explicar({ message: "mime type text/x-python is not supported" }), "PDF");
contem("sessão vencida manda reentrar", explicar({ message: "new row violates row-level security policy" }), "Saia e entre de novo");
contem("erro desconhecido não some", explicar({ message: "network timeout" }), "network timeout");

console.log(falhas === 0 ? "\nTUDO OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
