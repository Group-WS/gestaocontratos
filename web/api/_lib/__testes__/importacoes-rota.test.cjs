/* O registro das importacoes pela API (23/09/2026).
 *
 * Roda com: node web/api/_lib/__testes__/importacoes-rota.test.cjs
 *
 * Prova, sem sair pra rede, que:
 *   1. o autor sai do LOGIN, e nao do pedido (SEG-13);
 *   2. o que chega ao banco tem os nomes das colunas;
 *   3. so' quem edita a obra registra, e quem so' enxerga le';
 *   4. documento inventado ou campo estranho param antes do banco;
 *   5. a tabela que ainda nao existe nao quebra a leitura, e o registro
 *      diz qual SQL falta.
 */

process.env.SUPABASE_URL = "https://teste.supabase.co";
process.env.SUPABASE_ANON_KEY = "chave-de-teste";

const path = require("node:path");
const http = require("node:http");
const express = require("express");
const { rotasDeImportacoes } = require(path.join(__dirname, "..", "rotas", "importacoes.js"));

console.error = () => {}; // o log estruturado dos erros e' ruido aqui

const USUARIOS = {
  "t-gc": { id: "u-gc", email: "gc@groupws.com.br", pessoa: { perfil: "gc", ativo: true } },
  "t-mehoo": { id: "u-mehoo", email: "mehoo@groupws.com.br", pessoa: { perfil: "mehoo", ativo: true } },
};
const OBRAS = {
  2519: { codigo: "2519", gc: "gc@groupws.com.br", tailor_made: null, responsavel_executivo: null },
  2600: { codigo: "2600", gc: "outro@groupws.com.br", tailor_made: null, responsavel_executivo: null },
};

let temTabela = true;
let recebido = null;

const json = (corpo, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });

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
    const codigo = (u.searchParams.get("codigo") || "").replace(/^eq\./, "");
    return responder(OBRAS[codigo] ? [OBRAS[codigo]] : []);
  }
  if (u.pathname === "/rest/v1/obra_importacao") {
    if (!temTabela) return json({ code: "PGRST205", message: "Could not find the table" }, 404);
    const metodo = (opcoes.method || "GET").toUpperCase();
    if (metodo === "POST") {
      recebido = JSON.parse(opcoes.body);
      return responder([{ id: 1, ...recebido, criado_em: "2026-09-23T15:00:00Z" }]);
    }
    recebido = { select: u.searchParams.get("select"), order: u.searchParams.get("order"), limit: u.searchParams.get("limit") };
    return responder([{ id: 1, documento: "vendido_planilha", arquivo_nome: "a.xlsx" }]);
  }
  return json([], 404);
};

const app = express();
app.use(express.json());
app.use(rotasDeImportacoes);

let falhas = 0;
const conf = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome.padEnd(66)} ${JSON.stringify(obtido).slice(0, 30).padEnd(30)} ${ok ? "" : "esperava " + JSON.stringify(esperado)}`);
};

const REGISTRO = {
  documento: "vendido_planilha", arquivoNome: "planilha-2519.xlsx", arquivoTamanho: 48213,
  nItens: 134, verbasTrocadas: ["02", "05"], verbasMantidas: ["07"],
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

  try {
    console.log("=== registrar ===");
    let r = await pedir("t-gc", "POST", "/api/obras/2519/importacoes", REGISTRO);
    conf("o GC da obra registra", r.status, 200);
    conf("... com os nomes das colunas e o autor do LOGIN", recebido, {
      obra_codigo: "2519", documento: "vendido_planilha", arquivo_nome: "planilha-2519.xlsx",
      arquivo_tamanho: 48213, n_itens: 134, verbas_trocadas: ["02", "05"], verbas_mantidas: ["07"],
      autor: "gc@groupws.com.br",
    });

    r = await pedir("t-gc", "POST", "/api/obras/2519/importacoes", { ...REGISTRO, autor: "outro@groupws.com.br" });
    conf("autor no corpo do pedido nem chega ao banco", r.status, 400);
    r = await pedir("t-gc", "POST", "/api/obras/2519/importacoes", { ...REGISTRO, documento: "aditivo" });
    conf("documento inventado para antes do banco", r.status, 400);
    r = await pedir("t-gc", "POST", "/api/obras/2600/importacoes", REGISTRO);
    conf("obra de outro GC: nao encontrada", r.status, 404);
    r = await pedir("t-mehoo", "POST", "/api/obras/2519/importacoes", REGISTRO);
    conf("quem so' acompanha nao registra", r.status, 404);

    console.log("\n=== ler ===");
    r = await pedir("t-mehoo", "GET", "/api/obras/2519/importacoes");
    conf("quem enxerga a obra le' o registro", [r.status, r.corpo.importacoes.length], [200, 1]);
    conf("... do mais novo pro mais antigo, com limite", [recebido.order, recebido.limit], ["criado_em.desc", "50"]);
    conf("... pedindo as colunas uma a uma", recebido.select.includes("*"), false);

    console.log("\n=== o SQL ainda nao rodou ===");
    temTabela = false;
    r = await pedir("t-gc", "GET", "/api/obras/2519/importacoes");
    conf("a leitura devolve lista vazia, sem erro", [r.status, r.corpo], [200, { semTabela: true, importacoes: [] }]);
    r = await pedir("t-gc", "POST", "/api/obras/2519/importacoes", REGISTRO);
    conf("o registro diz qual SQL falta", [r.status, /obra-importacao\.sql/.test(r.corpo.error)], [503, true]);
    temTabela = true;
  } finally {
    servidor.close();
    console.log(falhas === 0 ? "\nOK — todas passaram" : `\n${falhas} falha(s)`);
    process.exitCode = falhas === 0 ? 0 : 1;
  }
});

/* O fetch global esta' trocado pelo falso do Supabase; as chamadas pra
   propria rota vao pelo http do Node. */
function fetchOriginal(url, { method = "GET", headers = {}, body } = {}) {
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
