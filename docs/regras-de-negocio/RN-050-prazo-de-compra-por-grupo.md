# RN-050 · Prazo de compra por grupo

**Status:** proposta
**Contexto:** Plano de Compras · Gestão · Painel por canal · Início
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Alguns grupos têm antecedência mínima de compra contada da data de entrega da obra: elétrica/iluminação 30 dias, climatização 30, móveis soltos 75, louças e metais 90 dias para Docol e 30 para Bracci (vale o mais apertado do grupo; sem fornecedor reconhecido vale o mais longo), automação 30. Os outros grupos não têm prazo.

## Por quê

Comentário "PRAZO DE COMPRA": "O que atrasa uma obra não é o preço: é o item que leva 75 dias pra chegar e foi comprado com 40."

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Obra com entrega em 30/11 | se olha a verba 24 (móveis soltos) | "comprar até" 16/09. |
| Verba 27 com uma peça Docol e uma Bracci | se calcula | vale 90 dias. |
| Obra sem data de entrega | se olha o grupo | mostra só "N dias antes da entrega". |

## Fora do escopo

Prazo de contratação de mão de obra (não existe; a MO se ancora na data de entrega).

## Implementação

- Hoje: `web/src/App.jsx:1968` (`PRAZOS_COMPRA`), `:1989` (`prazoDoGrupo`), `:2016` (`dataLimiteCompra`), `:2090` (`dataDeNecessidade`). Só na tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [dashboard](../funcionalidades/dashboard.md), [gestao-compras-contratacoes](../funcionalidades/gestao-compras-contratacoes.md), [inicio](../funcionalidades/inicio.md), [painel-por-canal](../funcionalidades/painel-por-canal.md), [plano-de-compras](../funcionalidades/plano-de-compras.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
