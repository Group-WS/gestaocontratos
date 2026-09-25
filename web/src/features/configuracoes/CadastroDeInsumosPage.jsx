import React from "react";
import { PageShell } from "@group-ws/ws-ui";
import { CadastroDeInsumos } from "./CadastroDeInsumos.jsx";

/* CADASTRO DE INSUMOS, na tela própria (ADR-009): /configuracoes/insumos.
   Antes era a única aba de Configurações; o conteúdo não mudou (ADR-008). */
export default function CadastroDeInsumosPage({ usuario }) {
  return (
    <PageShell crumb="Configurações · Sienge" title="Cadastro de Insumos"
      description="Os insumos ativos do Sienge, do relatório de Insumos. Só o administrador mantém."
      contentClassName="flex flex-col gap-6">
      <CadastroDeInsumos usuario={usuario} />
    </PageShell>
  );
}
