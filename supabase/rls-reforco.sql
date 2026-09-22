-- ============================================================
-- REFORCO DO ACESSO · varredura de seguranca de 21/09/2026
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
-- Reaplicavel: rodar de novo nao quebra nada.
-- Rode DEPOIS do bloco 5 (pessoa-escrita-restrita.sql, rls-perfis.sql e
-- rls-perfis-complemento.sql) — e de novo SEMPRE que o bloco 5 rodar: ele
-- recria as funcoes e as policies que este arquivo aperta.
-- ============================================================
--
-- O QUE ESTE ARQUIVO FECHA (cada item tem teste em tests/09-reforco.sql)
--
--  1. Apagar obra. As policies de `obra` e `obra_dados` eram `for all` com
--     o perfil so' no `with check` — e o DELETE so' olha o `using`. Quem
--     enxerga a obra (inclusive a Mehoo, que ve todas e nao edita nada)
--     apagava a obra inteira. Viram uma policy por operacao, e sem DELETE:
--     o app nunca apaga obra, e a limpeza roda no SQL Editor, que nao passa
--     pelo RLS.
--  2. O historico. `obra_versao` e' escrita so' pelo gatilho (security
--     definer); quem usa o app so' le. Antes, GC, geral e admin alteravam e
--     apagavam o historico — o que desfaz exatamente a garantia dele.
--     `sienge_solicitacao` (o rastro do que foi pedido) perde o DELETE.
--  3. Aditivo em obra alheia, e autoria de mentira. O `with check` so'
--     conferia o perfil: um GC criava aditivo na obra de outro. E
--     `criado_por`, que decide quem apaga, vinha do navegador e podia ser
--     trocado. Agora a obra e' conferida, e autoria sai do login.
--  4. Arquivos da obra. Qualquer conta logada — ate' quem esta na sala de
--     espera — lia, trocava e apagava os arquivos de TODAS as obras (so' o
--     contrato era protegido). Agora: le quem ve a obra; grava e apaga
--     quem edita a obra.
--  5. Bucket `catalogo`. A policy de leitura nao tinha `to <papel>`, entao
--     valia para anonimo: com a chave publica do bundle, dava pra LISTAR as
--     pastas `pessoas/<e-mail>/` e `ambientes/<obra>/`. As fotos continuam
--     publicas por link (o bucket e' publico), mas listar e gravar passa a
--     ser do time — a foto de perfil, so' na propria pasta.
--  6. Sala de espera lendo o que e' do time: recados, e-mails dos
--     compradores e a tabela de diarias. Agora so' quem tem perfil.
--  7. `sienge_obra`: o app so' marca `status_manual`. As demais colunas
--     (nome, cidade, endereco) deixam de ser alteraveis pelo app.
--  8. Funcoes `security definer`: `search_path` vazio e nomes
--     qualificados, e EXECUTE so' para quem esta logado.
--
-- NAO mexe em regra de negocio: quem ve e quem edita continua o mesmo de
-- docs/SPEC-acessos.md e do rls-perfis.sql. O que muda e' que o banco
-- passa a negar o que a tela ja' nao oferecia.
-- ============================================================

-- ---------- 0. o bloco 5 precisa ter rodado ----------
do $$
begin
  if to_regprocedure('public.minhas_obras()') is null then
    raise exception 'Rode antes o bloco 5 (rls-perfis.sql e rls-perfis-complemento.sql): public.minhas_obras() nao existe.';
  end if;
  if exists (
    select 1 from pg_policy p join pg_class c on c.oid = p.polrelid
     where c.relnamespace = 'public'::regnamespace
       and c.relname in ('obra', 'obra_dados', 'aditivo', 'obra_versao', 'sienge_solicitacao')
       and pg_get_expr(p.polqual, p.polrelid) = 'true'
  ) then
    raise exception 'Ainda ha policy "using (true)" em obra, obra_dados, aditivo, obra_versao ou sienge_solicitacao: rode o bloco 5 antes deste.';
  end if;
end $$;

-- ---------- 8. funcoes: search_path vazio, nomes qualificados ----------
-- Mesmo corpo do rls-perfis.sql e do admin-master.sql; so' a blindagem muda.
create or replace function public.meu_perfil()
returns text
language sql stable security definer set search_path = ''
as $$
  select perfil from public.pessoa
   where email = lower((select auth.jwt()) ->> 'email') and ativo
$$;

create or replace function public.sou_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(public.meu_perfil() in ('admin','master'), false) $$;

create or replace function public.sou_master()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce(public.meu_perfil() = 'master', false) $$;

-- A versao do taylor-made.sql (a mais nova): o GC e a Taylor Made veem a
-- obra em que respondem por QUALQUER dos tres papeis — GC, Taylor Made ou
-- Executivo — e as sem GC. Copiar a do rls-perfis.sql aqui tiraria de
-- vista as obras em que a pessoa e' Taylor ou Executivo.
create or replace function public.minhas_obras()
returns setof text
language sql stable security definer set search_path = ''
as $$
  select o.codigo from public.obra o
   where case public.meu_perfil()
           when 'master' then true
           when 'admin'  then true
           when 'geral'  then true
           when 'gc'     then o.gc is null
                              or lower(o.gc) = lower((select auth.jwt()) ->> 'email')
                              or lower(o.tailor_made) = lower((select auth.jwt()) ->> 'email')
                              or lower(o.responsavel_executivo) = lower((select auth.jwt()) ->> 'email')
           when 'taylor' then o.gc is null
                              or lower(o.gc) = lower((select auth.jwt()) ->> 'email')
                              or lower(o.tailor_made) = lower((select auth.jwt()) ->> 'email')
                              or lower(o.responsavel_executivo) = lower((select auth.jwt()) ->> 'email')
           when 'mehoo'  then true
           else false
         end
$$;

create or replace function public.admin_do_time()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.pessoa
     where email = lower((select auth.jwt()) ->> 'email') and ativo and perfil in ('admin','master')
  )
