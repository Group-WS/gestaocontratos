/* Liberar UM canal para uma pessoa.
 *
 * Roda com: node web/src/__testes__/canal-da-pessoa.test.mjs
 *
 * Pedido dela em 19/09/2026: "eu vou liberar uma visualização para cada tipo
 * de usuário. Por exemplo, cortina persiana vai ser um usuário... a pessoa só
 * vai ver essa tela."
 *
 * Até então isso só existia para a Mehoo, que tem perfil próprio. Criar um
 * perfil por canal daria seis — e um sétimo no dia em que nascesse outro.
 * Então: UM perfil ("Canal de compra") e um campo dizendo QUAL canal.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(aqui, "..", "App.jsx"), "utf8");
const pes = fs.readFileSync(path.join(aqui, "..", "lib", "pessoas.js"), "utf8");
const sql = fs.readFileSync(path.join(aqui, "..", "..", "..", "supabase", "pessoa-canal.sql"), "utf8");

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(60)} ${String(o).padEnd(8)} ${ok ? "" : "esperava " + e}`); };

/* ---- 1. UM perfil, não seis ---- */
conf("existe o perfil Canal de compra", pes.includes('id: "canal", nome: "Canal de compra"'), true);
conf("ele só vê o painel por canal", pes.includes('modulos: ["painel_canal"], obras: "todas", edita: false'), true);
conf("... e não abre obra nenhuma", /modulos: \["painel_canal"\][^}]*abreObras: false/.test(pes), true);
/* O canal vem da FICHA, não do perfil: é isso que faz canal novo funcionar
   sozinho, sem um perfil novo a cada vez. */
conf("o canal é campo da pessoa", pes.includes("canal: l.canal || null,"), true);
conf("e é gravado só quando veio", pes.includes("if (canal !== undefined) campos.canal = canal || null;"), true);

/* ---- 2. A pessoa fica presa no canal dela ---- */
conf("quem tem o perfil canal não escolhe",
  app.includes('const canalPreso = eu?.perfil === "canal" ? (eu.canal || CANAIS_COMPRA[0].id) : null;'), true);
conf("a tela usa o canal preso quando existe", app.includes("const canalNaTela = canalPreso || canalDoPainel;"), true);
/* Mostrar os outros cinco pra quem não pode abri-los só criaria a pergunta
   "por que não funciona". */
conf("os chips somem pra ela", app.includes("{!canalPreso && ("), true);

/* ---- 3. A escolha, na tela de Equipe ---- */
conf("o canal aparece ao escolher o perfil", app.includes('{perfil === "canal" && ('), true);
/* Gravar canal num Administrador guardaria uma escolha que não decide nada e
   que reapareceria se o perfil mudasse um dia. */
conf("canal só viaja com o perfil certo",
  app.includes('canal: perfil === "canal" ? (canal || null) : null'), true);

/* ---- 4. O SQL ---- */
conf("a coluna é criada sem apagar nada", sql.includes("alter table pessoa add column if not exists canal text;"), true);
/* Trava de valor no banco exigiria vir aqui a cada canal novo — trocaria um
   problema de código por um de operação. */
conf("sem trava de valor, de propósito", /check \(canal/.test(sql), false);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
