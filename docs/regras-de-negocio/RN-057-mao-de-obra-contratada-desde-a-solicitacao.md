# RN-057 · Mão de obra conta como contratada desde a solicitação

**Status:** proposta
**Contexto:** Contratos · Gestão de compras e contratações
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Para os indicadores, a mão de obra de um serviço conta como "contratada" assim que sai de "não solicitado" — a partir da solicitação de contrato, antes da assinatura.

## Por quê

Comentário em `resumoDaObra`: "MO feita é qualquer etapa de contrato fora de 'não_solicitado' — as duas definições já usadas nas telas de Compras e de Contratos".

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Serviço de R$ 10 mil em "Solicitação" | a Gestão soma | os R$ 10 mil entram em "já contratada". |
| Serviço em "Não solicitado" | a Gestão soma | entra em "a contratar". |

## Fora do escopo

O andamento do contrato em si.

## Implementação

- Hoje: `web/src/App.jsx:2060` (`contratoEtapa`), `:2108` (`resumoDaObra`), `:16011` (`DashboardMO`). Só na tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [contratos](../funcionalidades/contratos.md), [gestao-compras-contratacoes](../funcionalidades/gestao-compras-contratacoes.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
