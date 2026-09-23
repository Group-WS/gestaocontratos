# RN-049 · Item fora do escopo vendido fica bloqueado

**Status:** proposta
**Contexto:** Plano de Compras · Contratos
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Item marcado como fora do escopo vendido fica bloqueado — não segue para destino de compra nem para contratação — até alguém aprová-lo.

## Por quê

`itemAlertas` e `contratoBloqueado`; o botão "Aprovar p/ compra" no Plano diz que "sai do bloqueio de escopo". Origem da marca `foraDeEscopo` não verificada nesta frente (suposição: vem da conferência Vendido × Executivo).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Serviço fora do escopo | se abre Contratos | aparece em "serviços bloqueados", sem "Avançar etapa". |
| Item fora do escopo no Plano | alguém com edição clica "Aprovar p/ compra" e confirma | passa a mostrar o destino. |

## Fora do escopo

Liberação para compra (RN-001).

## Implementação

- Hoje: `web/src/App.jsx:295` (`itemAlertas`), `:15491` (`contratoBloqueado`), aprovação em `GrupoPlano` (`:3865`). Só na tela; qualquer perfil com edição aprova.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [contratos](../funcionalidades/contratos.md), [plano-de-compras](../funcionalidades/plano-de-compras.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
