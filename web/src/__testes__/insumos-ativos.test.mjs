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
import { createRequire } from "node:module";
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
   A GRAVAÇÃO DO CADASTRO — com uma API de mentira

   O navegador não fala mais com o banco: quem fala é
   `web/api/_lib/rotas/insumos.js` (VH-02). O que a lib do front faz agora
   é o laço — páginas de mil, blocos de 500, remoção em blocos de 150 —, e
   é isso que se testa aqui, com um `apiJson` de mentira no lugar da rede.

   As decisões que MUDARAM DE LADO (o que é "tabela não existe", como o
   filtro de busca é escapado, de onde vem quem importou) são testadas
   contra a rota de verdade, logo abaixo.
   ============================================================ */

const lib = fs.readFileSync(new URL("../lib/insumos.js", import.meta.url), "utf8");
const rota = fs.readFileSync(new URL("../../api/_lib/rotas/insumos.js", import.meta.url), "utf8");
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

/* A API de mentira: responde o que a rota responde, e anota o que foi
   pedido. `semTabela` é a resposta da rota quando o SQL ainda não rodou —
   leitura vazia, gravação avisada. */
function apiFalsa(linhas, { semTabela = false, cachePendente = false, recusa = null } = {}) {
  const chamadas = [];
  async function apiJson(caminho, { metodo = "GET", corpo } = {}) {
    const url = new URL(caminho, "http://api");
    const p = url.pathname;
    const n = (k) => Number(url.searchParams.get(k));

    if (p === "/api/insumos/sienge" && metodo === "GET") {
      chamadas.push({ op: "ler", de: n("de"), passo: n("passo") });
      if (semTabela) return []; // a rota devolve vazio: regra desligada
      return linhas.slice(n("de"), n("de") + n("passo")).map((r) => ({ ...r }));
    }
    if (p === "/api/insumos/sienge" && metodo === "POST") {
      chamadas.push({ op: "upsert", quantos: corpo.linhas.length });
      if (semTabela) return { gravados: 0, semTabela: true, cachePendente };
      if (recusa) throw new Error(recusa);
      corpo.linhas.forEach((b) => {
        const i = linhas.findIndex((l) => l.codigo === b.codigo);
        if (i >= 0) linhas[i] = { ...linhas[i], ...b }; else linhas.push({ ...b });
      });
      return { gravados: corpo.linhas.length };
    }
    if (p === "/api/insumos/sienge/remover" && metodo === "POST") {
      chamadas.push({ op: "delete", quantos: corpo.codigos.length });
      corpo.codigos.forEach((v) => {
        const i = linhas.findIndex((l) => l.codigo === v);
        if (i >= 0) linhas.splice(i, 1);
      });
      return { removidos: corpo.codigos.length };
    }
    throw new Error(`caminho que a lib não deveria chamar: ${metodo} ${caminho}`);
  }
  return { apiJson, chamadas, linhas };
}

const montar = (apiJson) => new Function("apiJson", "supabaseConfigurado", `
  ${linha("const TAMANHO_BLOCO =")}
  ${bloco("export async function carregarCadastroSienge(").replace(/^export /, "")}
  ${bloco("export async function salvarCadastroSienge(").replace(/^export /, "")}
  return { carregarCadastroSienge, salvarCadastroSienge, TAMANHO_BLOCO };
`)(apiJson, true);

/* ---- 6. Importar: atualiza o nome e tira quem saiu ---- */
{
  const b = apiFalsa([
    { codigo: "411", descricao: VELHO, unidade: "un" },
    { codigo: "8000", descricao: "PORTA ANTIGA", unidade: "un" },
  ]);
  const M = montar(b.apiJson);
  const r = await M.salvarCadastroSienge([
    { codigo: "411", descricao: AGORA, unidade: "un", precoTabela: 1246.5 },
    { codigo: "9500", descricao: "POLTRONA", unidade: "un" },
  ], "priscila.wayhs@groupws.com.br");
  conf("grava os dois do relatório", r.gravados, 2);
  conf("e remove quem saiu do Sienge", r.removidos, 1);
  conf("o nome do 411 virou o de agora", b.linhas.find((l) => l.codigo === "411")?.descricao, AGORA);
  conf("a porta antiga saiu do cadastro", b.linhas.some((l) => l.codigo === "8000"), false);
  conf("preço de tabela vai junto", b.linhas.find((l) => l.codigo === "411")?.preco_tabela, 1246.5);
  conf("sobe num bloco só, pelo caminho do cadastro",
    b.chamadas.filter((c) => c.op === "upsert").length, 1);
}

