-- ============================================================
-- DATA DE ENTREGA E PRAZOS DE COMPRA
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
-- Reaplicavel: rodar de novo nao quebra nada.
-- ============================================================

-- A data em que a obra e entregue ao cliente.
--
-- Nao e cadastro decorativo: e dela que sai, contando pra tras, a data
-- limite de compra de cada grupo da EAP. Moveis soltos levam 75 dias pra
-- chegar; comprados com 40, atrasam a entrega inteira. O alerta de cada
-- grupo do Plano de Compras depende deste campo.
alter table obra_dados add column if not exists data_entrega date;

-- Confere o que entrou:
--   select column_name, data_type from information_schema.columns
--   where table_name = 'obra_dados' and column_name = 'data_entrega';
