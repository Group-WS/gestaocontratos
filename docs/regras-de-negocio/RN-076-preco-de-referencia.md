# RN-076 · Preço de referência é a compra mais recente, sem "vb"

**Status:** proposta
**Contexto:** Banco de Preços
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

O preço de referência de um insumo é o da compra mais recente de cada combinação código + descrição + unidade. Compra em "vb" (verba, valor fechado) não vira preço de referência.

## Por quê

"linhas em 'vb' saem fora: é valor fechado de serviço, não preço unitário ('TRANSPORTE /vb' ia de R$ 1 a R$ 12.605)"; a descrição entra na chave porque o código do Sienge é caixa genérica (`web/src/App.jsx:20058-20064`).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Duas compras do mesmo insumo, em março e em agosto | o relatório é importado | fica o preço de agosto. |
| Uma linha "TRANSPORTE" em vb | é importada | é ignorada e contada no aviso. |
| O mesmo código com duas descrições diferentes | é importado | viram duas referências. |

## Fora do escopo

Reimportar relatório mais antigo (hoje sobrescreve — risco registrado).

## Implementação

- Hoje: `web/src/App.jsx:20065-20108` (`parseSiengeTexto`), `:20111-20190` (`lerSiengeExcel`); banco `unique (codigo, descricao, unidade)` (`supabase/schema.sql:152`).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): parcial — ver "Hoje" acima.
- Fichas que citam: [banco-de-precos](../funcionalidades/banco-de-precos.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
