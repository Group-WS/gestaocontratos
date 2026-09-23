# RN-024 · Concluir etapa registra quem e quando

**Status:** proposta
**Contexto:** Navegação da obra (esteira)
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Concluir uma etapa da esteira registra quem concluiu e quando; reabrir apaga esse registro e a etapa volta a pendente. Três etapas não têm botão próprio porque já se concluem por um ato que registra quem e quando: o CMV (liberar o CMV), o Plano de Compras (liberar as compras) e a antiga Aprovação do Cliente (registrar a assinatura).

## Por quê

Comentários de `ETAPAS_COM_CONCLUSAO` e `etapaConcluida`: "Um segundo botão criaria duas verdades sobre o mesmo fato." A data e a hora aparecem na tela desde o pedido de 23/09/2026.

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Ana editando a 2450 | conclui a etapa Executivo | fica "Etapa concluída por Ana · 23/09/2026 10:15". |
| A etapa Executivo concluída | alguém reabre e confirma | volta a "Etapa pendente" e o registro de Ana some. |
| A etapa CMV | se procura o botão Concluir | não há: ela conclui ao liberar o CMV. |
| A obra com as compras liberadas | alguém tenta concluir ou reabrir uma etapa | o botão está travado. |

## Fora do escopo

O que cada etapa exige antes de concluir (só a Conf. Executivo tem trava — [RN-041](RN-041-conf-executivo-conclui-sem-pendencia.md)).

## Implementação

- Hoje: Só na tela (`concluirEtapa`/`reabrirEtapa`, `web/src/App.jsx:23749`, `:23767`; `EtapaDaAba`, `:21274`). O `por` é o e-mail da tela, e o banco aceita qualquer valor em `etapas_concluidas` (`supabase/salvar-obra.sql:136`). Não há registro de quem reabriu.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [obra-navegacao](../funcionalidades/obra-navegacao.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
