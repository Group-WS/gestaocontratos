# RN-068 · Só o criador ou o administrador exclui o aditivo

**Status:** proposta
**Contexto:** Aditivos
**Aprovada por:** a confirmar · **Desde:** 2026-09-17

## Enunciado

Só quem criou o aditivo, ou um administrador (Administrador ou Admin master), pode excluí-lo. Aditivo sem criador registrado só o administrador exclui.

## Por quê

Pedido da Priscila em 17/09/2026: "só pode excluir o aditivo o criador do aditivo ou um administrador" (`supabase/aditivo-exclusao.sql:5-6`); aditivo é documento que vai para o cliente e mexe no dinheiro, e excluir não tem desfazer (`web/src/App.jsx:3163-3171`).

## Exemplos

| Dado | Quando | Então |
|---|---|---|
| Um GC na obra dele | tenta excluir um aditivo que outra pessoa criou | é recusado. |
| O GC que criou o aditivo | exclui | o aditivo sai (e uma cópia fica no histórico). |
| Um Administrador | exclui qualquer aditivo de uma obra que enxerga | é permitido. |
| Um aditivo antigo sem criador | um Geral tenta excluir | é recusado. |

## Fora do escopo

Excluir aditivo aprovado (hoje permitido ao criador — ver risco na ficha); histórico (`aditivo_versao`).

## Implementação

- Hoje: Tela `web/src/App.jsx:3173` (`podeExcluirAditivo`) e `:18711`; servidor devolve 403 quando o banco recusa (`web/api/_lib/rotas/aditivos.js:121-130`); banco `supabase/rls-perfis.sql:133-139` (policy "aditivo: excluir (criador ou admin)").
- Regra: ainda não está na camada de regras (`web/src/regras`) nem tem teste.
- Teste: nenhum.
- Garantia no banco (se houver): parcial — ver "Hoje" acima.
- Fichas que citam: [aditivo-e-apresentacao](../funcionalidades/aditivo-e-apresentacao.md)

## Histórico

| Data | Mudança | Aprovada por | PR |
|---|---|---|---|
| 2026-09-23 | Ficha criada como proposta a partir da documentação do sistema | a confirmar | — |
