import React from "react";
import ReactDOM from "react-dom/client";
// 1) design system (@group-ws/ws-ui) via Tailwind v4 — ver estilos/ws-ui.css.
// 2) CSS local: base do Confere, aliases legados e componentes compartilhados.
//    A ordem importa: o que está no local vence.
import "./estilos/ws-ui.css";
import "./estilos/design-system.css";
import { Toaster } from "sonner";
import { TooltipProvider } from "@group-ws/ws-ui";
import App from "./App.jsx";
import AuthGate from "./AuthGate.jsx";
import { ConfirmarHost, MensagemHost, PerguntarHost } from "./lib/confirmar.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* Um provider so', na raiz: todo Tooltip do DS exige um acima dele, e
        cada tela que esquecia de abrir o seu derrubava o app inteiro — a
        aba Executivo da obra abria em branco. */}
    <TooltipProvider delayDuration={200}>
      <AuthGate>
        <App />
      </AuthGate>
    </TooltipProvider>
    <ConfirmarHost />
    <MensagemHost />
    <PerguntarHost />
    <Toaster position="bottom-right" richColors closeButton />
  </React.StrictMode>
);
