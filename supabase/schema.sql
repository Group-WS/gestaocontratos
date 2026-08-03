-- ============================================================
-- Gestão de Obras TKWS — schema inicial (Supabase / Postgres)
-- Como usar: Supabase → SQL Editor → cole tudo → Run.
-- ============================================================

-- Itens do Executivo/Vendido por obra + o estado do processo
-- (compra e contrato). É o que a tela de upload vai gravar, e o que
-- os módulos leem ao abrir a obra.
create table if not exists obra_item (
  id             bigint generated always as identity primary key,
  obra_codigo    text not null,                 -- ex: "2519"
  verba_num      text not null,                 -- EAP: "06"
  verba_nome     text,                          -- "Climatização / Exaustão"
  item_codigo    text not null,                 -- "6.1"
  descricao      text,
  tipo           text check (tipo in ('produto','servico')),
  ambiente       text,
  unidade        text,
  qtd_vendida    numeric,
  qtd_executivo  numeric,
  custo          numeric,
  -- estado do processo (editável pelo time)
  liberado       boolean default false,
  lancado_sienge boolean default false,
  comprado       boolean default false,
  valor_comprado numeric,
  status_contrato text,
  status_escopo  text,
  -- correspondência com o Sienge
  sienge_status  text,                          -- 'match' | 'parcial' | 'nao_encontrado'
  sienge_codigo  text,
  criado_em      timestamptz default now(),
  atualizado_em  timestamptz default now(),
  unique (obra_codigo, item_codigo)
);

-- Row Level Security: só quem estiver logado acessa (modelo de time).
alter table obra_item enable row level security;

drop policy if exists "acesso time (autenticados)" on obra_item;
create policy "acesso time (autenticados)" on obra_item
  for all
  to authenticated
  using (true)
  with check (true);

-- Atualiza automaticamente o campo atualizado_em em cada UPDATE.
create or replace function set_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_obra_item_atualizado on obra_item;
create trigger trg_obra_item_atualizado
  before update on obra_item
  for each row execute function set_atualizado_em();
