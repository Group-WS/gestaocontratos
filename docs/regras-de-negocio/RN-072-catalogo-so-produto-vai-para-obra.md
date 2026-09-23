# RN-072 · Só produto vai do catálogo para a obra

**Status:** proposta
**Contexto:** Catálogo TKWS
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Só produto (peça que se compra) vai do catálogo para o Executivo de uma obra; acabamento (cor e material, como MDF, laca, tecido) não vira linha de custo.

## Por quê

"Acabamento indo pro orçamento criaria uma linha de custo pra uma cor, e alguém teria que apagar depois" (`web/src/lib/catalogoModelo.js:21-33`; `supabase/catalogo.sql:124-127`).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Um spot | é enviado a uma obra | vira linha no Executivo. |
| Um "MDF Freijó" (acabamento) | é selecionado para envio | não deveria ir para o Executivo. |

## Fora do escopo

Uso do acabamento na Apresentação.

## Implementação

- Hoje: Declarada em `web/src/lib/catalogoModelo.js:40` (`podeIrParaObra`), **não aplicada**: a função é importada em `web/src/Catalogo.jsx:20` e nunca chamada; o envio (`Catalogo.jsx:772-800`) aceita acabamentos.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [catalogo](../funcionalidades/catalogo.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
