import React, { useState } from "react";
import {
  PageShell, Card, CardHeader, CardTitle, CardDescription, CardContent, ListGroup, ListGroupItem, Input, EmptyState,
} from "@group-ws/ws-ui";
import { Boxes, Calculator, ChevronRight, DollarSign, KeyRound, Search, ShieldCheck, Workflow } from "lucide-react";
import { AREAS_DE_CONFIGURACOES, areasVisiveis, filtrarAtalhos } from "./atalhos.js";

/* CONFIGURAÇÕES (ADR-009, 25/09/2026).

   Um hub de atalhos, no molde do /settings do tkws-os: um cartão por área,
   com as telas dela, e uma busca por cima. Cada tela abre no seu endereço
   (/configuracoes/insumos…) e traz o índice lateral (IndiceDeConfiguracoes).

   O DS 1.3.0 não tem o SettingsHub do tkws-os: montado com Card e ListGroup
   (lacuna registrada na ADR-009). Quem vê cada atalho é o podeVerModulo; a
   API e o banco garantem de verdade. */

export const ICONE_DO_ATALHO = { equipe: ShieldCheck, precos: DollarSign, eap: Calculator, insumos: Boxes };
const ICONE_DA_AREA = { acesso: KeyRound, sienge: Workflow };

/* O ListGroupItem do DS 1.3.0 abre no clique, mas não é alcançável pelo
   teclado nem se anuncia como botão (lacuna registrada na ADR-009). Até o DS
   corrigir, o item ganha papel, foco e Enter/Espaço — WCAG 2.2 AA (DS-14). */
export function comoBotao(abrir) {
  return {
    role: "button",
    tabIndex: 0,
    onSelect: abrir,
    onKeyDown: (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      abrir();
    },
  };
}

export default function ConfiguracoesPage({ podeVer, onAbrir }) {
  const [busca, setBusca] = useState("");
  const minhas = areasVisiveis(AREAS_DE_CONFIGURACOES, podeVer);
  const naTela = filtrarAtalhos(minhas, busca);
  const total = minhas.reduce((n, a) => n + a.itens.length, 0);
  return (
    <PageShell crumb="Administração" title="Configurações"
      description="Os cadastros e as integrações que sustentam o dia a dia."
      toolbar={(
        <div className="flex w-full max-w-md items-center gap-2">
          <Search size={16} aria-hidden="true" className="shrink-0 text-text-mute" />
          <Input type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder={`Buscar em ${total} ${total === 1 ? "configuração" : "configurações"}`}
            aria-label="Buscar configuração" />
        </div>
      )}
      contentClassName="flex flex-col gap-6">
      {naTela.length === 0 ? (
        <EmptyState icon={<Search size={20} aria-hidden="true" />} title="Nada encontrado"
          description={`Nenhuma configuração para “${busca.trim()}”. Tente outro termo, como “insumo” ou “preço”.`} />
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {naTela.map((area) => {
            const IconeArea = ICONE_DA_AREA[area.id];
            return (
              <Card key={area.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {IconeArea && <IconeArea size={16} aria-hidden="true" className="text-brand" />}
                    {area.nome}
                  </CardTitle>
                  <CardDescription>{area.resumo}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ListGroup aria-label={area.nome}>
                    {area.itens.map((item) => {
                      const Icone = ICONE_DO_ATALHO[item.id];
                      return (
                        <ListGroupItem key={item.id} {...comoBotao(() => onAbrir(item.id))}
                          leading={Icone ? <Icone size={14} aria-hidden="true" /> : null}
                          description={item.sub}
                          trailing={<ChevronRight size={14} aria-hidden="true" />}>
                          {item.nome}
                        </ListGroupItem>
                      );
                    })}
                  </ListGroup>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
