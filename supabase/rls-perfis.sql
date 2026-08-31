-- ============================================================
-- RLS POR PERFIL  ·  ESCRITO, DESLIGADO
-- ============================================================
--
-- NAO RODE ISTO AINDA.
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
as $$ select coalesce(public.meu_perfil() = 'admin', false) $$;

-- As obras que EU enxergo, pelo meu perfil.
create or replace function public.minhas_obras()
returns setof text
language sql stable security definer set search_path = public
as $$
  select o.codigo from obra o
   where case public.meu_perfil()
           when 'admin' then true
           when 'geral' then true
           -- o GC ve as dele, e as que ainda nao tem dono
           when 'gc'    then o.gc is null or lower(o.gc) = lower(auth.jwt() ->> 'email')
           -- a Mehoo ve o que tem item do canal dela
           when 'mehoo' then exists (
             select 1 from obra_dados d,
                  jsonb_array_elements(d.categorias) c,
                  jsonb_array_elements(c -> 'itens') i
              where d.obra_codigo = o.codigo and i ->> 'canalCompra' = 'mehoo')
           else false
         end
$$;

-- ---------- pessoa ----------
-- Todo mundo le a propria linha (e' o que decide se entra). Admin le e
-- escreve todas. Ninguem mais escreve nada -- inclusive a propria linha:
-- senao qualquer um se promoveria a admin.
drop policy if exists "acesso time (autenticados)" on pessoa;
drop policy if exists "leio a minha linha"  on pessoa;
drop policy if exists "admin le todas"      on pessoa;
drop policy if exists "admin escreve todas" on pessoa;

create policy "leio a minha linha" on pessoa for select to authenticated
  using (email = lower(auth.jwt() ->> 'email'));
create policy "admin le todas" on pessoa for select to authenticated
  using (public.sou_admin());
create policy "admin escreve todas" on pessoa for all to authenticated
  using (public.sou_admin()) with check (public.sou_admin());

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
  with check (public.meu_perfil() in ('admin','geral','gc'));

drop policy if exists "acesso time (autenticados)" on obra_dados;
drop policy if exists "vejo os dados das minhas obras" on obra_dados;
create policy "vejo os dados das minhas obras" on obra_dados for all to authenticated
  using (obra_codigo in (select public.minhas_obras()))
  with check (public.meu_perfil() in ('admin','geral','gc'));

-- ---------- aditivo ----------
drop policy if exists "acesso time (autenticados)" on aditivo;
drop policy if exists "aditivo das minhas obras" on aditivo;
create policy "aditivo das minhas obras" on aditivo for all to authenticated
  using (obra_codigo in (select public.minhas_obras())
         and public.meu_perfil() in ('admin','geral','gc'))
  with check (public.meu_perfil() in ('admin','geral','gc'));

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
    execute format('create policy "escrevo referencia" on %I for all to authenticated using (public.meu_perfil() in (''admin'',''geral'',''gc'')) with check (public.meu_perfil() in (''admin'',''geral'',''gc''))', t);
  end loop;
end $$;

-- Confere DEPOIS de rodar, com a sua propria conta:
--   select public.meu_perfil(), public.sou_admin();
--   select count(*) from obra;        -- deve bater com o que a tela mostra
--   select count(*) from obra_dados;