$$;

create or replace function public.registrar_acesso()
returns void
language sql volatile security definer set search_path = ''
as $$
  update public.pessoa set ultimo_acesso = now()
   where email = lower((select auth.jwt()) ->> 'email');
$$;

create or replace function public.definir_foto(caminho text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if caminho is not null and caminho <> '' and caminho not like 'pessoas/%' then
    raise exception 'caminho de foto inválido: %', caminho;
  end if;
  update public.pessoa
     set foto = nullif(caminho, '')
   where email = lower((select auth.jwt()) ->> 'email');
end;
$$;

-- Quem nao esta logado nao chama nenhuma delas; quem esta, chama.
do $$
declare f text;
begin
  foreach f in array array[
    'public.meu_perfil()', 'public.sou_admin()', 'public.sou_master()', 'public.minhas_obras()',
    'public.admin_do_time()', 'public.registrar_acesso()', 'public.definir_foto(text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ---------- 1. obra e obra_dados: uma policy por operacao, sem DELETE ----------
drop policy if exists "vejo as minhas obras" on public.obra;
drop policy if exists "obra: ler" on public.obra;
drop policy if exists "obra: criar" on public.obra;
drop policy if exists "obra: alterar" on public.obra;
create policy "obra: ler" on public.obra for select to authenticated
  using (codigo in (select public.minhas_obras()));
create policy "obra: criar" on public.obra for insert to authenticated
  with check ((select public.meu_perfil()) in ('master','admin','geral','gc'));
create policy "obra: alterar" on public.obra for update to authenticated
  using (codigo in (select public.minhas_obras()))
  with check ((select public.meu_perfil()) in ('master','admin','geral','gc'));

drop policy if exists "vejo os dados das minhas obras" on public.obra_dados;
drop policy if exists "obra_dados: ler" on public.obra_dados;
drop policy if exists "obra_dados: criar" on public.obra_dados;
drop policy if exists "obra_dados: alterar" on public.obra_dados;
create policy "obra_dados: ler" on public.obra_dados for select to authenticated
  using (obra_codigo in (select public.minhas_obras()));
create policy "obra_dados: criar" on public.obra_dados for insert to authenticated
  with check ((select public.meu_perfil()) in ('master','admin','geral','gc'));
create policy "obra_dados: alterar" on public.obra_dados for update to authenticated
  using (obra_codigo in (select public.minhas_obras()))
  with check ((select public.meu_perfil()) in ('master','admin','geral','gc'));

-- ---------- 2. historico so' se le; o rastro do Sienge nao se apaga ----------
drop policy if exists "escrevo na minha obra" on public.obra_versao;

drop policy if exists "escrevo na minha obra" on public.sienge_solicitacao;
drop policy if exists "sienge_solicitacao: registrar" on public.sienge_solicitacao;
drop policy if exists "sienge_solicitacao: atualizar" on public.sienge_solicitacao;
create policy "sienge_solicitacao: registrar" on public.sienge_solicitacao for insert to authenticated
  with check (obra_codigo in (select public.minhas_obras())
              and (select public.meu_perfil()) in ('master','admin','geral','gc'));
create policy "sienge_solicitacao: atualizar" on public.sienge_solicitacao for update to authenticated
  using (obra_codigo in (select public.minhas_obras())
         and (select public.meu_perfil()) in ('master','admin','geral','gc'))
  with check (obra_codigo in (select public.minhas_obras())
              and (select public.meu_perfil()) in ('master','admin','geral','gc'));

-- ---------- 3. aditivo: so' na propria obra, e autoria pelo login ----------
drop policy if exists "aditivo: criar" on public.aditivo;
create policy "aditivo: criar" on public.aditivo for insert to authenticated
  with check (obra_codigo in (select public.minhas_obras())
              and (select public.meu_perfil()) in ('master','admin','geral','gc'));
drop policy if exists "aditivo: alterar" on public.aditivo;
create policy "aditivo: alterar" on public.aditivo for update to authenticated
  using (obra_codigo in (select public.minhas_obras())
         and (select public.meu_perfil()) in ('master','admin','geral','gc'))
  with check (obra_codigo in (select public.minhas_obras())
              and (select public.meu_perfil()) in ('master','admin','geral','gc'));

-- Quem criou e quem alterou saem do LOGIN, e nao do corpo do pedido
-- (SEG-13). `criado_por` decide quem apaga o aditivo — por isso ele nasce
-- do JWT e nao muda depois. So' vale para o papel do app (authenticated):
-- o SQL Editor e a massa de teste gravam como quiserem.
create or replace function public.aditivo_autoria()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  quem text := lower((select auth.jwt()) ->> 'email');
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      new.criado_por := quem;
    else
      new.criado_por := old.criado_por;
    end if;
    new.atualizado_por := quem;
  end if;
  return new;
end;
$$;
drop trigger if exists aditivo_autoria on public.aditivo;
create trigger aditivo_autoria before insert or update on public.aditivo
  for each row execute function public.aditivo_autoria();

-- ---------- 4. arquivos da obra ----------
-- O caminho e' <codigo da obra>/<chave>/<arquivo>: a primeira pasta e' a
-- obra. Ler: quem ve a obra. Gravar, trocar e apagar: quem edita a obra.
-- O contrato (<obra>/contrato/) continua so' do administrador.
-- Master, admin e geral passam sem depender da linha em `obra` — como na
-- API (web/api/_lib/auth.js); o GC, so' nas obras dele.
drop policy if exists "time le arquivos da obra" on storage.objects;
create policy "time le arquivos da obra" on storage.objects for select to authenticated
  using (
    bucket_id = 'obra-arquivos'
    and ((select public.meu_perfil()) in ('master','admin','geral','mehoo')
         or (storage.foldername(name))[1] in (select public.minhas_obras()))
    and ((storage.foldername(name))[2] is distinct from 'contrato' or public.admin_do_time())
  );

drop policy if exists "time grava arquivos da obra" on storage.objects;
create policy "time grava arquivos da obra" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'obra-arquivos'
    and ((select public.meu_perfil()) in ('master','admin','geral')
         or ((select public.meu_perfil()) = 'gc'
             and (storage.foldername(name))[1] in (select public.minhas_obras())))
    and ((storage.foldername(name))[2] is distinct from 'contrato' or public.admin_do_time())
  );

drop policy if exists "time atualiza arquivos da obra" on storage.objects;
create policy "time atualiza arquivos da obra" on storage.objects for update to authenticated
  using (
    bucket_id = 'obra-arquivos'
    and ((select public.meu_perfil()) in ('master','admin','geral')
         or ((select public.meu_perfil()) = 'gc'
             and (storage.foldername(name))[1] in (select public.minhas_obras())))
    and ((storage.foldername(name))[2] is distinct from 'contrato' or public.admin_do_time())
  )
  with check (
    bucket_id = 'obra-arquivos'
    and ((select public.meu_perfil()) in ('master','admin','geral')
         or ((select public.meu_perfil()) = 'gc'
             and (storage.foldername(name))[1] in (select public.minhas_obras())))
    and ((storage.foldername(name))[2] is distinct from 'contrato' or public.admin_do_time())
  );

drop policy if exists "time apaga arquivos da obra" on storage.objects;
create policy "time apaga arquivos da obra" on storage.objects for delete to authenticated
  using (
    bucket_id = 'obra-arquivos'
    and ((select public.meu_perfil()) in ('master','admin','geral')
         or ((select public.meu_perfil()) = 'gc'
             and (storage.foldername(name))[1] in (select public.minhas_obras())))
    and ((storage.foldername(name))[2] is distinct from 'contrato' or public.admin_do_time())
  );

-- ---------- 5. bucket catalogo ----------
-- As policies do catalogo.sql sao substituidas por estas, com outro nome
-- ("catalogo: ..."), para que rodar o catalogo.sql de novo nao as apague.
-- Rodou o catalogo.sql de novo? Rode este arquivo logo depois: ele volta a
-- remover as antigas.
drop policy if exists "catalogo le" on storage.objects;
drop policy if exists "catalogo escreve" on storage.objects;
drop policy if exists "catalogo troca" on storage.objects;
drop policy if exists "catalogo apaga" on storage.objects;

-- A foto de perfil mora em pessoas/<e-mail com o que nao e' letra, numero,
-- ponto, _ ou - trocado por ->/ — a mesma conta de web/src/lib/pessoas.js.
-- Os renders de ambiente, em ambientes/<obra>/. O resto e' foto de produto.
drop policy if exists "catalogo: time le" on storage.objects;
create policy "catalogo: time le" on storage.objects for select to authenticated
  using (bucket_id = 'catalogo' and (select public.meu_perfil()) is not null);

drop policy if exists "catalogo: grava" on storage.objects;
create policy "catalogo: grava" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'catalogo'
    and (select public.meu_perfil()) is not null
    and case (storage.foldername(name))[1]
          when 'pessoas' then (storage.foldername(name))[2]
               = regexp_replace(lower((select auth.jwt()) ->> 'email'), '[^a-z0-9._-]', '-', 'g')
          when 'ambientes' then (select public.meu_perfil()) in ('master','admin','geral')
               or ((select public.meu_perfil()) = 'gc'
                   and (storage.foldername(name))[2] in (select public.minhas_obras()))
          else (select public.meu_perfil()) in ('master','admin','geral','gc')
        end
  );

