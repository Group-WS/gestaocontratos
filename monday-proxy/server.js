/**
 * Servidor local do proxy do Monday — usado só em desenvolvimento.
 * -----------------------------------------------------------
 * A lógica de verdade (rotas, cache, leitura de PDF) mora em
 * web/api/_lib/mondayApp.js — esse arquivo é o mesmo que a Vercel usa
 * em produção (como função serverless, via web/api/index.js).
 * Aqui só carregamos o .env e colocamos esse mesmo app pra ouvir
 * numa porta local, pra bater com o proxy do Vite em dev (vite.config.js).
 *
 * Como rodar localmente:
 *   1) cp .env.example .env
 *   2) cole o token novo (gerado depois de revogar o antigo) em .env
 *   3) npm install
 *   4) npm start
 */

const path = require("node:path");
const fs = require("node:fs");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, ".env") });

// No ambiente local, compartilha apenas a configuração pública de Auth.
// Variáveis explícitas do backend têm precedência; nenhuma chave é impressa.
const webEnv = path.join(__dirname, "../web/.env");
if (fs.existsSync(webEnv)) {
  const publicEnv = dotenv.parse(fs.readFileSync(webEnv));
  for (const key of ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"]) {
    if (!process.env[key] && publicEnv[key]) process.env[key] = publicEnv[key];
  }
}
const app = require("../web/api/_lib/mondayApp.js");

if (!process.env.MONDAY_API_TOKEN) {
  console.warn(
    "[AVISO] MONDAY_API_TOKEN não definido. Configure em um arquivo .env (veja .env.example)."
  );
}

// Se a porta estiver em uso, tenta a próxima (até 20). A porta escolhida vai
// para .porta, que o vite.config.js lê para apontar o proxy /api.
const PORTA_INICIAL = Number(process.env.PORT) || 3001;
const ARQUIVO_PORTA = path.join(__dirname, ".porta");

function ouvir(porta, tentativas = 20) {
  const server = app.listen(porta, () => {
    fs.writeFileSync(ARQUIVO_PORTA, String(porta));
    console.log(`Proxy do Monday rodando em http://localhost:${porta}`);
  });
  server.on("error", (erro) => {
    if (erro.code === "EADDRINUSE" && tentativas > 1) {
      console.warn(`Porta ${porta} em uso, tentando ${porta + 1}...`);
      ouvir(porta + 1, tentativas - 1);
    } else {
      throw erro;
    }
  });
}

const limparPorta = () => fs.rmSync(ARQUIVO_PORTA, { force: true });
process.on("exit", limparPorta);
for (const sinal of ["SIGINT", "SIGTERM"]) process.on(sinal, () => process.exit(0));

ouvir(PORTA_INICIAL);
