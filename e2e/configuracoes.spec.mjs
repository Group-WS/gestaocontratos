/* Configurações → Cadastro de Insumos, no navegador (ADR-008).
 *
 * Como o login.spec.mjs: o build aponta para um Supabase que não existe e
 * as respostas (Auth, banco, Storage e a API do app) são simuladas aqui,
 * com dados inventados. Nada fala com banco de verdade (TST-07).
 *
 * O que se prova:
 *   1. quem não administra não vê o módulo — nem no menu, nem digitando o
 *      endereço (RN-086; a barreira de verdade é a API e o banco);
 *   2. o administrador vê a tabela ativa e a lista do cadastro;
 *   3. a importação: escolher o arquivo, conferir a prévia, e o botão de
 *      gravar só liga depois das decisões (caminho e conflitos).
 *
 * `E2E_CAPTURAS=<pasta>` guarda uma captura da tela e da prévia, para
 * conferir o visual.
 */
import { test, expect } from "@playwright/test";
import path from "node:path";

const APP = "http://localhost:4173";
const SUPABASE = "https://e2e-nao-existe.supabase.co";
const CHAVE_SESSAO = "sb-e2e-nao-existe-auth-token";

const ADMIN = { email: "admin@teste.local", nome: "Ana Admin", cargo: "Coordenação", perfil: "admin", ativo: true };
const GC = { email: "gc1@teste.local", nome: "Gil GC Um", cargo: "GC", perfil: "gc", ativo: true };

