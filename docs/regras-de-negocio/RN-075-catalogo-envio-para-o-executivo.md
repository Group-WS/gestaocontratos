# RN-075 · Produto enviado do catálogo entra no Executivo

**Status:** proposta
**Contexto:** Catálogo TKWS · Executivo
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Produto enviado do catálogo a uma obra entra no Executivo, na verba dele, como material ainda não comprado, com a descrição técnica, o fornecedor, as observações como especificação, a quantidade escolhida e o preço de referência como custo; o Vendido não é tocado.

## Por quê

"É o ponto do módulo: escolher no catálogo e a linha aparecer na planilha da obra, já na verba certa"; escolher não é comprar (`web/src/lib/catalogoModelo.js:207-248`); o Vendido é o que foi vendido ao cliente (`web/src/Catalogo.jsx` — diálogo do envio).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| 4 spots de R$ 50 enviados à obra 2405 | grava | entram 4 un. na verba 05 do Executivo com custo R$ 200, não comprados. |
| Uma obra sem a verba do produto | envia | é recusado: "Nenhuma verba correspondente…". |
| A obra em edição por outra pessoa | envia | é recusado para não gravar por cima. |

## Fora do escopo

A trava e a versão da gravação (gravação da obra).

## Implementação

- Hoje: `web/src/lib/catalogoModelo.js:217-248` (`produtoParaItem`); `web/src/Catalogo.jsx:772-800`; servidor só pela gravação protegida da obra.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [catalogo](../funcionalidades/catalogo.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
