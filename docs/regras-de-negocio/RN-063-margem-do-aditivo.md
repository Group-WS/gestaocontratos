# RN-063 · A margem do aditivo é só da adição

**Status:** proposta
**Contexto:** Aditivos
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

A margem do aditivo é calculada só sobre a adição (venda menos custo) e só é mostrada quando algum custo foi informado; com parte das linhas sem custo, a margem é dita parcial.

## Por quê

O custo do que saiu está na planilha do executivo, não no aditivo (`web/src/lib/aditivoDoc.js:121-128`); sem custo a conta daria "margem 100%", "uma mentira bonita" onde se decide preço (`web/src/App.jsx:18413-18416`).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Adição vendida R$ 10.000 sem nenhum custo | o fechamento é mostrado | a margem aparece "—". |
| Venda R$ 10.000 e custo R$ 7.000 em todas as linhas | o fechamento é mostrado | a margem é R$ 3.000 · 30,0%. |
| Custo só em parte das linhas | o fechamento é mostrado | a margem vem marcada "(parcial)". |

## Fora do escopo

Margem da obra inteira.

## Implementação

- Hoje: `web/src/lib/aditivoDoc.js:129-138` (`margemDoDocumento`); `web/src/App.jsx:18390-18431`; planilha `aditivoDoc.js:324-329`; só na tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [aditivo-e-apresentacao](../funcionalidades/aditivo-e-apresentacao.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
