import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import tailwindcss from "@tailwindcss/vite";

// Build normal (`npm run build`) gera arquivos separados (JS/CSS com
// cache) — é o que a Vercel/qualquer host de verdade deve usar. O modo
// "arquivo único" (HTML standalone, tudo inline) só entra quando
// STANDALONE=1 (`npm run build:standalone`) — pra gerar um HTML pra
// mandar por fora, não pra hospedar.
const standalone = process.env.STANDALONE === "1";

export default defineConfig({
  // tailwindcss(): gera as classes dos componentes do @group-ws/ws-ui (o
  // preset.css do pacote aponta o bundle) e as classes utilitárias das telas.
  // O CSS de entrada é src/estilos/ws-ui.css.
  plugins: [react(), tailwindcss(), ...(standalone ? [viteSingleFile()] : [])],
  server: {
    port: 5173,
    // Só os túneis que o time usa (*.loca.lt / *.trycloudflare.com), e não
    // qualquer host: `true` deixava qualquer domínio apontado pra esta
    // máquina (DNS rebinding) falar com o servidor de desenvolvimento — e
    // com o proxy /api, que usa as credenciais reais do .env local.
    allowedHosts: [".loca.lt", ".trycloudflare.com"],
    // Durante o desenvolvimento, chamadas para /api/monday/* são
    // encaminhadas para o proxy do Monday (rodando em outra porta),
    // assim o frontend nunca precisa saber a URL completa do backend.
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
