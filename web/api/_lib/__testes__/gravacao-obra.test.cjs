/* A gravação da obra pela API — quem grava, o formato, e o "não" do banco.
 *
 * Roda com: node web/api/_lib/__testes__/gravacao-obra.test.cjs
 *
 * O navegador gravava a obra direto na tabela, com um UPSERT sem condição
 * nenhuma. Agora a gravação passa por aqui e chega ao banco pelas funções
 * `salvar_obra`, `aplicar_patch_obra` e `restaurar_versao_obra`
 * (supabase/salvar-obra.sql), que conferem a trava e a versão. Este teste
 * prova a parte da API:
 *   1. só quem edita a obra chega à gravação (Mehoo e GC de outra obra não);
 *   2. o conteúdo chega ao banco inteiro, descomprimido, com a versão lida;
 *   3. o que o banco recusa volta 409 com o motivo — a tela precisa dele
 *      para dizer o que aconteceu, e para NÃO tentar de novo por cima;
 *   4. entrada fora do formato para aqui, antes do banco.
 *
 * O "não" de verdade (trava e versão) é do banco, e quem prova é o
 * supabase/tests/12-salvar-obra.sql. Nada aqui sai pra rede.
 */

process.env.SUPABASE_URL = "https://teste.supabase.co";
process.env.SUPABASE_ANON_KEY = "chave-de-teste";

const path = require("node:path");
const { gzipSync } = require("node:zlib");
const app = require(path.join(__dirname, "..", "mondayApp.js"));

console.error = () => {}; // o log estruturado dos erros e' ruido aqui

const USUARIOS = {
  "t-gc": { id: "u-gc", email: "gc@groupws.com.br", pessoa: { perfil: "gc", ativo: true } },
  "t-mehoo": { id: "u-mehoo", email: "mehoo@groupws.com.br", pessoa: { perfil: "mehoo", ativo: true } },
  "t-admin": { id: "u-admin", email: "admin@groupws.com.br", pessoa: { perfil: "admin", ativo: true } },
};
const OBRAS = {
  "2519": { codigo: "2519", gc: "gc@groupws.com.br", tailor_made: null, responsavel_executivo: null },
  "2600": { codigo: "2600", gc: "outro@groupws.com.br", tailor_made: null, responsavel_executivo: null },
};

// O que o "banco" responde a cada chamada de função, e o que recebeu.
let respostaDoBanco = null;
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
  const rpc = u.pathname.match(/^\/rest\/v1\/rpc\/(\w+)$/);
  if (rpc) {
    chamadas.push({ funcao: rpc[1], corpo: JSON.parse(opcoes.body || "{}"), quem: usuario?.email });
    const r = typeof respostaDoBanco === "function" ? respostaDoBanco() : respostaDoBanco;
    return r.erro ? json(r.erro, r.status || 400) : json(r);
  }
  return json([], 404);
};

