-- ============================================================
-- EQUIPE
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
-- Reaplicavel: rodar de novo nao quebra nada.
-- ============================================================

-- Quem e' quem. Existe pra que atribuir o GC de uma obra seja ESCOLHER
-- de uma lista, e nao digitar um e-mail — e-mail digitado erra, e um
-- caractere trocado faz a obra ficar sem dono sem ninguem perceber.
--
-- A chave e' o E-MAIL, e nao um id: e' com ele que o login se identifica,
-- e e' o unico jeito de "as minhas obras" saber quais sao as minhas.
-- Nome e cargo existem pra tela ter o que mostrar.
create table if not exists pessoa (
  email      text primary key,
  nome       text not null,
  cargo      text,
  -- Quem sai da empresa nao e' apagado: as obras que ele tocou continuam
  -- apontando pra ele, e apagar deixaria historico apontando pro vazio.
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  criado_por text
);

create index if not exists pessoa_cargo_idx on pessoa (cargo) where ativo;

alter table pessoa enable row level security;

drop policy if exists "acesso time (autenticados)" on pessoa;
create policy "acesso time (autenticados)" on pessoa
  for all
  to authenticated
  using (true)
  with check (true);

-- Confere o que entrou:
--   select email, nome, cargo, ativo from pessoa order by nome;
