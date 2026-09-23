# RN-023 · A esteira do planejamento segue a ordem

**Status:** proposta
**Contexto:** Navegação da obra (esteira)
**Aprovada por:** a confirmar · **Desde:** 2026-09-16

## Enunciado

As etapas do planejamento seguem a ordem Vendido Planilha → CMV → Executivo → Conf. Executivo → Plano de Compras → Compras de Produtos, e a tela avisa (cadeado) quando a anterior não foi concluída. Exceções: a Conf. Executivo não espera o Executivo (são feitos juntos), e Plano de Compras e Compras de Produtos perdem o cadeado assim que existe um item aprovado para compra. O aviso não impede abrir a aba.

## Por quê

- "a esteira so anda pra frente, e pular etapa e o que gera compra sem conferencia" (`TabBar`); "o trabalho e' feito em conjunto" (16/09/2026); "se tiver um item ja aprovado para compra, o cadeado deve sumir do menu plano de compras e compras de produtos" (18/09/2026).
- Comentário da `TabBar`: "a esteira so anda pra frente, e pular etapa e o que gera compra sem conferencia". Exceções: pedido de 16/09/2026 ("o trabalho e' feito em conjunto") e regra dela de 18/09/2026 ("se tiver um item ja aprovado para compra, o cadeado deve sumir do menu plano de compras e compras de produtos").

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| O Executivo não concluído | olha as abas | a Conf. Executivo aparece sem cadeado. |
| A Conf. Executivo não concluída e nenhum item aprovado | olha as abas | o Plano de Compras aparece com cadeado ("Conclua Conf. Executivo primeiro"), mas abre se clicado. |
| Um item aprovado para compra | olha as abas | Plano e Compras perdem o cadeado. |

## Fora do escopo

As travas de dentro de cada tela (CMV, RN-001).

## Implementação

- Hoje:
  - `web/src/App.jsx:11123` (`ETAPAS_PLANEJAMENTO`), `web/src/App.jsx:11163`, `web/src/App.jsx:11220`, `web/src/App.jsx:11225` (`TabBar`) — só na tela, e só como aviso.
  - Só na tela, e só como aviso visual (`TabBar`, `web/src/App.jsx:11251`–`11321`; `ETAPAS_SEM_TRAVA_DE_ORDEM`, `:11189`; `temCompraAprovada`, `:11246`).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [conf-executivo](../funcionalidades/conf-executivo.md), [obra-navegacao](../funcionalidades/obra-navegacao.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
