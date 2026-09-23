# RN-046 · Compra avulsa nasce sem valor

**Status:** proposta
**Contexto:** Plano de Compras
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Um item que a obra precisa e o executivo não tinha entra como compra avulsa: só com descrição, quantidade, verba e alocação, sem valor. Ele não muda o CMV nem o total de nenhuma verba até a compra acontecer, e já entra no plano (não passa por liberação).

## Por quê

Comentário em `FormAvulsa` e em `criarCompraAvulsa`: "Quem descobre quanto custa é a compra"; "um número chutado agora entraria no total da verba como se fosse orçamento e sujaria [...] o CMV". Continua disponível depois da liberação do plano.

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Obra com plano liberado | o GC registra "Spot de sobrepor Loyo Up MR16" na verba 05 | o item entra com custo vazio, marcado "compra avulsa · nome de quem pediu". |
| A avulsa de material | se abre Compras de Produtos | ela aparece para escolher canal. |
| A avulsa de mão de obra | se abre Compras | ela não aparece; vai para Contratos. |

## Fora do escopo

A solicitação de contrato avulsa (Contratos), que nasce com custo estimado.

## Implementação

- Hoje: `web/src/App.jsx:3991` (`FormAvulsa`), `:23456` (`criarCompraAvulsa`), `:11370` (`liberadoParaCompra` conta `avulso`). Só na tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [plano-de-compras](../funcionalidades/plano-de-compras.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
