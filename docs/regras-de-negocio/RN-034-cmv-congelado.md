# RN-034 · O CMV liberado é um teto fixo

**Status:** proposta
**Contexto:** CMV
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

O CMV liberado vira um teto fixo, com quem liberou e quando. Mudar ou reimportar a Vendido Planilha depois não move o teto.

## Por quê

Comentário de `aprovarDepara`: "se fosse recalculado a cada abertura, mexer numa linha do depara moveria o teto junto e o estouro sumiria sozinho. Teto que se ajusta ao gasto não é teto."

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| O CMV liberado de R$ 800 mil | a Vendido Planilha é reimportada com R$ 850 mil | o teto continua R$ 800 mil. |
| O CMV liberado | alguém procura desfazer pela tela | não há caminho (hoje). |
| Uma obra liberada numa versão antiga, sem o valor gravado | abre | o CMV é recalculado e marcado "recalculado". |

## Fora do escopo

O aditivo aprovado levanta o teto no fechamento do Executivo (regra de aditivos).

## Implementação

- Hoje: `web/src/App.jsx:22913` (`aprovarDepara`), `web/src/App.jsx:7226` (`cmvDaObra`) — só na tela; o banco aceita qualquer valor e qualquer nome em `cmv_liberado_por`.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [cmv](../funcionalidades/cmv.md), [vendido](../funcionalidades/vendido.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
