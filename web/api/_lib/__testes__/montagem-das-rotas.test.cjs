/* A ORDEM EM QUE AS ROTAS SÃO MONTADAS.
 *
 * Roda com: node web/api/_lib/__testes__/montagem-das-rotas.test.cjs
 *
 * O mondayApp.js aplica `exigirLogin` e `exigirMembro` no app inteiro, de
 * propósito: rota nova nasce protegida sem ninguém precisar lembrar.
 *
 * Só que existe UMA rota que não pode passar por `exigirMembro`, e é
 * justamente a que faz alguém virar membro. Quem entra pela primeira vez
 * ainda não tem linha em `pessoa`: se o `exigirMembro` vier antes, ele
 * recusa o pedido que criaria essa linha, a pessoa não aparece na fila do
 * administrador e não há como liberá-la a não ser por SQL na mão.
 *
 * Aconteceu de verdade em 22/09/2026, na migração que tirou o Supabase do
 * navegador (VH-02): o router de pessoas foi montado depois do
 * `exigirMembro`, o `.catch(() => null)` do App engoliu o 403 e ninguém
 * novo entrava mais no sistema — sem erro na tela, sem nada no log.
 * Nenhum teste pegou, porque cada rota, sozinha, estava certa.
 */
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "mondayApp.js"), "utf8");

let falhas = 0;
const conf = (nome, obtido, esperado = true) => {
  const ok = obtido === esperado;
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome.padEnd(62)} ${String(obtido).padEnd(6)} ${ok ? "" : "esperava " + esperado}`);
};

const onde = (trecho) => {
  const i = app.indexOf(trecho);
  if (i === -1) throw new Error(`não achei no mondayApp.js: ${trecho}`);
  return i;
};

const login = onde("app.use(exigirLogin);");
const membro = onde("app.use(exigirMembro);");
const pessoas = onde("app.use(rotasDePessoas);");

conf("o login vem antes de exigir que seja do time", login < membro);
conf("as rotas de pessoa entram DEPOIS do login", login < pessoas);
conf("... e ANTES do exigirMembro, senão ninguém novo entra", pessoas < membro);

/* O router só funciona nessa posição porque traz o próprio `exigirLogin` e o
   próprio leitor de JSON — ali em cima, os globais ainda não rodaram. */
const rotaPessoas = fs.readFileSync(path.join(__dirname, "..", "rotas", "pessoas.js"), "utf8");
conf("o router de pessoa traz o próprio exigirLogin", rotaPessoas.includes("rotas.use(exigirLogin,"));
conf("... e o próprio leitor de JSON", /rotas\.use\(exigirLogin,\s*express\.json\(/.test(rotaPessoas));

/* Todo o resto vem depois das duas barreiras. Se um router novo subir para
   cima do `exigirMembro` sem precisar, ele fica aberto a quem está na sala
   de espera — e ninguém percebe até alguém tentar. */
const outros = [...app.matchAll(/app\.use\((rotasDe[A-Za-z]+|rotasDaObra)\);/g)]
  .filter((m) => m[1] !== "rotasDePessoas");
conf("há outros routers montados (senão este teste não prova nada)", outros.length > 0);
conf("e todos eles vêm depois do exigirMembro", outros.every((m) => m.index > membro));

console.log(falhas === 0 ? "\nOK — todas passaram" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
