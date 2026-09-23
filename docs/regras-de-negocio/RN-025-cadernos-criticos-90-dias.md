# RN-025 · Passo pendente a 90 dias da entrega é crítico

**Status:** proposta
**Contexto:** Início · Visão geral da obra
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Quando faltam 90 dias ou menos para a entrega e as compras ainda não foram liberadas, todo passo pendente da esteira da obra (Criativo, CMV liberado, Caderno de Especificação, Caderno de Marcenaria, Caderno Completo do Projeto Executivo) vira pendência crítica.

## Por quê

Comentário de `passosCriticosAtrasados`: "Mesma regra dos 90 dias, mas devolvendo QUAIS passos estão pendentes". Origem da janela de 90 dias não encontrada no código (a confirmar).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| A entrega em 60 dias, compras não liberadas e o Caderno de Marcenaria sem anexo | o Início calcula | aparece "Fechar o caderno de Caderno de Marcenaria" como crítico. |
| A entrega em 120 dias | o Início calcula | não há pendência de caderno. |
| As compras já liberadas | falta um caderno a 30 dias da entrega | não há pendência (a obra já está em execução). |
| A obra sem data de entrega | o Início calcula | não há pendência de caderno. |

## Fora do escopo

Prazos de compra ([RN-050](RN-050-prazo-de-compra-por-grupo.md)).

## Implementação

- Hoje: Só na tela (`passosCriticosAtrasados`, `web/src/App.jsx:19085`; `esteiraDaObra`, `:19064`).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [dashboard](../funcionalidades/dashboard.md), [inicio](../funcionalidades/inicio.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
