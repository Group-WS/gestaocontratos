# RN-035 · O Executivo só abre com o CMV liberado

**Status:** proposta
**Contexto:** CMV · Executivo · Conf. Executivo
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

O Executivo e a Conf. Executivo só abrem depois de o CMV ser liberado. Exceção: obra que não tem Vendido nenhum (só o cadastro do Monday) pode começar o Executivo sem teto; a Conf. Executivo continua esperando o CMV.

## Por quê

- "é ele que define o teto de custo com que a equipe vai trabalhar daqui pra frente" (`FaseBloqueada`); a exceção existe porque exigir o CMV "travaria a obra pra sempre" quando não há com o que montá-lo (comentário de `comecarExecutivoSemDepara`).
- Tela de fase bloqueada com atalho para o CMV; a exceção existe para a obra que veio do Monday sem detalhe (`comecarExecutivoSemDepara`, `executivo_liberado_direto`). Data de origem não encontrada no código.

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| O CMV não liberado | abre o Executivo | vê "Aguardando a liberação do CMV". |
| Obra sem Vendido | quem edita escolhe "Começar direto pelo Executivo" | o Executivo abre sem teto e a etapa CMV continua pendente. |
| Obra com Vendido Planilha | o CMV não foi liberado | o atalho de começar sem CMV não aparece. |
| Obra que começou sem CMV | abre a Conf. Executivo | continua bloqueada. |

## Fora do escopo

O cadeado visual da esteira ([RN-023](RN-023-esteira-segue-a-ordem.md)).

## Implementação

- Hoje:
  - `web/src/App.jsx:25794-25798`, `web/src/App.jsx:8641`, `web/src/App.jsx:22926` — só na tela.
  - Só na tela (`web/src/App.jsx:25838`–`25846`).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [cmv](../funcionalidades/cmv.md), [conf-executivo](../funcionalidades/conf-executivo.md), [executivo](../funcionalidades/executivo.md), [obra-navegacao](../funcionalidades/obra-navegacao.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
