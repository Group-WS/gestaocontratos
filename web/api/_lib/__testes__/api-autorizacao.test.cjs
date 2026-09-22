/* Quem pode o que na API — perfil, obra e o numero da solicitacao.
 *
 * Roda com: node web/api/_lib/__testes__/api-autorizacao.test.cjs
 *
 * Achados da varredura de 21/09/2026: estar logado bastava para chamar
 * tudo (inclusive quem estava na sala de espera), a Mehoo criava
 * solicitacao no Sienge sem editar nada, o numero da solicitacao vindo do
 * navegador nao era conferido contra a obra, e as rotas de "descoberta"
 * do Monday liam a conta inteira. Cada caso abaixo e' um desses buracos,
 * fechado — e o caminho legitimo, que tem que continuar funcionando.
 *
 * Nada aqui sai pra rede: o `fetch` global responde como Supabase (Auth e
 * PostgREST) e como Sienge, com dados sinteticos.
 */

process.env.SUPABASE_URL = "https://teste.supabase.co";
process.env.SUPABASE_ANON_KEY = "chave-de-teste";
process.env.SIENGE_USERNAME = "usuario-de-teste";
process.env.SIENGE_PASSWORD = "senha-de-teste";

const fs = require("node:fs");
const path = require("node:path");
const app = require(path.join(__dirname, "..", "mondayApp.js"));

console.error = () => {}; // o log estruturado dos erros e' ruido aqui

/* ---------- o mundo simulado ---------- */

const USUARIOS = {
  "t-fila": { id: "u-fila", email: "fila@groupws.com.br", pessoa: { perfil: null, ativo: true } },
  "t-inativo": { id: "u-inativo", email: "saiu@groupws.com.br", pessoa: { perfil: "gc", ativo: false } },
  "t-mehoo": { id: "u-mehoo", email: "mehoo@groupws.com.br", pessoa: { perfil: "mehoo", ativo: true } },
  "t-gc": { id: "u-gc", email: "gc@groupws.com.br", pessoa: { perfil: "gc", ativo: true } },
  "t-exec": { id: "u-exec", email: "exec@groupws.com.br", pessoa: { perfil: "gc", ativo: true } },
  "t-taylor": { id: "u-taylor", email: "taylor@groupws.com.br", pessoa: { perfil: "taylor", ativo: true } },
  "t-admin": { id: "u-admin", email: "admin@groupws.com.br", pessoa: { perfil: "admin", ativo: true } },
};
// Os tres papeis da obra: GC, Taylor Made e Executivo (supabase/taylor-made.sql).
const OBRAS = {
  "2519": { codigo: "2519", gc: "gc@groupws.com.br", tailor_made: "taylor@groupws.com.br", responsavel_executivo: null },
  "2600": { codigo: "2600", gc: "outro@groupws.com.br", tailor_made: null, responsavel_executivo: "exec@groupws.com.br" },
};
// Solicitacoes que o "Sienge" conhece: o numero diz de qual obra ela e'.
const SOLICITACOES = { 23000: { buildingId: 2519, status: "PENDING" }, 24000: { buildingId: 2600, status: "PENDING" } };
const REF = "05.001.001.001";

const chamadasSienge = [];
// Preferencias que o "banco" tem, e o que a API mandou gravar.
const PREFERENCIAS = [
  { email: "gc@groupws.com.br", chave: "obras.modo", valor: "squad" },
  { email: "admin@groupws.com.br", chave: "obras.modo", valor: "numero" },
  { email: "gc@groupws.com.br", chave: "chave.aposentada", valor: true },
];
const gravadas = [];
const json = (corpo, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });

global.fetch = async (url, opcoes = {}) => {
  const u = new URL(String(url));
  const cab = new Headers(opcoes.headers || {});
  const metodo = (opcoes.method || "GET").toUpperCase();

  if (u.hostname === "teste.supabase.co") {
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
    if (u.pathname === "/rest/v1/preferencia") {
      if (metodo === "GET") {
        const email = (u.searchParams.get("email") || "").replace(/^eq\./, "");
        return json(PREFERENCIAS.filter((p) => p.email === email).map(({ chave, valor }) => ({ chave, valor })));
      }
      gravadas.push(JSON.parse(opcoes.body));
      return json([], 201);
    }
    return json([], 404);
  }

  if (u.hostname === "api.sienge.com.br") {
    chamadasSienge.push(`${metodo} ${u.pathname}`);
    const m = u.pathname.match(/\/purchase-requests\/(\d+)$/);
    if (m && metodo === "GET") {
      const s = SOLICITACOES[m[1]];
      return s ? json({ id: Number(m[1]), ...s }) : json({ clientMessage: "Não encontrada" }, 404);
    }
    if (/\/sheets\/\d+\/items$/.test(u.pathname)) return json({ results: [{ wbsCode: REF }] });
    if (/\/purchase-requests\/\d+\/items$/.test(u.pathname) && metodo === "POST") return json({}, 201);
    if (u.pathname.endsWith("/purchase-requests") && metodo === "POST") return json({ id: 25000 }, 201);
    return json({}, 404);
  }

  throw new Error(`fetch inesperado no teste: ${u.hostname}`);
};

