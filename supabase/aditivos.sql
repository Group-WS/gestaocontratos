-- ============================================================
-- ADITIVOS
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
-- Reaplicavel: rodar de novo nao quebra nada.
-- ============================================================

-- Tabela propria, e nao mais uma coluna jsonb dentro de obra_dados:
-- cada aditivo tem numero, status e ciclo de vida proprios, e dois
-- aditivos da mesma obra sendo editados ao mesmo tempo se sobrescreveriam
-- se morassem no mesmo documento.
create table if not exists aditivo (
  id            uuid primary key default gen_random_uuid(),
  obra_codigo   text not null,                -- centro de custo, 4 digitos ("2405")
  -- A sequencia dentro da obra. O numero que a pessoa le e' obra/seq —
  -- "2405/1" — e ele e' guardado tambem, pronto, porque e' o que sai no
  -- documento e no PDF: recalcular depois arriscaria renumerar um
  -- aditivo ja enviado ao cliente.
  seq           int  not null,
  numero        text not null,
  descricao     text,                          -- do que se trata, em uma linha
  status        text not null default 'rascunho'
                check (status in ('rascunho','aprovado','reprovado')),
  -- O documento inteiro: cabecalho, grupos, itens, condicoes. Guardado
  -- como retrato, igual aos escopos — o que foi enviado ao cliente nao
  -- pode mudar porque alguem editou um padrao depois.
  dados         jsonb not null default '{}'::jsonb,
  total_supressao numeric not null default 0,
  total_adicao    numeric not null default 0,
  criado_em     timestamptz not null default now(),
  criado_por    text,
  atualizado_em timestamptz not null default now(),
  atualizado_por text,
  -- Numero nao repete dentro da obra. E' o unico jeito de garantir que
  -- duas pessoas criando aditivo ao mesmo tempo nao gerem dois "2405/3".
  unique (obra_codigo, seq)
);

create index if not exists aditivo_obra_idx on aditivo (obra_codigo, seq desc);

alter table aditivo enable row level security;

drop policy if exists "acesso time (autenticados)" on aditivo;
create policy "acesso time (autenticados)" on aditivo
  for all
  to authenticated
  using (true)
  with check (true);

-- Confere o que entrou:
--   select obra_codigo, numero, status, descricao from aditivo order by obra_codigo, seq;
