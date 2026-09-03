/* A OBRA QUE SÓ EXISTE NO NOSSO BANCO.
 *
 * A barra lateral se alimenta do Monday. Obra cadastrada a mao nao esta'
 * la': ela aparecia no instante em que era criada e sumia ao recarregar
 * -- viva no banco, invisivel na tela. Foi o que aconteceu com a 2517.
 *
 * Este teste existe porque a falha e' SILENCIOSA: nada quebra, nenhum
 * erro sobe, a obra simplesmente nao esta' la'. */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/* `lib/obras.js` importa supabase, que nao roda no node. A funcao pura
   e' recortada daqui — ela nao depende de nada. */
const src = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "lib", "obras.js"), "utf8");
const i = src.indexOf("export function faltandoNaTela");
const j = src.indexOf("export async function listarObras");
const { faltandoNaTela } = await import(
  "data:text/javascript," + encodeURIComponent(src.slice(i, j)));

let ok = 0;
const t = (nome, f) => { f(); console.log("ok  ", nome); ok++; };

const doMonday = [
  { id: "2506", codigo: "2506", nome: "Salt Praia Brava" },
  { id: "2519", codigo: "2519", nome: "Const. Bidese" },
];

t("a obra manual que o Monday nao conhece e' devolvida", () => {
  const banco = [
    { codigo: "2506", nome: "Salt Praia Brava" },
    { codigo: "2517", nome: "Obra cadastrada a mao", squad: "Sun", board_id: null },
  ];
  const f = faltandoNaTela(banco, doMonday);
  assert.strictEqual(f.length, 1);
  assert.strictEqual(f[0].codigo, "2517");
});

t("obra que JA' esta' na tela nao entra duas vezes", () => {
  const banco = doMonday.map((o) => ({ codigo: o.codigo, nome: o.nome }));
  assert.deepStrictEqual(faltandoNaTela(banco, doMonday), []);
});

t("casa por CODIGO, e nao por id — no Monday o id cai pro boardId", () => {
  /* Obra sem codigo no Monday recebe o boardId como id. Casar por id
     faria a mesma obra entrar de novo, com outro nome. */
  const tela = [{ id: "18428503810", codigo: "2346", nome: "Bravissima" }];
  assert.deepStrictEqual(faltandoNaTela([{ codigo: "2346", nome: "Bravissima" }], tela), []);
});

t("codigo em numero e codigo em texto sao a MESMA obra", () =>
  assert.deepStrictEqual(faltandoNaTela([{ codigo: 2506, nome: "x" }], doMonday), []));

t("linha sem codigo nao vira obra fantasma", () =>
  assert.deepStrictEqual(faltandoNaTela([{ nome: "sem codigo" }, null], doMonday), []));

t("tela vazia devolve tudo — a ordem de carregamento nao importa", () => {
  /* O banco pode responder ANTES do Monday. Se a tela ainda estiver
     vazia, tudo do banco entra; o Monday depois so' acrescenta o que
     falta, porque a fusao dele tambem deduplica. */
  const banco = [{ codigo: "2506", nome: "a" }, { codigo: "2517", nome: "b" }];
  assert.strictEqual(faltandoNaTela(banco, []).length, 2);
});

t("nada no banco nao quebra", () => {
  assert.deepStrictEqual(faltandoNaTela([], doMonday), []);
  assert.deepStrictEqual(faltandoNaTela(null, doMonday), []);
  assert.deepStrictEqual(faltandoNaTela(null, null), []);
});

console.log(`\nOK — ${ok} casos`);
