import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  // viteSingleFile só age no build: empacota JS+CSS num único index.html.
  plugins: [react(), viteSingleFile()],
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
