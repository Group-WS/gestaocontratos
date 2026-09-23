# RN-051 · No Sienge, comprado só depois de solicitado

**Status:** proposta
**Contexto:** Compras de Produtos
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Item com canal Sienge só pode ser marcado como comprado depois de marcado como solicitado; item comprado conta como solicitado e não pode voltar a "não solicitado" enquanto estiver comprado. Nos outros canais não há etapa de solicitação; sem canal não se marca comprado.

## Por quê

ADR-003 (consequências): "o que mantém funcionando a regra de que item do Sienge só vira 'comprado' depois de solicitado"; comentário em `estaSolicitado`.

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Item Sienge não solicitado | alguém tenta marcar comprado | o botão fica desabilitado ("Marque como solicitado antes de comprado"). |
| Item Sienge comprado | alguém tenta desmarcar o solicitado | é recusado até desmarcar o comprado. |
| Item sem canal | se olha a linha | não há ação de comprado. |

## Fora do escopo

O envio da solicitação ao Sienge.

## Implementação

- Hoje: `web/src/App.jsx:11725`–`:11731` (`estaSolicitado`, `podeMarcarComprado`, `podeMudarSolicitado`). Só na tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [compras-de-produtos](../funcionalidades/compras-de-produtos.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
