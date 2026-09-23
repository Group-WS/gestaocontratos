/* Duas sessões na mesma obra — o que o navegador faz para nada se perder.
 *
 * A análise de confiabilidade de 22/09/2026 achou o caminho em que uma pessoa
 * apagava o trabalho de outra sem nenhuma das duas perceber: A e B abrem a
 * obra às 9h; A edita e sai; às 9h20 B habilita a edição na tela aberta desde
 * as 9h e grava — a cópia das 9h ia inteira por cima do que A fez.
 *
 * Aqui, duas pessoas (dois navegadores de verdade, cada um com a sua sessão)
 * na mesma obra. O banco é simulado neste arquivo, UM SÓ para as duas, com as
 * mesmas regras da gravação protegida (supabase/salvar-obra.sql): grava só
 * com a trava de quem grava e com a versão que a tela leu. As regras em si
 * são provadas contra o Postgres em supabase/tests/12-salvar-obra.sql; o que
 * se prova aqui é o que a TELA faz com elas:
 *   1. a trava vale entre as duas sessões;
 *   2. quem habilita a edição depois edita a obra como está no banco, e não a
 *      cópia velha que tinha na tela;
 *   3. a gravação recusada por versão desatualizada não grava por cima, a
 *      tela avisa e oferece recarregar a obra;
 *   4. a gravação que falha tenta de novo sozinha — e fechar a aba antes de
 *      gravar faz o navegador perguntar.
 *
 * Nada sai para a rede: o build aponta para um Supabase que não existe (ver
 * playwright.config.mjs), e as respostas dele e da API vêm daqui.
 */
import { test, expect } from "@playwright/test";
import { gunzipSync, gzipSync } from "node:zlib";

const APP = "http://localhost:4173";
const SUPABASE = "https://e2e-nao-existe.supabase.co";
// supabase-js guarda a sessão em sb-<primeiro pedaço do host>-auth-token.
const CHAVE_SESSAO = "sb-e2e-nao-existe-auth-token";
const OBRA = "9001";
const NOME_DA_OBRA = "Obra das duas sessões";

const ANA = { email: "ana@teste.local", nome: "Ana Admin", cargo: "Coordenação", perfil: "admin", ativo: true };
const BRUNO = { email: "bruno@teste.local", nome: "Bruno Admin", cargo: "Coordenação", perfil: "admin", ativo: true };

/* Um token com cara de JWT (o supabase-js lê o conteúdo, não confere a
   assinatura — quem confere é o servidor, que aqui é simulado). */
