# RN-061 · Só o aditivo aprovado muda o dinheiro da obra

**Status:** proposta
**Contexto:** Aditivos · Dashboard · Executivo · Plano de Compras · Compras
**Aprovada por:** a confirmar · **Desde:** 2026-09-17

## Enunciado

Só o aditivo aprovado muda o dinheiro da obra: ele entra no orçamento vigente (vendido + saldo), no teto do CMV, no Plano de Compras, nas Compras e no Dashboard. Rascunho, "aguardando cliente" e reprovado não contam.

## Por quê

Comentário "O ADITIVO DENTRO DO ORCAMENTO DA OBRA" (`web/src/App.jsx:2366-2375`): "esperar resposta não é compromisso assumido", e a regra precisa valer nas três telas para o Dashboard e o Plano de Compras não discordarem. O teto do CMV com aditivo foi pedido dela em 17/09/2026 (`App.jsx:9414`); o aditivo nas Compras veio de relato dela em 17/09/2026 (`App.jsx:12640`). A fase "aguardando" foi criada sem mexer no dinheiro (`supabase/aditivo-aguardando.sql:13-15`).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Um aditivo de R$ 20 mil em rascunho | o Dashboard calcula o orçamento vigente | o valor não entra. |
| O mesmo aditivo | alguém o marca como aprovado | o orçamento vigente, o teto do CMV e o Plano de Compras passam a contar o saldo e os itens de adição. |
| Um aditivo "aguardando cliente" | o resumo é mostrado | ele aparece como "em aberto", sem valor. |
| Um aditivo reprovado | o Plano de Compras é montado | nenhum item dele aparece. |

## Fora do escopo

Quem pode aprovar (hoje ninguém é exigido); o efeito sobre a supressão e o custo (outras regras).

## Implementação

- Hoje: `web/src/App.jsx:2377` (`aditivoVale`), usado em `App.jsx:2407`, `:2435`, `:2464`, `:2699`; só na tela (o banco não distingue o status para dinheiro).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [aditivo-e-apresentacao](../funcionalidades/aditivo-e-apresentacao.md), [dashboard](../funcionalidades/dashboard.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