/* ---- 7. CADASTRO VAZIO NÃO APAGA NADA ---- */
{
  const b = apiFalsa([{ codigo: "411", descricao: AGORA, unidade: "un" }]);
  const M = montar(b.apiJson);
  const r = await M.salvarCadastroSienge([], "eu");
  conf("lista vazia não grava", r.gravados, 0);
  conf("... e não remove", r.removidos, 0);
  conf("... e não fala com a API", b.chamadas.length, 0);
  conf("o cadastro fica de pé", b.linhas.length, 1);
  const r2 = await M.salvarCadastroSienge(undefined, "eu");
  conf("lista ausente também não", r2.gravados, 0);
  const r3 = await M.salvarCadastroSienge([{ codigo: "", descricao: "" }], "eu");
  conf("linha sem código nem nome não conta", r3.gravados, 0);
}

/* ---- 8. Código repetido no arquivo entra uma vez ---- */
{
  const b = apiFalsa([]);
  const M = montar(b.apiJson);
  const r = await M.salvarCadastroSienge([
    { codigo: "411", descricao: AGORA, unidade: "un" },
    { codigo: "411", descricao: AGORA, unidade: "un" },
  ], "eu");
  conf("repetido entra uma vez só", r.gravados, 1);
}

/* ---- 8b. O LAÇO DOS BLOCOS CONTINUA NO FRONT ----
   É ele que alimenta o "Gravando 1.500 de 10.507…" da tela e o que impede
   um corpo de pedido de passar de 1 MB. Se ele subisse para a rota, a
   barra de progresso morreria e o pedido estouraria o limite. */
{
  const b = apiFalsa([]);
  const M = montar(b.apiJson);
  const passos = [];
  const muitos = Array.from({ length: 1201 }, (_, i) => ({ codigo: String(i), descricao: `INSUMO ${i}`, unidade: "un" }));
  const r = await M.salvarCadastroSienge(muitos, "eu", (feitos, total) => passos.push([feitos, total]));
  conf("sobe em blocos de TAMANHO_BLOCO", M.TAMANHO_BLOCO, 500);
  conf("... três blocos para 1.201 insumos",
    b.chamadas.filter((c) => c.op === "upsert").map((c) => c.quantos).join("/"), "500/500/201");
  conf("... e o onProgresso vê cada bloco", passos.map((x) => x[0]).join("/"), "500/1000/1201");
  conf("... sempre com o total", passos[0][1], 1201);
  conf("gravou todos", r.gravados, 1201);
  conf("a leitura pagina de mil em mil",
    b.chamadas.filter((c) => c.op === "ler").map((c) => c.passo)[0], 1000);
}

/* ---- 8c. A remoção também vai em blocos ----
   Eram 150 por bloco porque a lista de códigos ia na URL do PostgREST. */
{
  const antigos = Array.from({ length: 160 }, (_, i) => ({ codigo: `velho${i}`, descricao: "X", unidade: "un" }));
  const b = apiFalsa(antigos);
  const M = montar(b.apiJson);
  const r = await M.salvarCadastroSienge([{ codigo: "411", descricao: AGORA, unidade: "un" }], "eu");
  conf("remove todos os que saíram", r.removidos, 160);
  conf("... em blocos de 150",
    b.chamadas.filter((c) => c.op === "delete").map((c) => c.quantos).join("/"), "150/10");
}

