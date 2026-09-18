/* O cadastro de insumos ATIVOS do Sienge manda na associação.
 *
 * Roda com: node web/src/__testes__/insumos-ativos.test.mjs
 *
 * Pedido dela em 17/09/2026: "atualize o banco de dados de insumos ativos
 * do sienge para fazer a associacao corretamente. ex, mesa de centro nao ta
 * ativo, n pode mostrar oque esta inativo."
 *
 * O QUE ESTAVA ACONTECENDO, medido no dia:
 * O insumo 411 NÃO foi desativado — ele foi RENOMEADO. Hoje o Sienge chama
 * "MOBÍLIA SOLTA - MESAS AUXILIARES"; a base de preços tem 10.507 linhas
 * (uma por compra) e as antigas dizem "MOBÍLIA SOLTA - MESA DE
 * CENTRO/LATERAL". A associação mostrava o nome mais repetido — o velho.
 *
 * Três coisas aqui não podem quebrar:
 *   1. SEM cadastro, nada muda. A tabela nasce vazia e o SQL é rodado por
 *      ela, na mão: até lá a associação tem que funcionar como antes.
 *   2. o preço pago NUNCA é apagado, nem de insumo que saiu do cadastro —
 *      é histórico da obra.
 *   3. cadastro vazio não apaga a lista. Arquivo lido errado chega assim.
 */
import fs from "node:fs";
import { agruparPorMae } from "../lib/sienge.js";

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(58)} ${String(o).slice(0, 40).padEnd(42)} ${ok ? "" : "esperava " + e}`); };

const VELHO = "MOBÍLIA SOLTA - MESA DE CENTRO/LATERAL";
const AGORA = "MOBÍLIA SOLTA - MESAS AUXILIARES";

// A base como ela está: uma linha por compra, com o nome da época.
const base = [
  { codigo: "411", descricao: `${VELHO} / DESTAK / MESA DE APOIO REDONDO IRON / PRETO`, unidade: "un", custoUnitario: 781.18 },
  { codigo: "411", descricao: `${VELHO} / CASAA / TURIM MENOR`, unidade: "un", custoUnitario: 392.2 },
  { codigo: "411", descricao: `${VELHO} / LINEE / MESA LATERAL ORGÂNICA P`, unidade: "un", custoUnitario: 490 },
  { codigo: "411", descricao: AGORA, unidade: "un", custoUnitario: 0 },
  { codigo: "8000", descricao: "PORTA ANTIGA / MODELO FORA DE LINHA", unidade: "un", custoUnitario: 1200 },
];

/* ---- 1. SEM cadastro: exatamente como antes ---- */
{
  const g = agruparPorMae(base);
  const g411 = g.find((x) => x.codigo === "411");
  conf("sem cadastro, o nome é o mais repetido", g411?.nome, VELHO);
  conf("sem cadastro, nenhum grupo desaparece", g.length, 2);
  conf("sem cadastro, as variantes seguem inteiras", g411?.variantes.length, 4);
  conf("cadastro vazio é o mesmo que nenhum", agruparPorMae(base, []).length, 2);
  conf("cadastro nulo não quebra", agruparPorMae(base, null).length, 2);
}

/* ---- 2. O CASO DELA: o nome vem do cadastro ---- */
{
  const cadastro = [{ codigo: "411", descricao: AGORA, unidade: "un" }];
  const g = agruparPorMae(base, cadastro);
  const g411 = g.find((x) => x.codigo === "411");
  conf("o nome é o de agora, não o mais repetido", g411?.nome, AGORA);
  conf("as três compras continuam escolhíveis", g411?.variantes.length, 4);
  conf("e o preço pago continua na variante",
    g411?.variantes.some((v) => v.custoUnitario === 781.18), true);
}

/* ---- 3. Quem saiu do cadastro não é oferecido ---- */
{
  const g = agruparPorMae(base, [{ codigo: "411", descricao: AGORA, unidade: "un" }]);
  conf("insumo fora do cadastro sai da associação", g.some((x) => x.codigo === "8000"), false);
  conf("... e sobra só o que está ativo", g.length, 1);
  /* A base NÃO é tocada: a linha da porta antiga continua lá, com o preço
     que a obra pagou. Isto é o que separa "não oferecer" de "apagar". */
  conf("a linha dele continua na base de preços", base.some((b) => b.codigo === "8000"), true);
}

/* ---- 4. Insumo ativo que a obra nunca comprou ----
   Sem isto, insumo novo do Sienge ficaria invisível até a primeira compra —
   e é na primeira que alguém precisa associar. */
{
  const g = agruparPorMae(base, [
    { codigo: "411", descricao: AGORA, unidade: "un" },
    { codigo: "9500", descricao: "MOBÍLIA SOLTA - POLTRONA GIRATÓRIA", unidade: "un" },
  ]);
  const nova = g.find((x) => x.codigo === "9500");
  conf("insumo sem compra nenhuma aparece", !!nova, true);
  conf("com o nome do cadastro", nova?.nome, "MOBÍLIA SOLTA - POLTRONA GIRATÓRIA");
  conf("e com ele mesmo como variante escolhível", nova?.variantes.length, 1);
  conf("... sem preço inventado", nova?.variantes[0].custoUnitario, 0);
}

/* ---- 5. O cadastro com " / " no nome ---- */
{
  const g = agruparPorMae([], [{ codigo: "77", descricao: "AR CONDICIONADO / SPLIT", unidade: "un" }]);
  conf("a mãe é a primeira parte do nome", g[0]?.nome, "AR CONDICIONADO");
}

/* ============================================================
   A GRAVAÇÃO DO CADASTRO — com um banco de mentira
   ============================================================ */
const lib = fs.readFileSync(new URL("../lib/insumos.js", import.meta.url), "utf8");
const bloco = (a, fim = "\n}\n") => {
  const i = lib.indexOf(a);
  if (i === -1) throw new Error(`não achei em insumos.js: ${a}`);
  return lib.slice(i, lib.indexOf(fim, i) + fim.length);
};
const linha = (a) => {
  const i = lib.indexOf(a);
  if (i === -1) throw new Error(`não achei em insumos.js: ${a}`);
  return lib.slice(i, lib.indexOf("\n", i) + 1);
};

function bancoFalso(linhas, { semTabela = false } = {}) {
  const erro = { code: "42P01", message: 'relation "insumo_sienge" does not exist' };
  const chamadas = [];
  const supabase = {
    from: () => ({
      select: () => ({
        range: (de, ate) => Promise.resolve(semTabela
          ? { data: null, error: erro }
          : { data: linhas.slice(de, ate + 1).map((r) => ({ ...r })), error: null }),
      }),
      upsert: (bloco) => {
        chamadas.push({ op: "upsert", quantos: bloco.length });
        if (semTabela) return Promise.resolve({ error: erro });
        bloco.forEach((b) => {
          const i = linhas.findIndex((l) => l.codigo === b.codigo);
          if (i >= 0) linhas[i] = { ...linhas[i], ...b }; else linhas.push({ ...b });
        });
        return Promise.resolve({ error: null });
      },
      delete: () => ({
        in: (col, vals) => {
          chamadas.push({ op: "delete", quantos: vals.length });
          vals.forEach((v) => {
            const i = linhas.findIndex((l) => l.codigo === v);
            if (i >= 0) linhas.splice(i, 1);
          });
          return Promise.resolve({ error: null });
        },
      }),
    }),
  };
  return { supabase, chamadas, linhas };
}

const montar = (supabase) => new Function("supabase", "supabaseConfigurado", "TAMANHO_BLOCO", `
  ${linha("const semTabelaCadastro =")}
  ${linha("const cachePendente =")}
  ${bloco("export async function carregarCadastroSienge(").replace(/^export /, "")}
  ${bloco("export async function salvarCadastroSienge(").replace(/^export /, "")}
  return { carregarCadastroSienge, salvarCadastroSienge };
