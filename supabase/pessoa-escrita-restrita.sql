-- ============================================================
-- PESSOA: LEITURA PRA TODOS, ESCRITA SO' PRO ADMIN MASTER
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
-- Reaplicavel: rodar de novo nao quebra nada.
-- Rode DEPOIS de admin-master.sql (e' de la' que vem admin_do_time()).
-- ============================================================
--
-- O QUE ISTO CONSERTA
--
-- A politica que vinha do equipe.sql dizia `for all to authenticated
-- using (true) with check (true)`: qualquer pessoa logada podia ESCREVER
-- na tabela pessoa. Pelo console do navegador, em uma linha:
--
--     update pessoa set perfil = 'master' where email = '<o meu>';
--
-- e a partir dai ela enxerga e muda tudo. Nao era um risco teorico: e' a
-- escalada de privilegio mais curta que existe no sistema.
--
-- Este arquivo e' o pedaco de rls-perfis.sql que NAO pode esperar. A
-- leitura continua ampla de proposito — a tela da Equipe mostra a lista
-- inteira, e quem restringe isso e' o rls-perfis.sql, no seu tempo. O que
-- muda aqui e' so' quem ESCREVE.

-- Guarda de seguranca: sem ninguem com perfil 'master', esta politica
-- trancaria a administracao da Equipe pra todo mundo, inclusive pra quem
-- rodou o script. Melhor parar aqui e avisar do que deixar o time de fora.
do $$
begin
  if not exists (select 1 from pessoa where perfil = 'master' and ativo) then
    raise exception using
      message = 'Nao ha nenhuma pessoa ativa com perfil master.',
      hint = 'Rode admin-master.sql, defina o seu acesso como Admin master na tela da Equipe, e rode este arquivo de novo. Sem isso, ninguem conseguiria mais editar a Equipe.';
  end if;
end $$;

-- A funcao que decide. Mesma de rls-perfis.sql; repetida aqui porque este
-- arquivo roda antes dele.
create or replace function public.sou_master()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select perfil from pessoa where email = lower(auth.jwt() ->> 'email') and ativo) = 'master',
    false
  )
$$;

drop policy if exists "acesso time (autenticados)" on pessoa;
drop policy if exists "time le todos"              on pessoa;
drop policy if exists "master escreve todas"       on pessoa;

-- Ler: quem esta logado. (O recorte por perfil vem no rls-perfis.sql.)
create policy "time le todos" on pessoa
  for select to authenticated
  using (true);

-- Escrever: so' o admin master. Ninguem edita a propria linha — e' isso
-- que impede a autopromocao.
create policy "master escreve todas" on pessoa
  for all to authenticated
  using (public.sou_master())
  with check (public.sou_master());

-- Confere o que entrou:
--   select polname, polcmd, pg_get_expr(polqual, polrelid) as usando
--     from pg_policy where polrelid = 'pessoa'::regclass;
-- E o teste que importa, logado como alguem que NAO e' master:
--   update pessoa set perfil = 'master' where email = '<o meu>';   -- 0 linhas