/* ---- 9. ANTES DE ELA RODAR O SQL ----
   A tabela não existe: a rota devolve vazio na leitura (regra desligada) e
   avisa na gravação, sem quebrar a tela. */
{
  const b = apiFalsa([], { semTabela: true });
  const M = montar(b.apiJson);
  conf("sem a tabela, ler devolve vazio", (await M.carregarCadastroSienge()).length, 0);
  const r = await M.salvarCadastroSienge([{ codigo: "411", descricao: AGORA }], "eu");
  conf("sem a tabela, gravar avisa em vez de quebrar", r.semTabela, true);
  conf("... e não diz que gravou", r.gravados, 0);
  conf("... e não tenta remover nada", r.removidos, 0);
}

/* ---- 10. As telas e o SQL ---- */
const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
conf("o Gerador de códigos passa o cadastro",
  (app.match(/agruparPorMae\(baseSienge, cadastroSienge\)/g) || []).length, 2);
/* 25/09/2026: a associação por grupo (botão) saiu; nas Compras a base
   carrega sozinha, pelo `recarregarBase`, que já traz o cadastro. */
conf("as Compras carregam a base sozinhas, com o cadastro",
  /recarregarBase\(\);\n  \}, \[naEtapaSienge/.test(app), true);
conf("as duas telas carregam o cadastro junto da base",
  (app.match(/carregarTodosInsumos\(\), carregarCadastroSienge\(\)/g) || []).length, 2);
