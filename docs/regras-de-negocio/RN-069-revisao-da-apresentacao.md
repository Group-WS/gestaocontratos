# RN-069 · Revisão da apresentação não sobrescreve a anterior

**Status:** proposta
**Contexto:** Apresentação de especificações
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Cada revisão da Apresentação de especificações (00, 01, 02…) é um documento próprio da obra. A revisão nova nasce como cópia da anterior, a anterior continua guardada, e não pode haver duas revisões com o mesmo número na mesma obra.

## Por quê

"a REV 01 não apaga a 00: a 00 já foi apresentada ao cliente, e alguém vai querer conferir o que mudou" (`supabase/apresentacao.sql:11-12`; `web/src/lib/apresentacaoModelo.js:326-333`).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| A revisão 00 já apresentada | alguém cria a revisão nova | nasce a 01 com o mesmo conteúdo, e a 00 continua lá. |
| Que a 01 já existe | alguém tenta criar outra 01 | é recusado com "A revisão 01 já existe nesta obra.". |
| Revisões 00 e 01 | a próxima é criada | é a 02 (dois dígitos). |

## Fora do escopo

Apagar revisão (hoje possível pela API — risco registrado).

## Implementação

- Hoje: Banco `criar_apresentacao` (`supabase/salvar-aditivo-apresentacao.sql:309-346`) e índice único (`supabase/apresentacao.sql:33-34`); tela `proximaRev`/`duplicarComoRev` (`apresentacaoModelo.js:335-353`), `web/src/Apresentacao.jsx:373`.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): parcial — ver "Hoje" acima.
- Fichas que citam: [aditivo-e-apresentacao](../funcionalidades/aditivo-e-apresentacao.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
