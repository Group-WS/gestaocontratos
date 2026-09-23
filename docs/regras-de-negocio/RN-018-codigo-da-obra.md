# RN-018 · O código da obra tem quatro dígitos e não se repete

**Status:** proposta
**Contexto:** Cadastro de obra
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

O código da obra é o centro de custo, com exatamente quatro dígitos, e não se repete entre obras. Ele é o número da obra em todo o sistema e o prefixo dos aditivos ("2405/1").

## Por quê

Comentário da janela Nova obra: "o centro de custo E' o numero da obra, e ele vira o prefixo do aditivo ('2405/1') e a chave de tudo que e' guardado". A unicidade é a chave `unique` da tabela `obra`.

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| A obra 2450 já cadastrada | alguém cria uma obra com centro de custo 2450 | recusa: "Já existe uma obra com o centro de custo 2450." |
| A janela Nova obra | se digita "251" | recusa: "Informe os 4 dígitos do centro de custo." |
| Um board do Monday chamado "2519 - Ed. Meraki" | se dá start | a obra nasce com código 2519. |
| Um board do Monday sem número no nome | se dá start | hoje a obra nasce com o id do board como código (fora da regra — ver Riscos da ficha). |

## Fora do escopo

O código de itens e de insumos; o vínculo com o Sienge (casa pelo mesmo código, sem chave).

## Implementação

- Hoje: 4 dígitos só na tela (`web/src/App.jsx:20887`); o servidor aceita 1 a 40 caracteres (`web/api/_lib/validacao.js:126`); a unicidade está no banco (`supabase/schema.sql:18`, `unique`) e a mensagem em `web/src/lib/obras.js:77`. O Monday aceita 3 dígitos ou mais (`web/api/_lib/mondayApp.js:215`).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): só a unicidade (`unique` em `supabase/schema.sql:18`); os 4 dígitos não.
- Fichas que citam: [cadastro-de-obra](../funcionalidades/cadastro-de-obra.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
