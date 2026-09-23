/* Duas sessões no mesmo aditivo — o que o navegador faz para nada se perder.
 *
 * O aditivo é documento de contrato, e até 22/09/2026 ele era gravado do
 * jeito mais frágil que havia no app: o documento inteiro, por `id`, sem
 * conferir nada, e só quando alguém clicava em "Salvar". Duas pessoas no
 * mesmo aditivo: a segunda a gravar apagava o trabalho da primeira sem
 * nenhuma das duas perceber.
 *
 * Aqui, duas pessoas (dois navegadores de verdade, cada um com a sua sessão)
 * no mesmo aditivo. O banco é simulado neste arquivo, UM SÓ para as duas,
 * com as regras de `salvar_aditivo` (supabase/salvar-aditivo-apresentacao.sql):
 * só grava com a versão que a tela leu. As regras em si são provadas contra o
 * Postgres em supabase/tests/13-aditivo-apresentacao.sql; o que se prova aqui
 * é o que a TELA faz com elas:
 *   1. abrir o aditivo traz o documento do banco, e não a cópia que a lista
 *      trouxe minutos atrás;
 *   2. a gravação recusada por versão desatualizada não grava por cima, a
 *      tela avisa dizendo quem alterou, e oferece recarregar;
 *   3. o aditivo grava sozinho — sair da tela não joga fora o digitado;
 *   4. a gravação que falha tenta de novo sozinha.
 *
 * Nada sai para a rede: o build aponta para um Supabase que não existe (ver
 * playwright.config.mjs), e as respostas dele e da API vêm daqui.
 */
import { test, expect } from "@playwright/test";
import { gzipSync } from "node:zlib";

const APP = "http://localhost:4173";
const SUPABASE = "https://e2e-nao-existe.supabase.co";
const CHAVE_SESSAO = "sb-e2e-nao-existe-auth-token";
const OBRA = "9001";
const NOME_DA_OBRA = "Obra das duas sessões";
const ID = "1f3c9b52-5a41-4c2e-9d7b-6e8a0c1d2f34";
const NUMERO = `${OBRA}/1`;

const ANA = { email: "ana@teste.local", nome: "Ana Admin", cargo: "Coordenação", perfil: "admin", ativo: true };
const BRUNO = { email: "bruno@teste.local", nome: "Bruno Admin", cargo: "Coordenação", perfil: "admin", ativo: true };

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

const documentoNovo = () => ({
  cliente: NOME_DA_OBRA, proposta: OBRA, data: "2026-09-22",
  cond: [], supressao: [], adicao: [],
});

function novoBanco() {
  const agora = new Date().toISOString();
  return {
    linha: {
      id: ID, obra_codigo: OBRA, seq: 1, numero: NUMERO,
      descricao: "Aditivo das duas sessões", status: "rascunho",
      dados: documentoNovo(), total_supressao: 0, total_adicao: 0,
      criado_em: agora, criado_por: ANA.email, atualizado_em: agora, atualizado_por: ANA.email,
      versao: 1,
    },
    gravacoes: [],       // cada gravação que chegou: { quem, versao, status }
    falharProximas: 0,   // quantas gravações seguidas respondem 503 (servidor fora)
  };
}

const conteudoDe = (l) => JSON.stringify([l.descricao, l.status, l.dados, l.total_supressao, l.total_adicao]);

/* A gravação protegida (`salvar_aditivo`), em JS. Sem trava: o que decide é
   a versão que a tela leu. */
function gravar(banco, quem, versao, campos) {
  const l = banco.linha;
  if (banco.falharProximas > 0) {
    banco.falharProximas -= 1;
    return [503, { error: "Não foi possível concluir a operação. Tente novamente em instantes." }];
  }
  if (l.versao !== versao) {
    return [409, {
      error: "Este documento foi alterado depois que esta tela o leu.",
      motivo: "versao", versao: l.versao, atualizadoPor: l.atualizado_por, atualizadoEm: l.atualizado_em,
    }];
  }
  const antes = conteudoDe(l);
  for (const campo of ["descricao", "status", "dados", "total_supressao", "total_adicao"]) {
    if (campos[campo] !== undefined) l[campo] = campos[campo];
  }
  l.atualizado_por = quem;
  l.atualizado_em = new Date().toISOString();
  if (conteudoDe(l) !== antes) l.versao += 1;
  return [200, { versao: l.versao }];
}