function tokenFalso(email) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const agora = Math.floor(Date.now() / 1000);
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: `e2e-${email}`, email, role: "authenticated", aud: "authenticated", iat: agora, exp: agora + 3600 })}.assinatura-falsa`;
}

function sessaoFalsa(email) {
  const agora = Math.floor(Date.now() / 1000);
  return {
    access_token: tokenFalso(email),
    refresh_token: "refresh-falso",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: agora + 3600,
    user: { id: `e2e-${email}`, email, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} },
  };
}

// Quem está chamando, pelo token do pedido — como o servidor de verdade faz.
function emailDoPedido(req) {
  try {
    const token = (req.headers().authorization || "").replace(/^Bearer\s+/i, "");
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")).email;
  } catch {
    return null;
  }
}

/* ---------- o banco simulado, um só para as duas sessões ---------- */

const MINUTOS_ATE_TRAVA_EXPIRAR = 5;
const CONTROLE = new Set(["versao", "editando_por", "editando_desde", "atualizado_por", "atualizado_em"]);
const conteudoDe = (linha) => JSON.stringify(Object.fromEntries(Object.entries(linha).filter(([k]) => !CONTROLE.has(k)).sort()));

function novoBanco() {
  return {
    linha: {
      obra_codigo: OBRA, categorias: [], cadernos: {}, arquivos: [], aprovacoes: [], escopos: [], etapas_concluidas: {},
      depara_aprovado: false, executivo_liberado_direto: false, compras_liberadas: false,
      cliente_assinou_em: null, cliente_assinatura_por: null, cliente_assinatura_arq: null, cliente_assinatura_obs: null,
      compra_sem_assinatura_por: null, compra_sem_assinatura_em: null, compra_sem_assinatura_just: null,
      cmv_liberado: null, cmv_liberado_em: null, cmv_liberado_por: null, data_entrega: null,
      editando_por: null, editando_desde: null, atualizado_por: null, atualizado_em: null, versao: 1,
    },
    gravacoes: [],       // cada gravação que chegou: { quem, versao, resposta }
    falharProximas: 0,   // quantas gravações seguidas respondem 503 (servidor fora)
  };
}

// Outra pessoa (ou uma restauração, ou o SQL Editor) mexe na obra por fora.
function mudarPorFora(banco, campos) {
  Object.assign(banco.linha, campos, { atualizado_por: "outra.pessoa@teste.local", atualizado_em: new Date().toISOString() });
  banco.linha.versao += 1;
}

const travaViva = (linha) => !!linha.editando_por
  && Date.now() - new Date(linha.editando_desde).getTime() < MINUTOS_ATE_TRAVA_EXPIRAR * 60_000;

/* A gravação protegida (supabase/salvar-obra.sql, `salvar_obra`), em JS. */
function gravar(banco, quem, versao, conteudo) {
  const l = banco.linha;
  if (banco.falharProximas > 0) {
    banco.falharProximas -= 1;
    return [503, { error: "Não foi possível concluir a operação. Tente novamente em instantes." }];
  }
  if ((l.editando_por || "").toLowerCase() !== quem) {
    return [409, { error: "Outra pessoa está com a edição desta obra.", motivo: "trava", por: l.editando_por, desde: l.editando_desde }];
  }
  if (l.versao !== versao) {
    return [409, { error: "A obra foi alterada depois que esta tela a leu.", motivo: "versao", versao: l.versao,
      atualizadoPor: l.atualizado_por, atualizadoEm: l.atualizado_em }];
  }
  const antes = conteudoDe(l);
  Object.assign(l, conteudo, { atualizado_por: quem, atualizado_em: new Date().toISOString(), editando_desde: new Date().toISOString() });
  if (conteudoDe(l) !== antes) l.versao += 1;
  return [200, { versao: l.versao }];
}

/* O QUE A TELA CONVERSA, AGORA TUDO PELA API.
 *
 * Até 22/09/2026 o navegador falava com o Supabase direto, e era isso que
 * este arquivo simulava. Com a adequação (VH-02), leitura e gravação passam
 * pelas rotas de `web/api/_lib/rotas/` — do Supabase sobrou o login. O banco
 * simulado é o mesmo; o que mudou é por onde ele responde.
 */
const comprimido = (valor) => ({ gzip: gzipSync(Buffer.from(JSON.stringify(valor ?? null), "utf8")).toString("base64") });

async function simularBackend(page, banco) {
  await page.route(`${SUPABASE}/**`, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const quem = emailDoPedido(req);
    const json = (corpo, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(corpo) });
    if (u.pathname === "/auth/v1/user") return json({ id: `e2e-${quem}`, email: quem, aud: "authenticated", role: "authenticated" });
    // Nada mais sai daqui: se sair, é porque alguma tela voltou a falar com o banco.
    if (req.method() === "GET" || req.method() === "HEAD") return json([]);
    return json([], 201);
  });

  await page.route(`${APP}/api/**`, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const metodo = req.method();
    const quem = emailDoPedido(req);
    const json = (corpo, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(corpo) });
    const corpo = ["POST", "PUT", "PATCH"].includes(metodo) ? JSON.parse(req.postData() || "{}") : {};
    const l = banco.linha;

    if (u.pathname === "/api/pessoas") return json([ANA, BRUNO]);
    // Quem entrou: a rota devolve a linha de quem chamou (é dela que sai o perfil).
    if (u.pathname === "/api/pessoas/entrada") return json([ANA, BRUNO].find((p) => p.email === quem) || null);
    if (u.pathname === "/api/obras") {
      return json([{ codigo: OBRA, nome: NOME_DA_OBRA, situacao: "ativa", squad: null, board_id: null, endereco: null,
        cliente: null, gc: null, valor_vendido: 0, iniciada_em: null, concluida_em: null,
        tailor_made: null, responsavel_executivo: null }]);
    }
    if (u.pathname === "/api/preferencias") return json({});
    if (u.pathname === "/api/aditivos") return json({ aditivos: [] });

    // A obra: ler, garantir a linha, pegar e devolver a trava.
    if (u.pathname === `/api/obras/${OBRA}/conteudo`) {
      return metodo === "GET" ? json(comprimido(l)) : json({});
    }
    if (u.pathname === `/api/obras/${OBRA}/edicao`) {
      if (metodo === "POST") {
        /* A trava só é tomada se estiver livre, já for desta pessoa ou tiver
           vencido — a mesma condição que a rota põe dentro do UPDATE. */
        if (travaViva(l) && (l.editando_por || "").toLowerCase() !== quem) {
          return json({ ok: false, por: l.editando_por, desde: l.editando_desde });
        }
        l.editando_por = quem;
        l.editando_desde = new Date().toISOString();
        return json({ ok: true, ...comprimido(l) });
      }
      if (metodo === "DELETE") {
        if ((l.editando_por || "").toLowerCase() === quem) { l.editando_por = null; l.editando_desde = null; }
        return json({});
      }
    }
    if (u.pathname === "/api/obras-travas") {
      return json(travaViva(l) ? [{ obra_codigo: OBRA, editando_por: l.editando_por, editando_desde: l.editando_desde }] : []);
    }
    if (u.pathname === "/api/obras-resumos") return json(comprimido([]));
    if (u.pathname === `/api/obras/${OBRA}/versoes`) return json({ versoes: [] });

    // A gravação protegida.
    if (u.pathname === `/api/obras/${OBRA}/gravar`) {
      const conteudo = JSON.parse(gunzipSync(Buffer.from(corpo.gzip, "base64")).toString("utf8"));
      const [status, resposta] = gravar(banco, quem, corpo.versao, conteudo);
      banco.gravacoes.push({ quem, versao: corpo.versao, status });
      return json(resposta, status);
    }
    if (u.pathname === `/api/obras/${OBRA}/patch`) {
      const marcas = Object.fromEntries((corpo.patches || []).filter((p) => p.coluna).map((p) => [p.coluna, p.valor]));
      const [status, resposta] = gravar(banco, quem, corpo.versao, marcas);
      return json(status === 200 ? { ...resposta, aplicados: corpo.patches.length, recusados: [] } : resposta, status);
    }
    // O Monday não tem obra nenhuma: a obra do teste vem só do nosso banco.
    return json([]);
  });
}

