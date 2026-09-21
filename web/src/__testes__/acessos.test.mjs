/* Quem vê o quê — os sete perfis.
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
const puras = src.slice(src.indexOf("export const PAPEIS_DA_OBRA")).replace(/export /g, "");
const M = eval(`(function () { ${puras}
  return { PERFIS, perfilDe, estaPendente, estaSuspenso, temAcesso, podeEntrar,
           podeVerModulo, podeEditar, podeGerenciarPessoas, obrasPermitidas,
           dominioPermitido, DOMINIOS, podeAbrirObras, estaOnline, quandoFoi,
           temMaster, ehAdministrador, ehOUltimoGestor, nivelQueCuida,
           PAPEIS_DA_OBRA, papelNaObra, obraDaPessoa, equipeDaObra }; })()`);

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

/* ---- 2. Admin master e Administrador ----
   Só o admin master vê e mexe na Equipe e nos acessos (15/09/2026). O
   Administrador fica com o resto, contrato e compradores inclusive. */
const master = p("master", { email: "m@groupws.com.br" });
const admin = p("admin", { email: "d@groupws.com.br" });
const time = [master, admin];
conf("master vê Equipe e acessos", M.podeVerModulo(master, "equipe", time), true);
conf("master gerencia pessoas", M.podeGerenciarPessoas(master, time), true);
conf("master é administrador (contrato, compradores)", M.ehAdministrador(master), true);
conf("master edita", M.podeEditar(master), true);
conf("admin NÃO vê Equipe quando há master", M.podeVerModulo(admin, "equipe", time), false);
conf("admin NÃO gerencia pessoas quando há master", M.podeGerenciarPessoas(admin, time), false);
conf("admin continua administrador", M.ehAdministrador(admin), true);
conf("admin vê os outros módulos", M.podeVerModulo(admin, "aditivos", time), true);
conf("admin edita", M.podeEditar(admin), true);
conf("sem a lista do time, admin não gerencia", M.podeGerenciarPessoas(admin), false);
/* Entre publicar e alguém virar master, o Administrador segue cuidando da
   Equipe — senão ninguém cuidaria. */
conf("sem master no time, admin cuida da Equipe", M.podeGerenciarPessoas(admin, [admin]), true);
conf("sem master no time, admin vê Equipe", M.podeVerModulo(admin, "equipe", [admin]), true);
conf("master inativo não conta como master", M.temMaster([p("master", { ativo: false })]), false);
conf("geral não é administrador", M.ehAdministrador(p("geral")), false);
/* Nunca pode faltar quem cuide da Equipe. */
conf("único master é o último gestor", M.ehOUltimoGestor(time, master.email), true);
conf("com master, admin não é o último gestor", M.ehOUltimoGestor(time, admin.email), false);
conf("dois masters: nenhum é o último", M.ehOUltimoGestor([master, p("master", { email: "n@groupws.com.br" })], master.email), false);
conf("sem master, o único admin é o último gestor", M.ehOUltimoGestor([admin], admin.email), true);
conf("com master, quem cuida é o master", M.nivelQueCuida(time), "master");

/* ---- 3. Geral: tudo menos gente ---- */
conf("geral vê os módulos de obra", M.podeVerModulo(p("geral"), "aditivos"), true);
conf("geral edita", M.podeEditar(p("geral")), true);
conf("geral NÃO gerencia pessoas", M.podeGerenciarPessoas(p("geral")), false);
conf("geral NÃO vê Equipe e acessos", M.podeVerModulo(p("geral"), "equipe"), false);
conf("geral abre obra", M.podeAbrirObras(p("geral")), true);

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
conf("GC NÃO vê Equipe e acessos", M.podeVerModulo(ana, "equipe"), false);
conf("GC abre obra", M.podeAbrirObras(ana), true);
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

/* Todas as obras, mas só dentro do painel dela: não abre obra (a barra
   não tem a lista) e não vê a Equipe. Antes eram só as obras com item do
   canal — e o painel nascia vazio, porque o item só é conhecido depois
   que a obra carrega. */
const todasAsObras = [{ codigo: "1", categorias: [] }, { codigo: "2" }];
conf("mehoo vê todas as obras", M.obrasPermitidas(mehoo, todasAsObras).length, 2);
conf("mehoo NÃO abre obra", M.podeAbrirObras(mehoo), false);
conf("mehoo NÃO vê Equipe e acessos", M.podeVerModulo(mehoo, "equipe"), false);
conf("pendente NÃO abre obra", M.podeAbrirObras(p(null)), false);

/* ---- 5b. Último acesso e online ---- */
const agora = new Date(2026, 8, 14, 18, 0).getTime();
const ha = (min) => new Date(agora - min * 60000).toISOString();
conf("acessou há 1 minuto: online", M.estaOnline({ ultimoAcesso: ha(1) }, agora), true);
conf("acessou há 5 minutos: não está online", M.estaOnline({ ultimoAcesso: ha(5) }, agora), false);
conf("nunca acessou: não está online", M.estaOnline({ ultimoAcesso: null }, agora), false);
conf("sem a coluna: não está online", M.estaOnline({}, agora), false);
const hoje = new Date(2026, 8, 14, 18, 0);
conf("hoje", M.quandoFoi(new Date(2026, 8, 14, 14, 32).toISOString(), hoje), "hoje às 14:32");
conf("ontem", M.quandoFoi(new Date(2026, 8, 13, 9, 10).toISOString(), hoje), "ontem às 09:10");
conf("mais antigo leva a data", M.quandoFoi(new Date(2026, 8, 10, 8, 5).toISOString(), hoje), "10/09/2026 às 08:05");

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

