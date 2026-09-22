-- ============================================================
-- PREFERENCIA DA PESSOA — o que a tela lembra de cada um
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
-- Reaplicavel: rodar de novo nao quebra nada.
-- Bloco 3 do README (so' depende de auth.jwt()).
-- ============================================================
--
-- "So' as minhas obras", a lista de obras por numero ou por squad, os
-- squads e os grupos da Equipe dobrados. Ate' 21/09/2026 isso morava no
-- localStorage: trocar de computador (ou limpar o navegador) desfazia tudo,
-- e o padrao Group WS pede preferencia no banco (NAV-02). O navegador
-- guarda so' uma copia, pra abrir sem piscar (web/src/lib/armazenamento.js).
--
-- A identidade e' o e-mail do login, como no resto do banco (pessoa,
-- meu_perfil). Cada um le e grava so' as proprias linhas. Quem grava e' a
-- API (web/api/_lib/rotas/preferencias.js), que confere a chave e o valor.

create table if not exists public.preferencia (
  email         text not null check (char_length(email) between 3 and 320),
  chave         text not null check (chave ~ '^[a-z][a-z_.]{0,59}$'),
  valor         jsonb not null check (octet_length(valor::text) <= 4096),
  atualizado_em timestamptz not null default now(),
  primary key (email, chave)
);

alter table public.preferencia enable row level security;

drop policy if exists "preferencia: leio as minhas" on public.preferencia;
create policy "preferencia: leio as minhas" on public.preferencia for select to authenticated
  using (email = lower((select auth.jwt()) ->> 'email'));

drop policy if exists "preferencia: gravo as minhas" on public.preferencia;
create policy "preferencia: gravo as minhas" on public.preferencia for insert to authenticated
  with check (email = lower((select auth.jwt()) ->> 'email'));

drop policy if exists "preferencia: troco as minhas" on public.preferencia;
create policy "preferencia: troco as minhas" on public.preferencia for update to authenticated
  using (email = lower((select auth.jwt()) ->> 'email'))
  with check (email = lower((select auth.jwt()) ->> 'email'));

drop policy if exists "preferencia: apago as minhas" on public.preferencia;
create policy "preferencia: apago as minhas" on public.preferencia for delete to authenticated
  using (email = lower((select auth.jwt()) ->> 'email'));

-- Anonimo nao tem o que fazer aqui.
revoke all on public.preferencia from anon;

-- Confere DEPOIS de rodar, logado:
--   select chave, valor from public.preferencia;   -- so' as suas
