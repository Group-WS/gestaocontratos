-- ============================================================
-- ARQUIVOS AVULSOS DA OBRA
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
-- Reaplicavel: rodar de novo nao quebra nada.
-- ============================================================

-- Os cadernos do Executivo tem lugar fixo (uma chave cada) porque sao
-- sempre os mesmos quatro. Isto aqui e' o resto: contrato assinado, ART,
-- foto de medicao, memorial — coisa que a obra junta e nao cabe num
-- campo com nome proprio.
--
-- Lista, e nao mapa: aqui a mesma obra tem N arquivos do mesmo tipo, e
-- uma chave por arquivo obrigaria a inventar nome pra cada um.
alter table obra_dados add column if not exists arquivos jsonb not null default '[]'::jsonb;

-- Confere o que entrou:
--   select obra_codigo, jsonb_array_length(arquivos) as avulsos from obra_dados;
