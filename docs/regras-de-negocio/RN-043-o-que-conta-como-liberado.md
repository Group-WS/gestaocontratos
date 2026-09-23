# RN-043 · O que conta como liberado para compra

**Status:** proposta
**Contexto:** Conf. Executivo · Plano de Compras · Compras · Gestão
**Aprovada por:** a confirmar · **Desde:** 2026-09-16

## Enunciado

Só item liberado para compra aparece em Compras de Produtos e conta como "falta comprar (real)" nos painéis; o resto é estimativa. Conta como liberado o item com a liberação registrada (RN-001) e também o item que já tem canal, já foi solicitado ou comprado, a compra avulsa e o item de aditivo aprovado.

## Por quê

- Comentário em `produtosMAT` (16/09/2026): "deixar entrar o que ninguém liberou é deixar comprar o que o cliente ainda pode recusar"; e em `resumoDaObra`: "Sem essa divisão a Gestão promete precisão que não tem — pedido dela em 16/09/2026".
- Comentário sobre a regra de liberação (16/09/2026): sem isso, "ligar a regra esvaziaria a tela de Compras das obras em andamento: só na 2450 são 156 itens com canal escolhido e 8 já comprados".

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Item do executivo sem liberação | se abre Compras | ele não aparece; no Plano fica "clarinho" (estimativa). |
| Item já comprado antes da liberação existir | se abre Compras | aparece (conta como liberado). |
| Item de aditivo aprovado | se abre Compras | aparece sem precisar de liberação. |
| Item liberado sem canal | se olha a Gestão | soma em "falta comprar", não em "est.". |

## Fora do escopo

Quem registra a liberação (RN-001).

## Implementação

- Hoje:
  - `web/src/App.jsx:11370` (`liberadoParaCompra`), `:11603` (`produtosMAT`), `:2108` (`resumoDaObra`). Só na tela.
  - `web/src/App.jsx:11350` (`liberadoParaCompra`) — só na tela; o gatilho da RN-001 não olha estes campos (ver riscos em `conf-executivo.md`).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [compras-de-produtos](../funcionalidades/compras-de-produtos.md), [conf-executivo](../funcionalidades/conf-executivo.md), [gestao-compras-contratacoes](../funcionalidades/gestao-compras-contratacoes.md), [plano-de-compras](../funcionalidades/plano-de-compras.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
