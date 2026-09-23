# RN-032 · O CMV é o custo da Vendido Planilha

**Status:** proposta
**Contexto:** CMV
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

O CMV da obra é o custo da Vendido Planilha somado por grupo e no total, incluindo os grupos que não se conferem item a item (01, 02 e Móveis Sob Medida) e os grupos fora da EAP. Valor de venda e margem não entram nem aparecem.

## Por quê

Comentários de `calcularCMV` — "Não conferimos item a item não é o mesmo que não custa dinheiro: móveis sob medida sozinhos dão R$ 141 mil numa obra"; a tela é usada pela equipe de obra e o valor de venda não é divulgado para ela.

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| A planilha com R$ 141 mil em Móveis Sob Medida | o CMV é apurado | os R$ 141 mil entram no total. |
| Um grupo fora da EAP com valor | o CMV é apurado | entra, marcado. |
| Os grupos 01 e 02 renumerados numa obra antiga | o CMV é apurado | o grupo é reconhecido pelo nome, não pelo número. |

## Fora do escopo

Liberar o CMV ([RN-033](RN-033-cmv-so-libera-com-valor.md)), congelar ([RN-034](RN-034-cmv-congelado.md)).

## Implementação

- Hoje: `web/src/App.jsx:7162` (`calcularCMV`), `web/src/App.jsx:7116` (`NAO_ANALISADAS_CODIGO`) — só na tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [cmv](../funcionalidades/cmv.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
