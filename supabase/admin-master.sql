-- ============================================================
-- ADMIN MASTER
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
-- Reaplicavel: rodar de novo nao quebra nada. NAO muda o perfil de
-- ninguem: so' ensina o banco que o perfil 'master' existe.
-- ============================================================
--
-- O admin master e' quem cuida da Equipe e dos acessos (pedido de
-- 15/09/2026): tem tudo do Administrador e mais isso. O Administrador
-- continua com o resto (contrato da obra, compradores), sem a Equipe.
--
-- Depois de rodar, no app: Equipe -> a sua linha -> acesso -> Admin
-- master -> Salvar acesso. A partir dai so' o admin master ve a Equipe.

-- 1. O banco passa a aceitar o perfil.
alter table pessoa drop constraint if exists pessoa_perfil_check;
alter table pessoa add constraint pessoa_perfil_check
  check (perfil is null or perfil in ('master','admin','geral','gc','mehoo'));

-- 2. O admin master continua abrindo o contrato da obra e trocando o
-- comprador de cada grupo, como o Administrador. E' a mesma funcao do
-- contrato-restrito.sql e do compradores.sql, agora com o master.
create or replace function public.admin_do_time()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from pessoa
     where email = lower(auth.jwt() ->> 'email') and ativo and perfil in ('admin','master')
  )
$$;

-- Confere o que entrou:
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'pessoa_perfil_check';
--   select email, nome, perfil from pessoa where perfil in ('master','admin') order by perfil, nome;
