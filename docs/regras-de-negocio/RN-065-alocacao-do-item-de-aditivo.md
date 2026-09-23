# RN-065 · Alocação do item de aditivo

**Status:** proposta
**Contexto:** Aditivos · Plano de Compras · Compras
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

O item de aditivo nasce como material. A alocação escolhida na linha decide para onde vai o custo: material, mão de obra, ou metade para cada quando é "material e mão de obra".

## Por quê

Aditivo é, na maioria, coisa para comprar; sem a alocação explícita o valor cairia inteiro em mão de obra e o material não apareceria para comprar (`web/src/lib/aditivoDoc.js:29-33`; `web/src/App.jsx:2470-2478`). Puxar da supressão traz a alocação que a obra já decidiu (`App.jsx:17905-17907`).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Uma linha nova de adição | é criada | vem como MAT. |
| Uma linha AMBOS com custo R$ 2.000 | o aditivo é aprovado | R$ 1.000 vão para material e R$ 1.000 para mão de obra. |
| Uma linha MO com custo R$ 800 | o aditivo é aprovado | os R$ 800 contam em contratação, não em compra. |

## Fora do escopo

A alocação dos itens da planilha da obra.

## Implementação

- Hoje: `web/src/lib/aditivoDoc.js:39` (`novoItem`), `web/src/App.jsx:2485-2490`; só na tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [aditivo-e-apresentacao](../funcionalidades/aditivo-e-apresentacao.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