// Outra pessoa (ou o SQL Editor) mexe no aditivo por fora.
function mudarPorFora(banco, campos) {
  Object.assign(banco.linha, campos, {
    atualizado_por: "outra.pessoa@teste.local", atualizado_em: new Date().toISOString(),
  });
  banco.linha.versao += 1;
}

async function simularBackend(page, banco) {
  await page.route(`${SUPABASE}/**`, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const quem = emailDoPedido(req);
    const json = (corpo, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(corpo) });
    if (u.pathname === "/auth/v1/user") return json({ id: `e2e-${quem}`, email: quem, aud: "authenticated", role: "authenticated" });
    /* Do Supabase sobrou o login: desde a adequação (VH-02), o dado todo
       passa pelas rotas da API. Se algo sair por aqui, é porque uma tela
       voltou a falar com o banco direto. */
    if (req.method() === "GET" || req.method() === "HEAD") return json([]);
    return json([], 201);
  });

  await page.route(`${APP}/api/**`, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const quem = emailDoPedido(req);
    const json = (corpo, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(corpo) });
    const corpo = req.method() === "POST" ? JSON.parse(req.postData() || "{}") : {};

    if (u.pathname === "/api/pessoas") return json([ANA, BRUNO]);
    // Quem entrou: a rota devolve a linha de quem chamou (é dela que sai o perfil).
    if (u.pathname === "/api/pessoas/entrada") return json([ANA, BRUNO].find((p) => p.email === quem) || null);
    if (u.pathname === "/api/obras") {
      return json([{ codigo: OBRA, nome: NOME_DA_OBRA, situacao: "ativa", squad: null, board_id: null, endereco: null,
        cliente: null, gc: null, valor_vendido: 0, iniciada_em: null, concluida_em: null,
        tailor_made: null, responsavel_executivo: null }]);
    }
    // A obra não tem linha de conteúdo neste teste: o que se edita é o aditivo.
    if (u.pathname === `/api/obras/${OBRA}/conteudo`) {
      return req.method() === "GET"
        ? json({ gzip: gzipSync(Buffer.from(JSON.stringify(null), "utf8")).toString("base64") })
        : json({});
    }
    if (u.pathname === "/api/obras-travas") return json([]);
    if (u.pathname === "/api/obras-resumos") {
      return json({ gzip: gzipSync(Buffer.from(JSON.stringify([]), "utf8")).toString("base64") });
    }

    // A lista, com o documento (é dela que saem as contas da obra).
    if (u.pathname === "/api/aditivos") return json({ aditivos: [banco.linha] });
    // Abrir: o documento e a versão de agora.
    if (u.pathname === `/api/obras/${OBRA}/aditivos/${ID}`) return json({ aditivo: banco.linha });
    if (u.pathname === `/api/obras/${OBRA}/aditivos/${ID}/gravar`) {
      const [status, resposta] = gravar(banco, quem, corpo.versao, corpo.campos || {});
      banco.gravacoes.push({ quem, versao: corpo.versao, status });
      return json(resposta, status);
    }
    if (u.pathname === "/api/preferencias") return json({});
    return json([]);
  });
}

/* Uma pessoa entrando no app, direto na tela de Aditivos. */
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
  await page.goto(`${APP}/aditivos`);
  await expect(page.getByRole("heading", { name: "Aditivos", exact: true })).toBeVisible();
  return page;
}

/* Abrir o aditivo da lista: o botão da linha é a descrição dele. */
async function abrirAditivo(page, descricao) {
  await page.getByRole("button", { name: descricao }).first().click();
  await expect(page.getByText(NUMERO).first()).toBeVisible();
  await expect(page.getByLabel("Do que se trata este aditivo")).toBeVisible();
}

const barra = (page) => page.getByRole("status");
const campoDescricao = (page) => page.getByLabel("Do que se trata este aditivo");

test("abrir o aditivo traz o que está no banco, e não a cópia da lista", { tag: "@gravacao" }, async ({ browser }) => {
  const banco = novoBanco();
  const bruno = await entrar(browser, BRUNO, banco);

  // A lista do Bruno está aberta; enquanto isso, o aditivo muda por fora.
  mudarPorFora(banco, { descricao: "Texto que a Ana gravou" });

  // Abrir traz o documento de agora — e não o que a lista trouxe.
  await abrirAditivo(bruno, "Aditivo das duas sessões");
  await expect(campoDescricao(bruno)).toHaveValue("Texto que a Ana gravou");
});

