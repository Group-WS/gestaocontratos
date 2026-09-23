# RN-027 · Situação da obra no mapa

**Status:** proposta
**Contexto:** Início (mapa)
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

No mapa de obras, uma obra do histórico do Sienge é "finalizada" ou "ativa" nesta ordem de decisão: a marcação manual feita no app; a situação da obra no app, quando ela é acompanhada aqui; o nome dizendo "Entregue"; o código até 1500. Fora disso, é ativa. Obra acompanhada no app aparece sempre como em obra.

## Por quê

Comentário de `statusSienge`: a marcação manual "manda mais que qualquer regra automática"; código antigo "demais pra ainda estar em obra hoje"; "Sem cruzar com o Monday ao vivo por enquanto — decisão dela".

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| A obra 1200 do Sienge, sem marcação | o mapa monta | aparece como concluída. |
| A obra 1200 marcada manualmente como ativa | o mapa monta | aparece ativa. |
| A obra 2450 concluída no app | o mapa monta | aparece como concluída. |
| A obra 2600 com "Entregue" no nome | o mapa monta | aparece como concluída. |

## Fora do escopo

A situação da obra no app (`obra.situacao`).

## Implementação

- Hoje: Só na tela (`statusSienge`, `web/src/App.jsx:18930`; uso no mapa, `:21866`). A marcação manual (`PUT /api/sienge-obras/:codigo/status`) hoje não tem tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [inicio](../funcionalidades/inicio.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
