# RN-030 · Grupo fora da EAP vai para o fim e conta no CMV

**Status:** proposta
**Contexto:** Vendido · CMV · Executivo
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Item de um grupo que não existe na EAP da empresa não é descartado: vai para um grupo "fora do padrão" no fim da lista e conta no CMV como qualquer outro.

## Por quê

"A regra da empresa é o contrário: o que não está no padrão é acrescido no final" (comentário de `aplicarItensNasVerbas`); no criativo da 2405 o grupo AUTOMAÇÃO (R$ 24.317,00) sumia do CMV sem aviso.

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| A planilha com o grupo "AUTOMAÇÃO - CONTROL 4" fora da EAP | é importada | os itens aparecem num grupo "fora do padrão" no fim. |
| Esse grupo com R$ 24.317,00 | o CMV é apurado | entra no total, marcado "fora do padrão da EAP". |
| A EAP passou a ter o grupo com esse nome | a obra é reimportada | o grupo antigo "fora" não é carregado adiante (não duplica). |

## Fora do escopo

A tradução do número do grupo para a EAP (é pelo nome).

## Implementação

- Hoje: `web/src/App.jsx:5373` (`aplicarItensNasVerbas`), `web/src/App.jsx:7162` (`calcularCMV`) — só na tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [cmv](../funcionalidades/cmv.md), [executivo](../funcionalidades/executivo.md), [vendido](../funcionalidades/vendido.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
