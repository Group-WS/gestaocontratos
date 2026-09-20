/* Quem nao esta logado nao ve o sistema.
 *
 * A barreira de verdade e' o servidor e o banco (ver
 * web/api/_lib/__testes__/rotas-exigem-login.test.cjs e supabase/tests/).
 * Estes testes cobrem a outra ponta: o que o NAVEGADOR mostra. Um app que
 * renderiza o painel antes de saber quem e' a pessoa entrega, no minimo, a
 * estrutura do sistema e os nomes das telas.
 *
 * O marcador de "estou dentro do sistema" e' o `nav.trilho` (a navegacao
 * principal) e o botao Sair — os dois so' existem depois do login.
 */
import { test, expect } from "@playwright/test";

const dentroDoSistema = (page) => [
  page.locator("nav.trilho"),
  page.getByRole("button", { name: /sair/i }),
];

test("sem sessao, o app para na tela de entrada", { tag: "@acesso-negado" }, async ({ page }) => {
  await page.goto("http://localhost:4173/");

  await expect(page.getByRole("button", { name: "Continuar com Microsoft" })).toBeVisible();
  await expect(page.getByText("Acesso exclusivo ao time Group WS")).toBeVisible();

  for (const marcador of dentroDoSistema(page)) {
    await expect(marcador).toHaveCount(0);
  }
});

test("sem sessao, nenhum endereco interno fura a tela de entrada", { tag: "@acesso-negado" }, async ({ page }) => {
  // O app e' uma SPA: qualquer caminho cai no mesmo index.html. Quem digita
  // um endereco de dentro tem que cair na mesma porta que quem entra pela
  // frente — e nao num pedaco do sistema carregado por engano.
  for (const caminho of ["/obras", "/equipe", "/?verComo=master"]) {
    await page.goto(`http://localhost:4173${caminho}`);
    await expect(page.getByRole("button", { name: "Continuar com Microsoft" })).toBeVisible();
    for (const marcador of dentroDoSistema(page)) {
      await expect(marcador).toHaveCount(0);
    }
  }
});

test("publicado sem configuracao, ninguem entra", { tag: "@acesso-negado" }, async ({ page }) => {
  // Era o "modo local": sem as variaveis, o app abria sem login. Um build
  // publicado por descuido entregava o sistema aberto.
  await page.goto("http://localhost:4174/");

  await expect(page.getByText("Este ambiente está sem configuração de acesso")).toBeVisible();

  // Nem o sistema...
  for (const marcador of dentroDoSistema(page)) {
    await expect(marcador).toHaveCount(0);
  }
  // ...nem a tela de login: sem Supabase, nao ha como autenticar ninguem, e
  // oferecer o botao so' levaria a um erro.
  await expect(page.getByRole("button", { name: "Continuar com Microsoft" })).toHaveCount(0);
});
