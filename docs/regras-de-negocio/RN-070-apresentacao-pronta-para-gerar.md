# RN-070 · A apresentação só sai com todo ambiente completo

**Status:** proposta
**Contexto:** Apresentação de especificações
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

A apresentação só sai (PDF ou PowerPoint) quando tem ao menos um ambiente e todo ambiente tem nome e imagem.

## Por quê

"Descobrir que um ambiente ficou sem imagem depois de gerar 40 páginas é caro" (`web/src/lib/apresentacaoModelo.js:313-314`).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Um slide sem render | a pessoa tenta gerar o PDF | o botão fica desabilitado com "Todo ambiente precisa de nome e de imagem". |
| Todos os ambientes com nome e imagem | gera | o PDF sai e vai para Arquivos da obra. |
| Nenhum ambiente | tenta gerar | não é permitido. |

## Fora do escopo

Descrição em inglês faltando (não bloqueia; sai em português).

## Implementação

- Hoje: `web/src/lib/apresentacaoModelo.js:315-327` (`conferir`); `web/src/Apresentacao.jsx:403`, `:408`; só na tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [aditivo-e-apresentacao](../funcionalidades/aditivo-e-apresentacao.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