function tokenFalso(email) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const agora = Math.floor(Date.now() / 1000);
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "e2e-usuario", email, role: "authenticated", aud: "authenticated", iat: agora, exp: agora + 3600 })}.assinatura-falsa`;
}

function sessaoFalsa(email) {
  const agora = Math.floor(Date.now() / 1000);
  return {
    access_token: tokenFalso(email), refresh_token: "refresh-falso", token_type: "bearer",
    expires_in: 3600, expires_at: agora + 3600,
    user: { id: "e2e-usuario", email, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} },
  };
}

const INSUMOS = [
  { id: 1, codigo: "275", descricao: "AR CONDICIONADO (CORRIGIDO)", unidade: "un", ativo: true, origem: "sienge", editado: true },
  { id: 2, codigo: "406", descricao: "MOBILIA SOLTA - CADEIRA / TOK STOK / CADEIRA EIFFEL BRANCA", unidade: "un", ativo: true, origem: "sienge", editado: false },
  { id: 3, codigo: "900", descricao: "INSUMO FEITO NA TELA", unidade: "m2", ativo: false, origem: "tela", editado: false },
];

const PREVIA = {
  id: 41,
  resumo: {
    tabela: { codigo: "1", nome: "TABELA WS BUILDING", texto: "1 - TABELA WS BUILDING" },
    tabelaAtiva: { codigo: "1", nome: "TABELA WS BUILDING" }, tabelaConfere: "confere",
    geradoEm: "2026-09-21T21:12:13-03:00",
    linhas: 14388, vb: 568, vbCodigos: 135, repetidas: 62, fora: 0, entram: 13758, codigos: 2571, pares: 8,
    cadastroHoje: 3, inserir: 13755, atualizar: 0, reativados: 0, semMudanca: 1, conflitos: 1, jaExistem: 0,
    naoVieram: 1, sairiam: 0, ficamEmUso: 1,
  },
  listas: {
    fora: { itens: [], total: 0 },
    repetidas: { itens: [{ linhaExcel: 645, igualALinha: 634, codigo: "362", descricao: "TELEVISOR / LG / SMART TV LED 70\" " }], total: 62 },
    pares: { itens: [{ codigo: "275", linhas: [{ linhaExcel: 328, descricao: "AR / CINZA" }, { linhaExcel: 337, descricao: "AR /  CINZA" }] }], total: 8 },
    conflitos: { itens: [{ id: 1, atual: { codigo: "275", descricao: "AR CONDICIONADO (CORRIGIDO)", unidade: "un" },
      relatorio: { codigo: "275", descricao: "AR CONDICIONADO", unidade: "un" }, escolha: null, podeUsarRelatorio: true }], total: 1 },
    sairiam: { itens: [], total: 0 },
    ficamEmUso: { itens: [{ id: 2, codigo: "406", descricao: "MOBILIA SOLTA - CADEIRA / TOK STOK / CADEIRA EIFFEL BRANCA", unidade: "un",
      usos: [{ obraCodigo: "2450", solicitacaoId: 23488 }] }], total: 1 },
    jaExistem: { itens: [], total: 0 },
  },
};

/* A sessão, o Supabase e a API do app, simulados. `aplicados` recebe o
   corpo de cada "gravar", para o teste conferir as decisões enviadas. */
async function entrarComo(page, context, pessoa, { aplicados = [] } = {}) {
  await context.addInitScript(([chave, sessao]) => {
    localStorage.setItem(chave, sessao);
  }, [CHAVE_SESSAO, JSON.stringify(sessaoFalsa(pessoa.email))]);

  await page.route(`${SUPABASE}/**`, (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const json = (corpo, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(corpo) });
    if (u.pathname === "/auth/v1/user") return json({ id: "e2e-usuario", email: pessoa.email, aud: "authenticated", role: "authenticated" });
    // A subida do relatório para o balde, pelo endereço que a API assinou.
    if (u.pathname.startsWith("/storage/v1/object/upload/sign/")) return json({ Key: "insumo-importacao/importacoes/41.xlsx" });
    if (req.method() === "GET" || req.method() === "HEAD") return json([]);
    return json([], 201);
  });

  await page.route(`${APP}/api/**`, (route) => {
    const req = route.request();
    const caminho = new URL(req.url()).pathname;
    const json = (corpo, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(corpo) });
    if (caminho === "/api/pessoas") return json([pessoa]);
    if (caminho === "/api/pessoas/entrada") return json(pessoa);
    if (caminho === "/api/insumo-cadastro") return json({ itens: INSUMOS, total: INSUMOS.length });
    if (caminho === "/api/insumo-cadastro/unidades") return json(["m2", "un"]);
    if (caminho === "/api/insumo-cadastro/tabela-ativa") return json({ tabela: { codigo: "1", nome: "TABELA WS BUILDING", atualizado_em: null, atualizado_por: null } });
    if (caminho === "/api/insumo-cadastro/importacoes" && req.method() === "GET") return json({ lista: [] });
    if (caminho === "/api/insumo-cadastro/importacoes") return json({ id: 41, assinatura: { caminho: "importacoes/41.xlsx", token: "t" } });
    if (caminho === "/api/insumo-cadastro/importacoes/41/previa") return json(PREVIA);
    if (caminho === "/api/insumo-cadastro/importacoes/41/aplicar") {
      aplicados.push(req.postDataJSON());
      return json({ status: "concluida", resumo: { resultado: { gravadas: 13755, apagados: 0, ficaramEmUso: 0, caminho: "manter" } } });
    }
    return json(req.method() === "GET" ? [] : {});
  });
}

const capturar = async (page, nome) => {
  if (!process.env.E2E_CAPTURAS) return;
  await page.screenshot({ path: path.join(process.env.E2E_CAPTURAS, `${nome}.png`), fullPage: true });
};

test("quem não administra vê só os atalhos dele, e o Cadastro de Insumos nem pelo endereço", { tag: "@acesso-negado" }, async ({ page, context }) => {
  await entrarComo(page, context, GC);
  await page.goto(`${APP}/configuracoes`);
  // ADR-009: o hub abre para quem vê algum atalho, e mostra só os dele.
  await expect(page.getByRole("link", { name: /Banco de Preços/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Cadastro de Insumos/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Equipe e acessos/ })).toHaveCount(0);

  await page.goto(`${APP}/configuracoes/insumos`);
  await expect(page.getByRole("navigation", { name: "Módulos" })).toBeVisible();
  await expect(page.getByText("Tabela de preços ativa")).toHaveCount(0);
});

test("o hub leva ao Cadastro de Insumos, e o índice lateral volta", async ({ page, context }) => {
  await entrarComo(page, context, ADMIN);
  await page.goto(`${APP}/configuracoes`);
  await expect(page.getByRole("heading", { name: "Sienge" })).toBeVisible();
  await capturar(page, "configuracoes-hub");
  // Equipe, Banco de Preços e EAP saíram do menu lateral.
  const menu = page.getByRole("navigation", { name: "Módulos" });
  await expect(menu.getByRole("link", { name: /Banco de Preços/ })).toHaveCount(0);
  await expect(menu.getByRole("link", { name: /EAP Sienge/ })).toHaveCount(0);

  await page.getByRole("searchbox", { name: /Buscar em 4 configurações/ }).fill("material");
  await expect(page.getByRole("link", { name: /Banco de Preços/ })).toHaveCount(0);
  await page.getByRole("link", { name: /Cadastro de Insumos/ }).click();
  await expect(page).toHaveURL(/\/configuracoes\/insumos$/);
  await expect(page.getByText("Tabela de preços ativa")).toBeVisible();
  await capturar(page, "configuracoes-hub-insumos");

  await page.getByRole("navigation", { name: "Configurações" }).getByRole("link", { name: /EAP Sienge/ }).click();
  await expect(page).toHaveURL(/\/configuracoes\/eap$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/configuracoes\/insumos$/);
});

test("⌘, abre as Configurações por cima de qualquer tela", async ({ page, context }) => {
  await entrarComo(page, context, ADMIN);
  await page.goto(`${APP}/configuracoes/eap`);
  await expect(page.getByRole("navigation", { name: "Configurações" })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+Comma");
  const painel = page.getByRole("dialog", { name: "Configurações" });
  await expect(painel).toBeVisible();
  await capturar(page, "configuracoes-painel");
  await painel.getByRole("link", { name: /Cadastro de Insumos/ }).click();
  await expect(painel).toHaveCount(0);
  await expect(page).toHaveURL(/\/configuracoes\/insumos$/);
});

test("endereço antigo abre a tela no endereço novo", async ({ page, context }) => {
  await entrarComo(page, context, ADMIN);
  await page.goto(`${APP}/precos`);
  await expect(page).toHaveURL(/\/configuracoes\/precos$/);
});

test("o administrador vê o cadastro e importa o relatório do Sienge", async ({ page, context }) => {
  const aplicados = [];
  await entrarComo(page, context, ADMIN, { aplicados });
  await page.goto(`${APP}/configuracoes/insumos`);

  await expect(page.getByRole("heading", { name: "Cadastro de Insumos" })).toBeVisible();
  await expect(page.getByText("Tabela de preços ativa")).toBeVisible();
  await expect(page.getByText("MOBILIA SOLTA - CADEIRA / TOK STOK / CADEIRA EIFFEL BRANCA")).toBeVisible();
  await expect(page.getByText("editado", { exact: true })).toBeVisible();
  await capturar(page, "configuracoes-cadastro");

  // A importação sai do menu "Mais ações" (uma ação primária por área).
  await page.getByRole("button", { name: "Mais ações" }).click();
  await page.getByRole("menuitem", { name: "Importar relatório do Sienge" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "cadastro de insumos ativos_09.26.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from("relatorio simulado"),
  });

  // A prévia: números e as decisões pendentes.
  await expect(page.getByText("linhas no arquivo")).toBeVisible();
  await expect(page.getByText("14.388")).toBeVisible();
  const gravar = page.getByRole("button", { name: "Gravar no cadastro" });
  await expect(gravar).toBeDisabled();
  await capturar(page, "configuracoes-previa");

  // Nenhum caminho vem marcado: escolher o caminho ainda não basta — falta o conflito.
  await page.getByRole("radio", { name: /Manter e só incluir os novos/ }).click();
  await expect(gravar).toBeDisabled();
  await page.getByLabel("A edição da tela").click();
  await expect(gravar).toBeEnabled();

  await gravar.click();
  await expect(page.getByText("Cadastro de insumos atualizado.")).toBeVisible();
  expect(aplicados).toEqual([{ caminho: "manter", conflitos: { 1: "edicao" }, confirmouNome: false }]);
});
