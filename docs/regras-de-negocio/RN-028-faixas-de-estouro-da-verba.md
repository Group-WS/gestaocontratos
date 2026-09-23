# RN-028 · Faixas de estouro da verba

**Status:** proposta
**Contexto:** Visão geral da obra · lista de obras
**Aprovada por:** a confirmar · **Desde:** 2026-09-15

## Enunciado

Cada verba é classificada comparando o executivo com o vendido: crítica quando o executivo passa mais de 15% do vendido, quando há executivo sem vendido, ou quando a verba está fora do escopo vendido; atenção quando passa até 15%; pendente quando ainda não tem executivo; ok quando está igual ou abaixo. Verba sem valor e sem item não pede nada.

## Por quê

Comentário de `categoriaStatus` (15/09/2026): verba vazia acendia "estouro crítico" em branco na obra 2450 (Sonorização, Automação, Equipamentos de Lazer e Mobiliário Corporativo). Origem dos 15% não encontrada (a confirmar).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Vendido R$ 100 mil e executivo R$ 120 mil | se classifica | crítica (+20%). |
| Vendido R$ 100 mil e executivo R$ 110 mil | se classifica | atenção. |
| Vendido zero e executivo R$ 5 mil | se classifica | crítica ("sem valor vendido"). |
| Uma verba de fora da EAP sem nenhum item | se classifica | vazia (não pede nada). |

## Fora do escopo

O CMV e a liberação acima dele (fichas do CMV e do Plano de Compras).

## Implementação

- Hoje: Só na tela (`categoriaStatus`, `web/src/App.jsx:266`; `motivoDoEstouro`, `:287`; contagem na lista de obras, `obraAlertCount`, `:328`).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [dashboard](../funcionalidades/dashboard.md), [inicio](../funcionalidades/inicio.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
