# RN-038 · Remover item do Executivo exige justificativa

**Status:** proposta
**Contexto:** Executivo
**Aprovada por:** a confirmar · **Desde:** 2026-09-18

## Enunciado

Remover um item do Executivo exige escrever o motivo (mínimo de 5 caracteres), gravado com quem removeu e quando. Trazer o item de volta apaga a justificativa.

## Por quê

ADR-005 (18/09/2026): "Sempre que for removido um item, precisa abrir o campo de observacao abaixo para justificativa. Essa observacao tem que aparecer na tela de conferencia executivo." O mínimo era 10 e baixou para 5 a pedido dela em 22/09/2026.

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Um item | a pessoa clica em remover | abre o campo; sem 5 caracteres, "Remover" fica desabilitado. |
| A justificativa "duplicado" | confirma | o item fica removido com motivo, autor e data. |
| Um item removido | é trazido de volta | os três campos são apagados. |

## Fora do escopo

Substituição de item (hoje marca o antigo como removido sem justificativa — risco).

## Implementação

- Hoje: `web/src/App.jsx:7709` (`MINIMO_DA_JUSTIFICATIVA`), `web/src/App.jsx:7710` (`FormRemocao`), `web/src/App.jsx:22939` — só na tela. Hoje a justificativa não é mostrada em tela nenhuma.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [executivo](../funcionalidades/executivo.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
