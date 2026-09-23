# RN-066 · Supressão de aditivo não vira compra

**Status:** proposta
**Contexto:** Aditivos · Plano de Compras · Dashboard
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

A supressão de um aditivo aprovado reduz o valor da verba, mas não vira linha de compra (não existe compra negativa). Cada grupo do aditivo cai na verba escolhida ou, sem escolha, na verba adivinhada pelo nome; grupo sem verba não entra no dinheiro e é avisado.

## Por quê

"o que foi adicionado precisa ser comprado, e o que foi suprimido some do escopo — não vira compra negativa" (`web/src/App.jsx:2392-2400`, `:2450-2455`); grupo sem verba ficaria invisível e o total da obra não fecharia (`App.jsx:2430-2432`).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Um aditivo aprovado que suprime R$ 3.000 na verba 24 | o Plano de Compras é montado | o resumo da verba 24 mostra −R$ 3.000 e nenhuma linha negativa aparece. |
| Um grupo "MÓVEIS SOB MEDIDA" sem verba escolhida | o aditivo é aprovado | ele cai na verba de mesmo nome. |
| Um grupo com nome que não casa com verba nenhuma | o aditivo é aprovado | o Dashboard avisa o grupo "solto" com o valor. |

## Fora do escopo

O custo da supressão (mora na planilha do executivo).

## Implementação

- Hoje: `web/src/App.jsx:2387` (`verbaDoGrupoAditivo`), `:2401` (`aditivosPorVerba`), `:2433` (`aditivosSemVerba`); só na tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [aditivo-e-apresentacao](../funcionalidades/aditivo-e-apresentacao.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