drop policy if exists "catalogo: troca" on storage.objects;
create policy "catalogo: troca" on storage.objects for update to authenticated
  using (
    bucket_id = 'catalogo'
    and (select public.meu_perfil()) is not null
    and case (storage.foldername(name))[1]
          when 'pessoas' then (storage.foldername(name))[2]
               = regexp_replace(lower((select auth.jwt()) ->> 'email'), '[^a-z0-9._-]', '-', 'g')
          when 'ambientes' then (select public.meu_perfil()) in ('master','admin','geral')
               or ((select public.meu_perfil()) = 'gc'
                   and (storage.foldername(name))[2] in (select public.minhas_obras()))
          else (select public.meu_perfil()) in ('master','admin','geral','gc')
        end
  )
  with check (
    bucket_id = 'catalogo'
    and (select public.meu_perfil()) is not null
    and case (storage.foldername(name))[1]
          when 'pessoas' then (storage.foldername(name))[2]
               = regexp_replace(lower((select auth.jwt()) ->> 'email'), '[^a-z0-9._-]', '-', 'g')
          when 'ambientes' then (select public.meu_perfil()) in ('master','admin','geral')
               or ((select public.meu_perfil()) = 'gc'
                   and (storage.foldername(name))[2] in (select public.minhas_obras()))
          else (select public.meu_perfil()) in ('master','admin','geral','gc')
        end
  );

