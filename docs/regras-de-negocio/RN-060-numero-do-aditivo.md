# RN-060 · O número do aditivo é sequencial na obra e não se reusa

**Status:** proposta
**Contexto:** Aditivos
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

O número do aditivo é o centro de custo da obra, barra, a sequência dentro da obra ("2405/3"). O número é dado pelo sistema na criação, nunca se repete na obra e o número de um aditivo apagado não é usado de novo.

## Por quê

O "2405/3" que já foi para o cliente não pode nascer de novo em outro documento (`supabase/salvar-aditivo-apresentacao.sql:208-216`; `web/src/lib/aditivoDoc.js:359-366`); antes o número era contado na tela e duas pessoas criavam o mesmo número.

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| A obra 2405 com aditivos 2405/1 e 2405/2 | alguém cria um novo | ele é 2405/3. |
| Que o 2405/3 foi apagado | alguém cria um novo | ele é 2405/4, não 2405/3. |
| Duas pessoas criando aditivo na mesma obra no mesmo segundo | as duas gravam | uma recebe 2405/3 e a outra 2405/4. |

## Fora do escopo

Numeração das revisões da apresentação.

## Implementação

- Hoje: Banco — `criar_aditivo` (`supabase/salvar-aditivo-apresentacao.sql:217-256`) e `unique (obra_codigo, seq)` (`supabase/aditivos.sql:39`); a tela só prevê o próximo (`aditivoDoc.js:363`).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): parcial — ver "Hoje" acima.
- Fichas que citam: [aditivo-e-apresentacao](../funcionalidades/aditivo-e-apresentacao.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
