# RN-067 · Aditivo aprovado exige a Solicitação de contrato no Pipefy

**Status:** proposta
**Contexto:** Aditivos · Dashboard · Início
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Todo aditivo aprovado obriga abrir a "Solicitação de contrato" no Pipefy. Enquanto ninguém marcar que abriu, ele fica como pendência na obra e no Início; rascunho e reprovado não cobram nada.

## Por quê

`web/src/lib/aditivoDoc.js:368-399` ("Aditivo aprovado obriga abrir a Solicitação de contrato no Pipefy"). O envio não é automático porque o formulário tem captcha e campos que o app não sabe.

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Um aditivo aprovado sem `pipefy` marcado | o Dashboard da obra abre | aparece a pendência "está aprovado e ainda sem a Solicitação de contrato no Pipefy". |
| O mesmo aditivo | alguém marca que abriu | a pendência some e fica registrado quando e por quem. |
| Um aditivo com saldo negativo | o link do Pipefy é aberto | o campo de valor vai vazio. |

## Fora do escopo

O conteúdo do card no Pipefy.

## Implementação

- Hoje: `web/src/lib/aditivoDoc.js:399` (`pipefyPendente`), `:388` (`linkPipefy`); `web/src/App.jsx:1272`, `:19095`; só na tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [aditivo-e-apresentacao](../funcionalidades/aditivo-e-apresentacao.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
