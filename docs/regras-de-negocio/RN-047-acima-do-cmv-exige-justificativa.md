# RN-047 · Liberar o plano acima do CMV exige justificativa

**Status:** proposta
**Contexto:** Plano de Compras · CMV
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

O plano de compras pode ser liberado mesmo quando o custo do Executivo passa do CMV liberado, mas nesse caso é obrigatório escrever por que passou e o nome de quem autorizou a exceção.

## Por quê

- Comentário em `LiberacaoCompra` — "Passar do CMV não bloqueia — bloquear empurraria a obra pra fora da plataforma"; o preço de passar é o registro. A exceção pela falta de assinatura do cliente foi desligada por decisão dela em 18/09/2026 ("o cliente deixa de barrar").
- Comentário de `LiberacaoCompra`: "A decisão continua sendo de gente; o registro é que deixa de ser opcional."

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Executivo de R$ 320 mil e CMV de R$ 318 mil | alguém libera o plano | a tela exige justificativa (mínimo 15 letras) e "Autorizado por" (mínimo 3 letras). |
| Executivo abaixo do CMV | alguém libera | libera sem pedir nada. |
| Obra sem CMV liberado nem Depara aprovado | alguém libera | não há teto e nada é pedido. |

## Fora do escopo

Quem pode liberar (hoje qualquer perfil com edição); guardar o registro (hoje a justificativa não chega ao banco — ver risco na ficha).

## Implementação

- Hoje:
  - `web/src/App.jsx:4115` (`LiberacaoCompra`, limites em `:4139`), gravação em `web/src/App.jsx:23169` (`liberarCompras`). Só na tela.
  - `web/src/App.jsx:4114` (`LiberacaoCompra`), `web/src/App.jsx:23144` (`liberarCompras`) — só na tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [cmv](../funcionalidades/cmv.md), [plano-de-compras](../funcionalidades/plano-de-compras.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
