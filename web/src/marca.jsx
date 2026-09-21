import React, { useState } from "react";
import { GroupWsLogo, ToggleGroup, ToggleGroupItem } from "@group-ws/ws-ui";

/* A marca oficial do Group WS: o GroupWsLogo do design system, com a API em
   português que o app já usa. Tudo em currentColor: herda a cor do texto e
   funciona nos dois temas.
     completa: monograma + "GROUP WS" — dimensione pelo font-size.
     marca: só o monograma — dimensione pela altura.
   `style` só existe para quem ainda passa fontSize por prop; prefira classe. */
export function LogoGroupWS({ variante = "completa", className, style, titulo = "Group WS" }) {
  return (
    <GroupWsLogo variant={variante === "marca" ? "mark" : "full"} className={className}
      style={style} title={titulo} />
  );
}

/* A mesma chave que o script do index.html lê antes da primeira pintura. */
export const CHAVE_TEMA = "ws-tema";

function temaDoDocumento() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export function useTema() {
  const [tema, setTemaLocal] = useState(temaDoDocumento);
  function setTema(novo) {
    document.documentElement.setAttribute("data-theme", novo);
    try { localStorage.setItem(CHAVE_TEMA, novo); } catch { /* navegador sem storage */ }
    setTemaLocal(novo);
  }
  return [tema, setTema];
}

export function AlternarTema({ className = "" }) {
  const [tema, setTema] = useTema();
  return (
    <ToggleGroup type="single" value={tema} aria-label="Tema" className={className}
      onValueChange={(novo) => { if (novo === "light" || novo === "dark") setTema(novo); }}>
      <ToggleGroupItem value="light" size="sm" aria-label="Tema claro">Claro</ToggleGroupItem>
      <ToggleGroupItem value="dark" size="sm" aria-label="Tema escuro">Escuro</ToggleGroupItem>
    </ToggleGroup>
  );
}
