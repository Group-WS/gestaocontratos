# RN-074 · Preço do catálogo tem data e envelhece

**Status:** proposta
**Contexto:** Catálogo TKWS
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

O preço de referência do catálogo é guardado em centavos, junto com a data em que foi informado; preço com 6 meses ou mais é mostrado como velho ("de N meses atrás").

## Por quê

"Preço digitado à mão ENVELHECE. Sem a data, um número de dois anos atrás tem a mesma cara de um de ontem" (`supabase/catalogo.sql:46-51`; `web/src/lib/catalogoModelo.js:193-205`).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Um preço informado há 8 meses | o cartão aparece | diz "de 8 meses atrás" em destaque. |
| Um preço informado há 2 meses | o cartão aparece | diz "atualizado". |
| R$ 1.213,11 | é gravado | fica 121311 centavos. |

## Fora do escopo

Preço pago (Banco de Preços).

## Implementação

- Hoje: `web/src/lib/catalogoModelo.js:189-205`; `web/src/Catalogo.jsx:377`, `:407`; banco `preco_ref integer`, `preco_em date`; importação data o preço com o dia (`Catalogo.jsx:998`).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): parcial — ver "Hoje" acima.
- Fichas que citam: [catalogo](../funcionalidades/catalogo.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
