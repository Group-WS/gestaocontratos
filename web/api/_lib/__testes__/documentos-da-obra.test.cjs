/* O aditivo e a apresentação pela API — quem grava, o formato, e o "não" do banco.
 *
 * Roda com: node web/api/_lib/__testes__/documentos-da-obra.test.cjs
 *
 * Os dois documentos eram gravados direto da tela, com o documento inteiro
 * e sem conferir nada: duas pessoas no mesmo aditivo se apagavam em
 * silêncio. Agora passam por aqui e chegam ao banco pelas funções
 * `salvar_aditivo`, `criar_aditivo`, `salvar_apresentacao` e
 * `criar_apresentacao` (supabase/salvar-aditivo-apresentacao.sql). Este
 * teste prova a parte da API:
 *   1. só quem edita a obra grava (a Mehoo lê e o GC de outra obra, não);
 *   2. o que a tela manda chega ao banco com a versão lida;
 *   3. o "não" do banco vira 409 com o motivo, para a tela avisar em vez de
 *      tentar de novo por cima;
 *   4. quem ABRE um aditivo ou uma revisão carrega por id, fresco do banco;
 *   5. a imagem do ambiente vai para o balde da obra, e o endereço dela é
 *      assinado só para caminho que é daquela obra.
 *
 * O "não" de verdade (a versão) é do banco, e quem prova é o
 * supabase/tests/13-aditivo-apresentacao.sql. Nada aqui sai pra rede.
 */

process.env.SUPABASE_URL = "https://teste.supabase.co";
process.env.SUPABASE_ANON_KEY = "chave-de-teste";

const path = require("node:path");
const app = require(path.join(__dirname, "..", "mondayApp.js"));

console.error = () => {}; // o log estruturado dos erros e' ruido aqui

const USUARIOS = {
  "t-gc": { id: "u-gc", email: "gc@groupws.com.br", pessoa: { perfil: "gc", ativo: true } },
  "t-mehoo": { id: "u-mehoo", email: "mehoo@groupws.com.br", pessoa: { perfil: "mehoo", ativo: true } },
};
const OBRAS = {
  "2519": { codigo: "2519", gc: "gc@groupws.com.br", tailor_made: null, responsavel_executivo: null },
  "2600": { codigo: "2600", gc: "outro@groupws.com.br", tailor_made: null, responsavel_executivo: null },
};
const ID = "6f1e8f4e-1d2b-4c3a-9f10-2a3b4c5d6e7f";

let respostaDoBanco = null;
let linhasDaTabela = [];
const chamadas = [];
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
  if (u.pathname === "/rest/v1/aditivo" || u.pathname === "/rest/v1/apresentacao") {
    chamadas.push({
      tabela: u.pathname.split("/").pop(),
      metodo: opcoes.method || "GET",
      select: u.searchParams.get("select") || "",
      filtros: Object.fromEntries(u.searchParams.entries()),
      quem: usuario?.email,
    });
    return responder(linhasDaTabela);
  }
  const rpc = u.pathname.match(/^\/rest\/v1\/rpc\/(\w+)$/);
  if (rpc) {
    chamadas.push({ funcao: rpc[1], corpo: JSON.parse(opcoes.body || "{}"), quem: usuario?.email });
    const r = typeof respostaDoBanco === "function" ? respostaDoBanco() : respostaDoBanco;
    return r.erro ? json(r.erro, r.status || 400) : json(r);
  }
  if (u.pathname.startsWith("/storage/v1/object/sign/")) {
    const corpo = JSON.parse(opcoes.body || "{}");
    chamadas.push({ storage: "assinar", balde: u.pathname.split("/").pop(), caminhos: corpo.paths, quem: usuario?.email });
    return json((corpo.paths || []).map((p) => ({ error: null, path: p, signedURL: `/object/sign/obra-arquivos/${p}?token=abc` })));
  }
  if (u.pathname.startsWith("/storage/v1/object/")) {
    const caminho = u.pathname.replace("/storage/v1/object/", "");
    chamadas.push({ storage: "subir", caminho, tipo: cab.get("content-type"), quem: usuario?.email });
    return json({ Key: caminho });
  }
  return json([], 404);
};

