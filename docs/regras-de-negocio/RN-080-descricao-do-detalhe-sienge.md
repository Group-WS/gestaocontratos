# RN-080 · Padrão da descrição do detalhe no Sienge

**Status:** proposta
**Contexto:** Gerador de códigos Sienge · Compras
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

A descrição do detalhe no Sienge segue o padrão da casa: FORNECEDOR / DESCRIÇÃO / MODELO / COR / ESPECIFICAÇÃO / CÓDIGO, em caixa alta, sem partes vazias e sem repetir fornecedor e marca.

## Por quê

É como a base do Sienge escreve; separador sobrando ou nome repetido ficam para sempre no cadastro (`web/src/lib/sienge.js:245-280`).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Fornecedor Macrosul, descrição "Mesa lateral", cor "Preto" | a descrição é gerada | sai "MACROSUL / MESA LATERAL / PRETO". |
| Marca igual ao fornecedor | é gerada | o nome aparece uma vez só. |
| A descrição que já começa com o fornecedor | é gerada | ele não é repetido. |

## Fora do escopo

A descrição do insumo (mãe).

## Implementação

- Hoje: `web/src/lib/sienge.js:253` (`descricaoSienge`); só na tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [gerador-codigos-sienge](../funcionalidades/gerador-codigos-sienge.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
