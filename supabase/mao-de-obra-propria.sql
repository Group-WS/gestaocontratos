-- ============================================================
-- MÃO DE OBRA PRÓPRIA (Gestão de compras e contratações)
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
-- Reaplicável: rodar de novo não duplica nada.
-- ============================================================
--
-- A equipe interna: a especialidade, a função, a diária e, quando se
-- sabe, o nome da pessoa. A calculadora da "mão de obra a contratar" usa
-- estes valores pra simular quanto custaria fazer com a equipe da casa
-- (pedido de 15/09/2026).

create table if not exists public.prestador_interno (
  id             uuid primary key default gen_random_uuid(),
  nome           text,                 -- em branco vale a função
  especialidade  text not null,        -- Marcenaria, Pintura, Gesseiro, Pedreiro...
  funcao         text not null,        -- Montador, Auxiliar, Pintor, Ajudante...
  diaria         numeric(12,2) not null default 0 check (diaria >= 0),
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  atualizado_por text
);

-- A mesma checagem de administrador dos outros arquivos (compradores.sql,
-- admin-master.sql): vai aqui também pra este arquivo andar sozinho. O
-- conteúdo é idêntico, então rodar em qualquer ordem não troca nada.
create or replace function public.admin_do_time()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from pessoa
     where email = lower(auth.jwt() ->> 'email') and ativo and perfil in ('admin','master')
  )
$$;

alter table public.prestador_interno enable row level security;

-- O time inteiro lê: a calculadora é de todo mundo.
drop policy if exists "time le prestadores" on public.prestador_interno;
create policy "time le prestadores" on public.prestador_interno
  for select to authenticated using (true);

-- Cadastrar, mudar e tirar: administrador (a mesma regra dos compradores).
drop policy if exists "admin cadastra prestador" on public.prestador_interno;
create policy "admin cadastra prestador" on public.prestador_interno
  for insert to authenticated with check (public.admin_do_time());

drop policy if exists "admin muda prestador" on public.prestador_interno;
create policy "admin muda prestador" on public.prestador_interno
  for update to authenticated using (public.admin_do_time()) with check (public.admin_do_time());

drop policy if exists "admin tira prestador" on public.prestador_interno;
create policy "admin tira prestador" on public.prestador_interno
  for delete to authenticated using (public.admin_do_time());

-- A equipe de partida. Só entra com a tabela vazia: rodar de novo não duplica.
insert into public.prestador_interno (especialidade, funcao, diaria)
select v.especialidade, v.funcao, v.diaria
  from (values
    ('Marcenaria', 'Montador', 450.00),
    ('Marcenaria', 'Auxiliar', 385.00),
    ('Pintura',    'Pintor',   450.00),
    ('Pintura',    'Ajudante', 300.00),
    ('Gesseiro',   'Gesseiro', 350.00),
    ('Pedreiro',   'Pedreiro', 300.00)
  ) as v(especialidade, funcao, diaria)
 where not exists (select 1 from public.prestador_interno);

-- Confere o que entrou:
--   select especialidade, funcao, nome, diaria from public.prestador_interno order by especialidade, funcao;
