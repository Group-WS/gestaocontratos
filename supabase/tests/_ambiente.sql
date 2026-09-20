-- ============================================================
-- O MINIMO DO SUPABASE, NUM POSTGRES PURO
-- So' pra testes. Nunca rode isto no banco de verdade.
-- ============================================================
--
-- Os scripts desta pasta foram escritos pro Supabase, que traz de fabrica
-- os papeis `anon` e `authenticated`, o schema `auth` e o `storage`. Num
-- Postgres de teste nada disso existe, e o primeiro `create policy ... to
-- authenticated` ja' cai. Este arquivo cria o que falta, do jeito mais
-- parecido possivel com o original:
--
--   auth.jwt() le as claims de `request.jwt.claims`, exatamente como no
--   Supabase. E' isso que deixa um teste trocar de identidade com
--   `set local request.jwt.claims = '{"email": "..."}'`.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

create schema if not exists auth;
create schema if not exists storage;

create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb
$$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;

create table if not exists storage.buckets (
  id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid default gen_random_uuid() primary key,
  bucket_id text, name text, owner uuid, metadata jsonb
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$ select string_to_array(name, '/') $$;

grant usage on schema public, auth, storage to anon, authenticated;
grant all on storage.objects, storage.buckets to anon, authenticated;
alter default privileges in schema public grant all on tables    to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;

create extension if not exists pgtap;
