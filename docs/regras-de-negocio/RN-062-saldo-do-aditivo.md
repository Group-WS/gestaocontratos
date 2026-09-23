# RN-062 · Saldo e arredondamento do aditivo

**Status:** proposta
**Contexto:** Aditivos
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

O total de cada linha é quantidade × valor arredondado ao centavo, e os totais somam essas linhas. O saldo do aditivo é adição menos supressão: positivo é "Valor do aditivo" (o cliente paga), negativo é "Crédito gerado do aditivo".

## Por quê

Somar em ponto flutuante fazia o total fechar centavos diferente da soma das linhas que o cliente confere (`web/src/lib/aditivoDoc.js:70-82`); "saldo" nos dois sentidos deixaria a linha mais importante ambígua (`aditivoDoc.js:140-147`). Vírgula decide o decimal (já houve parcelas que viraram um milhão, `aditivoDoc.js:53-60`).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| 9,60 m² × R$ 414,00 | a linha é somada | vale R$ 3.974,40 exatos. |
| Adição R$ 10.000 e supressão R$ 4.000 | o documento fecha | mostra "Valor do aditivo R$ 6.000". |
| Adição R$ 2.000 e supressão R$ 5.000 | o documento fecha | mostra "Crédito gerado do aditivo −R$ 3.000". |

## Fora do escopo

O custo interno.

## Implementação

- Hoje: `web/src/lib/aditivoDoc.js:61-96`, `:143`; na tela; o banco grava os totais que a tela manda (`salvar-aditivo-apresentacao.sql:197-198`).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [aditivo-e-apresentacao](../funcionalidades/aditivo-e-apresentacao.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
