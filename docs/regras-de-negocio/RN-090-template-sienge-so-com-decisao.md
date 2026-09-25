# RN-090 · Produto só vai ao Template Sienge com a decisão tomada

**Status:** vigente
**Contexto:** Compras (etapa Sienge) · Gerador de códigos Sienge
**Aprovada por:** Allysson Pereira · **Desde:** 2026-09-25

## Enunciado

Cada produto associado ao Sienge está numa de três situações: usa um detalhe que **já existe** no
Sienge, foi decidido que é um **detalhe novo**, ou está **a conferir** (ninguém decidiu). Só o
detalhe novo entra no Template Sienge (o arquivo de cadastro de detalhes). O que está a conferir
fica de fora até alguém decidir.

## Por quê

Até 25/09/2026, produto sem detalhe escolhido ia para o template como detalhe novo sem ninguém
olhar. "Não olhei" e "decidi cadastrar" eram a mesma coisa, e é assim que o mesmo produto ganha dois
códigos no Sienge. Decidido com o dev no redesenho do seletor do insumo (25/09/2026).

Os produtos gravados antes da regra não tinham a decisão: conta como detalhe novo o que já tinha o
descritivo editado, o código do detalhe ou o auxiliar digitado, ou já tinha sido solicitado (ou
comprado). O resto fica a conferir.

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Escolheu o detalhe "LINEE / CADEIRA BROTO BOUCLÉ" | baixa o Template Sienge | fica de fora (já existe) |
| Escolheu "cadastrar como detalhe novo" | baixa o Template Sienge | entra |
| Ninguém escolheu nada | baixa o Template Sienge | fica de fora, contado como "a conferir" |
| Decidiu novo e depois trocou o insumo mãe | — | volta para "a conferir" |
| Produto de antes da regra, com código auxiliar digitado | baixa o Template Sienge | entra (conta como decidido) |
| Produto de antes da regra, já solicitado | baixa o Template Sienge | entra (conta como decidido) |
| Produto de antes da regra, sem nada | baixa o Template Sienge | fica de fora (a conferir) |

## Fora do escopo

- A Solicitação de compra ao Sienge: continua seguindo a RN-053; produto a conferir pode ir.
- Qual detalhe é o certo: a sugestão por palavras em comum ajuda, mas a escolha é da pessoa.
- O Resumo de cadastro: mostra o que está a conferir numa aba própria, sem somar com o resto.

## Implementação

- Regra: `web/src/regras/detalheDoSienge.js` (`decisaoDoDetalhe`, `entraNoTemplateSienge`)
- Teste: `web/src/regras/detalheDoSienge.test.mjs`
- Onde é chamada: `web/src/App.jsx` (`templateComprasDoGrupo`, `resumoCadastroSienge`, a faixa
  do Sienge na linha de Compras e o Gerador de códigos)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-25 | Criação, já vigente (decidida item a item no redesenho do seletor do insumo) | Allysson Pereira | — |
