# RN-044 · Material vai para Compras, mão de obra para Contratos

**Status:** proposta
**Contexto:** Executivo · Plano de Compras · Compras · Contratos · Gestão
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Cada item do executivo tem até duas parcelas: a de material segue para Compras de Produtos e a de mão de obra segue para Contratos. Linha com custo de material é produto (vai para compra); linha só com mão de obra é serviço (vai para contrato). A classificação (só material, só mão de obra, ou as duas) sai das colunas da planilha, pode ser corrigida à mão e nunca muda o total do item.

## Por quê

- Bloco "PLANO DE COMPRAS — o que vai ser comprado, e com que dinheiro" (`web/src/App.jsx`, acima de `ComparativoView`): na planilha da 2519 havia R$ 1,5 mi de mão de obra que nunca chegava em Contratos e inflava Compras.
- Comentário de `lerExecutivoPDF`: "Regra de negócio: se tem custo de material, é PRODUTO (→ Compras/Sienge); senão é SERVIÇO (→ Contratos)."

Esta ficha junta candidatas levantadas separadamente na documentação (`material-vai-para-compras-mo-para-contratos`, `produto-tem-material-servico-nao`).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Spot com material R$ 182 e mão de obra R$ 180 | entra no plano | R$ 182 aparecem em Compras e R$ 180 em Contratos. |
| Item corrigido à mão de MAT+MO para MAT | a tela soma | o valor inteiro passa para material e o total do item não muda. |
| Item sem valor em verba que tem separação própria (05, 20, 24, 27, 28) | o app classifica | é MAT (decisão dela, 18/09/2026). |
| Item só de mão de obra | se abre Compras | ele não aparece lá. |
| A linha com custo de material R$ 223 | importada | é produto. |
| A linha só com mão de obra | importada | é serviço. |
| Um título | importado | não é produto nem serviço contável. |

## Fora do escopo

Quem libera o item para compra (RN-001).

## Implementação

- Hoje:
  - `web/src/App.jsx:1715` (`alocacaoDoItem`), `:3744` (`parcelasDoItem`), `:11603` (`produtosMAT`), `:15597` (`servicosMO`). Só na tela (cálculo).
  - `web/src/App.jsx:4642` (`lerExecutivoPDF`), `web/src/App.jsx:23015` (`puxarDoCriativo`) — só na tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [compras-de-produtos](../funcionalidades/compras-de-produtos.md), [contratos](../funcionalidades/contratos.md), [executivo](../funcionalidades/executivo.md), [gestao-compras-contratacoes](../funcionalidades/gestao-compras-contratacoes.md), [plano-de-compras](../funcionalidades/plano-de-compras.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