`)(supabase, true, 500);

/* ---- 6. Importar: atualiza o nome e tira quem saiu ---- */
{
  const b = bancoFalso([
    { codigo: "411", descricao: VELHO, unidade: "un" },
    { codigo: "8000", descricao: "PORTA ANTIGA", unidade: "un" },
  ]);
  const M = montar(b.supabase);
  const r = await M.salvarCadastroSienge([
    { codigo: "411", descricao: AGORA, unidade: "un", precoTabela: 1246.5 },
    { codigo: "9500", descricao: "POLTRONA", unidade: "un" },
  ], "priscila.wayhs@groupws.com.br");
  conf("grava os dois do relatório", r.gravados, 2);
  conf("e remove quem saiu do Sienge", r.removidos, 1);
  conf("o nome do 411 virou o de agora", b.linhas.find((l) => l.codigo === "411")?.descricao, AGORA);
  conf("a porta antiga saiu do cadastro", b.linhas.some((l) => l.codigo === "8000"), false);
  conf("quem importou fica gravado",
    b.linhas.find((l) => l.codigo === "411")?.importado_por, "priscila.wayhs@groupws.com.br");
  conf("preço de tabela vai junto", b.linhas.find((l) => l.codigo === "411")?.preco_tabela, 1246.5);
}

/* ---- 7. CADASTRO VAZIO NÃO APAGA NADA ---- */
{
  const b = bancoFalso([{ codigo: "411", descricao: AGORA, unidade: "un" }]);
  const M = montar(b.supabase);
  const r = await M.salvarCadastroSienge([], "eu");
  conf("lista vazia não grava", r.gravados, 0);
  conf("... e não remove", r.removidos, 0);
  conf("... e não fala com o banco", b.chamadas.length, 0);
  conf("o cadastro fica de pé", b.linhas.length, 1);
  const r2 = await M.salvarCadastroSienge(undefined, "eu");
  conf("lista ausente também não", r2.gravados, 0);
  const r3 = await M.salvarCadastroSienge([{ codigo: "", descricao: "" }], "eu");
  conf("linha sem código nem nome não conta", r3.gravados, 0);
}

/* ---- 8. Código repetido no arquivo entra uma vez ---- */
{
  const b = bancoFalso([]);
  const M = montar(b.supabase);
  const r = await M.salvarCadastroSienge([
    { codigo: "411", descricao: AGORA, unidade: "un" },
    { codigo: "411", descricao: AGORA, unidade: "un" },
  ], "eu");
  conf("repetido entra uma vez só", r.gravados, 1);
}

/* ---- 9. ANTES DE ELA RODAR O SQL ----
   A tabela não existe: leitura devolve vazio (regra desligada) e a
   gravação avisa, sem quebrar a tela. */
{
  const b = bancoFalso([], { semTabela: true });
  const M = montar(b.supabase);
  conf("sem a tabela, ler devolve vazio", (await M.carregarCadastroSienge()).length, 0);
  const r = await M.salvarCadastroSienge([{ codigo: "411", descricao: AGORA }], "eu");
  conf("sem a tabela, gravar avisa em vez de quebrar", r.semTabela, true);
  conf("... e não diz que gravou", r.gravados, 0);
}

/* ---- 10. As telas e o SQL ---- */
const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
conf("o Gerador de códigos passa o cadastro",
  (app.match(/agruparPorMae\(baseSienge, cadastroSienge\)/g) || []).length, 2);
conf("a associação por grupo também",
  app.includes("base = agruparPorMae(insumos, cad);"), true);
conf("as duas telas carregam o cadastro junto da base",
  (app.match(/carregarTodosInsumos\(\), carregarCadastroSienge\(\)/g) || []).length, 3);
conf("a importação do cadastro grava a tabela", /await salvarCadastroSienge\(/.test(app), true);
conf("a tela diz quantos saíram do Sienge",
  /saíram do Sienge e não são mais oferecidos na associação/.test(app), true);
conf("e manda rodar o SQL se a tabela faltar", /supabase\/insumo-sienge\.sql/.test(app), true);

const sql = fs.readFileSync(new URL("../../../supabase/insumo-sienge.sql", import.meta.url), "utf8");
conf("o SQL cria a tabela", sql.includes("create table if not exists insumo_sienge"), true);
conf("o código é a chave", /codigo\s+text primary key/.test(sql), true);
conf("... e roda duas vezes sem erro", sql.includes("if not exists"), true);
conf("o SQL não toca na base de preços", /insumo_preco/.test(sql.replace(/--.*/g, "")), false);

/* ---- ERRO DISFARÇADO DE OUTRO ERRO (17/09/2026) ----
   A primeira versão chamava de "tabela não existe" qualquer erro que citasse
   o nome dela. O Postgres cita o nome em quase tudo — falta de permissão vem
   como `new row violates row-level security policy for table "insumo_sienge"`.
   Um banco que RECUSOU a gravação era anunciado como "falta rodar o SQL", que
   era justamente o que ela já tinha feito. */
{
  const rls = { code: "42501", message: 'new row violates row-level security policy for table "insumo_sienge"' };
  const b = bancoFalso([]);
  b.supabase.from = () => ({
    select: () => ({ range: () => Promise.resolve({ data: [], error: null }) }),
    upsert: () => Promise.resolve({ error: rls }),
    delete: () => ({ in: () => Promise.resolve({ error: null }) }),
  });
  const M = montar(b.supabase);
  let erro = null;
  try { await M.salvarCadastroSienge([{ codigo: "411", descricao: AGORA }], "eu"); }
  catch (e) { erro = e; }
  conf("erro de permissão não vira 'falta rodar o SQL'", !!erro, true);
  conf("... e a mensagem do banco chega inteira", /row-level security/.test(erro?.message || ""), true);
  conf("... com a dica do arquivo certo", /insumo-sienge\.sql/.test(erro?.message || ""), true);
}
/* O cache de schema do PostgREST é caso à parte: a tabela existe, ele é que
   ainda não a enxerga. Sai como semTabela, mas marcado, porque a saída é
   outra (esperar ou recarregar o schema). */
{
  const b = bancoFalso([]);
  b.supabase.from = () => ({
    select: () => ({ range: () => Promise.resolve({ data: [], error: null }) }),
    upsert: () => Promise.resolve({ error: { code: "PGRST205", message: "Could not find the table 'public.insumo_sienge' in the schema cache" } }),
    delete: () => ({ in: () => Promise.resolve({ error: null }) }),
  });
  const M = montar(b.supabase);
  const r = await M.salvarCadastroSienge([{ codigo: "411", descricao: AGORA }], "eu");
  conf("cache do PostgREST é reconhecido", r.semTabela, true);
  conf("... e marcado como cache, não como tabela ausente", r.cachePendente, true);
}

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
