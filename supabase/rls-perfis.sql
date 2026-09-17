-- ============================================================
-- RLS POR PERFIL  ·  ESCRITO, DESLIGADO
-- ============================================================
--
-- NAO RODE ISTO AINDA.
--
-- E so' depois de existir um admin master (supabase/admin-master.sql e o
-- perfil dado no app): aqui so' o master escreve na tabela pessoa.
--
-- Enquanto os perfis nao estiverem atribuidos e conferidos, ligar estas
-- politicas tranca TODO MUNDO ao mesmo tempo -- inclusive quem
-- resolveria. Ver docs/ADR-001-perfis-de-acesso.md, decisao 7.
--
-- A ordem certa e':
--   1. rodar supabase/perfis.sql
--   2. cadastrar a equipe e dar perfil a cada um
--   3. conferir na tela quem esta vendo o que
--   4. so' entao rodar isto, com alguem acompanhando
--
-- Ate la o acesso e' filtro de tela: o banco continua servindo tudo pra
-- quem esta logado. Esta e' a janela conhecida, e ela tem fim.
-- ============================================================

-- Quem sou eu, na tabela pessoa. `security definer` porque a propria
-- politica de `pessoa` vai chamar isto: sem ele, a funcao cairia na
-- politica que ela mesma ajuda a decidir e entraria em recursao.
create or replace function public.meu_perfil()
returns text
language sql stable security definer set search_path = public
as $$
  select perfil from pessoa
   where email = lower(auth.jwt() ->> 'email') and ativo
$$;

create or replace function public.sou_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.meu_perfil() in ('admin','master'), false) $$;

-- Equipe e acessos: so' o admin master escreve na tabela pessoa (15/09/2026).
create or replace function public.sou_master()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.meu_perfil() = 'master', false) $$;

-- As obras que EU enxergo, pelo meu perfil.
create or replace function public.minhas_obras()
returns setof text
language sql stable security definer set search_path = public
as $$
  select o.codigo from obra o
   where case public.meu_perfil()
           when 'master' then true
           when 'admin' then true
           when 'geral' then true
           -- o GC ve as dele, e as que ainda nao tem dono
           when 'gc'    then o.gc is null or lower(o.gc) = lower(auth.jwt() ->> 'email')
           -- a Mehoo ve todas, dentro do painel dela (decisao de 14/09/2026;
           -- antes eram so' as obras com item do canal)
           when 'mehoo' then true
           else false
         end
$$;

-- ---------- pessoa ----------
-- Todo mundo le a propria linha (e' o que decide se entra). Administrador
-- e admin master leem todas; escrever, so' o admin master (a Equipe e os
-- acessos sao dele). Ninguem mais escreve nada -- inclusive a propria
-- linha: senao qualquer um se promoveria.
drop policy if exists "acesso time (autenticados)" on pessoa;
drop policy if exists "leio a minha linha"  on pessoa;
drop policy if exists "admin le todas"      on pessoa;
drop policy if exists "admin escreve todas" on pessoa;
drop policy if exists "master escreve todas" on pessoa;

create policy "leio a minha linha" on pessoa for select to authenticated
  using (email = lower(auth.jwt() ->> 'email'));
create policy "admin le todas" on pessoa for select to authenticated
  using (public.sou_admin());
create policy "master escreve todas" on pessoa for all to authenticated
  using (public.sou_master()) with check (public.sou_master());

-- A linha que nasce no primeiro login: a pessoa pode se inserir, mas so'
-- com perfil NULO. E' o que permite entrar na fila sem poder se liberar.
drop policy if exists "entro na fila" on pessoa;
create policy "entro na fila" on pessoa for insert to authenticated
  with check (email = lower(auth.jwt() ->> 'email') and perfil is null);

-- ---------- obra e obra_dados ----------
drop policy if exists "acesso time (autenticados)" on obra;
drop policy if exists "vejo as minhas obras" on obra;
create policy "vejo as minhas obras" on obra for all to authenticated
  using (codigo in (select public.minhas_obras()))
  with check (public.meu_perfil() in ('master','admin','geral','gc'));

drop policy if exists "acesso time (autenticados)" on obra_dados;
drop policy if exists "vejo os dados das minhas obras" on obra_dados;
create policy "vejo os dados das minhas obras" on obra_dados for all to authenticated
  using (obra_codigo in (select public.minhas_obras()))
  with check (public.meu_perfil() in ('master','admin','geral','gc'));

-- ---------- aditivo ----------
-- Separado por acao por causa da regra de EXCLUSAO (pedido dela,
-- 17/09/2026): so' o criador do aditivo ou um administrador apaga. Se este
-- arquivo voltasse a criar uma politica "for all", ele reabriria a exclusao
-- pra todo mundo — ver supabase/aditivo-exclusao.sql.
drop policy if exists "acesso time (autenticados)" on aditivo;
drop policy if exists "aditivo das minhas obras" on aditivo;
drop policy if exists "aditivo: ler" on aditivo;
drop policy if exists "aditivo: criar" on aditivo;
drop policy if exists "aditivo: alterar" on aditivo;
drop policy if exists "aditivo: excluir (criador ou admin)" on aditivo;
create policy "aditivo: ler" on aditivo for select to authenticated
  using (obra_codigo in (select public.minhas_obras())
         and public.meu_perfil() in ('master','admin','geral','gc'));
create policy "aditivo: criar" on aditivo for insert to authenticated
  with check (public.meu_perfil() in ('master','admin','geral','gc'));
create policy "aditivo: alterar" on aditivo for update to authenticated
  using (obra_codigo in (select public.minhas_obras())
         and public.meu_perfil() in ('master','admin','geral','gc'))
  with check (public.meu_perfil() in ('master','admin','geral','gc'));
create policy "aditivo: excluir (criador ou admin)" on aditivo for delete to authenticated
  using (
    obra_codigo in (select public.minhas_obras())
    and (
      (criado_por is not null and lower(criado_por) = lower(auth.jwt() ->> 'email'))
      or public.meu_perfil() in ('master','admin')
    )
  );

-- ---------- tabelas de referencia ----------
-- Insumo, EAP e alocacao padrao nao sao de obra nenhuma: quem entrou, le.
-- Escrever, so' quem edita.
do $$
declare t text;
begin
  foreach t in array array['insumo_preco','eap_grupo','alocacao_padrao'] loop
    execute format('drop policy if exists "acesso time (autenticados)" on %I', t);
    execute format('drop policy if exists "leio referencia" on %I', t);
    execute format('drop policy if exists "escrevo referencia" on %I', t);
    execute format('create policy "leio referencia" on %I for select to authenticated using (public.meu_perfil() is not null)', t);
    execute format('create policy "escrevo referencia" on %I for all to authenticated using (public.meu_perfil() in (''master'',''admin'',''geral'',''gc'')) with check (public.meu_perfil() in (''master'',''admin'',''geral'',''gc''))', t);
  end loop;
end $$;

-- Confere DEPOIS de rodar, com a sua propria conta:
--   select public.meu_perfil(), public.sou_admin(), public.sou_master();
--   select count(*) from obra;        -- deve bater com o que a tela mostra
--   select count(*) from obra_dados;
