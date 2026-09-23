# RN-054 · A solicitação ao Sienge soma itens iguais

**Status:** proposta
**Contexto:** Compras de Produtos
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Na solicitação ao Sienge, linhas com o mesmo insumo, a mesma descrição e a mesma apropriação viram uma linha só, com as quantidades e os custos somados.

## Por quê

ADR-003, decisão 3: evita o erro do Sienge "não é possível cadastrar mais de um insumo de mesmo código, obra, detalhe e marca".

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| A mesma luminária em dois ambientes (2 + 3 un) | se monta o envio | vai uma linha de 5 un. |
| A mesma luminária em verbas com apropriações diferentes | se monta o envio | vão duas linhas. |

## Fora do escopo

O resumo para cadastro em Excel (mesma regra, outra saída).

## Implementação

- Hoje: `web/src/lib/siengeSolicitacao.js:37` (chave `productId|descrição|código EAP`). Só na tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [compras-de-produtos](../funcionalidades/compras-de-produtos.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
