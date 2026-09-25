# RN-088 · A importação só aceita o relatório da tabela ativa

**Status:** vigente
**Contexto:** Configurações · Cadastro de Insumos
**Aprovada por:** Allysson Pereira · **Desde:** 2026-09-23

## Enunciado

O relatório de Insumos do Sienge só é importado quando foi gerado com a tabela de preços ativa,
configurada pelo administrador (hoje "1 - TABELA WS BUILDING"). O código e o nome da tabela
precisam bater. Se só o nome mudou, a importação segue apenas com a confirmação do administrador;
com outro código, ou sem tabela, é recusada. Para importar outra tabela, primeiro se troca a
tabela ativa.

## Por quê

Decisões do item 1 da `docs/ADR-008-cadastro-de-insumos.md`: guardar a tabela do relatório e
"informar qual tabela deve ficar ativa, porque pode ser que o usuário envie outras tabelas no
futuro". Uma só tabela ativa, configurada, conferida por código e nome.

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Tabela ativa "1 - TABELA WS BUILDING" | chega relatório da tabela "1 - TABELA WS BUILDING" | aceito |
| A mesma | chega "1 - tabela ws  building" (caixa ou espaço diferente) | aceito |
| A mesma | chega "1 - TABELA WS BUILDING 2026" | a prévia avisa; grava só com a confirmação do admin |
| A mesma | chega "2 - TABELA OUTRA" | recusado |
| A mesma | o relatório não traz a linha "Tabela" | recusado (fora do modelo) |
| Nenhuma tabela ativa configurada | chega qualquer relatório | recusado |

## Fora do escopo

- O que a tabela de preços muda nos valores: o relatório de Insumos não traz preço.
- Guardar insumos de várias tabelas ao mesmo tempo: decidido que existe uma tabela ativa só.

## Implementação

- Regra: `web/src/regras/cadastroDeInsumos.js` (`conferirTabela`, `tabelaPermiteImportar`)
- Teste: `web/src/regras/cadastroDeInsumos.test.mjs`
- Onde é chamada: `web/api/_lib/rotas/insumoCadastro.js` (prévia e gravação)
- A tabela ativa: `supabase/insumo-cadastro.sql` (`insumo_tabela_ativa`)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Criação, já vigente (decidida item a item na ADR-008) | Allysson Pereira | — |
