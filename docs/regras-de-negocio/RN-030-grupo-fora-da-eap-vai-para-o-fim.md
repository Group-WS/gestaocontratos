# RN-030 · Grupo fora da EAP vai para o fim e conta no CMV

**Status:** proposta
**Contexto:** Vendido · CMV · Executivo
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Item de um grupo que não existe na EAP da empresa não é descartado nem passa calado: na importação, a pessoa escolhe a verba da EAP para cada grupo não reconhecido, ou decide mantê-lo fora do padrão. A verba escolhida vira apelido da verba na EAP, e o próximo arquivo com o mesmo grupo já entra nela. O grupo mantido fora vai para um grupo "fora do padrão" no fim da lista e conta no CMV como qualquer outro.

## Por quê

"A regra da empresa é o contrário: o que não está no padrão é acrescido no final" (comentário de `aplicarItensNasVerbas`); no criativo da 2405 o grupo AUTOMAÇÃO (R$ 24.317,00) sumia do CMV sem aviso.

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| A planilha com o grupo "AUTOMAÇÃO - CONTROL 4" fora da EAP | é importada | os itens aparecem num grupo "fora do padrão" no fim. |
| Esse grupo com R$ 24.317,00 | o CMV é apurado | entra no total, marcado "fora do padrão da EAP". |
| A EAP passou a ter o grupo com esse nome | a obra é reimportada | o grupo antigo "fora" não é carregado adiante (não duplica). |
| O grupo "PAISAGISMO" que a EAP não reconhece | é importado e a pessoa escolhe 17 Parede Verde | os itens entram na 17, e "paisagismo" vira apelido da verba 17. |
| Um grupo não reconhecido | a pessoa escolhe "Manter fora do padrão" | entra no fim da lista, marcado, e conta no CMV. |
| Um grupo não reconhecido | a pessoa cancela | a importação inteira é cancelada. |

## Fora do escopo

A tradução do número do grupo para a EAP (é pelo nome).

## Implementação

- Hoje: `web/src/App.jsx:5373` (`aplicarItensNasVerbas`), `web/src/App.jsx:7162` (`calcularCMV`) — só na tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Escolha da verba: `web/src/lib/gruposForaDaEap.js`, `resolverGruposForaDaEap` em `web/src/App.jsx`, diálogo `escolherVerbas` em `web/src/lib/confirmar.jsx`, rota `PUT /api/eap/grupos/:num/apelidos` em `web/api/_lib/rotas/eap.js`.
- Teste: `web/src/__testes__/grupos-fora-da-eap.test.mjs`, `web/api/_lib/__testes__/eap-rotas.test.cjs`.
- Garantia no banco (se houver): quem grava apelido é o RLS de `eap_grupo` (master, admin, geral, gc).
- Fichas que citam: [cmv](../funcionalidades/cmv.md), [executivo](../funcionalidades/executivo.md), [vendido](../funcionalidades/vendido.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
| 2026-09-23 | Grupo não reconhecido passa pela pessoa na importação: escolhe a verba (vira apelido da EAP) ou mantém fora do padrão | Allysson Pereira (pedido no chat) | — |
