-- ============================================================
-- CONTRATO DA OBRA — SO' ADMINISTRADOR ABRE
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
-- Reaplicavel: rodar de novo nao quebra nada.
-- Pre-requisito: supabase/arquivos.sql e supabase/perfis.sql ja rodados.
-- ============================================================

-- O contrato mora no mesmo deposito dos outros arquivos da obra, na
-- pasta <codigo da obra>/contrato/. A tela ja esconde o arquivo de quem
-- nao e' administrador; isto aqui fecha a porta no proprio banco. Sem
-- isto, quem descobrisse o caminho ainda conseguiria baixar.
--
-- Administrador = pessoa com perfil 'admin' ou 'master' e ativa — a mesma regra da
-- tela. `security definer` pra funcionar igual quando as politicas de
-- perfil da tabela pessoa (rls-perfis.sql) forem ligadas.
--
-- ATENCAO: o arquivos.sql recria estas quatro politicas SEM a restricao.
-- Se ele for rodado de novo, rode este aqui logo depois.

create or replace function public.admin_do_time()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from pessoa
     where email = lower(auth.jwt() ->> 'email') and ativo and perfil in ('admin','master')
  )
$$;

drop policy if exists "time le arquivos da obra" on storage.objects;
create policy "time le arquivos da obra" on storage.objects
  for select to authenticated using (
    bucket_id = 'obra-arquivos'
    and ((storage.foldername(name))[2] is distinct from 'contrato' or public.admin_do_time())
  );

drop policy if exists "time grava arquivos da obra" on storage.objects;
create policy "time grava arquivos da obra" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'obra-arquivos'
    and ((storage.foldername(name))[2] is distinct from 'contrato' or public.admin_do_time())
  );

drop policy if exists "time atualiza arquivos da obra" on storage.objects;
create policy "time atualiza arquivos da obra" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'obra-arquivos'
    and ((storage.foldername(name))[2] is distinct from 'contrato' or public.admin_do_time())
  )
  with check (
    bucket_id = 'obra-arquivos'
    and ((storage.foldername(name))[2] is distinct from 'contrato' or public.admin_do_time())
  );

drop policy if exists "time apaga arquivos da obra" on storage.objects;
create policy "time apaga arquivos da obra" on storage.objects
  for delete to authenticated using (
    bucket_id = 'obra-arquivos'
    and ((storage.foldername(name))[2] is distinct from 'contrato' or public.admin_do_time())
  );

-- Confere o que entrou (logado como admin deve dar true):
--   select public.admin_do_time();
--   select policyname from pg_policies where tablename = 'objects' and policyname like 'time %';
