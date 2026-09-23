# RN-037 · Editar item partido vale para o produto nas duas linhas

**Status:** proposta
**Contexto:** Executivo
**Aprovada por:** a confirmar · **Desde:** 2026-09-19

## Enunciado

Editar no Executivo um item partido em material e mão de obra muda nas duas linhas o que identifica o produto (descrição, fornecedor, ambiente, especificação, unidade, remoção); o que é dinheiro fica só na linha dona do valor. A edição vale para o produto editado, nunca para o vizinho.

## Por quê

"Regra confirmada por ela em 19/09/2026" (comentário de `CAMPOS_DO_PRODUTO`), após o defeito em que editar "Spot de Embutir LOYO" na 2498 gravava em "Downlight Led Powerus" (470 itens expostos).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| O spot partido em duas linhas | a descrição é corrigida | as duas linhas mudam. |
| O mesmo spot | o custo de material é editado | só a linha de material muda. |
| O produto não encontrado na lista de trabalho | editado | nada é gravado nela ("melhor não gravar do que gravar no vizinho"). |

## Fora do escopo

Produto repetido em dois ambientes (hoje recebe o mesmo patch — é risco, não regra).

## Implementação

- Hoje: `web/src/App.jsx:22939` (`editarItemExecutivo`), `web/src/App.jsx:11576` (`CAMPOS_DO_PRODUTO`) — só na tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [executivo](../funcionalidades/executivo.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
