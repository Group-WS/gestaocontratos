# RN-087 · Insumo pedido ao Sienge não se apaga

**Status:** vigente
**Contexto:** Configurações · Cadastro de Insumos · Solicitação de compra no Sienge
**Aprovada por:** Allysson Pereira · **Desde:** 2026-09-23

## Enunciado

Um insumo do cadastro não pode ser apagado quando já foi pedido ao Sienge: quando alguma
solicitação de compra **concluída** ou **parcial** tem um item com o **mesmo código** e o **mesmo
texto** desse insumo. Vale para o apagar da tela, que mostra onde ele foi pedido, e para o caminho
"apagar" da importação, que o mantém e lista. Os outros registros do mesmo código, com outro texto,
continuam apagáveis.

## Por quê

Decisão do item 5 da `docs/ADR-008-cadastro-de-insumos.md` ("tem que garantir que nenhum lugar vai
estar utilizando"), detalhada em 23/09/2026: conta só a solicitação enviada ao Sienge; bloqueia só o
registro com o mesmo texto; contam só as solicitações concluídas e parciais — enviando, falhou e
abandonada não deixaram nada certo no Sienge.

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Insumo 406 "CADEIRA EIFFEL", pedido numa solicitação concluída | alguém tenta apagar na tela | recusado, e a tela mostra a obra e a solicitação |
| O mesmo insumo | a importação no caminho "apagar" não o traz | fica, e a prévia lista |
| Insumo 406 "CADEIRA PAULISTANO", nunca pedido | alguém apaga | apagado |
| Insumo pedido numa solicitação parcial | alguém tenta apagar | recusado |
| Insumo pedido só numa solicitação que falhou ou foi abandonada | alguém apaga | apagado |
| Insumo com um espaço a mais no texto do que foi pedido | alguém apaga | apagado (é outro texto) |

## Fora do escopo

- Desativar o insumo (Ativo = Não): sempre permitido, é o caminho para tirá-lo de circulação.
- Produto de obra associado ao insumo e preço na base de preços: não contam como uso.

## Implementação

- Regra: `web/src/regras/cadastroDeInsumos.js` (`STATUS_QUE_CONTAM_COMO_ENVIADA`, `itensEnviadosAoSienge`, `usosDoInsumo`, `podeApagarInsumo`)
- Teste: `web/src/regras/cadastroDeInsumos.test.mjs`
- Garantia no banco: `supabase/insumo-cadastro.sql` (função `insumo_em_uso` e gatilho `insumo_cadastro_rn_087`)
- Onde é chamada: `web/api/_lib/rotas/insumoCadastro.js` e `web/src/lib/relatorioDeInsumos.js` (plano da importação)
- Teste do banco: `supabase/tests/17-insumo-cadastro.sql`

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Criação, já vigente (decidida item a item na ADR-008) | Allysson Pereira | — |
