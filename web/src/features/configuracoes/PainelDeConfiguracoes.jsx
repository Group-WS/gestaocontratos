import React, { useEffect, useState } from "react";
import { SettingsPanel } from "@group-ws/ws-ui";
import { AREAS_DE_CONFIGURACOES, areasVisiveis } from "./atalhos.js";
import { linkDeConfiguracao } from "./linkDeConfiguracao.jsx";

/* O PAINEL DO ⌘, (ADR-009, revisão de 25/09/2026): o SettingsPanel do DS
   abre por cima da tela atual, com a busca, e leva direto a qualquer tela
   de configuração. Cmd+, no Mac, Ctrl+, nos outros. Só existe para quem vê
   algum atalho. */
export function PainelDeConfiguracoes({ rotaAtual, podeVer, onAbrir }) {
  const [aberto, setAberto] = useState(false);
  const areas = areasVisiveis(AREAS_DE_CONFIGURACOES, podeVer);
  const temAtalho = areas.length > 0;

  useEffect(() => {
    if (!temAtalho) return undefined;
    const aoTeclar = (e) => {
      if (e.key !== "," || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      e.preventDefault();
      setAberto((v) => !v);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [temAtalho]);

  if (!temAtalho) return null;
  return (
    <SettingsPanel open={aberto} onOpenChange={setAberto} areas={areas} rotaAtual={rotaAtual}
      renderLink={linkDeConfiguracao(onAbrir)} />
  );
}
