# RN-031 · Linha sem quantidade e sem valor não é item

**Status:** proposta
**Contexto:** Vendido · Executivo · Conf. Executivo
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Linha da planilha com quantidade e valor zerados é título de um trecho (ou item não vendido): aparece na lista, mas não é produto — não se confere, não se aprova e não se compra.

## Por quê

Comentário de `ehLinhaDeTitulo`: "17.1 Quadros decorativos" ou "17.10 Enxoval" vêm com 0 e sem valor e nomeiam o conjunto; compará-los gerava divergência inventada. Precisa dos dois zerados.

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| A linha "Quadros decorativos" com quantidade 0 e sem valor | importada | é título. |
| Um item com quantidade e sem preço | importado | continua sendo item (preço a definir). |
| Um título na Conf. Executivo | a lista é montada | aparece como cabeçalho, sem botões, e não conta nos totais. |

## Fora do escopo

Grupo não vendido (grupo sem nenhum item).

## Implementação

- Hoje: `web/src/App.jsx:4692` (`ehLinhaDeTitulo`), `web/src/App.jsx:5349` (`itemFoiVendido`), `web/src/App.jsx:11477` (`itensParaLiberar`) — só na tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [conf-executivo](../funcionalidades/conf-executivo.md), [executivo](../funcionalidades/executivo.md), [vendido](../funcionalidades/vendido.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
