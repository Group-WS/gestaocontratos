import React from "react";
import { SettingsIndex } from "@group-ws/ws-ui";
import { AREAS_DE_CONFIGURACOES, areasVisiveis } from "./atalhos.js";
import { linkDeConfiguracao } from "./linkDeConfiguracao.jsx";

/* O ÍNDICE LATERAL das telas de configuração (ADR-009, TELA-31), com o
   SettingsIndex do DS: todas as áreas abertas, a tela atual marcada e uma
   busca. Como no exemplo do DS, só aparece em tela larga; no celular, o
   caminho é o hub.

   O PageShell sangra sobre o respiro da área de conteúdo (-mx/-my); o índice
   ocupa a mesma sangria, colado à borda, e devolve o respiro à tela ao lado
   para o PageShell dela sangrar de novo até o índice. */
export function IndiceDeConfiguracoes({ rotaAtual, podeVer, onAbrir, children }) {
  const areas = areasVisiveis(AREAS_DE_CONFIGURACOES, podeVer);
  return (
    <div className="-mx-4 -my-6 flex min-h-full items-stretch md:-mx-8 md:-my-8">
      <SettingsIndex areas={areas} rotaAtual={rotaAtual} renderLink={linkDeConfiguracao(onAbrir)}
        className="sticky top-0 hidden max-h-screen lg:flex" />
      <div className="flex min-w-0 flex-1 flex-col px-4 py-6 md:px-8 md:py-8">{children}</div>
    </div>
  );
}
