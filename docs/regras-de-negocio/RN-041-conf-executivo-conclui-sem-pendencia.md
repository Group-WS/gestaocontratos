# RN-041 · A Conf. Executivo só se conclui sem pendência de conferência

**Status:** proposta
**Contexto:** Conf. Executivo · Navegação da obra
**Aprovada por:** a confirmar · **Desde:** 2026-09-16

## Enunciado

A etapa Conf. Executivo só pode ser concluída quando nenhum item espera conferência (alerta técnico ou item que entrou sem ser vendido). Diferença de número e "entrou ou saiu" não impedem. Etapa já concluída continua concluída.

## Por quê

- Comentário de `bloqueioDaEtapa` (16/09/2026): "ela precisa estar 100% aprovada, zero pendência, antes de a esteira andar"; em 18/09/2026 a conta passou a incluir os itens que entraram sem ser vendidos (efeito "dito a ela").
- Comentário de `bloqueioDaEtapa` (16/09/2026): "Só a Conf. Executivo tem trava, e desde 16/09/2026 só a Conferência técnica: ela precisa estar 100% aprovada, zero pendência, antes de a esteira andar."

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| 3 itens esperando o "conferi" | tentam concluir | o botão fica desabilitado com "Falta conferir 3 produtos". |
| Zero pendências e 50 itens ainda não aprovados para compra | concluem | conclui. |
| A etapa concluída | surge uma pendência nova | continua concluída. |

## Fora do escopo

As outras etapas (sem trava).

## Implementação

- Hoje:
  - `web/src/App.jsx:11203` (`bloqueioDaEtapa`), `web/src/App.jsx:7641` (`pendenciasConfExecutivo`), `web/src/App.jsx:23705` (`concluirEtapa`) — só na tela.
  - Só na tela (`bloqueioDaEtapa`, `web/src/App.jsx:11229`; conferida de novo em `concluirEtapa`, `:23749`). O banco aceita a marca sem conferir.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [conf-executivo](../funcionalidades/conf-executivo.md), [obra-navegacao](../funcionalidades/obra-navegacao.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
