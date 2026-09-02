-- ============================================================
-- APRESENTACAO DE ESPECIFICACOES
-- Supabase -> SQL Editor -> cole tudo -> Run. Reaplicavel.
-- Depende de: catalogo.sql (usa o balde 'catalogo' pras imagens)
-- ============================================================

create table if not exists apresentacao (
  id           uuid primary key default gen_random_uuid(),
  obra_codigo  text not null,

  -- Uma por obra E por revisao. A REV 01 nao apaga a 00: a 00 ja' foi
  -- apresentada ao cliente, e alguem vai querer conferir o que mudou.
  rev          text not null default '00',

  -- A capa e os slides inteiros, como vieram da tela. JSONB porque o
  -- desenho de um slide muda com o uso, e coluna por campo viraria uma
  -- migracao a cada ajuste de layout.
  capa         jsonb not null default '{}'::jsonb,
  slides       jsonb not null default '[]'::jsonb,

  idioma       text not null default 'pt',

  -- Onde o PDF foi parar em Arquivos da obra, e quando.
  arquivo      text,
  gerado_em    timestamptz,

  criado_em      timestamptz not null default now(),
  criado_por     text,
  atualizado_em  timestamptz not null default now(),
  atualizado_por text
);

create unique index if not exists apresentacao_obra_rev_idx
  on apresentacao (obra_codigo, rev);
create index if not exists apresentacao_obra_idx on apresentacao (obra_codigo);

alter table apresentacao enable row level security;
drop policy if exists "acesso time (autenticados)" on apresentacao;
create policy "acesso time (autenticados)" on apresentacao
  for all to authenticated using (true) with check (true);

-- Confere:
--   select obra_codigo, rev, jsonb_array_length(slides) as slides, gerado_em
--     from apresentacao order by atualizado_em desc;
