import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Build normal (`npm run build`) gera arquivos separados (JS/CSS com
// cache) — é o que a Vercel/qualquer host de verdade deve usar. O modo
// "arquivo único" (HTML standalone, tudo inline) só entra quando
// STANDALONE=1 (`npm run build:standalone`) — pra gerar um HTML pra
// mandar por fora, não pra hospedar.
const standalone = process.env.STANDALONE === "1";

export default defineConfig({
  plugins: [react(), ...(standalone ? [viteSingleFile()] : [])],
  server: {
    port: 5173,
    // Aceita qualquer host (necessário pra acessar via link de túnel,
    // ex: *.loca.lt / *.trycloudflare.com — senão o Vite bloqueia).
    allowedHosts: true,
    // Durante o desenvolvimento, chamadas para /api/monday/* são
    // encaminhadas para o proxy do Monday (rodando em outra porta),
    // assim o frontend nunca precisa saber a URL completa do backend.
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
