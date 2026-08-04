-- ============================================================
-- Gestão de Obras TKWS — schema inicial (Supabase / Postgres)
-- Como usar: Supabase → SQL Editor → cole tudo → Run.
-- ============================================================

-- As obras que o time decidiu acompanhar aqui.
--
-- O Monday nao manda nesta tabela: ele so avisa que uma obra existe.
-- Quem entra aqui e a obra em que alguem clicou "Dar start" — a partir
-- desse momento ela e nossa, e o que estiver dentro dela nao depende
-- mais do Monday pra continuar existindo.
--
-- situacao:
--   ativa     — aparece na sidebar, em andamento
--   concluida — sai da sidebar, fica no Arquivo, so leitura
create table if not exists obra (
  id             bigint generated always as identity primary key,
  codigo         text not null unique,          -- ex: "2519" (mesma chave usada em obra_item)
  nome           text not null,
  squad          text,                          -- SUN / MOON / COMET
  board_id       text,                          -- board de origem no Monday
  cliente        text,
  endereco       text,
  gc             text,                          -- GC responsavel
  valor_vendido  numeric,
  situacao       text not null default 'ativa' check (situacao in ('ativa','concluida')),
  iniciada_em    timestamptz default now(),
  concluida_em   timestamptz,
  criado_em      timestamptz default now(),
  atualizado_em  timestamptz default now()
);

alter table obra enable row level security;

drop policy if exists "acesso time (autenticados)" on obra;
create policy "acesso time (autenticados)" on obra
  for all
  to authenticated
  using (true)
  with check (true);

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

drop trigger if exists trg_obra_atualizado on obra;
create trigger trg_obra_atualizado
  before update on obra
  for each row execute function set_atualizado_em();

-- ============================================================
-- BANCO DE PRECOS POR INSUMO
--
-- Vem do relatorio de pedidos de compra do Sienge: e o que foi
-- REALMENTE pago, nao preco de tabela. Serve de referencia quando o
-- time lanca item na mao no Executivo.
--
-- Uma linha por (codigo + descricao + unidade), guardando a compra mais
-- recente. O codigo sozinho nao serve de chave: no Sienge ele e uma
-- caixa generica ("DECORATIVOS OBRAS" cobre de R$ 15 a R$ 3.845) — quem
-- identifica o produto e a descricao detalhada.
--
-- Linhas em "vb" (verba) ficam de fora na importacao: sao valor fechado
-- de servico, nao preco unitario, e poluiriam a referencia.
-- ============================================================
create table if not exists insumo_preco (
  id             bigint generated always as identity primary key,
  codigo         text not null,
  descricao      text not null,
  unidade        text not null default '',
  custo_unitario numeric not null,
  data_ref       date not null,          -- data da compra que gerou este preco
  fornecedor     text,
  atualizado_em  timestamptz default now(),
  unique (codigo, descricao, unidade)
);

-- busca por texto da descricao (e o que o time digita)
create index if not exists idx_insumo_preco_descricao on insumo_preco (descricao);
create index if not exists idx_insumo_preco_codigo on insumo_preco (codigo);

alter table insumo_preco enable row level security;

drop policy if exists "acesso time (autenticados)" on insumo_preco;
create policy "acesso time (autenticados)" on insumo_preco
  for all
  to authenticated
  using (true)
  with check (true);

drop trigger if exists trg_insumo_preco_atualizado on insumo_preco;
create trigger trg_insumo_preco_atualizado
  before update on insumo_preco
  for each row execute function set_atualizado_em();