/* ---------- conferencia ---------- */

let falhas = 0;
const conf = (nome, obtido, esperado) => {
  const ok = obtido === esperado;
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome.padEnd(70)} ${String(obtido).padEnd(5)} ${ok ? "" : "esperava " + esperado}`);
};

const item = (extra = {}) => ({
  productId: 275, quantity: 2, unitySymbol: "un", estimatedPrice: 1500, notes: "LG SPLIT 18.000 BTUS",
  buildingUnitId: 1, costEstimationItemReference: REF, chaves: ["05:3"], ...extra,
});

const servidor = app.listen(0, async () => {
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const pedir = (token, metodo, caminho, corpo, cabecalhos = {}) => fetchOriginal(base + caminho, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, ...(corpo && !Buffer.isBuffer(corpo) ? { "Content-Type": "application/json" } : {}), ...cabecalhos },
    body: corpo === undefined ? undefined : Buffer.isBuffer(corpo) ? corpo : JSON.stringify(corpo),
  });
  const obras = "/api/monday/obras-execucao?workspaceId=13339794";

  try {
    // 1. Estar logado nao basta: sala de espera e desativado ficam de fora.
    conf("sem perfil (sala de espera) não chama a API", (await pedir("t-fila", "GET", obras)).status, 403);
    conf("pessoa desativada não chama a API", (await pedir("t-inativo", "GET", obras)).status, 403);

    // 2. Mehoo: ve, nao edita.
    const pdf = Buffer.from("%PDF-1.4\n%sintetico\n");
    conf("Mehoo não usa o leitor de PDF (é de quem edita)",
      (await pedir("t-mehoo", "POST", "/api/vendido/parse", pdf, { "Content-Type": "application/pdf" })).status, 403);
    conf("Mehoo não cria solicitação no Sienge",
      (await pedir("t-mehoo", "POST", "/api/sienge/solicitacao", { buildingId: 2519, itens: [item()] })).status, 404);

    // 3. GC: so' nas obras dele.
    conf("GC não cria solicitação em obra de outro GC",
      (await pedir("t-gc", "POST", "/api/sienge/solicitacao", { buildingId: 2600, itens: [item()] })).status, 404);

    // 3b. Os tres papeis: quem e' Executivo (ou Taylor) de uma obra a enxerga.
    conf("GC que é Executivo de outra obra consulta a solicitação dela",
      (await pedir("t-exec", "GET", "/api/sienge/solicitacao/24000")).status, 200);
    conf("... e cria solicitação nela (edita, como GC)",
      (await pedir("t-exec", "POST", "/api/sienge/solicitacao", { buildingId: 2600, itens: [item()] })).status, 200);
    conf("Taylor Made consulta a solicitação da obra em que responde",
      (await pedir("t-taylor", "GET", "/api/sienge/solicitacao/23000")).status, 200);
    conf("... mas não cria solicitação (acompanha, não edita)",
      (await pedir("t-taylor", "POST", "/api/sienge/solicitacao", { buildingId: 2519, itens: [item()] })).status, 404);
    conf("Taylor Made não consulta solicitação de obra em que não responde",
      (await pedir("t-taylor", "GET", "/api/sienge/solicitacao/24000")).status, 404);

    // 4. O numero do reenvio tem que ser da mesma obra.
    const antes = chamadasSienge.length;
    const cruzado = await pedir("t-gc", "POST", "/api/sienge/solicitacao",
      { buildingId: 2519, solicitacaoId: 24000, itens: [item()] });
    conf("reenvio com solicitação de OUTRA obra é recusado", cruzado.status, 404);
    conf("... e nenhum item é mandado ao Sienge",
      chamadasSienge.slice(antes).some((c) => c.startsWith("POST")), false);

    // 5. Consultar solicitacao de obra que nao e' sua: "nao encontrada".
    conf("GC não consulta solicitação de obra alheia",
      (await pedir("t-gc", "GET", "/api/sienge/solicitacao/24000")).status, 404);
    const admin = await pedir("t-admin", "GET", "/api/sienge/solicitacao/24000");
    conf("admin consulta qualquer solicitação", admin.status, 200);
    conf("... e recebe o cabeçalho", (await admin.json()).existe, true);

    // 6. Entrada fora do contrato: 400, antes de tocar o banco ou o Sienge.
    const invalido = await pedir("t-gc", "POST", "/api/sienge/solicitacao",
      { buildingId: 2519, itens: [item({ quantity: -1 })] });
    conf("quantidade negativa é recusada pelo schema", invalido.status, 400);
    conf("... dizendo o campo", (await invalido.json()).campos.includes("itens.0.quantity"), true);
    conf("campo desconhecido no corpo é recusado",
      (await pedir("t-gc", "POST", "/api/sienge/solicitacao", { buildingId: 2519, itens: [item()], extra: 1 })).status, 400);
    conf("número de solicitação que não é número é recusado",
      (await pedir("t-admin", "GET", "/api/sienge/solicitacao/abc")).status, 400);

    // 7. Monday: so' os workspaces dos squads, e so' a rota que o app usa.
    conf("workspace fora dos squads é recusado",
      (await pedir("t-admin", "GET", "/api/monday/obras-execucao?workspaceId=999")).status, 400);
    conf("?full=1 (regex vinda da URL) não existe mais",
      (await pedir("t-admin", "GET", obras + "&full=1&grupoNome=.*")).status, 400);
    for (const rota of ["/api/monday/boards", "/api/monday/columns?boardId=1", "/api/monday/obras?boardId=1", "/api/monday/workspaces"]) {
      conf(`rota de descoberta removida: ${rota}`, (await pedir("t-admin", "GET", rota)).status, 404);
    }
    const app = fs.readFileSync(path.join(__dirname, "..", "..", "..", "src", "App.jsx"), "utf8");
    const noFront = [...app.matchAll(/workspaceId: "(\d+)"/g)].map((m) => m[1]).sort().join(",");
    const naApi = (fs.readFileSync(path.join(__dirname, "..", "mondayApp.js"), "utf8")
      .match(/WORKSPACES_DOS_SQUADS = new Set\(\[([^\]]+)\]\)/)[1].match(/\d+/g) || []).sort().join(",");
    conf("os workspaces da API são os mesmos squads do front", naApi, noFront);

    // 8. PDF: so' PDF, e ate' 4 MB.
    conf("arquivo que não é PDF é recusado",
      (await pedir("t-admin", "POST", "/api/vendido/parse", Buffer.from("MZ executavel"), { "Content-Type": "application/pdf" })).status, 415);
    conf("PDF acima de 4 MB é recusado",
      (await pedir("t-admin", "POST", "/api/executivo/parse", Buffer.alloc(4 * 1024 * 1024 + 10, 0x25), { "Content-Type": "application/pdf" })).status, 413);
    const semBase64 = await pedir("t-admin", "POST", "/api/sienge/texto", Buffer.from("isto nao e pdf"), { "Content-Type": "application/pdf" });
    conf("leitura do Sienge: corpo cru inválido ainda oferece o base64", (await semBase64.json()).podeBase64, true);
    conf("base64 fora do formato é recusado pelo schema",
      (await pedir("t-admin", "POST", "/api/sienge/texto", { pdfBase64: "não é base64!" })).status, 400);

    // 8b. Preferencias: cada um as suas, no formato certo, com o e-mail do login.
    const prefs = await pedir("t-gc", "GET", "/api/preferencias");
    conf("a pessoa lê as próprias preferências", prefs.status, 200);
    conf("... só as dela, e só as chaves que existem", JSON.stringify(await prefs.json()), JSON.stringify({ "obras.modo": "squad" }));
    conf("preferência que não existe é recusada",
      (await pedir("t-gc", "PUT", "/api/preferencias/qualquer.coisa", { valor: 1 })).status, 400);
    conf("valor fora do formato é recusado",
      (await pedir("t-gc", "PUT", "/api/preferencias/obras.modo", { valor: "de cabeça pra baixo" })).status, 400);
    conf("e-mail no corpo do pedido é recusado (quem grava é o login)",
      (await pedir("t-gc", "PUT", "/api/preferencias/obras.modo", { valor: "numero", email: "admin@groupws.com.br" })).status, 400);
    const certo8 = await pedir("t-gc", "PUT", "/api/preferencias/obras.squads_fechados", { valor: ["Squad Moon"] });
    conf("grava a própria preferência", certo8.status, 200);
    conf("... no e-mail do login", gravadas.at(-1)?.email, "gc@groupws.com.br");
    conf("quem está na sala de espera não grava preferência",
      (await pedir("t-fila", "PUT", "/api/preferencias/obras.modo", { valor: "numero" })).status, 403);

    // 9. O caminho legitimo continua de pe': GC, obra dele, reenvio da mesma obra.
    const certo = await pedir("t-gc", "POST", "/api/sienge/solicitacao",
      { buildingId: 2519, solicitacaoId: 23000, itens: [item()] });
    conf("GC reenvia itens na solicitação da própria obra", certo.status, 200);
    const corpo = await certo.json();
    conf("... para a MESMA solicitação", corpo.solicitacaoId, 23000);
    conf("... e o item entra", corpo.ok, 1);
    const novo = await pedir("t-gc", "POST", "/api/sienge/solicitacao", { buildingId: 2519, itens: [item()] });
    conf("GC cria solicitação nova na própria obra", (await novo.json()).solicitacaoId, 25000);
  } catch (e) {
    falhas++;
    console.log("FALHOU com exceção:", e);
  }

  servidor.close();
  console.log(falhas === 0 ? "\nOK — cada perfil só alcança o que pode" : `\n${falhas} falha(s)`);
  process.exit(falhas === 0 ? 0 : 1);
});

/* O fetch global foi trocado pelo simulado acima (e' ele que responde
   como Supabase e Sienge); para bater no servidor local, uma chamada HTTP
   minima com node:http. */
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
