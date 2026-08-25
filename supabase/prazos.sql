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

-- Prazos preenchidos a mao, pros grupos que nao tem regra fixa.
--
-- Formato: { "28": 45, "AUTOMAÇÃO": 30 } — a chave e o numero canonico da
-- verba quando ela esta na EAP padrao, e o nome do grupo quando nao esta.
-- O valor e quantos DIAS antes da entrega aquele grupo precisa estar
-- comprado; dia de antecedencia sobrevive a mudanca da data de entrega,
-- data digitada nao.
alter table obra_dados add column if not exists prazos_compra jsonb not null default '{}'::jsonb;

-- Confere o que entrou:
--   select column_name, data_type from information_schema.columns
--   where table_name = 'obra_dados' and column_name in ('data_entrega','prazos_compra');
