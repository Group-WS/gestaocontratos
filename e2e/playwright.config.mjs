/* Playwright do Confere.
 *
 *   cd e2e && npm ci && npx playwright install chromium && npm test
 *
 * Sobe DOIS builds do app, cada um na sua porta, porque o que se testa e'
 * justamente a diferenca de configuracao entre eles:
 *
 *   :4173  com Supabase configurado — mas apontando pra um endereco falso.
 *          Sem sessao guardada, o supabase-js nem chega a ir a rede: o app
 *          tem que parar na tela de entrada.
 *   :4174  SEM as variaveis do Supabase. Antes de 20/09/2026 isso abria o
 *          sistema inteiro sem login ("modo local"). Tem que parar num
 *          aviso — nem login, nem sistema.
 *
 * Os builds usam `vite build` de producao, e nao o `vite dev`: o modo local
 * continua valendo em dev de proposito, entao testar em dev nao provaria
 * nada.
 */
import { defineConfig, devices } from "@playwright/test";

const WEB = new URL("../web/", import.meta.url).pathname;

/* Variavel vazia SOBREPOE o web/.env de quem roda local (conferido): sem
   isso, o build "sem configuracao" pegaria as chaves reais do .env e o
   teste passaria pelo motivo errado. */
function servir({ porta, pasta, url, chave }) {
  const env = `VITE_SUPABASE_URL=${url} VITE_SUPABASE_ANON_KEY=${chave}`;
  return {
    command: `${env} npx vite build --outDir ${pasta} --emptyOutDir && npx vite preview --outDir ${pasta} --port ${porta} --strictPort`,
    cwd: WEB,
    url: `http://localhost:${porta}`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  };
}

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.mjs$/,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
  },
  webServer: [
    servir({ porta: 4173, pasta: "dist-e2e-com", url: "https://e2e-nao-existe.supabase.co", chave: "e2e" }),
    servir({ porta: 4174, pasta: "dist-e2e-sem", url: "", chave: "" }),
  ],
});
