# RN-045 · Alocação corrigida vira o padrão da empresa

**Status:** proposta
**Contexto:** Plano de Compras
**Aprovada por:** a confirmar · **Desde:** a confirmar

## Enunciado

Corrigir a alocação (material, mão de obra ou os dois) de um item vale para a obra e também vira o padrão da empresa para aquela descrição: toda obra com a mesma descrição passa a nascer com a mesma alocação.

## Por quê

Comentário em `definirAlocacao`: "Anotação de responsabilidade técnica - RRT é mão de obra em toda obra que a casa faz. Corrigir isso obra a obra é refazer a mesma decisão pra sempre."

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| "Caçambas de entulho" marcado como MAT na obra A | o GC corrige para MO | a obra A muda e a tabela `alocacao_padrao` guarda MO para essa descrição. |
| A obra B com a mesma descrição | ela é aberta | o item já aparece como MO. |
| A correção feita | o banco recusa gravar o padrão | a obra fica corrigida e a tela avisa que não virou padrão. |

## Fora do escopo

A liberação automática ao passar de MO para MAT (é a exceção da RN-001).

## Implementação

- Hoje: `web/src/App.jsx:23339` (`definirAlocacao`), `web/src/lib/alocacaoPadrao.js:77`, `web/api/_lib/rotas/cadastros.js:76`; no banco, `alocacao_padrao` aceita escrita só de master, admin, geral e GC (`supabase/rls-perfis.sql:150`).
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): parcial — ver "Hoje" acima.
- Fichas que citam: [plano-de-compras](../funcionalidades/plano-de-compras.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