drop policy if exists "catalogo: apaga" on storage.objects;
create policy "catalogo: apaga" on storage.objects for delete to authenticated
  using (
    bucket_id = 'catalogo'
    and (select public.meu_perfil()) is not null
    and case (storage.foldername(name))[1]
          when 'pessoas' then (storage.foldername(name))[2]
               = regexp_replace(lower((select auth.jwt()) ->> 'email'), '[^a-z0-9._-]', '-', 'g')
          when 'ambientes' then (select public.meu_perfil()) in ('master','admin','geral')
               or ((select public.meu_perfil()) = 'gc'
                   and (storage.foldername(name))[2] in (select public.minhas_obras()))
          else (select public.meu_perfil()) in ('master','admin','geral','gc')
        end
  );

-- PENDENTE (medir antes de apertar): limite de tamanho e tipos do bucket.
-- Entram fotos de produto, imagens tiradas de PPTX e renders de ambiente;
-- restringir sem medir recusaria upload legitimo. Para medir:
--   select metadata ->> 'mimetype' as tipo, count(*),
--          pg_size_pretty(max((metadata ->> 'size')::bigint)) as maior
--     from storage.objects where bucket_id = 'catalogo' group by 1 order by 2 desc;

-- ---------- 6. o que e' do time, so' para quem tem perfil ----------
drop policy if exists "leitura do time" on public.obra_comentario;
create policy "leitura do time" on public.obra_comentario for select to authenticated
  using ((select public.meu_perfil()) is not null);
