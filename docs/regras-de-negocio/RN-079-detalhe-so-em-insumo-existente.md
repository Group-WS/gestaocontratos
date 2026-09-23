# RN-079 · Produto novo entra no Sienge como detalhe de insumo existente

**Status:** proposta
**Contexto:** Gerador de códigos Sienge · Compras
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Produto novo só se cadastra no Sienge como detalhe dentro de um insumo (mãe) que já existe no cadastro; a mãe é sempre escolhida da base, nunca digitada. Produto que já existe como variante não vai para o template de cadastro.

## Por quê

"o Sienge não aceita insumo que não está lá, e o template só serve pra cadastrar DETALHE dentro de um insumo que já existe" (`web/src/App.jsx:11739-11743`, `:12127-12132`); reimportar o que existe criaria duplicata (`App.jsx:11892-11896`).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Um produto casado com uma variante que a pessoa confirmou | o template é baixado | a linha não vai. |
| Um produto sem variante escolhida | o template é baixado | vai como detalhe novo dentro da mãe escolhida. |
| Um produto sem mãe nenhuma na base | o template é baixado | sai sem o código do insumo e a tela avisa que vai incompleto. |

## Fora do escopo

Criar insumo (mãe) novo no Sienge.

## Implementação

- Hoje: `web/src/App.jsx:11895-11911` (`paraCadastrar`); `faltaNoTemplate` (`web/src/lib/sienge.js:791`); só na tela.
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): nenhuma.
- Fichas que citam: [gerador-codigos-sienge](../funcionalidades/gerador-codigos-sienge.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
