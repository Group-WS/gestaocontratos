# RN-089 · Insumo em "vb" não entra no cadastro

**Status:** vigente
**Contexto:** Configurações · Cadastro de Insumos
**Aprovada por:** Allysson Pereira · **Desde:** 2026-09-23

## Enunciado

Linha do relatório de Insumos com unidade "vb" (valor fechado, verba: taxas, alvará, IPTU,
consulta de viabilidade) não entra no Cadastro de Insumos. A importação conta quantas ficaram de
fora e mostra na prévia.

## Por quê

Decisão do item 3 da `docs/ADR-008-cadastro-de-insumos.md`. No relatório de 09/2026 são 568 linhas
em "vb", de 135 códigos, que não são produto de compra.

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| "IPTU", unidade vb | importa | fica de fora, contado na prévia |
| "ALVARÁ DE CONSTRUÇÃO", unidade "VB " | importa | fica de fora (caixa e espaço não importam) |
| "CADEIRA", unidade un | importa | entra |
| "PISO", unidade m2 | importa | entra |
| Unidade "vbx" | importa | entra (não é vb) |

## Fora do escopo

- Criar à mão um insumo em "vb" pela tela: não é barrado por esta regra.
- A base de preços (Banco de Preços), que tem a própria regra para "vb".

## Implementação

- Regra: `web/src/regras/cadastroDeInsumos.js` (`unidadeEmVb`, `entraNoCadastro`)
- Teste: `web/src/regras/cadastroDeInsumos.test.mjs`
- Onde é chamada: `web/src/lib/relatorioDeInsumos.js` (leitura do relatório, na API)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Criação, já vigente (decidida item a item na ADR-008) | Allysson Pereira | — |
