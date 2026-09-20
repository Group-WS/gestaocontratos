import React from "react";
import ReactDOM from "react-dom/client";
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
