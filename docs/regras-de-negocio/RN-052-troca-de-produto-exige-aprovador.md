# RN-052 · Trocar produto exige quem aprovou

**Status:** proposta
**Contexto:** Compras de Produtos
**Aprovada por:** a confirmar · **Desde:** 2026-09-15

## Enunciado

Trocar um produto nas Compras exige dizer quem aprovou a troca (uma pessoa ativa da equipe); o motivo é opcional. O produto original fica riscado e sem contar, as linhas novas entram logo abaixo com o próprio custo. Item já comprado não troca, e a troca só se desfaz se nenhuma linha nova foi comprada.

## Por quê

Pedido de 15/09/2026 (comentário em `FormTroca`); "Quem aprovou é obrigatório; o motivo, não".

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Item não comprado | o GC troca por outro produto indicando o executivo como aprovador | o original fica riscado com "aprovado por" e a linha nova entra abaixo. |
| A troca sem aprovador | se tenta registrar | a tela recusa ("Diga quem aprovou a troca."). |
| Item comprado | se procura o botão "trocar" | ele não aparece. |
| Linha nova já comprada | se tenta desfazer | nada muda. |

## Fora do escopo

Substituir item no Executivo (outra frente).

## Implementação

- Hoje: `web/src/App.jsx:15084` (`FormTroca`), `:23625` (`trocarProduto`), `:23664` (`desfazerTroca`). Só na tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [compras-de-produtos](../funcionalidades/compras-de-produtos.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
