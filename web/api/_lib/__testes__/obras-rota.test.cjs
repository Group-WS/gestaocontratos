/* O ciclo de vida das obras pela API — e a coluna que ainda nao existe.
 *
 * Roda com: node web/api/_lib/__testes__/obras-rota.test.cjs
 *
 * O navegador falava direto com a tabela `obra`; agora fala com estas
 * rotas (VH-02). Na mudanca de caminho, a trava que mais importa veio
 * junto: entre o deploy do app e alguem rodar a migracao existe uma janela
 * em que o Postgres rejeita a LEITURA INTEIRA por causa de uma coluna
 * desconhecida. Como e' essa leitura que diz "esta obra esta' ativa?", o
 * efeito era o pior possivel — toda obra ativa virava invisivel, como se
 * tivesse sumido. Aconteceu de verdade em 2026-09-05, com as colunas de
 * Equipe da obra.
 *
 * Este teste prova, sem sair pra rede, que:
 *   1. a lista sobrevive a' coluna que falta (rele' sem ela, nao estoura);
 *   2. o GC tambem sobrevive (so' o SELECT de volta falha, o UPDATE nao);
 *   3. Taylor Made e Executivo, que gravam NA coluna nova, dizem qual SQL
 *      falta — com a frase que a tela ja' mostrava, palavra por palavra;
 *   4. o que chega ao banco continua sendo o mesmo de antes;
 *   5. quem nao edita a obra nao passa.
 *
 * As rotas sao montadas aqui direto, sem o mondayApp: o registro delas no
 * app e' outra conversa, e este teste e' sobre o que a rota faz.
 */

process.env.SUPABASE_URL = "https://teste.supabase.co";
process.env.SUPABASE_ANON_KEY = "chave-de-teste";

const path = require("node:path");
const express = require("express");
const { rotasDeObras } = require(path.join(__dirname, "..", "rotas", "obras.js"));

console.error = () => {}; // o log estruturado dos erros e' ruido aqui

const USUARIOS = {
  "t-admin": { id: "u-admin", email: "admin@groupws.com.br", pessoa: { perfil: "admin", ativo: true } },
  "t-gc": { id: "u-gc", email: "gc@groupws.com.br", pessoa: { perfil: "gc", ativo: true } },
  "t-mehoo": { id: "u-mehoo", email: "mehoo@groupws.com.br", pessoa: { perfil: "mehoo", ativo: true } },
};
const OBRAS = {
  2519: { codigo: "2519", nome: "Const. Bidese", squad: "Sun", situacao: "ativa", gc: "gc@groupws.com.br", tailor_made: null, responsavel_executivo: null },
  2600: { codigo: "2600", nome: "Salt", squad: "Moon", situacao: "ativa", gc: "outro@groupws.com.br", tailor_made: null, responsavel_executivo: null },
};

/* O estado do "banco" deste teste: a migracao das colunas novas rodou ou
   nao, e o que cada escrita recebeu. */
let temAsColunasNovas = true;
let duplicado = false;
let recebido = null;

