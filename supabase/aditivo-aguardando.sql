-- ============================================================
-- ADITIVO: fase "Aguardando cliente"
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
-- Reaplicavel: rodar de novo nao quebra nada.
--
-- O QUE MUDA: so' a lista de valores aceitos na coluna `status`.
-- Nenhum aditivo e' alterado, nenhum dado e' apagado.
--
-- POR QUE PRECISA: a tabela nasceu com uma trava que so' aceitava
-- 'rascunho', 'aprovado' e 'reprovado'. Sem rodar isto, clicar em
-- "Aguardando cliente" no app volta erro do banco e o status nao grava.
--
-- A fase entra ENTRE rascunho e aprovado: e' o aditivo que ja foi
-- enviado ao cliente e espera resposta. Ela NAO mexe no dinheiro —
-- so' o aprovado conta no Dashboard, no CMV e no Plano de Compras.
-- ============================================================

alter table aditivo drop constraint if exists aditivo_status_check;

alter table aditivo add constraint aditivo_status_check
  check (status in ('rascunho','aguardando','aprovado','reprovado'));

-- Confere o que entrou (tem que aparecer 'aguardando' na regra):
--   select pg_get_constraintdef(oid) as regra
--     from pg_constraint
--    where conrelid = 'aditivo'::regclass and conname = 'aditivo_status_check';
--
-- E os aditivos como estao hoje:
--   select obra_codigo, numero, status, descricao from aditivo order by obra_codigo, seq;