drop policy if exists "comentar em nome proprio" on public.obra_comentario;
create policy "comentar em nome proprio" on public.obra_comentario for insert to authenticated
  with check (autor = lower((select auth.jwt()) ->> 'email')
              and (select public.meu_perfil()) is not null);

drop policy if exists "time le compradores" on public.comprador_grupo;
create policy "time le compradores" on public.comprador_grupo for select to authenticated
  using ((select public.meu_perfil()) is not null);

drop policy if exists "time le prestadores" on public.prestador_interno;
create policy "time le prestadores" on public.prestador_interno for select to authenticated
  using ((select public.meu_perfil()) is not null);

-- ---------- 7. sienge_obra: o app so' marca o status ----------
revoke insert, update, delete on public.sienge_obra from anon, authenticated;
grant update (status_manual) on public.sienge_obra to authenticated;

-- Confere DEPOIS de rodar:
--   -- nenhuma policy de DELETE em obra, obra_dados, obra_versao, sienge_solicitacao:
--   select c.relname, p.polname from pg_policy p join pg_class c on c.oid = p.polrelid
--    where c.relname in ('obra','obra_dados','obra_versao','sienge_solicitacao')
--      and p.polcmd in ('d', '*');
--   -- nenhuma policy de storage sem papel:
--   select policyname, roles from pg_policies where schemaname = 'storage' and 'public' = any(roles);
