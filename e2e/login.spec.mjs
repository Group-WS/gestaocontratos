/* Entrar e sair do sistema, no navegador.
 *
 * O login de verdade é da Microsoft (Azure), pelo Supabase. Este teste não
 * fala com nenhum dos dois: o build aponta para um Supabase que não existe
 * (e2e-nao-existe.supabase.co, ver playwright.config.mjs), e as respostas
 * dele são simuladas aqui, com dados inventados. O que se prova:
 *
 *   1. o botão manda para o login da Microsoft pelo Supabase, e a volta é
 *      para o próprio app — e só para ele (SEG-05);
 *   2. com uma sessão válida, o app entra: o menu de módulos aparece e o
 *      menu da conta oferece "Sair";
 *   3. sair apaga a sessão e a cópia das preferências deste navegador
 *      (NAV-06), e a pessoa volta para a tela de entrada.
 */
import { test, expect } from "@playwright/test";

const APP = "http://localhost:4173";
const SUPABASE = "https://e2e-nao-existe.supabase.co";
// supabase-js guarda a sessão em sb-<primeiro pedaço do host>-auth-token.
const CHAVE_SESSAO = "sb-e2e-nao-existe-auth-token";

const PESSOA = { email: "admin@teste.local", nome: "Ana Admin", cargo: "Coordenação", perfil: "admin", ativo: true };

/* Um token com cara de JWT (o supabase-js lê o conteúdo, não confere a
   assinatura — quem confere é o servidor, que aqui é simulado). */
function tokenFalso(email) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const agora = Math.floor(Date.now() / 1000);
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "e2e-usuario", email, role: "authenticated", aud: "authenticated", iat: agora, exp: agora + 3600 })}.assinatura-falsa`;
}

function sessaoFalsa(email) {
  const agora = Math.floor(Date.now() / 1000);
  return {
    access_token: tokenFalso(email),
    refresh_token: "refresh-falso",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: agora + 3600,
    user: { id: "e2e-usuario", email, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} },
  };
}

/* O Supabase simulado: o Auth responde quem é a pessoa; o banco devolve a
   linha dela em `pessoa` e vazio no resto; escrever e chamar função dá
   certo sem guardar nada. */
async function simularSupabase(page, { sair } = {}) {
  await page.route(`${SUPABASE}/**`, (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const json = (corpo, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(corpo) });
    if (u.pathname === "/auth/v1/user") return json({ id: "e2e-usuario", email: PESSOA.email, aud: "authenticated", role: "authenticated" });
    if (u.pathname === "/auth/v1/logout") { sair?.(); return route.fulfill({ status: 204, body: "" }); }
    if (u.pathname.startsWith("/rest/v1/rpc/")) return json(null);
    if (req.method() === "GET" || req.method() === "HEAD") return json([]);
    return json([], 201);
  });
  /* O `vite preview` não tem a API: as rotas respondem vazio — menos a da
     EQUIPE, que é por onde o app descobre o perfil de quem entrou. Desde a
     adequação (VH-02) é ela que responde isso, e não mais o Supabase. */
  await page.route(`${APP}/api/**`, (route) => {
    const req = route.request();
    const caminho = new URL(req.url()).pathname;
    /* A EQUIPE é o que interessa aqui: `/api/pessoas` e
       `/api/pessoas/entrada` são por onde a tela descobre o perfil de quem
       entrou — desde a adequação (VH-02) é a API que responde isso, e não
       mais o Supabase. O resto das rotas devolve vazio; listagem responde
       LISTA vazia, porque a tela faz `.map` no que recebe. */
    const corpo = caminho === "/api/pessoas" ? JSON.stringify([PESSOA])
      : caminho === "/api/pessoas/entrada" ? JSON.stringify(PESSOA)
        : req.method() === "GET" ? "[]"
          : "{}";
    return route.fulfill({ status: 200, contentType: "application/json", body: corpo });
  });
}

test("o botão manda para o login da Microsoft, voltando para o próprio app", { tag: "@login" }, async ({ page }) => {
  let ida = null;
  await page.route(`${SUPABASE}/auth/v1/authorize**`, (route) => {
    ida = new URL(route.request().url());
    return route.fulfill({ status: 200, contentType: "text/html", body: "<p>login da Microsoft (simulado)</p>" });
  });

  await page.goto(APP);
  await page.getByRole("button", { name: "Continuar com Microsoft" }).click();

  await expect.poll(() => ida?.searchParams.get("provider")).toBe("azure");
  // A volta é para a origem do app, sem caminho vindo de parâmetro (SEG-05).
  expect(ida.searchParams.get("redirect_to")).toBe(APP);
});

test("com sessão válida, o app entra — e sair volta para a entrada", { tag: "@login" }, async ({ page, context }) => {
  let saiuNoServidor = false;
  await context.addInitScript(([chave, sessao]) => {
    // Só na primeira abertura: depois de sair, o reload não pode trazê-la de volta.
    if (!sessionStorage.getItem("e2e-sessao-posta")) {
      localStorage.setItem(chave, sessao);
      sessionStorage.setItem("e2e-sessao-posta", "1");
    }
  }, [CHAVE_SESSAO, JSON.stringify(sessaoFalsa(PESSOA.email))]);
  await simularSupabase(page, { sair: () => { saiuNoServidor = true; } });

  await page.goto(APP);

  // Dentro do sistema: o menu de módulos está na tela, e a entrada não.
  await expect(page.getByRole("navigation", { name: "Módulos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar com Microsoft" })).toHaveCount(0);

  // O menu da conta oferece "Sair".
  await page.getByRole("button", { name: new RegExp(`${PESSOA.nome}|${PESSOA.email}`) }).click();
  const sair = page.getByRole("button", { name: "Sair" });
  await expect(sair).toBeVisible();
  await sair.click();

  // De volta à entrada, sem sessão e sem a cópia das preferências.
  await expect(page.getByRole("button", { name: "Continuar com Microsoft" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Módulos" })).toHaveCount(0);
  const guardado = await page.evaluate((chave) => [localStorage.getItem(chave), localStorage.getItem("cache:preferencias")], CHAVE_SESSAO);
  expect(guardado).toEqual([null, null]);
  expect(saiuNoServidor).toBe(true);
});
