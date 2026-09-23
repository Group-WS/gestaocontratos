# RN-039 · Item com alerta técnico só se aprova depois do "conferi"

**Status:** proposta
**Contexto:** Conf. Executivo
**Aprovada por:** a confirmar · **Desde:** 2026-09-17

## Enunciado

Item com alerta de conferência técnica (medida, compatibilidade, gás, passagem) ou que entrou no executivo sem ter sido vendido só pode ser aprovado para compra depois que alguém marca que conferiu; a marca fica com o nome e a data. Aprovação antiga de linha não substitui essa marca.

## Por quê

Pedido dela — "obrigatorio o executivo tagar isso e realmente fazer essa verificacao"; "só o conferi dado aqui vale", decisão de 17/09/2026 ("pra gente ver como vai ser, se ficar ruim depois eu mudo"). O "entrou" entrou na mesma regra em 18/09/2026.

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| A mesa de 3,00 m com alerta de elevador | o admin tenta aprovar | o botão fica desabilitado: "Confira o alerta desta linha antes de liberar". |
| O mesmo item com "conferi" marcado | o admin aprova | é liberado. |
| Um televisor que não estava no vendido | aparece no executivo | pede o "conferi" antes de liberar. |
| A verba com itens travados | o admin usa "Conferi os alertas · liberar N" | marca o "conferi" e libera no mesmo gesto, com o nome dele. |

## Fora do escopo

Quem libera (RN-001).

## Implementação

- Hoje: `web/src/App.jsx:11393` (`pendenciaParaLiberar`), `web/src/App.jsx:11427` (`podeLiberarItem`), `web/src/App.jsx:7987` (`precisaConferir`) — só na tela (o banco não exige o "conferi").
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [conf-executivo](../funcionalidades/conf-executivo.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
