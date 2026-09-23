# RN-048 · Plano liberado congela as etapas anteriores

**Status:** proposta
**Contexto:** Plano de Compras · Navegação da obra
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Liberado o plano de compras, as etapas anteriores da obra (Vendido Contrato, Vendido Planilha, Executivo, Conferência do executivo, anexos de projeto e aprovação do cliente) deixam de aceitar alteração até alguém reabrir as etapas.

## Por quê

Comentário "PLANILHA DE COMPRA — a versão que o time libera pra valer": "Compras e Contratos passam a trabalhar em cima de um número que não muda mais debaixo deles". Reabrir existe porque "toda trava precisa de volta".

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Plano liberado | o GC tenta editar uma célula do Executivo | a célula está travada. |
| Plano liberado | alguém clica "Reabrir etapas" e confirma | Vendido, Depara e Executivo voltam a aceitar alteração; compras já feitas continuam. |
| Plano liberado | alguém cria uma compra avulsa | é permitido (a avulsa fica fora do congelamento). |

## Fora do escopo

A trava por item aprovado no Executivo (RN-002, outra frente); quem pode reabrir.

## Implementação

- Hoje: `web/src/App.jsx:4229` (botões em `ComparativoView`), `:23169` e `:23205` (`liberarCompras`/`reabrirCompras`); a leitura `obra.comprasLiberadas` trava as telas em `:1036` (anexos), `:5505` (Vendido Contrato), `:5732` (Vendido Planilha), `:8569` (Conf. Executivo), `:9410` (Executivo), `:10957` (aprovação do cliente), `:21265` (botões de etapa). A tela do CMV (Depara) não lê a marca. Só na tela: o banco aceita editar o Executivo com `compras_liberadas = true`.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [obra-documentos](../funcionalidades/obra-documentos.md), [obra-navegacao](../funcionalidades/obra-navegacao.md), [plano-de-compras](../funcionalidades/plano-de-compras.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