let falhas = 0;
const conf = (nome, obtido, esperado) => {
  const ok = obtido === esperado;
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome.padEnd(72)} ${String(obtido).padEnd(8)} ${ok ? "" : "esperava " + esperado}`);
};

// Uma obra no formato das colunas de `obra_dados`, como o app manda.
const conteudo = (extra = {}) => ({
  categorias: [{ num: "05", itens: [{ codigo: "5.1", desc: "Spot", comprado: true }] }],
  cadernos: {}, arquivos: [], aprovacoes: ["05|5.1"], escopos: [], etapas_concluidas: {},
  depara_aprovado: true, executivo_liberado_direto: false, compras_liberadas: false,
  cliente_assinou_em: null, cliente_assinatura_por: null, cliente_assinatura_arq: null, cliente_assinatura_obs: null,
  compra_sem_assinatura_por: null, compra_sem_assinatura_em: null, compra_sem_assinatura_just: null,
  cmv_liberado: 632000.5, cmv_liberado_em: "2026-09-20T10:00:00.000Z", cmv_liberado_por: "gc@groupws.com.br",
  data_entrega: "2026-12-18",
  ...extra,
});
const comprimir = (obj) => gzipSync(Buffer.from(JSON.stringify(obj), "utf8")).toString("base64");

const servidor = app.listen(0, async () => {
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const pedir = async (token, caminho, corpo) => {
    const r = await fetchOriginal(base + caminho, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: corpo === undefined ? undefined : typeof corpo === "string" ? corpo : JSON.stringify(corpo),
    });
    let dados = null;
    try { dados = await r.json(); } catch { /* sem corpo */ }
    return { status: r.status, dados };
  };
  const gravar = (token, codigo, corpo) => pedir(token, `/api/obras/${codigo}/gravar`, corpo);

  try {
    // 1. Quem chega à gravação.
    respostaDoBanco = { ok: true, versao: 8 };
    conf("Mehoo não grava obra (vê, não edita)",
      (await gravar("t-mehoo", "2519", { versao: 7, gzip: comprimir(conteudo()) })).status, 404);
    conf("GC não grava obra de outro GC",
      (await gravar("t-gc", "2600", { versao: 7, gzip: comprimir(conteudo()) })).status, 404);
    conf("... e nenhuma das duas chegou ao banco", chamadas.length, 0);

    // 2. O caminho de sempre: grava, e a versão nova volta para a tela.
    const certo = await gravar("t-gc", "2519", { versao: 7, gzip: comprimir(conteudo()) });
    conf("o GC grava a própria obra", certo.status, 200);
    conf("... e recebe a versão nova", certo.dados?.versao, 8);
    const ida = chamadas.at(-1);
    conf("chama a gravação protegida do banco", ida?.funcao, "salvar_obra");
    conf("... com o código da obra", ida?.corpo.p_codigo, "2519");
    conf("... com a versão que a tela leu", ida?.corpo.p_versao, 7);
    conf("... com o conteúdo inteiro, descomprimido", JSON.stringify(ida?.corpo.p_conteudo), JSON.stringify(conteudo()));
    conf("... e como o próprio usuário (RLS)", ida?.quem, "gc@groupws.com.br");

    // Uma obra grande: bem acima do 1 MB do leitor global, e ainda assim passa.
    const grande = conteudo({ categorias: Array.from({ length: 60 }, (_, v) => ({
      num: String(v), itens: Array.from({ length: 500 }, (__, i) => ({ codigo: `${v}.${i}`, desc: `Item ${i} da verba ${v} `.repeat(4) })),
    })) });
    conf("o teste da obra grande é mesmo grande (> 3 MB de JSON)", JSON.stringify(grande).length > 3 * 1024 * 1024, true);
    conf("obra grande grava (vai comprimida)", (await gravar("t-gc", "2519", { versao: 7, gzip: comprimir(grande) })).status, 200);

    // 3. O "não" do banco vira 409 com o motivo.
    respostaDoBanco = { ok: false, motivo: "versao", versao: 9, atualizado_por: "admin@groupws.com.br", atualizado_em: "2026-09-22T12:00:00Z" };
    const velha = await gravar("t-gc", "2519", { versao: 7, gzip: comprimir(conteudo()) });
    conf("versão desatualizada volta 409", velha.status, 409);
    conf("... dizendo o motivo", velha.dados?.motivo, "versao");
    conf("... a versão atual", velha.dados?.versao, 9);
    conf("... e quem alterou", velha.dados?.atualizadoPor, "admin@groupws.com.br");

    respostaDoBanco = { ok: false, motivo: "trava", por: "admin@groupws.com.br", desde: "2026-09-22T12:00:00Z" };
    const travada = await gravar("t-gc", "2519", { versao: 7, gzip: comprimir(conteudo()) });
    conf("trava de outra pessoa volta 409", travada.status, 409);
    conf("... com o motivo e com quem está editando", `${travada.dados?.motivo}|${travada.dados?.por}`, "trava|admin@groupws.com.br");

    respostaDoBanco = { ok: false, motivo: "vazia" };
    conf("obra vazia por cima de obra cheia volta 409 'vazia'",
      (await gravar("t-gc", "2519", { versao: 7, gzip: comprimir(conteudo({ categorias: [] })) })).dados?.motivo, "vazia");

    respostaDoBanco = { erro: { code: "PGRST202", message: "Could not find the function public.salvar_obra" }, status: 404 };
    const semSql = await gravar("t-gc", "2519", { versao: 7, gzip: comprimir(conteudo()) });
    conf("função que ainda não existe no banco: 503 (a tela tenta de novo)", semSql.status, 503);
    conf("... sem repassar a mensagem do banco", /Could not find/.test(semSql.dados?.error || ""), false);

    respostaDoBanco = { erro: { code: "42501", message: "RN-001: só o administrador libera a compra." }, status: 403 };
    const rn = await gravar("t-gc", "2519", { versao: 7, gzip: comprimir(conteudo()) });
    conf("a RN-001 recusada no banco volta 403", rn.status, 403);
    conf("... com a mensagem da regra, escrita para a pessoa", rn.dados?.error, "RN-001: só o administrador libera a compra.");

    respostaDoBanco = { erro: { code: "55006", message: "fulano está editando esta obra agora." }, status: 400 };
    conf("o gatilho da trava vira 409 'trava'",
      (await gravar("t-gc", "2519", { versao: 7, gzip: comprimir(conteudo()) })).dados?.motivo, "trava");

    // 4. Fora do formato: para antes do banco.
    respostaDoBanco = { ok: true, versao: 8 };
    const antes = chamadas.length;
    conf("sem a versão é recusado", (await gravar("t-gc", "2519", { gzip: comprimir(conteudo()) })).status, 400);
    conf("versão que não é inteiro positivo é recusada",
      (await gravar("t-gc", "2519", { versao: 0, gzip: comprimir(conteudo()) })).status, 400);
    conf("conteúdo sem compressão é recusado",
      (await gravar("t-gc", "2519", { versao: 7, gzip: Buffer.from("nao e gzip").toString("base64") })).status, 400);
    conf("base64 fora do formato é recusado", (await gravar("t-gc", "2519", { versao: 7, gzip: "não é base64!" })).status, 400);
    const campoEstranho = await gravar("t-gc", "2519", { versao: 7, gzip: comprimir(conteudo({ editando_por: "outro@groupws.com.br" })) });
    conf("coluna fora do conteúdo (a trava) é recusada", campoEstranho.status, 400);
    conf("... apontando o conteúdo como o campo recusado", (campoEstranho.dados?.campos || []).includes("conteudo"), true);
    conf("lista no lugar de número é recusada",
      (await gravar("t-gc", "2519", { versao: 7, gzip: comprimir(conteudo({ cmv_liberado: [1] })) })).status, 400);
    conf("código de obra com caractere estranho é recusado",
      (await gravar("t-gc", "25%2019", { versao: 7, gzip: comprimir(conteudo()) })).status, 400);
    conf("nada disso chegou ao banco", chamadas.length, antes);
    const bomba = gzipSync(Buffer.alloc(60 * 1024 * 1024, 0x20)).toString("base64");
    conf("gzip que explode acima do teto é recusado (413)",
      (await gravar("t-gc", "2519", { versao: 7, gzip: bomba })).status, 413);

    // 5. O patch.
    respostaDoBanco = { ok: true, versao: 9, aplicados: 1, recusados: [] };
    const patch = await pedir("t-gc", "/api/obras/2519/patch",
      { versao: 8, patches: [{ verba: 0, item: 0, campos: { comprado: true }, confCodigo: "5.1", confDesc: "Spot" }] });
    conf("o patch grava", patch.status, 200);
    conf("... pela função de patch, com a versão", `${chamadas.at(-1)?.funcao}|${chamadas.at(-1)?.corpo.p_versao}`, "aplicar_patch_obra|8");
    conf("... e devolve a versão nova e o que aplicou", `${patch.dados?.versao}|${patch.dados?.aplicados}`, "9|1");
    conf("patch sem versão é recusado",
      (await pedir("t-gc", "/api/obras/2519/patch", { patches: [{ coluna: "compras_liberadas", valor: true }] })).status, 400);
    conf("patch fora dos três formatos é recusado",
      (await pedir("t-gc", "/api/obras/2519/patch", { versao: 8, patches: [{ verba: 0, qualquer: 1 }] })).status, 400);
    conf("Mehoo não manda patch",
      (await pedir("t-mehoo", "/api/obras/2519/patch", { versao: 8, patches: [{ coluna: "compras_liberadas", valor: true }] })).status, 404);

    // 6. Restaurar.
    respostaDoBanco = { ok: true, versao: 10, restaurou: 269, de: "2026-09-19T08:00:00Z" };
    const rest = await pedir("t-admin", "/api/obras/2519/versoes/77/restaurar");
    conf("restaurar uma versão passa pela função do banco", `${rest.status}|${chamadas.at(-1)?.funcao}|${chamadas.at(-1)?.corpo.p_versao_id}`, "200|restaurar_versao_obra|77");
    conf("... e devolve a versão nova", rest.dados?.versao, 10);
    respostaDoBanco = { ok: false, motivo: "trava", por: "gc@groupws.com.br" };
    conf("restaurar por cima de quem está editando volta 409",
      (await pedir("t-admin", "/api/obras/2519/versoes/77/restaurar")).status, 409);
    conf("id de versão que não é número é recusado",
      (await pedir("t-admin", "/api/obras/2519/versoes/abc/restaurar")).status, 400);
  } catch (e) {
    falhas++;
    console.log("FALHOU com exceção:", e);
  }

  servidor.close();
  console.log(falhas === 0 ? "\nOK — a gravação da obra passa pela API e respeita o banco" : `\n${falhas} falha(s)`);
  process.exit(falhas === 0 ? 0 : 1);
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
