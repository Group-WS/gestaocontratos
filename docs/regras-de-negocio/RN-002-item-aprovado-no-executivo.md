# RN-002 · Item aprovado para compra não se edita nem se remove no Executivo

**Status:** vigente
**Contexto:** Executivo · Conferência do Executivo · Plano de compras
**Aprovada por:** Allysson Pereira · **Desde:** 2026-09-23

## Enunciado

Com a edição da obra habilitada, um item do Executivo que já foi aprovado para compra na
Conferência do executivo — ou que já está andando na compra (solicitado, comprado, com canal de
compra, avulso ou de aditivo) — não pode ser editado, removido nem substituído por ninguém,
inclusive o administrador. Para mexer nele, a aprovação é desfeita antes. Adicionar item novo não
segue esta regra.

## Por quê

Pedido de 23/09/2026: "ele apenas poderá editar ou remover um item se ele ainda não tiver sido
aprovado para compra na aba Conferência do executivo; adicionar um novo item não precisa seguir a
regra". Decisões e alternativas em `docs/ADR-006-executivo-trava-item-aprovado.md`.

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Item aprovado para compra | alguém edita o custo, a quantidade ou a descrição | recusado |
| Item aprovado para compra | alguém remove ou substitui | recusado |
| Item já solicitado ao Sienge, sem a marca de aprovação | alguém edita | recusado |
| Item só aprovado pelo cliente | alguém edita | permitido |
| Item não aprovado | alguém edita ou remove | permitido |
| Qualquer obra | alguém adiciona item novo | permitido |
| Item aprovado | o administrador desfaz a aprovação e depois edita | permitido |
| Obra com item aprovado | alguém (inclusive o administrador) substitui ou limpa a planilha do Executivo | recusado |

## Fora do escopo

- Quem aprova e quem desfaz a aprovação: RN-001.
- O que acontece com o item nas abas seguintes; o Executivo continua sendo a origem delas.
- Trocas de produto feitas na aba Compras criam linhas novas; tirar essas linhas depois que
  andaram na compra também é recusado pela regra.

## Implementação

- Regra: `web/src/regras/itemAprovadoNoExecutivo.js`
- Teste: `web/src/regras/itemAprovadoNoExecutivo.test.mjs`
- Garantia no banco: `supabase/rn-002-item-aprovado-no-executivo.sql`

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Criação | Allysson Pereira | — |
| 2026-09-23 | Confirmada como vigente | Allysson Pereira | — |
| 2026-09-23 | Correção da implementação: a linha casa com o item pelo id da linha (ADR-007), não pela descrição. Enunciado sem mudança. | Allysson Pereira | — |