/* Uma pessoa entrando no app, direto na obra. */
async function entrar(browser, pessoa, banco) {
  const contexto = await browser.newContext();
  await contexto.addInitScript(([chave, sessao]) => {
    if (!sessionStorage.getItem("e2e-sessao-posta")) {
      localStorage.setItem(chave, sessao);
      sessionStorage.setItem("e2e-sessao-posta", "1");
    }
  }, [CHAVE_SESSAO, JSON.stringify(sessaoFalsa(pessoa.email))]);
  const page = await contexto.newPage();
  await simularBackend(page, banco);
  await page.goto(`${APP}/obra/${OBRA}`);
  await expect(page.getByText("Modo leitura")).toBeVisible();
  return page;
}

const barra = (page) => page.getByRole("status");

/* A data de entrega: o campo do DS abre um calendário. Escolhe o dia `dia`
   do mês que o calendário abrir e devolve a data como o banco guarda. */
async function escolherEntrega(page, dia) {
  await page.getByRole("button", { name: /dd\/mm\/aaaa|\d{2}\/\d{2}\/\d{4}/ }).click();
  const botaoDoDia = page.locator("[role=gridcell]:not([data-outside]) button").filter({ hasText: new RegExp(`^${dia}$`) }).first();
  await botaoDoDia.click();
  await page.getByRole("button", { name: "Salvar data" }).click();
}
const mesAtual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const naTela = (iso) => { const [a, m, d] = iso.split("-"); return `${d}/${m}/${a}`; };

test("a trava vale entre as duas sessões: quem chega depois não edita", { tag: "@gravacao" }, async ({ browser }) => {
  const banco = novoBanco();
  const ana = await entrar(browser, ANA, banco);
  const bruno = await entrar(browser, BRUNO, banco);

  await ana.getByRole("button", { name: "Habilitar edição" }).click();
  await expect(ana.getByText("Você está editando")).toBeVisible();
  await expect.poll(() => banco.linha.editando_por).toBe(ANA.email);

  await bruno.getByRole("button", { name: "Habilitar edição" }).click();
  // A faixa da edição (23/09/2026) diz quem está com a obra num selo só.
  await expect(bruno.getByText(`${ANA.nome} está editando`)).toBeVisible();
  // O campo de data continua fechado para quem não está com a obra.
  await expect(bruno.getByRole("button", { name: /dd\/mm\/aaaa/ })).toBeDisabled();
  expect(banco.linha.editando_por).toBe(ANA.email);
});

