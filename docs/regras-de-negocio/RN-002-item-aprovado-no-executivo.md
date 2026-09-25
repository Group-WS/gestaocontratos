# RN-002 · Item aprovado para compra não se edita nem se remove no Executivo

**Status:** vigente
**Contexto:** Executivo · Conferência do Executivo · Plano de compras · Compras de Produtos
**Aprovada por:** Allysson Pereira · **Desde:** 2026-09-23

## Enunciado

Com a edição da obra habilitada, um item do Executivo que já foi aprovado para compra na
Conferência do executivo — ou que já está andando na compra (solicitado, comprado, com canal de
compra, avulso ou de aditivo) — não pode ser editado, removido nem substituído por ninguém,
inclusive o administrador. Para mexer nele, a aprovação é desfeita antes. Adicionar item novo não
segue esta regra.

A trava é só do Executivo. Em Compras de Produtos o item aprovado pode ser alterado, mas toda
alteração fica registrada: quem, quando, o campo, o valor de antes e o de depois. O registro não se
edita nem se apaga, e quem vê a obra o lê no histórico do item.

## Por quê

Pedido de 23/09/2026: "ele apenas poderá editar ou remover um item se ele ainda não tiver sido
aprovado para compra na aba Conferência do executivo; adicionar um novo item não precisa seguir a
regra". Decisões e alternativas em `docs/ADR-006-executivo-trava-item-aprovado.md`.

Pedido de 25/09/2026: "quando o usuário tentar alterar um item em Compras dos Produtos, pode deixar
ele fazer, mas sempre precisa ter log do que foi feito". A trava na gravação recusava também as
alterações feitas em Compras.

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
| Item aprovado | alguém muda o fornecedor ou o custo em Compras de Produtos | permitido, e cada campo alterado fica no registro com quem, quando, antes e depois |
| Item aprovado | alguém tira o item da lista em Compras | permitido, e fica no registro como "item tirado da lista" |
| Item não aprovado | alguém muda em Compras | permitido, sem registro |

## Fora do escopo

- Quem aprova e quem desfaz a aprovação: RN-001.
- O que acontece com o item nas abas seguintes; o Executivo continua sendo a origem delas.
- Trocas de produto feitas na aba Compras criam linhas novas; elas seguem a mesma regra das
  outras (mudam em Compras com registro).

## Implementação

- Regra: `web/src/regras/itemAprovadoNoExecutivo.js`
- Teste: `web/src/regras/itemAprovadoNoExecutivo.test.mjs`
- Garantia no banco: `supabase/rn-002-item-aprovado-no-executivo.sql` e
  `supabase/rn-002-compras-com-registro.sql` (trava só na planilha do Executivo e o registro
  `obra_item_aprovado_log`)
- Teste do banco: `supabase/tests/18-rn-002-registro.sql`
- Leitura do registro: `GET /api/obras/:codigo/itens-aprovados/log` e o menu ⋯ do item em Compras

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Criação | Allysson Pereira | — |
| 2026-09-23 | Confirmada como vigente | Allysson Pereira | — |
| 2026-09-23 | Correção da implementação: a linha casa com o item pelo id da linha (ADR-007), não pela descrição. Enunciado sem mudança. | Allysson Pereira | — |
| 2026-09-25 | A trava fica só no Executivo; em Compras de Produtos o item aprovado pode ser alterado, com registro de quem, quando, campo, antes e depois. | Allysson Pereira | — |
