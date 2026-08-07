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

-- ============================================================
-- DADOS DA OBRA — o que os uploads produzem
--
-- Uma linha por obra, guardando o conteudo em JSON.
--
-- Por que JSON e nao uma tabela de itens: o mesmo item existe em TRES
-- fontes (contrato, planilha, executivo) e e justamente compara-las que
-- da sentido ao depara. A tabela obra_item antiga tinha
-- `unique (obra_codigo, item_codigo)`, que impedia isso — uma fonte
-- sobrescreveria a outra. Alem disso o app ja trabalha com a obra como
-- um documento aninhado (verbas -> itens), entao gravar e ler nesse
-- mesmo formato elimina uma camada de traducao e os erros dela.
--
-- TRAVA DE EDICAO: duas pessoas na mesma obra sobrescreveriam uma a
-- outra sem perceber. Quem clica em "Habilitar edicao" fica com a obra;
-- os demais veem tudo, mas em modo leitura. A trava expira sozinha por
-- inatividade — sem isso, um navegador fechado travaria a obra pra
-- sempre.
-- ============================================================
create table if not exists obra_dados (
  obra_codigo       text primary key,
  categorias        jsonb not null default '[]'::jsonb,   -- verbas + itens das tres fontes
  cadernos          jsonb not null default '{}'::jsonb,   -- metadados dos PDFs anexados
  aprovacoes        jsonb not null default '[]'::jsonb,   -- linhas do depara aprovadas na mao
  depara_aprovado   boolean not null default false,
  compras_liberadas boolean not null default false,
  -- Teto de custo definido na liberacao do CMV (no depara contrato x
  -- planilha). Sem estas colunas o valor vivia so na memoria do
  -- navegador: ao recarregar, a aba Executivo continuava aberta mas o
  -- resumo do topo e o fechamento do rodape sumiam sem dizer nada.
  cmv_liberado      numeric,
  cmv_liberado_em   timestamptz,
  cmv_liberado_por  text,
  -- trava de edicao
  editando_por      text,                                 -- e-mail de quem esta editando
  editando_desde    timestamptz,
  atualizado_por    text,
  atualizado_em     timestamptz default now(),
  criado_em         timestamptz default now()
);

-- Para quem ja tinha a tabela criada antes destas colunas existirem:
-- `create table if not exists` acima nao altera tabela existente.
alter table obra_dados add column if not exists cmv_liberado     numeric;
alter table obra_dados add column if not exists cmv_liberado_em  timestamptz;
alter table obra_dados add column if not exists cmv_liberado_por text;

alter table obra_dados enable row level security;

drop policy if exists "acesso time (autenticados)" on obra_dados;
create policy "acesso time (autenticados)" on obra_dados
  for all
  to authenticated
  using (true)
  with check (true);

-- A antiga obra_item foi substituida por obra_dados (acima). A regra
-- `unique (obra_codigo, item_codigo)` dela impedia o mesmo item existir
-- nas tres fontes — que e exatamente o que o depara compara.
drop table if exists obra_item;

-- Atualiza automaticamente o campo atualizado_em em cada UPDATE.
create or replace function set_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_obra_atualizado on obra;
create trigger trg_obra_atualizado
  before update on obra
  for each row execute function set_atualizado_em();

drop trigger if exists trg_obra_dados_atualizado on obra_dados;
create trigger trg_obra_dados_atualizado
  before update on obra_dados
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