const json = (corpo, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
const erroDeColuna = () => json({
  code: "42703", message: 'column obra.tailor_made does not exist', details: null, hint: null,
}, 400);

global.fetch = async (url, opcoes = {}) => {
  const u = new URL(String(url));
  const cab = new Headers(opcoes.headers || {});
  if (u.hostname !== "teste.supabase.co") throw new Error(`fetch inesperado no teste: ${u.hostname}`);
  const token = (cab.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const usuario = USUARIOS[token];
  if (u.pathname === "/auth/v1/user") {
    return usuario ? json({ id: usuario.id, email: usuario.email, aud: "authenticated" }) : json({ msg: "invalid" }, 401);
  }
  const umSo = (cab.get("accept") || "").includes("vnd.pgrst.object");
  const responder = (linhas) => (umSo ? (linhas.length ? json(linhas[0]) : json({}, 406)) : json(linhas));

  if (u.pathname === "/rest/v1/pessoa") {
    const email = (u.searchParams.get("email") || "").replace(/^eq\./, "");
    const dono = Object.values(USUARIOS).find((x) => x.email === email);
    return responder(dono ? [dono.pessoa] : []);
  }
  if (u.pathname === "/rest/v1/obra") {
    const select = u.searchParams.get("select") || "";
    const pedeAsNovas = /tailor_made|responsavel_executivo/.test(select);
    const metodo = (opcoes.method || "GET").toUpperCase();
    const codigo = (u.searchParams.get("codigo") || "").replace(/^eq\./, "");
    const corpo = opcoes.body ? JSON.parse(opcoes.body) : null;
    if (metodo !== "GET") recebido = { metodo, codigo, corpo, select };

    // Coluna que o banco ainda nao tem derruba o pedido INTEIRO — leitura,
    // escrita, tanto faz: e' o Postgres recusando a consulta.
    if (pedeAsNovas && !temAsColunasNovas) return erroDeColuna();
    if (metodo === "POST") {
      if (duplicado) {
        return json({ code: "23505", message: 'duplicate key value violates unique constraint "obra_pkey"' }, 409);
      }
      return responder([{ ...corpo }]);
    }
    if (metodo === "PATCH") {
      const linha = OBRAS[codigo];
      return responder(linha ? [{ ...linha, ...corpo }] : []);
    }
    const linhas = codigo ? [OBRAS[codigo]].filter(Boolean) : Object.values(OBRAS);
    return responder(linhas.map((o) => ({ ...o })));
  }
  return json([], 404);
};

const app = express();
app.use(express.json());
app.use(rotasDeObras);

let falhas = 0;
const conf = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome.padEnd(66)} ${JSON.stringify(obtido).slice(0, 30).padEnd(30)} ${ok ? "" : "esperava " + JSON.stringify(esperado)}`);
};

const servidor = app.listen(0, async () => {
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const pedir = async (quem, metodo, caminho, corpo) => {
    const r = await fetchOriginal(base + caminho, {
      method: metodo,
      headers: { Authorization: `Bearer ${quem}`, ...(corpo ? { "Content-Type": "application/json" } : {}) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    let dados = null;
    try { dados = await r.json(); } catch { /* sem corpo */ }
    return { status: r.status, corpo: dados };
  };

  console.log("=== a lista ===");
  temAsColunasNovas = true;
  let r = await pedir("t-admin", "GET", "/api/obras");
  conf("as obras do banco chegam a' tela", [r.status, r.corpo.length], [200, 2]);

  /* A JANELA DA MIGRACAO. Sem o retry, isto e' a tela sem nenhuma obra. */
  temAsColunasNovas = false;
  r = await pedir("t-admin", "GET", "/api/obras");
  conf("coluna que falta NAO apaga a lista de obras", [r.status, r.corpo.length], [200, 2]);
  conf("... e a obra volta inteira, sem as colunas novas", r.corpo[0].codigo, "2519");

  console.log("\n=== dar start ===");
  temAsColunasNovas = true;
  r = await pedir("t-admin", "POST", "/api/obras", {
    codigo: "2517", nome: "Obra à mão", squad: "Sun", boardId: null,
    cliente: "—", endereco: "", gc: null, valorVendido: 0,
  });
  conf("a obra nasce ativa, com os nomes das colunas", [r.status, recebido.corpo], [200, {
    codigo: "2517", nome: "Obra à mão", squad: "Sun", board_id: null,
    cliente: "—", endereco: "", gc: null, valor_vendido: null, situacao: "ativa",
  }]);
  conf("... e a tela recebe a linha gravada", r.corpo.codigo, "2517");

  duplicado = true;
  r = await pedir("t-admin", "POST", "/api/obras", { codigo: "2517" });
  conf("centro de custo repetido volta com o codigo do banco", [r.status, r.corpo.code], [409, "23505"]);
  conf("... e sem o texto cru do Postgres", /duplicate key/.test(JSON.stringify(r.corpo)), false);
  duplicado = false;

  r = await pedir("t-mehoo", "POST", "/api/obras", { codigo: "2518" });
  conf("quem nao edita nao inicia obra", r.status, 403);
  r = await pedir("t-admin", "POST", "/api/obras", { codigo: "2517", cor: "azul" });
  conf("campo estranho no corpo para antes do banco", r.status, 400);

  console.log("\n=== concluir e reabrir ===");
  r = await pedir("t-admin", "PATCH", "/api/obras/2519/situacao", { situacao: "concluida" });
  conf("concluir grava a situacao e a data", [r.status, recebido.corpo.situacao, typeof recebido.corpo.concluida_em], [200, "concluida", "string"]);
  await pedir("t-admin", "PATCH", "/api/obras/2519/situacao", { situacao: "ativa" });
  conf("reabrir limpa a data", recebido.corpo, { situacao: "ativa", concluida_em: null });
  r = await pedir("t-admin", "PATCH", "/api/obras/2519/situacao", { situacao: "arquivada" });
  conf("situacao inventada nao chega ao banco", r.status, 400);

  console.log("\n=== equipe da obra ===");
  r = await pedir("t-admin", "PATCH", "/api/obras/2519/papel", { papel: "gc", email: "a@groupws.com.br" });
  conf("o GC vai pra coluna gc", [r.status, recebido.corpo], [200, { gc: "a@groupws.com.br" }]);
  await pedir("t-admin", "PATCH", "/api/obras/2519/papel", { papel: "gc", email: "" });
  conf("e-mail vazio tira o responsavel", recebido.corpo, { gc: null });
  r = await pedir("t-admin", "PATCH", "/api/obras/2519/papel", { papel: "chefe", email: "a@groupws.com.br" });
  conf("papel inventado nao chega ao banco", r.status, 400);

  /* Sem a migracao: no GC e' so' o SELECT de volta que pede a coluna nova
     — a gravacao em si funcionou. Nos outros dois e' o proprio UPDATE que
     toca a coluna, e ai nao tem o que reler: a pessoa precisa saber qual
     arquivo rodar, com a frase de sempre. */
  temAsColunasNovas = false;
  r = await pedir("t-admin", "PATCH", "/api/obras/2519/papel", { papel: "gc", email: "a@groupws.com.br" });
  conf("GC sem a migracao: rele' sem as colunas novas", [r.status, r.corpo.codigo], [200, "2519"]);
  r = await pedir("t-admin", "PATCH", "/api/obras/2519/papel", { papel: "tailor_made", email: "a@groupws.com.br" });
  conf("Taylor Made sem a migracao diz qual SQL falta", r.corpo.error,
    "Falta rodar supabase/equipe-da-obra.sql — a coluna de Taylor Made ainda não existe.");
  r = await pedir("t-admin", "PATCH", "/api/obras/2519/papel", { papel: "responsavel_executivo", email: "a@groupws.com.br" });
  conf("Executivo sem a migracao diz qual SQL falta", r.corpo.error,
    "Falta rodar supabase/equipe-da-obra.sql — a coluna de Executivo ainda não existe.");
  temAsColunasNovas = true;

  console.log("\n=== o endereco corrigido a' mao ===");
  await pedir("t-admin", "PATCH", "/api/obras/2519/endereco", { endereco: "  Rua 3310, 31  " });
  conf("o endereco grava aparado", recebido.corpo, { endereco: "Rua 3310, 31" });
  await pedir("t-admin", "PATCH", "/api/obras/2519/endereco", { endereco: "" });
  conf("endereco vazio grava nulo (a tela volta ao do Sienge)", recebido.corpo, { endereco: null });
  temAsColunasNovas = false;
  r = await pedir("t-admin", "PATCH", "/api/obras/2519/endereco", { endereco: "Rua X" });
  conf("endereco sem a migracao: rele' sem as colunas novas", [r.status, r.corpo.codigo], [200, "2519"]);
  temAsColunasNovas = true;

  console.log("\n=== quem pode mexer ===");
  r = await pedir("t-gc", "PATCH", "/api/obras/2519/endereco", { endereco: "Rua X" });
  conf("o GC da obra passa", r.status, 200);
  r = await pedir("t-gc", "PATCH", "/api/obras/2600/endereco", { endereco: "Rua X" });
  conf("o GC de OUTRA obra nao passa (e nem sabe que ela existe)", r.status, 404);
  r = await pedir("t-mehoo", "PATCH", "/api/obras/2519/papel", { papel: "gc", email: "a@groupws.com.br" });
  conf("a Mehoo ve tudo e nao muda nada", r.status, 404);
  r = await pedir("sem-token", "GET", "/api/obras");
  conf("sem login, nada", r.status, 401);

  servidor.close();
  console.log(falhas === 0 ? "\nOK — todas passaram" : `\n${falhas} falha(s)`);
  process.exit(falhas === 0 ? 0 : 1);
});

/* O fetch global responde como Supabase; para bater no servidor local, uma
   chamada HTTP minima com node:http (o mesmo do gravacao-obra.test.cjs). */
function fetchOriginal(url, { method = "GET", headers = {}, body } = {}) {
  const http = require("node:http");
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method, headers }, (res) => {
      const partes = [];
      res.on("data", (p) => partes.push(p));
      res.on("end", () => {
        const texto = Buffer.concat(partes).toString("utf8");
        resolve({ status: res.statusCode, json: async () => JSON.parse(texto), text: async () => texto });
      });
    });
    req.on("error", reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}
