# RN-040 · Aprovar para compra conclui o executivo da linha

**Status:** proposta
**Contexto:** Conf. Executivo
**Aprovada por:** a confirmar · **Desde:** 2026-09-18

## Enunciado

"Concluído executivo" e "Aprovado para compra" são duas decisões de pessoas diferentes; quem aprova para compra conclui junto a linha que ainda não estava concluída, sem reescrever quem já concluiu. Item aprovado conta como concluído.

## Por quê

ADR-005 (duas colunas, 18/09/2026); regra dela em 18/09/2026: "quando o usuario coloca aprovado para compra, caso o executivo nao esteja aprovado, ele coloca como aprovado automaticamente" e "tudo que ja consta como aprovado para compra, coloque como concluido executivo".

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Um item não concluído | o admin aprova para compra | recebe os dois carimbos com o nome do admin. |
| Um item concluído pelo executivo | o admin aprova | o carimbo de conclusão continua com o executivo. |
| Um item aprovado antes da coluna existir | a tela conta | aparece "concluído" sem autor inventado. |

## Fora do escopo

Quem pode aprovar (RN-001).

## Implementação

- Hoje: `web/src/App.jsx:23460` (`liberarItensParaCompra`), `web/src/App.jsx:8000` (`estaConcluido`) — só na tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [conf-executivo](../funcionalidades/conf-executivo.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
