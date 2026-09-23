# RN-078 · Só insumo ativo do Sienge é oferecido

**Status:** proposta
**Contexto:** Gerador de códigos Sienge · Banco de Preços · Compras
**Aprovada por:** a confirmar · **Desde:** 2026-09-17

## Enunciado

Na associação com o Sienge só é oferecido insumo que está no cadastro ativo do Sienge, e com o nome que ele tem hoje. O preço já pago de um insumo que saiu do cadastro continua guardado.

## Por quê

Pedido da Priscila em 17/09/2026: "mesa de centro não tá ativo, não pode mostrar o que está inativo" (`supabase/insumo-sienge.sql:5-7`; `web/src/lib/insumos.js:179-196`); o código 411 mudou de nome e a associação mostrava o nome antigo.

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| O código 411 ativo com o nome "MOBÍLIA SOLTA - MESAS AUXILIARES" | a associação mostra a mãe | mostra esse nome, não "MESA DE CENTRO/LATERAL". |
| Um código que saiu do cadastro | alguém associa | ele não aparece, mas os preços pagos dele continuam no Banco de Preços. |
| Um insumo ativo nunca comprado | alguém associa | ele aparece como opção. |
| O cadastro ainda vazio | alguém associa | vale a base de preços, como antes. |

## Fora do escopo

Preço de referência.

## Implementação

- Hoje: `web/src/lib/sienge.js:151-194` (`agruparPorMae`); tabela `insumo_sienge`; importação `web/src/lib/insumos.js:225-267`; na tela (o banco só guarda a lista).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [banco-de-precos](../funcionalidades/banco-de-precos.md), [gerador-codigos-sienge](../funcionalidades/gerador-codigos-sienge.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
