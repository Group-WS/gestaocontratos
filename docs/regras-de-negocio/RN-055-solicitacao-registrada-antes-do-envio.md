# RN-055 · A solicitação ao Sienge é registrada antes de sair

**Status:** proposta
**Contexto:** Compras de Produtos
**Aprovada por:** a confirmar · **Desde:** 2026-09-15

## Enunciado

Toda solicitação ao Sienge é registrada no sistema antes de sair, com quem enviou; se o registro falhar, nada é enviado. Envio sem resposta fica "sem confirmação" até alguém conferir no Sienge, e só o que o Sienge aceitou fica marcado como solicitado na obra.

## Por quê

ADR-003, decisão 8 (revista em 15/09/2026): "Um envio sem rastro é indistinguível de um envio que nunca houve".

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Banco fora do ar | o GC envia | o envio é interrompido e nada vai ao Sienge. |
| Resposta perdida (rede) | a tela volta | o envio fica "sem confirmação" e a etapa Sienge oferece "conferir no Sienge". |
| 4 itens enviados e 1 recusado | a resposta chega | 3 ficam solicitados e o recusado continua pendente com o motivo. |
| O mesmo conteúdo já enviado | se abre o envio | a tela avisa antes. |

## Fora do escopo

O que o Sienge faz com a solicitação depois.

## Implementação

- Hoje: `web/src/App.jsx:14406` (`enviar`), `web/src/lib/siengeSolicitacoes.js:37`, `web/api/_lib/rotas/siengeBanco.js:169`. A ordem "registro antes" é garantida pela tela; o servidor não exige o registro para enviar.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [compras-de-produtos](../funcionalidades/compras-de-produtos.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
