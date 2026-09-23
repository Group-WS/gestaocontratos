# RN-053 · Quando um item pode ir na solicitação ao Sienge

**Status:** proposta
**Contexto:** Compras de Produtos · EAP Sienge
**Aprovada por:** a confirmar · **Desde:** 2026-09-15

## Enunciado

Um item só vai numa solicitação de compra ao Sienge se tiver insumo do Sienge associado, quantidade maior que zero, unidade que exista no cadastro do Sienge, verba ligada a um item do orçamento na EAP Sienge, unidade construtiva escolhida, alguma descrição, e se ainda não tiver sido solicitado nem comprado. O item que não pode ir aparece bloqueado com o motivo, não some: parar é melhor que apropriar errado.

## Por quê

- ADR-003, decisão 4 (revisão de 15/09/2026: o detalhe não barra) e ADR-002, decisão 3 ("parar é melhor que apropriar errado").
- ADR-002, decisão 3 ("Verba sem folha bloqueia o envio dos itens dela. De propósito"); `web/src/lib/siengeSolicitacao.js:69-72`.

Esta ficha junta candidatas levantadas separadamente na documentação (`item-elegivel-para-solicitacao-sienge`, `eap-verba-sem-folha-bloqueia-envio`).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Item sem insumo associado | se monta o envio | fica fora com "sem insumo do Sienge associado". |
| Item em unidade "cj" | se monta o envio | fica fora: a unidade não existe no Sienge. |
| Verba sem folha da EAP | se monta o envio | os itens dela ficam fora até alguém escolher a folha. |
| Item já solicitado na 23488 | se monta o envio | fica fora com "já foi pedido na solicitação 23488". |
| A verba 29 sem ligação | alguém prepara a solicitação com um item dela | o item aparece bloqueado: "a verba 29 não está ligada a um item do orçamento — configure em EAP Sienge". |
| A pessoa liga a verba na própria janela do envio | a tela remonta o pedido | o item é desbloqueado. |
| Nenhuma EAP cadastrada | alguém tenta solicitar | o botão fica desabilitado com o motivo. |

## Fora do escopo

Se o item está liberado para compra (a tela só oferece itens liberados; o servidor não confere).

## Implementação

- Hoje:
  - `web/src/lib/siengeSolicitacao.js:37` (`montarSolicitacaoSienge`). Na tela; o servidor confere só o formato (`web/api/_lib/validacao.js:81`) e a apropriação contra o orçamento da obra (`web/api/_lib/mondayApp.js:805`).
  - `web/src/lib/siengeSolicitacao.js:71-72` (`montarSolicitacaoSienge`); `web/src/App.jsx:13929-13957`; só na tela (suposição: o servidor do envio não reconfere o mapa).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [compras-de-produtos](../funcionalidades/compras-de-produtos.md), [eap-sienge](../funcionalidades/eap-sienge.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