/* ---- 7. Os seis, e só os seis ---- */
/* Virou seis em 19/09/2026 com o "Canal de compra": um perfil só, e o CANAL
   vem da ficha da pessoa. Um perfil por canal daria seis de uma vez e um
   sétimo a cada canal novo. */
conf("existem sete perfis", M.PERFIS.length, 7);
conf("perfil inventado não vale", M.perfilDe({ perfil: "chefe" }), null);
conf("só um perfil gerencia pessoas", M.PERFIS.filter((x) => x.gerenciaPessoas).length, 1);
conf("dois perfis administram", M.PERFIS.filter((x) => x.administra).map((x) => x.id).join(), "master,admin");
/* TRES perfis de consulta agora, e eles NAO sao mais o mesmo conjunto dos
   que nao abrem obra. Ate' a Taylor Made, "nao edita" e "nao abre obra"
   andavam juntos: Mehoo e Canal entram direto no painel deles e nao
   alcancam obra nenhuma.

   A Taylor Made quebra esse par de proposito — ela abre a obra inteira,
   le' tudo, e nao altera nada. E' o primeiro perfil que so' acompanha. */
conf("tres perfis não editam", M.PERFIS.filter((x) => !x.edita).map((x) => x.id).join(), "taylor,mehoo,canal");
conf("mas só dois não abrem obra",
  M.PERFIS.filter((x) => !x.abreObras).map((x) => x.id).join(), "mehoo,canal");
conf("a Taylor Made é a que lê tudo sem mexer em nada",
  M.PERFIS.filter((x) => !x.edita && x.abreObras).map((x) => x.id).join(), "taylor");

/* ---- Os tres papeis da obra ----

   `tailor_made` e `responsavel_executivo` existem no banco desde
   equipe-da-obra.sql, mas "minhas obras" testava so' o `gc`: uma Taylor
   Made nunca via as proprias obras. Errar aqui e' invisivel — a tela
   aparece vazia e parece bug de interface, quando o corte esta' na regra. */
console.log("\n=== 9. OS TRES PAPEIS ===");
const marina = "marina@groupws.com.br";
const obraDela = { codigo: "1", gc: "outro@groupws.com.br", tailorMade: marina };
const obraDoOutro = { codigo: "2", gc: "outro@groupws.com.br" };
const obraCrua = { codigo: "3", tailor_made: marina };
const obraSemNinguem = { codigo: "4" };

conf("acha o papel de Taylor Made", M.papelNaObra(obraDela, marina)?.rotulo, "Taylor Made");
conf("... tambem na grafia crua do banco", M.papelNaObra(obraCrua, marina)?.rotulo, "Taylor Made");
conf("acha o papel de GC", M.papelNaObra(obraDoOutro, "outro@groupws.com.br")?.rotulo, "GC");
conf("quem nao tem papel nenhum, nao tem", M.papelNaObra(obraDoOutro, marina), null);
conf("maiuscula nao atrapalha", M.papelNaObra(obraDela, "MARINA@groupws.com.br")?.chave, "tailorMade");

const taylor = p("taylor", { email: marina });
const vistas = M.obrasPermitidas(taylor, [obraDela, obraDoOutro, obraCrua, obraSemNinguem]).map((o) => o.codigo);
conf("a Taylor ve a obra em que e' a Taylor", vistas.includes("1"), true);
conf("... e nao a obra que nao e' dela", vistas.includes("2"), false);
conf("... e a obra sem responsavel nenhum continua visivel", vistas.includes("4"), true);
conf("a Taylor NAO edita", M.podeEditar(taylor), false);
conf("... mas abre obra", M.podeAbrirObras(taylor), true);

/* O GC continua GC: generalizar "minhas" nao pode alargar o que ele ve. */
const gcOutro = p("gc", { email: "outro@groupws.com.br" });
const doGc = M.obrasPermitidas(gcOutro, [obraDela, obraDoOutro, obraCrua]).map((o) => o.codigo);
conf("o GC ve a obra em que e' GC", doGc.includes("2"), true);
conf("... e tambem a que e' dele com outra Taylor", doGc.includes("1"), true);
/* A #3 tem Taylor e NAO tem GC. O GC continua vendo, porque "obra sem GC
   todo mundo ve" e' regra antiga e nao pode ser desfeita de bonus: sem
   isso ninguem poderia trabalhar nela. */
conf("... e a obra sem GC continua visivel pra ele", doGc.includes("3"), true);

conf("a equipe da obra sai com os tres papeis", M.equipeDaObra(obraDela).length, 3);
conf("... e a vaga vazia vem como null", M.equipeDaObra(obraDela).find((x) => x.chave === "executivo").email, null);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