let falhas = 0;
const conf = (nome, obtido, esperado) => {
  const ok = obtido === esperado;
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome.padEnd(72)} ${String(obtido).padEnd(10)} ${ok ? "" : "esperava " + esperado}`);
};

const documento = { grupos: [{ nome: "Cozinha", itens: [{ desc: "Marcenaria", valor: 1200 }] }] };

const servidor = app.listen(0, async () => {
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const pedir = async (token, metodo, caminho, corpo) => {
    const r = await fetchOriginal(base + caminho, {
      method: metodo,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: corpo === undefined ? undefined : typeof corpo === "string" ? corpo : JSON.stringify(corpo),
    });
    let dados = null;
    try { dados = await r.json(); } catch { /* sem corpo */ }
    return { status: r.status, dados };
  };

  try {
    // 1. Quem chega à gravação.
    respostaDoBanco = { ok: true, versao: 4 };
    chamadas.length = 0;
    conf("Mehoo não grava aditivo (vê, não edita)",
      (await pedir("t-mehoo", "POST", `/api/obras/2519/aditivos/${ID}/gravar`, { versao: 3, campos: { dados: documento } })).status, 404);
    conf("GC não grava aditivo de obra de outro GC",
      (await pedir("t-gc", "POST", `/api/obras/2600/aditivos/${ID}/gravar`, { versao: 3, campos: { dados: documento } })).status, 404);
    conf("... e nenhuma das duas chegou ao banco", chamadas.filter((c) => c.funcao).length, 0);

    // 2. O caminho de sempre.
    const gravou = await pedir("t-gc", "POST", `/api/obras/2519/aditivos/${ID}/gravar`,
      { versao: 3, campos: { descricao: "Vidro temperado", status: "aguardando", dados: documento, total_adicao: 1200.5 } });
    conf("o GC grava o aditivo da própria obra", gravou.status, 200);
    conf("... e recebe a versão nova", gravou.dados?.versao, 4);
    const ida = chamadas.at(-1);
    conf("chama a gravação protegida do banco", ida?.funcao, "salvar_aditivo");
    conf("... com o id do aditivo", ida?.corpo.p_id, ID);
    conf("... com a versão que a tela leu", ida?.corpo.p_versao, 3);
    conf("... com o documento inteiro", JSON.stringify(ida?.corpo.p_campos?.dados), JSON.stringify(documento));
    conf("... e como o próprio usuário (RLS)", ida?.quem, "gc@groupws.com.br");

    respostaDoBanco = { ok: true, id: ID, seq: 3, numero: "2519/3", versao: 1 };
    const criou = await pedir("t-gc", "POST", "/api/obras/2519/aditivos", { campos: { descricao: "Novo", dados: documento } });
    conf("criar aditivo passa pela função do banco", chamadas.at(-1)?.funcao, "criar_aditivo");
    conf("... e o número vem de lá", criou.dados?.numero, "2519/3");
    conf("... sem a tela mandar seq nem número", JSON.stringify(Object.keys(chamadas.at(-1)?.corpo || {})), '["p_obra","p_campos"]');

    respostaDoBanco = { ok: true, versao: 6 };
    const ap = await pedir("t-gc", "POST", `/api/obras/2519/apresentacoes/${ID}/gravar`,
      { versao: 5, conteudo: { slides: [{ ambiente: "Sala" }], capa: { obra: "Casa" } } });
    conf("a apresentação grava pela função do banco", chamadas.at(-1)?.funcao, "salvar_apresentacao");
    conf("... com a versão lida", chamadas.at(-1)?.corpo.p_versao, 5);
    conf("... e devolve a versão nova", ap.dados?.versao, 6);

    // 3. O "não" do banco vira 409 com o motivo.
    respostaDoBanco = { ok: false, motivo: "versao", versao: 9, atualizadoPor: "outro@groupws.com.br", atualizadoEm: "2026-09-22T12:00:00Z" };
    const velha = await pedir("t-gc", "POST", `/api/obras/2519/aditivos/${ID}/gravar`, { versao: 3, campos: { dados: documento } });
    conf("versão desatualizada volta 409", velha.status, 409);
    conf("... dizendo o motivo", velha.dados?.motivo, "versao");
    conf("... a versão de agora", velha.dados?.versao, 9);
    conf("... e quem alterou", velha.dados?.atualizadoPor, "outro@groupws.com.br");

    respostaDoBanco = { ok: false, motivo: "rev_existe", rev: "01" };
    const rev = await pedir("t-gc", "POST", "/api/obras/2519/apresentacoes", { rev: "01", conteudo: { slides: [] } });
    conf("revisão repetida volta 409", rev.status, 409);
    conf("... com o motivo que a tela entende", rev.dados?.motivo, "rev_existe");

    respostaDoBanco = { ok: false, motivo: "sem_linha" };
    conf("documento que não existe volta 404",
      (await pedir("t-gc", "POST", `/api/obras/2519/aditivos/${ID}/gravar`, { versao: 3, campos: {} })).status, 404);

    // O SQL novo ainda não rodou: não é erro de quem está usando.
    respostaDoBanco = { erro: { code: "PGRST202", message: "function not found" }, status: 404 };
    const semSql = await pedir("t-gc", "POST", `/api/obras/2519/aditivos/${ID}/gravar`, { versao: 3, campos: {} });
    conf("função que falta no banco volta 503", semSql.status, 503);
    conf("... dizendo qual SQL falta", /salvar-aditivo-apresentacao\.sql/.test(semSql.dados?.error || ""), true);

    // 4. O formato para aqui, antes do banco.
    respostaDoBanco = { ok: true, versao: 4 };
    chamadas.length = 0;
    conf("sem versão, 400",
      (await pedir("t-gc", "POST", `/api/obras/2519/aditivos/${ID}/gravar`, { campos: {} })).status, 400);
    conf("versão zero, 400",
      (await pedir("t-gc", "POST", `/api/obras/2519/aditivos/${ID}/gravar`, { versao: 0, campos: {} })).status, 400);
    conf("fase que não existe, 400",
      (await pedir("t-gc", "POST", `/api/obras/2519/aditivos/${ID}/gravar`, { versao: 3, campos: { status: "quase" } })).status, 400);
    conf("campo desconhecido, 400",
      (await pedir("t-gc", "POST", `/api/obras/2519/aditivos/${ID}/gravar`, { versao: 3, campos: { outro: 1 } })).status, 400);
    conf("id que não é uuid, 400",
      (await pedir("t-gc", "POST", "/api/obras/2519/aditivos/nao-e-uuid/gravar", { versao: 3, campos: {} })).status, 400);
    conf("... e nada disso chegou ao banco", chamadas.filter((c) => c.funcao).length, 0);

    // 5. As listas não levam o documento; quem abre carrega por id.
    linhasDaTabela = [{ id: ID, obra_codigo: "2519", numero: "2519/1", versao: 2 }];
    chamadas.length = 0;
    await pedir("t-gc", "GET", "/api/aditivos");
    conf("a lista de aditivos pede colunas nomeadas, não *", /^id,obra_codigo|^id, obra_codigo/.test((chamadas.at(-1)?.select || "").replace(/\s+/g, " ")), true);
    conf("... com o documento, que as contas da obra usam", /dados/.test(chamadas.at(-1)?.select || ""), true);
    conf("... e com a versão, sem a qual não se grava", /versao/.test(chamadas.at(-1)?.select || ""), true);
    await pedir("t-gc", "GET", "/api/obras/2519/apresentacoes");
    conf("a lista de apresentações não pede capa nem slides",
      /slides|capa/.test(chamadas.at(-1)?.select || ""), false);
    const um = await pedir("t-gc", "GET", `/api/obras/2519/aditivos/${ID}`);
    conf("abrir um aditivo pede o documento", /dados/.test(chamadas.at(-1)?.select || ""), true);
    conf("... e devolve a linha", um.dados?.aditivo?.numero, "2519/1");
    conf("Mehoo lê a lista (vê a obra)", (await pedir("t-mehoo", "GET", "/api/aditivos")).status, 200);

    linhasDaTabela = [];
    conf("apagar o que o banco recusa volta 403",
      (await pedir("t-gc", "DELETE", `/api/obras/2519/aditivos/${ID}`)).status, 403);
    linhasDaTabela = [{ id: ID }];
    conf("apagar o que é seu volta 200",
      (await pedir("t-gc", "DELETE", `/api/obras/2519/aditivos/${ID}`)).status, 200);

    // 6. A imagem do ambiente: balde da obra, e endereço só do que é dela.
    chamadas.length = 0;
    const imagem = { nome: "sala.jpg", tipo: "image/jpeg", base64: Buffer.from("imagem").toString("base64") };
    const subiu = await pedir("t-gc", "POST", "/api/obras/2519/ambientes", imagem);
    conf("a imagem sobe", subiu.status, 200);
    conf("... para o balde da obra", /^obra-arquivos\/2519\/ambientes\//.test(chamadas.at(-1)?.caminho || ""), true);
    conf("... com o tipo declarado", chamadas.at(-1)?.tipo, "image/jpeg");
    conf("... e o caminho volta para a tela", /^2519\/ambientes\/\d+\.jpg$/.test(subiu.dados?.caminho || ""), true);
    conf("tipo que não é imagem, 400",
      (await pedir("t-gc", "POST", "/api/obras/2519/ambientes", { ...imagem, tipo: "application/pdf" })).status, 400);
    conf("Mehoo não sobe imagem",
      (await pedir("t-mehoo", "POST", "/api/obras/2519/ambientes", imagem)).status, 404);

    chamadas.length = 0;
    const links = await pedir("t-gc", "POST", "/api/obras/2519/ambientes/links", {
      caminhos: ["2519/ambientes/1.jpg", "ambientes/2519/antiga.jpg", "2600/ambientes/de-outra.jpg", "../fora.jpg"],
    });
    conf("o endereço da imagem da obra é assinado", /token=abc/.test(links.dados?.urls?.["2519/ambientes/1.jpg"] || ""), true);
    conf("a imagem antiga, do catálogo, tem endereço público",
      /storage\/v1\/object\/public\/catalogo\//.test(links.dados?.urls?.["ambientes/2519/antiga.jpg"] || ""), true);
    conf("caminho de outra obra não é assinado", links.dados?.urls?.["2600/ambientes/de-outra.jpg"], undefined);
    conf("... nem caminho que tenta sair da pasta", links.dados?.urls?.["../fora.jpg"], undefined);
    conf("e só os caminhos da obra foram ao Storage",
      JSON.stringify(chamadas.find((c) => c.storage === "assinar")?.caminhos), '["2519/ambientes/1.jpg"]');
  } catch (e) {
    falhas++;
    console.log("FALHOU  erro inesperado:", e?.message || e);
  } finally {
    servidor.close();
    console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
    process.exit(falhas ? 1 : 0);
  }
});

/* O fetch global responde como Supabase; para bater no servidor local, uma
   chamada HTTP mínima com node:http (o mesmo do api-autorizacao.test.cjs). */
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
