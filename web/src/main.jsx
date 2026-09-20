import React from "react";
import ReactDOM from "react-dom/client";

/* A ORDEM DESTES IMPORTS E' A CASCATA DO APP.
 *
 * Ate' 20/09/2026 todo o CSS do app vivia num template literal dentro do
 * App.jsx, e a ordem era a ordem do arquivo. Ela continua valendo aqui:
 * nenhuma dessas camadas usa !important — quem vence e' quem vem depois.
 *
 *   design-system.css  tokens dos dois temas (nao tem regra de tela)
 *   base.css           reset, .app, topo, avatar
 *   shell.css          trilho, painel, cabecalho de pagina
 *   telas.css          uma secao por tela
 *   componentes.css    a camada do Design System, que re-veste as classes
 *                      antigas agrupadas em :is(...) — por isso vem DEPOIS
 *   celular.css        @media (max-width: 760px) — por ultimo, disputa
 *                      especificidade igual com tudo acima
 *
 * Trocar duas linhas de lugar aqui muda a aparencia do app inteiro e nao
 * levanta nenhum erro. O teste css-ordem-dos-estilos.test.mjs vigia isso. */
import "./estilos/design-system.css";
import "./estilos/base.css";
import "./estilos/shell.css";
import "./estilos/telas.css";
import "./estilos/componentes.css";
import "./estilos/celular.css";

import App from "./App.jsx";
import AuthGate from "./AuthGate.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </React.StrictMode>
);
