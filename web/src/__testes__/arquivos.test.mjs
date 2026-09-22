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
 *
 * A tradução do erro do Storage saiu daqui e foi pra `explicarStorage`
 * (lib/storage.js), que é quem fala com o Storage desde que o front
 * parou de falar com ele direto (VH-02). É lá que ela é conferida
 * agora — a mesma conferência, no lugar onde a frase é montada.
 */
const src = (await import("fs")).readFileSync(new URL("../lib/arquivos.js", import.meta.url), "utf8");
const srcStorage = (await import("fs")).readFileSync(new URL("../lib/storage.js", import.meta.url), "utf8");
const de = (texto, n) => { const i = texto.indexOf(`function ${n}(`); return texto.slice(i, texto.indexOf("\n}\n", i) + 2); };
const pega = (n) => de(src, n);
const nomeSeguro = eval(`(${pega("nomeSeguro")})`);
const explicar = eval(`(${de(srcStorage, "explicarStorage")})`);

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

/* ---- QUEM ESCOLHE ONDE O ARQUIVO GRAVA É O SERVIDOR ----
 *
 * O front deixou de falar com o Storage (VH-02): ele manda o NOME do
 * arquivo e a rota monta o caminho (obra + chave + carimbo de tempo) e
 * assina o envio. Se o caminho voltar a vir do navegador, qualquer
 * pessoa logada escolhe em que pasta grava — inclusive a do contrato,
 * que só o administrador abre.
 */
const rota = (await import("fs")).readFileSync(new URL("../../api/_lib/rotas/arquivos.js", import.meta.url), "utf8");
console.log("=== O CAMINHO É MONTADO NA ROTA ===");
conf("a rota monta obra + chave + carimbo de tempo",
  rota.includes("`${obraCodigo}/${chave}/${Date.now()}-${nome}`"), true);
conf("... e não aceita caminho pronto do navegador",
  /corpoDoEnvio\s*=\s*z\.object\(\{[^}]*obraCodigo[^}]*chave[^}]*nome[^}]*\}\)\.strict\(\)/s.test(rota), true);
conf("o nome ainda é o subconjunto que o Storage aceita",
  rota.includes('z.string().min(1).max(80).regex(/^[A-Za-z0-9._-]+$/)'), true);
conf("a chave não pode virar outra pasta (a do contrato é restrita)",
  rota.includes("regex(/^[a-z][a-z0-9-]*$/)"), true);
conf("o balde continua sendo o privado", rota.includes('const BALDE = "obra-arquivos";'), true);
conf("cada envio grava em caminho novo — nada por cima de nada",
  rota.includes("{ upsert: false }"), true);

/* Ver e baixar continuam sendo duas coisas: quem confere uma prancha
   quer ABRIR, quem manda pro fornecedor quer SALVAR. */
conf("o link temporário mantém a distinção ver/baixar",
  rota.includes("baixar,") && rota.includes("baixar: z.boolean().optional()"), true);
conf("e o link continua durando uma hora", rota.includes("const MINUTOS_DO_LINK = 60;"), true);
conf("toda rota daqui exige login e time",
  rota.includes("rotas.use(exigirLogin, exigirMembro);"), true);

/* Faxina é calada: apagar o arquivo trocado falhar não pode virar erro
   na tela de quem só queria trocar um anexo. */
conf("apagar arquivo continua em silêncio", /export async function apagarArquivo[\s\S]*?catch \{\s*\/\* silêncio proposital \*\/\s*\}/.test(src), true);

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
const app = (await import("fs")).readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
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
conf("a linha mostra o título em negrito", app.includes('<div className="truncate text-sm font-semibold text-text">{a.titulo || a.nome}</div>'), true);

console.log(falhas === 0 ? "\nTUDO OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
