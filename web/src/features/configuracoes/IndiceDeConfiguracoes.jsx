import React from "react";
import { ListGroup, ListGroupItem } from "@group-ws/ws-ui";
import { ArrowLeft } from "lucide-react";
import { AREAS_DE_CONFIGURACOES, areasVisiveis } from "./atalhos.js";
import { ICONE_DO_ATALHO, comoBotao } from "./ConfiguracoesPage.jsx";

/* O ÍNDICE LATERAL das telas de configuração (ADR-009, TELA-31): as áreas
   abertas ao mesmo tempo, a tela atual marcada, e a volta ao hub no topo.
   Em tela estreita ele sobe para cima do conteúdo. */
export function IndiceDeConfiguracoes({ atual, podeVer, onAbrir, children }) {
  const areas = areasVisiveis(AREAS_DE_CONFIGURACOES, podeVer);
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <nav aria-label="Configurações" className="flex shrink-0 flex-col gap-4 px-4 pt-6 lg:sticky lg:top-0 lg:w-64 lg:pr-0">
        <ListGroup>
          <ListGroupItem {...comoBotao(() => onAbrir("configuracoes"))}
            leading={<ArrowLeft size={14} aria-hidden="true" />}>
            Configurações
          </ListGroupItem>
        </ListGroup>
        {areas.map((area) => (
          <div key={area.id} className="flex flex-col gap-2">
            <p className="px-1 text-xs font-medium uppercase tracking-wide text-text-mute">{area.nome}</p>
            <ListGroup aria-label={area.nome}>
              {area.itens.map((item) => {
                const Icone = ICONE_DO_ATALHO[item.id];
                const ativo = item.id === atual;
                return (
                  <ListGroupItem key={item.id} active={ativo} aria-current={ativo ? "page" : undefined}
                    {...comoBotao(() => onAbrir(item.id))}
                    leading={Icone ? <Icone size={14} aria-hidden="true" /> : null}>
                    {item.nome}
                  </ListGroupItem>
                );
              })}
            </ListGroup>
          </div>
        ))}
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
