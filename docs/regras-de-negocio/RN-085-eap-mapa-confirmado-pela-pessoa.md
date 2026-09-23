# RN-085 · A ligação verba → EAP é decisão de uma pessoa

**Status:** proposta
**Contexto:** EAP Sienge
**Aprovada por:** a confirmar · **Desde:** 2026-09-15

## Enunciado

A ligação entre uma verba da casa e um item do orçamento do Sienge é decisão de uma pessoa. O sistema pode sugerir por semelhança de nome — com empate indo para o item de material [MAT] — mas nunca liga sozinho.

## Por quê

ADR-002, decisões 3 e 4: a sugestão acertou 19 de 33 verbas e não errou nenhuma, mas apropriar na conta errada o Sienge aceita calado; a tela serve compra de produto, por isso [MAT].

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| A verba "20 Climatização / Exaustão" sem ligação | a tela abre | sugere "04.001.001.001 … [MAT]" com um botão para usar. |
| A sugestão | ninguém clica | a verba continua sem ligação. |
| Empate entre [MAT] e [MO] | a sugestão é calculada | fica a [MAT]. |

## Fora do escopo

O bloqueio do envio.

## Implementação

- Hoje: `web/src/lib/eapSienge.js:139-152` (`sugerirFolha`); `web/src/App.jsx:20454-20478`; só na tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [eap-sienge](../funcionalidades/eap-sienge.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
