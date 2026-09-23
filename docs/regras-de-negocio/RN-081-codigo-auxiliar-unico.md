# RN-081 · Código auxiliar único no arquivo do Sienge

**Status:** proposta
**Contexto:** Gerador de códigos Sienge · Compras
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Todo detalhe enviado ao Sienge leva um código auxiliar, único no arquivo. Ele é o código do próprio arquivo (código ou modelo do fabricante); sem isso, recebe um número de 5 dígitos sorteado, identificado na tela como sorteado.

## Por quê

A coluna é obrigatória no template e dois detalhes com o mesmo auxiliar é justamente a duplicata que o campo existe para evitar (`web/src/lib/sienge.js:692-718`).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Um produto com modelo "ZT-W18GTTAA" e sem código | o arquivo é lido | o auxiliar é "ZT-W18GTTAA". |
| Dois produtos sem código nem modelo | o arquivo é lido | cada um recebe um número diferente, marcado como sorteado. |
| A pessoa edita o número sorteado | salva | a marca de sorteado some. |

## Fora do escopo

O código do detalhe (quem numera é o Sienge).

## Implementação

- Hoje: `web/src/lib/sienge.js:703` (`codigoAuxiliarDe`), `:719` (`sortearAuxiliares`); nas Compras, `auxiliarEstavel` (`sienge.js:777`); só na tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [gerador-codigos-sienge](../funcionalidades/gerador-codigos-sienge.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