conf("a importação do cadastro grava a tabela", /await salvarCadastroSienge\(/.test(app), true);
conf("a tela diz quantos saíram do Sienge",
  /saíram do Sienge e não são mais oferecidos na associação/.test(app), true);
conf("e manda rodar o SQL se a tabela faltar", /supabase\/insumo-sienge\.sql/.test(app), true);

const sql = fs.readFileSync(new URL("../../../supabase/insumo-sienge.sql", import.meta.url), "utf8");
conf("o SQL cria a tabela", sql.includes("create table if not exists insumo_sienge"), true);
conf("o código é a chave", /codigo\s+text primary key/.test(sql), true);
conf("... e roda duas vezes sem erro", sql.includes("if not exists"), true);
conf("o SQL não toca na base de preços", /insumo_preco/.test(sql.replace(/--.*/g, "")), false);

/* ============================================================
   A ROTA — onde as decisões do banco passaram a morar (VH-02)
   ============================================================ */
const daRota = createRequire(import.meta.url)("../../api/_lib/rotas/insumos.js");

conf("a lib do front não fala mais com o Supabase", /supabase\.(from|rpc|storage)\(/.test(lib), false);
conf("... ela chama a API", /apiJson\(/.test(lib), true);
conf("a rota exige login e ser do time", /rotas\.use\(exigirLogin, exigirMembro\)/.test(rota), true);
conf("a rota nunca usa select(\"*\")", /select\(\s*["'`]\*/.test(rota), false);
conf("o upsert do cadastro continua com onConflict pelo código",
  /upsert\(linhas, \{ onConflict: "codigo" \}\)/.test(rota), true);
conf("o upsert dos preços continua com a chave de três colunas",
  /onConflict: "codigo,descricao,unidade"/.test(rota), true);
conf("a remoção continua sendo pelo código", /\.delete\(\)\.in\("codigo", codigos\)/.test(rota), true);
conf("a leitura do cadastro devolve vazio quando a tabela não existe",
  /if \(semTabelaCadastro\(error\)\) return res\.json\(\[\]\);/.test(rota), true);

/* QUEM IMPORTOU VEM DO LOGIN, não do corpo do pedido (SEG-13). É o mesmo
   e-mail que a tela mandava — a sessão aberta —, só que agora o servidor
   é quem o escreve, e ninguém consegue gravar em nome de outra pessoa. */
conf("quem importou é tirado do login", /importado_por: req\.usuario\.email/.test(rota), true);
conf("... e o front não manda esse campo", /importado_por/.test(lib), false);

/* ---- ERRO DISFARÇADO DE OUTRO ERRO (17/09/2026) ----
   A primeira versão chamava de "tabela não existe" qualquer erro que citasse
   o nome dela. O Postgres cita o nome em quase tudo — falta de permissão vem
   como `new row violates row-level security policy for table "insumo_sienge"`.
   Um banco que RECUSOU a gravação era anunciado como "falta rodar o SQL", que
   era justamente o que ela já tinha feito. A decisão agora é da rota, e
   continua sendo pelo CÓDIGO do erro, nunca pelo texto. */
conf("42P01 é tabela que não existe", daRota.semTabelaCadastro({ code: "42P01" }), true);
conf("PGRST205 também", daRota.semTabelaCadastro({ code: "PGRST205" }), true);
conf("... e é marcado como cache do PostgREST", daRota.cachePendente({ code: "PGRST205" }), true);
conf("42P01 não é cache", daRota.cachePendente({ code: "42P01" }), false);
conf("erro de permissão NÃO vira 'falta rodar o SQL'",
  daRota.semTabelaCadastro({ code: "42501", message: 'row-level security policy for table "insumo_sienge"' }), false);

/* A mensagem que a pessoa lê quando o banco recusa: sem o texto cru do
   Postgres (SEG-33), mas com o que resolve — o código e o arquivo. */
{
  const m = daRota.mensagemDeRecusa("42501");
  conf("a recusa fala em row-level security", /row-level security/.test(m), true);
  conf("... com a dica do arquivo certo", /insumo-sienge\.sql/.test(m), true);
  conf("... e com o código do banco", /42501/.test(m), true);
  const outro = daRota.mensagemDeRecusa("23505");
  conf("outro código também chega com a dica", /insumo-sienge\.sql/.test(outro), true);
}

/* A tela ainda vê o erro: o que a rota respondeu sobe como exceção e não
   é confundido com "falta rodar o SQL". */
{
  const b = apiFalsa([], { recusa: daRota.mensagemDeRecusa("42501") });
  const M = montar(b.apiJson);
  let erro = null;
  try { await M.salvarCadastroSienge([{ codigo: "411", descricao: AGORA }], "eu"); }
  catch (e) { erro = e; }
  conf("a recusa do banco chega à tela", !!erro, true);
  conf("... com a mensagem inteira da rota", /row-level security/.test(erro?.message || ""), true);
  conf("... e a tela não recebe semTabela", erro?.semTabela, undefined);
}

/* O cache de schema do PostgREST é caso à parte: a tabela existe, ele é que
   ainda não a enxerga. Sai como semTabela, mas marcado, porque a saída é
   outra (esperar ou recarregar o schema). */
{
  const b = apiFalsa([], { semTabela: true, cachePendente: true });
  const M = montar(b.apiJson);
  const r = await M.salvarCadastroSienge([{ codigo: "411", descricao: AGORA }], "eu");
  conf("cache do PostgREST é reconhecido", r.semTabela, true);
  conf("... e marcado como cache, não como tabela ausente", r.cachePendente, true);
}

/* ---- O TERMO DA BUSCA NÃO ESCREVE FILTRO ----
   `or=(codigo.ilike.%x%,descricao.ilike.%x%)` é uma linguagem: vírgula
   separa condições, parêntese agrupa. Com o termo cru interpolado, quem
   digitasse uma vírgula montava condição nova. Entre aspas, não. */
{
  const limpo = daRota.filtroDeBusca("arandela", ["codigo", "descricao"]);
  conf("a busca simples procura nas duas colunas",
    limpo, 'codigo.ilike."%arandela%",descricao.ilike."%arandela%"');
  const sujo = daRota.filtroDeBusca('a,b)or(descricao.is.null', ["descricao"]);
  conf("vírgula e parêntese do usuário viram texto",
    sujo, 'descricao.ilike."%a,b)or(descricao.is.null%"');
  conf("aspas do usuário são escapadas",
    daRota.valorDoFiltro('diz "oi"'), '"diz \\"oi\\""');
  conf("barra invertida também", daRota.valorDoFiltro("a\\b"), '"a\\\\b"');
}

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
