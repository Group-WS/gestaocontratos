import React from "react";
import ReactDOM from "react-dom/client";
// 1) design system (@group-ws/ws-ui) via Tailwind v4 — ver estilos/ws-ui.css.
// 2) CSS local: base do Confere, aliases legados e componentes compartilhados.
//    A ordem importa: o que está no local vence.
import "./estilos/ws-ui.css";
import "./estilos/design-system.css";
import { Toaster } from "sonner";
import App from "./App.jsx";
import AuthGate from "./AuthGate.jsx";
import { ConfirmarHost, MensagemHost } from "./lib/confirmar.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
    <ConfirmarHost />
    <MensagemHost />
    <Toaster position="bottom-right" richColors closeButton />
  </React.StrictMode>
);
