# RN-056 · O solicitante no Sienge é sempre VALENTINA

**Status:** proposta
**Contexto:** Compras de Produtos
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Toda solicitação de compra criada pelo sistema no Sienge sai em nome do usuário VALENTINA; quem apertou o botão fica registrado no histórico do sistema, não no Sienge.

## Por quê

ADR-003, decisão 7: "Decisão do negócio, registrada aqui para não virar uma constante órfã no código".

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| O GC Fulano enviando | a solicitação nasce no Sienge | o solicitante é VALENTINA e o histórico daqui diz Fulano. |
| VALENTINA inativa no Sienge | se envia | o Sienge recusa o cabeçalho e nenhum item é enviado. |

## Fora do escopo

Permissões dentro do Sienge.

## Implementação

- Hoje: `web/api/_lib/mondayApp.js:723` (servidor).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [compras-de-produtos](../funcionalidades/compras-de-produtos.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
