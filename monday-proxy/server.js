/**
 * Servidor local do proxy do Monday — usado só em desenvolvimento.
 * -----------------------------------------------------------
 * A lógica de verdade (rotas, cache, leitura de PDF) mora em
 * web/api/_lib/mondayApp.js — esse arquivo é o mesmo que a Vercel usa
 * em produção (como função serverless, via web/api/[...path].js).
 * Aqui só carregamos o .env e colocamos esse mesmo app pra ouvir
 * numa porta local, pra bater com o proxy do Vite em dev (vite.config.js).
 *
 * Como rodar localmente:
 *   1) cp .env.example .env
 *   2) cole o token novo (gerado depois de revogar o antigo) em .env
 *   3) npm install
 *   4) npm start
 */

require("dotenv").config();
const app = require("../web/api/_lib/mondayApp.js");

if (!process.env.MONDAY_API_TOKEN) {
  console.warn(
    "[AVISO] MONDAY_API_TOKEN não definido. Configure em um arquivo .env (veja .env.example)."
  );
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Proxy do Monday rodando em http://localhost:${PORT}`));