test("versão desatualizada é recusada: nada é gravado por cima, e a tela avisa", { tag: "@gravacao" }, async ({ browser }) => {
  const banco = novoBanco();
  const ana = await entrar(browser, ANA, banco);
  const bruno = await entrar(browser, BRUNO, banco);

  // As duas abrem o MESMO aditivo, na mesma versão.
  await abrirAditivo(ana, "Aditivo das duas sessões");
  await abrirAditivo(bruno, "Aditivo das duas sessões");

  // Ana escreve e a gravação sai sozinha.
  await campoDescricao(ana).fill("Vidro temperado, pedido da Ana");
  await expect(barra(ana).filter({ hasText: /^Salvo às \d{2}:\d{2}$/ })).toBeVisible();
  expect(banco.linha.descricao).toBe("Vidro temperado, pedido da Ana");
  const versaoDaAna = banco.linha.versao;

  // Bruno escreve a partir da cópia dele: o banco recusa, e nada é gravado.
  await campoDescricao(bruno).fill("Texto do Bruno, por cima");
  await expect(bruno.getByText(`Suas últimas alterações no aditivo ${NUMERO} não foram gravadas`)).toBeVisible();
  await expect(bruno.getByText(/nada desta tela foi gravado por cima/)).toBeVisible();
  await expect(bruno.getByText(new RegExp(ANA.email))).toBeVisible();
  expect(banco.linha.descricao).toBe("Vidro temperado, pedido da Ana");
  expect(banco.linha.versao).toBe(versaoDaAna);
  expect(banco.gravacoes.filter((g) => g.quem === BRUNO.email).every((g) => g.status === 409)).toBe(true);

  // E não fica tentando de novo por cima.
  const tentativas = banco.gravacoes.length;
  await bruno.waitForTimeout(3000);
  expect(banco.gravacoes.length).toBe(tentativas);

  // A saída é recarregar — sempre perguntando antes.
  await bruno.getByRole("button", { name: "Recarregar o aditivo" }).click();
  await bruno.getByRole("button", { name: "Recarregar e descartar" }).click();
  await expect(campoDescricao(bruno)).toHaveValue("Vidro temperado, pedido da Ana");
  await expect(bruno.getByText(/não foram gravadas/)).toHaveCount(0);

  // Daí em diante, o Bruno grava normalmente — a partir da versão da Ana.
  await campoDescricao(bruno).fill("Agora sim, o texto do Bruno");
  await expect(barra(bruno).filter({ hasText: /^Salvo às \d{2}:\d{2}$/ })).toBeVisible();
  expect(banco.linha.descricao).toBe("Agora sim, o texto do Bruno");
  expect(banco.linha.versao).toBe(versaoDaAna + 1);
});

test("o aditivo grava sozinho: sair da tela não joga fora o digitado", { tag: "@gravacao" }, async ({ browser }) => {
  const banco = novoBanco();
  const ana = await entrar(browser, ANA, banco);
  await abrirAditivo(ana, "Aditivo das duas sessões");

  // Digita e sai na mesma hora, sem esperar gravação nenhuma — a fila só
  // grava 1,2 s depois da última tecla.
  await campoDescricao(ana).fill("Escrito e já saí da tela");
  await ana.getByRole("button", { name: "Aditivos da obra" }).click();

  /* A ORDEM é o que se prova aqui: quando a lista aparece, o que foi digitado
     JÁ ESTÁ no banco. Sem isso, o teste passaria mesmo se sair não gravasse
     nada — a fila continua viva por 1,2 s e gravaria depois, por acaso. */
  await expect(ana.getByRole("heading", { name: "Aditivos", exact: true })).toBeVisible();
  expect(banco.gravacoes.length).toBe(1);
  expect(banco.linha.descricao).toBe("Escrito e já saí da tela");
  expect(banco.gravacoes.every((g) => g.status === 200)).toBe(true);
});

test("gravação que falha tenta de novo sozinha", { tag: "@gravacao" }, async ({ browser }) => {
  const banco = novoBanco();
  const ana = await entrar(browser, ANA, banco);
  await abrirAditivo(ana, "Aditivo das duas sessões");

  banco.falharProximas = 1;
  await campoDescricao(ana).fill("Escrito com o servidor fora");
  await expect(barra(ana).filter({ hasText: /não salvo — nova tentativa em \d+ s/i })).toBeVisible();
  expect(banco.linha.descricao).toBe("Aditivo das duas sessões");

  // A nova tentativa sai sozinha e grava.
  await expect(barra(ana).filter({ hasText: /^Salvo às \d{2}:\d{2}$/ })).toBeVisible({ timeout: 15_000 });
  expect(banco.linha.descricao).toBe("Escrito com o servidor fora");
});
