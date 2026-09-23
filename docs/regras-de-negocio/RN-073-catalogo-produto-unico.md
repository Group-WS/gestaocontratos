# RN-073 · Produto único por fornecedor e código no catálogo

**Status:** proposta
**Contexto:** Catálogo TKWS
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

O mesmo código do mesmo fornecedor não entra duas vezes no catálogo. Produto sem código não conta para essa trava.

## Por quê

`supabase/catalogo.sql:65-68` ("O mesmo produto do mesmo fornecedor não entra duas vezes"); a importação conta com essa recusa para não duplicar (`web/src/Catalogo.jsx` — "Nada é sobrescrito: produtos repetidos com o mesmo código e fornecedor são recusados pelo banco").

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| O código 6730 da Nordecor já cadastrado | alguém cadastra outro 6730 da Nordecor | é recusado. |
| O código 6730 da Nordecor | alguém cadastra 6730 de outro fornecedor | é aceito. |
| Uma importação com 3 produtos repetidos | grava | os 3 aparecem em "ficaram de fora". |

## Fora do escopo

Descrição repetida (é aviso na tela, `duplicatasDe`, não trava).

## Implementação

- Hoje: Banco, índice único parcial `catalogo_produto_codigo_idx` (`supabase/catalogo.sql:67-68`).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): parcial — ver "Hoje" acima.
- Fichas que citam: [catalogo](../funcionalidades/catalogo.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
