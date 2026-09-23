# RN-042 · A aprovação do cliente não barra a compra

**Status:** proposta
**Contexto:** Conf. Executivo · Plano de Compras
**Aprovada por:** a confirmar · **Desde:** 2026-09-18

## Enunciado

A aprovação do cliente (a assinatura geral ou item a item) não é pré-requisito para liberar a compra nem para abrir o Plano de Compras; quem segura a compra são as decisões internas (o executivo conclui, o administrador aprova). Os registros antigos de aprovação do cliente ficam como histórico.

## Por quê

Decisão dela em 18/09/2026, perguntada sobre o portão: tirar os dois — "o cliente deixa de barrar" (comentário de `pendenciaParaLiberar`); a aba "Aprovação do Cliente" saiu da esteira no mesmo dia (ADR-005).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Um item sem aprovação do cliente | o admin aprova para compra | é liberado. |
| Uma obra sem assinatura | o Plano de Compras é liberado | não pede justificativa por falta de assinatura (só pelo estouro do CMV). |
| Um item com `aprovadoCliente` antigo | a tela abre | o carimbo continua gravado, sem efeito. |

## Fora do escopo

Anexar a assinatura do cliente em Documentos.

## Implementação

- Hoje: `web/src/App.jsx:11393` (`pendenciaParaLiberar`), `web/src/App.jsx:11123` (comentário da esteira), `web/src/App.jsx:4114` — só na tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [conf-executivo](../funcionalidades/conf-executivo.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
