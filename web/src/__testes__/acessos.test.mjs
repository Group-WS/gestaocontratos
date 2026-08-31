/* Quem vê o quê — os quatro perfis.
 *
 * Roda com: node web/src/__testes__/acessos.test.mjs
 * Ver docs/SPEC-acessos.md
 *
 * Errar aqui não produz um número torto: produz alguém trancado fora do
 * próprio sistema, ou vendo o que não devia. As duas falhas são
 * silenciosas — a pessoa acha que o app quebrou, ou nem percebe.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* `lib/pessoas.js` importa supabase, que não roda no node. As funções
   puras são recortadas daqui — elas não dependem de nada. */
const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "lib", "pessoas.js"), "utf8");
const puras = src.slice(src.indexOf("export const PERFIS")).replace(/export /g, "");
const M = eval(`(function () { ${puras}
  return { PERFIS, perfilDe, estaPendente, estaSuspenso, temAcesso, podeEntrar,
           podeVerModulo, podeEditar, podeGerenciarPessoas, obrasPermitidas,
           dominioPermitido, DOMINIOS }; })()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(56)} ${String(o).padEnd(10)} ${ok ? "" : "esperava " + e}`); };

const p = (perfil, extra = {}) => ({ email: "a@groupws.com.br", ativo: true, perfil, ...extra });

/* ---- 1. Sem perfil não entra ----
   É o oposto do que valia antes desta versão, e é o ponto inteiro da
   mudança: acesso deixou de ser concedido por omissão. */
conf("sem linha nenhuma não entra", M.podeEntrar(null), false);
conf("com linha e sem perfil não entra", M.podeEntrar(p(null)), false);
conf("pendente não vê módulo nenhum", M.podeVerModulo(p(null), "inicio"), false);
conf("pendente não vê obra nenhuma", M.obrasPermitidas(p(null), [{ codigo: "1" }]).length, 0);
conf("pendente é pendente", M.estaPendente(p(null)), true);

/* Suspenso e pendente não são a mesma coisa: um está esperando, o outro
   foi desativado — e a tela precisa dizer coisas diferentes. */
const suspenso = p("geral", { ativo: false });
conf("suspenso não entra", M.podeEntrar(suspenso), false);
conf("suspenso não é pendente", M.estaPendente(suspenso), false);
conf("suspenso é suspenso", M.estaSuspenso(suspenso), true);
conf("suspenso não vê módulo", M.podeVerModulo(suspenso, "inicio"), false);
conf("suspenso não vê obra", M.obrasPermitidas(suspenso, [{ codigo: "1" }]).length, 0);

/* ---- 2. Administrador ---- */
conf("admin vê qualquer módulo", M.podeVerModulo(p("admin"), "equipe"), true);
conf("admin edita", M.podeEditar(p("admin")), true);
conf("admin gerencia pessoas", M.podeGerenciarPessoas(p("admin")), true);

/* ---- 3. Geral: tudo menos gente ---- */
conf("geral vê os módulos de obra", M.podeVerModulo(p("geral"), "aditivos"), true);
conf("geral edita", M.podeEditar(p("geral")), true);
conf("geral NÃO gerencia pessoas", M.podeGerenciarPessoas(p("geral")), false);

/* ---- 4. GC: edita, só nas dele ---- */
const obras = [
  { codigo: "2256", gc: "ana@groupws.com.br" },
  { codigo: "2506", gc: "bruno@groupws.com.br" },
  { codigo: "2519", gc: null },
  { codigo: "2405", gc: "ANA@GROUPWS.COM.BR" },
];
const ana = p("gc", { email: "ana@groupws.com.br" });
const dela = M.obrasPermitidas(ana, obras).map((o) => o.codigo);

conf("GC edita — não é só leitura", M.podeEditar(ana), true);
conf("GC vê os módulos de obra", M.podeVerModulo(ana, "compras"), true);
conf("GC não gerencia pessoas", M.podeGerenciarPessoas(ana), false);
conf("GC pega as obras dele", dela.includes("2256"), true);
conf("GC não pega a do outro", dela.includes("2506"), false);
// O mesmo e-mail escrito em caixa diferente. Comparar cru esconderia obra.
conf("caixa alta é o mesmo e-mail", dela.includes("2405"), true);
/* Obra sem GC continua visível: enquanto os vínculos não estão feitos,
   esconder o que não tem dono deixaria obra viva fora da tela de todos. */
conf("obra sem GC continua visível", dela.includes("2519"), true);

/* ---- 5. Mehoo: só o painel dela, e só consulta ---- */
const mehoo = p("mehoo", { email: "compras@groupws.com.br" });
conf("mehoo vê o painel dela", M.podeVerModulo(mehoo, "mehoo"), true);
conf("mehoo NÃO vê o Início", M.podeVerModulo(mehoo, "inicio"), false);
conf("mehoo NÃO vê aditivos", M.podeVerModulo(mehoo, "aditivos"), false);
conf("mehoo NÃO edita", M.podeEditar(mehoo), false);

/* A obra aparece pra Mehoo se tiver item do canal. Quem decide é o
   próprio item, não um cadastro à parte — a lista acompanha a compra
   sem ninguém manter nada em dia. */
const comCanal = [
  { codigo: "1", categorias: [{ itens: [{ canalCompra: "mehoo" }, { canalCompra: "sienge" }] }] },
  { codigo: "2", categorias: [{ itens: [{ canalCompra: "sienge" }] }] },
  { codigo: "3", categorias: [] },
  { codigo: "4" },
];
const daMehoo = M.obrasPermitidas(mehoo, comCanal).map((o) => o.codigo);
conf("mehoo: só obra com item do canal", daMehoo.join(), "1");
conf("mehoo: obra sem categoria não quebra", M.obrasPermitidas(mehoo, [{ codigo: "9" }]).length, 0);

/* ---- 6. O domínio ----
   Sem este corte, qualquer pessoa com o link viraria uma linha na fila,
   e a tela de quem está esperando viraria caixa de entrada. */
conf("domínio da empresa entra", M.dominioPermitido("alguem@groupws.com.br"), true);
conf("caixa alta entra", M.dominioPermitido("ALGUEM@GroupWS.com.br"), true);
conf("outro domínio não entra", M.dominioPermitido("alguem@gmail.com"), false);
// "@naogroupws.com.br" termina com "groupws.com.br" numa comparação ingênua.
conf("domínio parecido não entra", M.dominioPermitido("x@naogroupws.com.br"), false);
conf("vazio não entra", M.dominioPermitido(""), false);
conf("indefinido não quebra", M.dominioPermitido(undefined), false);

/* ---- 7. Os quatro, e só os quatro ---- */
conf("existem quatro perfis", M.PERFIS.length, 4);
conf("perfil inventado não vale", M.perfilDe({ perfil: "chefe" }), null);
conf("só um perfil gerencia pessoas", M.PERFIS.filter((x) => x.gerenciaPessoas).length, 1);
conf("só um perfil não edita", M.PERFIS.filter((x) => !x.edita).map((x) => x.id).join(), "mehoo");

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