test("quem habilita a edição depois edita a obra como está no banco, e não a cópia velha", { tag: "@gravacao" }, async ({ browser }) => {
  const banco = novoBanco();
  // As duas abrem a obra ao mesmo tempo: as duas telas têm a obra sem data.
  const ana = await entrar(browser, ANA, banco);
  const bruno = await entrar(browser, BRUNO, banco);

  // Ana edita e sai.
  await ana.getByRole("button", { name: "Habilitar edição" }).click();
  await escolherEntrega(ana, 15);
  await expect(barra(ana).filter({ hasText: /^Salvo às \d{2}:\d{2}$/ })).toBeVisible();
  const dataDaAna = `${mesAtual()}-15`;
  expect(banco.linha.data_entrega).toBe(dataDaAna);
  const versaoDaAna = banco.linha.versao;
  await ana.getByRole("button", { name: "Finalizar edição" }).click();
  await expect.poll(() => banco.linha.editando_por).toBe(null);

  // A tela do Bruno ainda é a de antes: sem a data que a Ana gravou.
  await expect(bruno.getByRole("button", { name: /dd\/mm\/aaaa/ })).toBeVisible();

  // Bruno habilita: a obra vem do banco como está AGORA, com a data da Ana.
  await bruno.getByRole("button", { name: "Habilitar edição" }).click();
  await expect(bruno.getByText("Você está editando")).toBeVisible();
  await expect(bruno.getByRole("button", { name: naTela(dataDaAna) })).toBeVisible();

  // E a gravação do Bruno parte da versão da Ana — nada do que ela fez se perde.
  await escolherEntrega(bruno, 20);
  await expect(barra(bruno).filter({ hasText: /^Salvo às \d{2}:\d{2}$/ })).toBeVisible();
  const doBruno = banco.gravacoes.filter((g) => g.quem === BRUNO.email);
  expect(doBruno.every((g) => g.versao >= versaoDaAna)).toBe(true);
  expect(doBruno.every((g) => g.status === 200)).toBe(true);
  expect(banco.linha.data_entrega).toBe(`${mesAtual()}-20`);
});

test("versão desatualizada é recusada: nada é gravado por cima, e a tela avisa", { tag: "@gravacao" }, async ({ browser }) => {
  const banco = novoBanco();
  const ana = await entrar(browser, ANA, banco);
  await ana.getByRole("button", { name: "Habilitar edição" }).click();
  await expect(ana.getByText("Você está editando")).toBeVisible();

  // Enquanto isso, a obra muda por fora (uma restauração, o SQL Editor).
  const dataDeFora = `${mesAtual()}-10`;
  mudarPorFora(banco, { data_entrega: dataDeFora });

  // Ana grava a partir da cópia dela: o banco recusa.
  await escolherEntrega(ana, 25);
  await expect(ana.getByText(/Suas últimas alterações na obra .* não foram gravadas/)).toBeVisible();
  await expect(ana.getByText(/nada desta tela foi gravado por cima/)).toBeVisible();
  expect(banco.linha.data_entrega).toBe(dataDeFora);
  expect(banco.gravacoes.at(-1)).toMatchObject({ quem: ANA.email, status: 409 });
  // A tela volta ao modo leitura: continuar digitando seria trabalho sem ter como gravar.
  await expect(ana.getByText("Modo leitura")).toBeVisible();
  // E não fica tentando de novo por cima.
  const tentativas = banco.gravacoes.length;
  await ana.waitForTimeout(3000);
  expect(banco.gravacoes.length).toBe(tentativas);

  // A saída é recarregar a obra — sempre perguntando antes.
  await ana.getByRole("button", { name: "Recarregar a obra" }).click();
  await ana.getByRole("button", { name: "Recarregar e descartar" }).click();
  await expect(ana.getByRole("button", { name: naTela(dataDeFora) })).toBeVisible();
  await expect(ana.getByText(/não foram gravadas/)).toHaveCount(0);
});

test("gravação que falha tenta de novo sozinha, e fechar a aba antes pergunta", { tag: "@gravacao" }, async ({ browser }) => {
  const banco = novoBanco();
  const ana = await entrar(browser, ANA, banco);
  await ana.getByRole("button", { name: "Habilitar edição" }).click();
  await expect(ana.getByText("Você está editando")).toBeVisible();

  banco.falharProximas = 1;
  await escolherEntrega(ana, 12);
  await expect(barra(ana).filter({ hasText: /não salvo — nova tentativa em \d+ s/i })).toBeVisible();
  expect(banco.linha.data_entrega).toBe(null);

  // Com trabalho por gravar, fechar a aba faz o navegador perguntar.
  let perguntou = null;
  ana.once("dialog", async (dialogo) => { perguntou = dialogo.type(); await dialogo.dismiss(); });
  await ana.close({ runBeforeUnload: true });
  await expect.poll(() => perguntou).toBe("beforeunload");

  // A pessoa ficou; a nova tentativa sai sozinha e grava.
  await expect(barra(ana).filter({ hasText: /^Salvo às \d{2}:\d{2}$/ })).toBeVisible({ timeout: 10_000 });
  expect(banco.linha.data_entrega).toBe(`${mesAtual()}-12`);
});
