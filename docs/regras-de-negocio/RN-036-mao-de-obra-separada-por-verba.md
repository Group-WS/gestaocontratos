# RN-036 · Nas verbas de instalação contratada, material e mão de obra se separam

**Status:** proposta
**Contexto:** Executivo · Plano de Compras
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Nas verbas em que a empresa sempre compra o material e contrata a instalação à parte — iluminação/elétrica, climatização, móveis soltos e louças/metais (05, 20, 24, 27 e 28, reconhecidas pelo nome) —, o item do Executivo que chega com as duas parcelas é partido em duas linhas na mesma verba: o material e, logo abaixo, a mão de obra, sem mudar o total. O documento do executivo mostrado continua como veio. Separar e juntar de volta também podem ser feitos à mão.

## Por quê

- Comentário em `importPlanilhaExecutivo` e em `VERBAS_MO_CONTRATADA`; a linha de MO fica no grupo de origem porque "a mão de obra da iluminação é da iluminação".
- Comentário de `importPlanilhaExecutivo`: deixar as duas parcelas na mesma linha "obrigaria a separar tudo na mão, item por item"; a mão de obra "da iluminação é da iluminação" (fica no grupo de origem).

Esta ficha junta candidatas levantadas separadamente na documentação (`verbas-com-mao-de-obra-sempre-separada`, `mao-de-obra-separada-nas-verbas-de-contrato`).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Item de R$ 268 (223 de material + 45 de MO) na verba 05 | o Executivo é importado | vira uma linha de R$ 223 (MAT) e logo abaixo uma de R$ 45 (MO). |
| O mesmo item em outra verba | o GC clica "separar MO" | a separação acontece só nesse item. |
| Item separado | alguém clica "juntar de volta" | a linha de MO some e o valor volta ao item. |
| Um spot de R$ 268 (223 material + 45 mão de obra) na verba 05 | a planilha é importada | vira duas linhas: R$ 223 de material e R$ 45 de serviço. |
| O mesmo item na verba 03 Civil | importado | não é partido. |
| O item partido | a Conf. Executivo o mostra ao cliente | aparece uma linha só, com o valor inteiro. |

## Fora do escopo

A regra de "MAT+MO vira MO" das outras verbas (`seriaMatMaisMoDaEmpresa`).

## Implementação

- Hoje:
  - `web/src/App.jsx:1786`, `:1833` (`partirMaoDeObra`), `:1868`, `:23366`, `:23389`, `:23399`. Só na tela.
  - `web/src/App.jsx:1785` (`VERBAS_MO_CONTRATADA`), `web/src/App.jsx:1867`, `web/src/App.jsx:1832` — só na tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [executivo](../funcionalidades/executivo.md), [plano-de-compras](../funcionalidades/plano-de-compras.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
