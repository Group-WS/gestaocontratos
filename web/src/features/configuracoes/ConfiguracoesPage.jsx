import React from "react";
import { PageShell, SettingsHub } from "@group-ws/ws-ui";
import { AREAS_DE_CONFIGURACOES, areasVisiveis } from "./atalhos.js";
import { linkDeConfiguracao } from "./linkDeConfiguracao.jsx";

/* CONFIGURAÇÕES (ADR-009, 25/09/2026).

   O hub de atalhos com o SettingsHub do DS (1.4.0): um cartão por área, com
   as telas dela, e a busca por nome, sinônimo e área. Cada tela abre no seu
   endereço (/configuracoes/insumos…) com o índice lateral
   (IndiceDeConfiguracoes). Quem vê cada atalho é o podeVerModulo; a API e o
   banco garantem de verdade. */
export default function ConfiguracoesPage({ podeVer, onAbrir }) {
  const areas = areasVisiveis(AREAS_DE_CONFIGURACOES, podeVer);
  return (
    <PageShell crumb="Administração" title="Configurações"
      description="Os cadastros e as integrações que sustentam o dia a dia.">
      <SettingsHub areas={areas} renderLink={linkDeConfiguracao(onAbrir)} />
    </PageShell>
  );
}
