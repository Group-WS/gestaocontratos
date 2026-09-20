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

/* ---- CONGELAR É NÃO TROCAR, NÃO É NÃO ANEXAR (17/09/2026) ----
 *
 * Ela abriu a 2204 com a edição na mão dela e não achou como subir os
 * cadernos do Executivo: os três apareciam "sem arquivo" e sem botão. A obra
 * já tinha as compras liberadas, e a regra congelava a linha inteira — a
 * "Apresentação de Especificações", que não congela, era a única com Anexar
 * na tela dela, e foi isso que entregou o motivo.
 *
 * O congelamento existe para proteger o que FOI MANDADO ao fornecedor: trocar
 * o caderno depois apaga a prova. Slot vazio não tem prova para apagar.
 */
/* O CSS saiu do App.jsx e virou folha .css — `fonteDoApp` e os dois
   juntos, na ordem do main.jsx. Ver fonte.mjs. */
const app = (await import("./fonte.mjs")).tudo;
conf("slot vazio aceita anexo mesmo congelado",
  app.includes("{podeEditar && (!congelado || !arquivo) && ("), true);
conf("... e modo leitura continua sem anexar nada",
  /\{podeEditar && \(!congelado \|\| !arquivo\)/.test(app), true);
conf("trocar arquivo congelado continua barrado, com o motivo",
  app.includes("{podeEditar && congelado && arquivo && !perdido && ("), true);
conf("congelar passou a ser só as compras liberadas",
  app.includes("const congeladoProjeto = !!obra.comprasLiberadas;"), true);
conf("o slot recebe os dois motivos separados",
  /function CadernoSlot\(\{[^}]*congelado, podeEditar = true \}\)/.test(app), true);
conf("o contrato não congela com as compras", app.includes("slot(CADERNO_CONTRATO)"), true);

/* ---- O ANEXO DUPLICADO SAIU, E "OUTROS" GANHOU DESCRIÇÃO (18/09/2026) ----
 *
 * "retire esse ultimo anexo 'apresentacao de especificacoes': esta duplicado
 * ... vou manter somente o caderno de especificacao." E, em seguida: "em
 * outros, quando for subir, aparecer uma descricao que ai aparece em negrito
 * como no padrao."
 *
 * O que NÃO pode acontecer: o arquivo que já foi anexado ficar inalcançável.
 * Ele continua listado em Documentos até ela apagar o vínculo pelo SQL —
 * arquivo que existe no balde e perde o caminho na tela é arquivo perdido.
 */
conf("o slot duplicado saiu da Jornada", app.includes("{slot(CADERNO_APRESENTACAO)}"), false);
conf("os três cadernos do executivo ficam", app.includes(`{["especificacao", "marcenaria", "projeto"].map((k) => slot(cadernoPorChave(k), congeladoProjeto))}`), true);
conf("o que já foi anexado continua listado em Documentos",
  app.includes(`out.push({ ...cad.apresentacao, id: "caderno-apresentacao"`), true);
const sqlLimpeza = (await import("node:fs")).readFileSync(new URL("../../../supabase/limpar-apresentacao-caderno.sql", import.meta.url), "utf8");
conf("e existe o SQL pra ela apagar o vínculo quando quiser",
  sqlLimpeza.includes("cadernos = cadernos - 'apresentacao'"), true);
/* O SQL mostra antes de apagar, e o passo que apaga vem comentado: apagar
   vínculo de arquivo não tem desfazer pela tela. */
conf("o SQL manda olhar a lista antes", sqlLimpeza.includes("PASSO 1 — VER o que existe hoje"), true);
conf("e o comando de apagar vem comentado", sqlLimpeza.includes("-- update obra_dados set cadernos = cadernos - 'apresentacao'"), true);

conf("Outros pergunta a descrição antes de subir",
  app.includes(`placeholder="Descrição do arquivo (ex: Memorial descritivo)"`), true);
conf("... e manda o título junto do arquivo",
  app.includes("onArquivos(await anexarAvulso({ obra, file, titulo, fase, usuario }));"), true);
conf("... limpando o campo depois", /setTitulo\(""\);/.test(app), true);
conf("sem descrição continua valendo o nome do arquivo",
  app.includes(`titulo: (titulo || "").trim() || file.name,`), true);
/* O negrito e' o ponto; o tamanho vem do token e pode mudar de degrau
   sem mudar o que esta regra quer dizer. */
conf("a linha mostra o título em negrito", /\.arq-titulo \{[^}]*font-weight: 600/.test(app), true);

console.log(falhas === 0 ? "\nTUDO OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
