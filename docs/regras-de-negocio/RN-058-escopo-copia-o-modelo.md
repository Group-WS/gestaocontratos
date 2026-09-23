# RN-058 · O escopo de contratação copia o modelo

**Status:** proposta
**Contexto:** Contratos
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

O escopo de contratação nasce dos serviços escolhidos: o orçado é a soma da mão de obra deles, e o texto do modelo é copiado para dentro do escopo — mudar o modelo depois não muda o escopo já aberto.

## Por quê

Comentário "ESCOPO DE CONTRATAÇÃO": "contrato assinado é um retrato, não um link".

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| 3 serviços de pintura somando R$ 42 mil | se abre o escopo | o orçado é R$ 42 mil. |
| Escopo aberto | alguém muda o modelo de pintura | o escopo continua com o texto antigo. |
| Valor do contrato R$ 46 mil | se vê o escopo | aparece "10% acima do orçado". |

## Fora do escopo

Aprovação do contrato; medição.

## Implementação

- Hoje: `web/src/App.jsx:15622` (`FormNovoEscopo`), `:15717` (`EscopoAberto`), `:23424` (`criarEscopo`). Só na tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [contratos](../funcionalidades/contratos.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
