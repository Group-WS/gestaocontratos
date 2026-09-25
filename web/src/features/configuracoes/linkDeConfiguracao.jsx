import React from "react";
import { moduloDoAtalho } from "./atalhos.js";

/* O `renderLink` do settings-nav do DS: um link de verdade (Cmd/Ctrl+clique
   abre em outra aba), e o clique simples troca de tela dentro do app, como
   os itens do menu lateral. */
export function linkDeConfiguracao(onAbrir) {
  return function LinkDeConfiguracao({ to, children, ativo: _ativo, onClick, ...resto }) {
    const aoClicar = (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      onClick?.();
      onAbrir(moduloDoAtalho(to));
    };
    return <a href={to} onClick={aoClicar} {...resto}>{children}</a>;
  };
}
