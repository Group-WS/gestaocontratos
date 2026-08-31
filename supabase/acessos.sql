-- ============================================================
-- ACESSOS POR MODULO E POR OBRA
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
-- Reaplicavel: rodar de novo nao quebra nada.
-- ============================================================

-- Quem pode configurar acesso dos outros.
alter table pessoa add column if not exists admin boolean not null default false;

-- Modulos que a pessoa ve. LISTA VAZIA QUER DIZER TODOS -- e nao
-- "nenhum": senao toda pessoa cadastrada antes desta coluna existir
-- perderia o app inteiro no instante em que a migracao rodasse.
alter table pessoa add column if not exists modulos jsonb not null default '[]'::jsonb;

-- Como as obras sao liberadas:
--   todas  -- ve tudo (coordenacao)
--   minhas -- so' onde ela e' o GC. E' o caso do GC, e a lista se
--             atualiza sozinha quando a obra troca de responsavel
--   lista  -- as escolhidas a dedo, na coluna obras
alter table pessoa add column if not exists obras_regra text not null default 'todas'
  check (obras_regra in ('todas','minhas','lista'));
alter table pessoa add column if not exists obras jsonb not null default '[]'::jsonb;

-- Confere o que entrou:
--   select email, nome, cargo, admin, obras_regra,
--          jsonb_array_length(modulos) as modulos,
--          jsonb_array_length(obras) as obras
--     from pessoa order by nome;
