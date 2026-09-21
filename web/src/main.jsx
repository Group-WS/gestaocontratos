import React from "react";
import ReactDOM from "react-dom/client";
// CSS do design system (@group-ws/ws-ui, caminho A: pronto, sem Tailwind).
// O arquivo local mantém apenas a compatibilidade com nomes legados do Confere.
import "@group-ws/ws-ui/styles.css";
import "./estilos/design-system.css";
import App from "./App.jsx";
import AuthGate from "./AuthGate.jsx";
import { ConfirmarHost } from "./lib/confirmar.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
    <ConfirmarHost />
  </React.StrictMode>
);
