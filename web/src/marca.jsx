import React from "react";
import { GroupWsLogo } from "@group-ws/ws-ui";

/* A marca oficial do Group WS: o GroupWsLogo do design system, com a API em
   português que o app já usa. Tudo em currentColor: herda a cor do texto e
   funciona nos dois temas.
     completa: monograma + "GROUP WS" — dimensione pelo font-size.
     marca: só o monograma — dimensione pela altura. */
export function LogoGroupWS({ variante = "completa", className, titulo = "Group WS" }) {
  return (
    <GroupWsLogo variant={variante === "marca" ? "mark" : "full"} className={className}
      title={titulo} />
  );
}
