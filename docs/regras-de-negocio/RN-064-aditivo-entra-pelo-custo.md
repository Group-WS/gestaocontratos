# RN-064 · Aditivo entra no Plano de Compras pelo custo

**Status:** proposta
**Contexto:** Aditivos · Plano de Compras · Compras
**Aprovada por:** a confirmar · **Desde:** 2026-09-15

## Enunciado

Cada linha de adição de um aditivo aprovado entra no Plano de Compras pelo custo interno (o que a empresa gasta), e não pelo preço de venda ao cliente. Linha sem custo entra "a orçar", sem valor nenhum, e não é estimada pelo preço de venda.

## Por quê

Pedido de 15/09/2026 (`web/src/App.jsx:2457`): comprar pelo preço de venda faria a obra parecer gastar a margem inteira (`web/src/lib/aditivoDoc.js:34-38`); copiar o preço como estimativa somaria um número que ninguém conferiu (`App.jsx:2480-2484`).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Uma linha de adição com venda R$ 10.000 e custo R$ 6.500 | o aditivo é aprovado | o Plano de Compras mostra R$ 6.500. |
| Uma linha de adição sem custo | o aditivo é aprovado | ela aparece no Plano de Compras como "a orçar", sem valor. |
| Três linhas sem custo | a pessoa edita o aditivo | a tela avisa que 3 linhas entram "a orçar". |

## Fora do escopo

A supressão; a margem; o estado de compra da linha.

## Implementação

- Hoje: `web/src/App.jsx:2462-2520` (`itensDeAditivo`); só na tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [aditivo-e-apresentacao](../funcionalidades/aditivo-e-apresentacao.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
