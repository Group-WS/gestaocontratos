/* Quem vê o quê.
 *
 * Roda com: node web/src/__testes__/acessos.test.mjs
 *
 * Errar aqui não produz um número torto: produz alguém trancado fora do
 * próprio sistema, ou vendo obra que não devia. As duas falhas são
 * silenciosas — a pessoa acha que o app está quebrado, ou nem percebe.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* `lib/pessoas.js` importa supabase, que não roda no node. As duas
   funções puras são recortadas daqui — elas não dependem de nada. */
const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "lib", "pessoas.js"), "utf8");
const puras = src.slice(src.indexOf("export function podeVerModulo")).replace(/export /g, "");
const { podeVerModulo, obrasPermitidas } = eval(`(function () { ${puras}
  return { podeVerModulo, obrasPermitidas }; })()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(56)} ${String(o).padEnd(12)} ${ok ? "" : "esperava " + e}`); };

/* ---- 1. Não cadastrado vê tudo ----
   Parece o contrário do que segurança pede, e é de propósito: a primeira
   pessoa a abrir o app depois da migração não está cadastrada em lugar
   nenhum. Negar por padrão a trancaria pra fora ANTES de existir
   qualquer admin pra liberar. */
conf("não cadastrado vê o módulo", podeVerModulo(null, "aditivos"), true);
conf("indefinido não quebra", podeVerModulo(undefined, "qualquer"), true);
conf("não cadastrado vê todas as obras",
  obrasPermitidas(null, [{ codigo: "1" }, { codigo: "2" }]).length, 2);

/* ---- 2. Admin passa por cima de tudo ---- */
const admin = { email: "a@x", admin: true, modulos: ["inicio"], obrasRegra: "lista", obras: ["1"] };
conf("admin vê módulo fora da lista dele", podeVerModulo(admin, "aditivos"), true);
conf("admin vê obra fora da lista dele",
  obrasPermitidas(admin, [{ codigo: "1" }, { codigo: "2" }]).length, 2);

/* ---- 3. Lista de módulos vazia = TODOS ----
   Quem foi cadastrado antes destas colunas existirem tem lista vazia. Se
   vazia significasse "nenhum", a migração tiraria o app inteiro de todo
   mundo no instante em que rodasse. */
conf("lista vazia libera tudo", podeVerModulo({ modulos: [] }, "aditivos"), true);
conf("sem a coluna também libera", podeVerModulo({ email: "b@x" }, "aditivos"), true);
conf("dentro da lista passa", podeVerModulo({ modulos: ["inicio", "aditivos"] }, "aditivos"), true);
conf("fora da lista não passa", podeVerModulo({ modulos: ["inicio"] }, "aditivos"), false);

/* ---- 4. As obras ---- */
const obras = [
  { codigo: "2256", gc: "ana@x" },
  { codigo: "2506", gc: "bruno@x" },
  { codigo: "2519", gc: null },
  { codigo: "2405", gc: "ANA@X" },   // caixa alta: o mesmo e-mail
];
const ana = { email: "ana@x", obrasRegra: "minhas" };

conf("todas devolve todas", obrasPermitidas({ obrasRegra: "todas" }, obras).length, 4);
conf("sem regra devolve todas", obrasPermitidas({ email: "z@x" }, obras).length, 4);

/* "minhas" se atualiza sozinha quando a obra troca de GC — é por isso
   que ela existe, em vez de a coordenação remarcar a lista a cada troca. */
const dela = obrasPermitidas(ana, obras).map((o) => o.codigo);
conf("minhas: pega as dela", dela.includes("2256") && dela.includes("2405"), true);
conf("minhas: não pega a do outro", dela.includes("2506"), false);
// E-mail é o mesmo escrito em caixa diferente. Comparar cru esconderia obra.
conf("minhas: caixa alta é o mesmo e-mail", dela.includes("2405"), true);
/* Obra SEM GC continua visível: enquanto os vínculos não estão feitos,
   esconder o que não tem dono deixaria obra viva fora da tela de todos. */
conf("minhas: obra sem GC continua visível", dela.includes("2519"), true);

const escolhidas = { email: "c@x", obrasRegra: "lista", obras: ["2256", "2519"] };
conf("lista: só as escolhidas", obrasPermitidas(escolhidas, obras).length, 2);
// O código vem como número numa ponta e texto na outra o tempo todo.
conf("lista: número e texto casam",
  obrasPermitidas({ obrasRegra: "lista", obras: [2256] }, obras).length, 1);
conf("lista vazia não mostra nada", obrasPermitidas({ obrasRegra: "lista", obras: [] }, obras).length, 0);

conf("sem obras não quebra", obrasPermitidas(ana, undefined).length, 0);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
