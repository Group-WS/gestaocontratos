# RN-059 · Compra atrasada e perto do prazo

**Status:** proposta
**Contexto:** Gestão de compras e contratações · Painel por canal · Início
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Uma verba está com compra atrasada quando a data limite de compra já passou e ainda há material a comprar nela; está perto do prazo quando faltam 15 dias ou menos. Verba já toda comprada não atrasa.

## Por quê

Comentário em `resumoDaObra`: "Grupo já comprado não atrasa nada, mesmo com a data para trás — marcar ele de vermelho ensinaria a ignorar o vermelho."

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Verba 24 com "comprar até" ontem e R$ 5 mil pendentes | a Gestão calcula | a obra aparece com 1 atrasada. |
| A mesma verba toda comprada | a Gestão calcula | não há atraso. |
| Prazo em 10 dias | a Gestão calcula | aparece como "perto do prazo". |

## Fora do escopo

Os prazos de cada grupo ([RN-050](RN-050-prazo-de-compra-por-grupo.md)).

## Implementação

- Hoje: `web/src/App.jsx:2108` (`resumoDaObra`), e por item em `:2664` (`painelDoCanal`). Só na tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [dashboard](../funcionalidades/dashboard.md), [gestao-compras-contratacoes](../funcionalidades/gestao-compras-contratacoes.md), [inicio](../funcionalidades/inicio.md), [painel-por-canal](../funcionalidades/painel-por-canal.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
