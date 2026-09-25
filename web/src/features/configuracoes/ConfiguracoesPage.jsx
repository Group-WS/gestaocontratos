import React, { useState } from "react";
import { PageShell, Tabs, TabsList, TabsTrigger, TabsContent } from "@group-ws/ws-ui";
import { Boxes } from "lucide-react";
import { CadastroDeInsumos } from "./CadastroDeInsumos.jsx";

/* CONFIGURAÇÕES (ADR-008, 23/09/2026).

   O que é cadastro da empresa e só o administrador mantém. Mora no pé da
   barra lateral, ao lado de Equipe e acessos — é cadastro, não trabalho do
   dia. Nasce com uma aba; as próximas configurações entram como abas novas.

   Quem enxerga o módulo é decidido no menu (podeVerModulo) e, de verdade,
   na API e no banco (RN-086). */
export default function ConfiguracoesPage({ usuario }) {
  const [aba, setAba] = useState("insumos");
  return (
    <PageShell crumb="Administração" title="Configurações"
      description="Cadastros da empresa que só o administrador mantém."
      contentClassName="flex flex-col gap-6">
      <Tabs value={aba} onValueChange={setAba}>
        <TabsList variant="underline">
          <TabsTrigger underline value="insumos" className="gap-2">
            <Boxes size={15} aria-hidden="true" /> Cadastro de Insumos
          </TabsTrigger>
        </TabsList>
        <TabsContent value="insumos" className="mt-6 flex flex-col gap-6">
          <CadastroDeInsumos usuario={usuario} />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
