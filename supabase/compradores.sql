-- Compradores por grupo de compra (Gestão de compras e contratações).
--
-- Rode UMA vez no SQL Editor do Supabase. Pode rodar de novo sem medo:
-- tudo aqui é "se não existir" ou recria o que já existe igual.
--
-- Cada grupo de compra é um grupo da EAP, guardado pelo NOME. A numeração
-- da EAP já mudou uma vez (o 07 virou Preventivo de Incêndio) e obra antiga
-- guarda número velho; o nome é o que sobrevive às duas numerações.
-- Um comprador por grupo.

create table if not exists public.comprador_grupo (
  grupo           text primary key,   -- nome do grupo da EAP (eap_grupo.nome)
  comprador_email text not null,
  comprador_nome  text,
  atualizado_em   timestamptz not null default now(),
  atualizado_por  text
);

-- A mesma checagem de administrador do contrato-restrito.sql. Vai aqui
-- também porque aquele arquivo pode ainda não ter sido rodado; o conteúdo
-- é idêntico, então rodar os dois não troca nada.
create or replace function public.admin_do_time()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from pessoa
     where email = lower(auth.jwt() ->> 'email') and ativo and perfil = 'admin'
  )
$$;

alter table public.comprador_grupo enable row level security;

-- O time inteiro enxerga quem compra o quê: o painel filtra por comprador.
drop policy if exists "time le compradores" on public.comprador_grupo;
create policy "time le compradores" on public.comprador_grupo
  for select to authenticated using (true);

-- Só administrador atribui, troca ou tira comprador.
drop policy if exists "admin atribui comprador" on public.comprador_grupo;
create policy "admin atribui comprador" on public.comprador_grupo
  for insert to authenticated with check (public.admin_do_time());

drop policy if exists "admin troca comprador" on public.comprador_grupo;
create policy "admin troca comprador" on public.comprador_grupo
  for update to authenticated using (public.admin_do_time()) with check (public.admin_do_time());

drop policy if exists "admin tira comprador" on public.comprador_grupo;
create policy "admin tira comprador" on public.comprador_grupo
  for delete to authenticated using (public.admin_do_time());
