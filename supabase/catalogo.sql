-- ============================================================
-- CATÁLOGO TKWS
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
-- Reaplicavel: rodar de novo nao quebra nada.
-- ============================================================

-- FORNECEDOR tem cadastro proprio, e nao e' so' um texto dentro do
-- produto. Duas razoes: o contato de quem vende e' o que falta na hora
-- de pedir, e "Nordecor", "NORDECOR " e "Nordecor Ltda" digitados em
-- linhas diferentes viram tres fornecedores que ninguem consegue juntar
-- depois.
create table if not exists catalogo_fornecedor (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null unique,
  contato     text,
  telefone    text,
  email       text,
  site        text,
  observacoes text,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now(),
  criado_por  text
);

create table if not exists catalogo_produto (
  id          uuid primary key default gen_random_uuid(),

  -- A VERBA DA EAP, e nao um grupo proprio. Os grupos da planilha ja
  -- eram verbas com outro nome (ILUMINACAO = 05, LOUCAS E METAIS = 27,
  -- MOVEIS SOLTOS = 24, CORTINAS = 30). Amarrar aqui e' o que faz o
  -- produto saber sozinho em que verba cai quando vai pra obra.
  verba       text not null references eap_grupo(num),
  subgrupo    text,

  -- O mesmo produto e' dito de dois jeitos: a tecnica, que precisa
  -- bastar pra comprar e cadastrar no Sienge, e a curta, que o cliente
  -- le na apresentacao. So' a primeira e' obrigatoria.
  descricao          text not null,
  descricao_criativo text,
  descricao_en       text,
  codigo      text,
  fornecedor  text,
  observacoes text,

  -- CENTAVOS inteiros. Float de dinheiro soma errado, e este app ja'
  -- pagou caro por isso uma vez.
  preco_ref   integer,
  -- Preco digitado a mao ENVELHECE. Sem a data, um numero de dois anos
  -- atras tem a mesma cara de um de ontem.
  preco_em    date,

  imagem      text,                       -- caminho no bucket 'catalogo'
  unidade     text not null default 'un',
  ativo       boolean not null default true,

  criado_em     timestamptz not null default now(),
  criado_por    text,
  atualizado_em timestamptz not null default now()
);

create index if not exists catalogo_produto_verba_idx on catalogo_produto (verba, subgrupo);
create index if not exists catalogo_produto_forn_idx  on catalogo_produto (fornecedor);

-- O mesmo produto do mesmo fornecedor nao entra duas vezes. Codigo nulo
-- nao colide com nada (indice parcial), porque nem todo produto tem.
create unique index if not exists catalogo_produto_codigo_idx
  on catalogo_produto (fornecedor, codigo) where codigo is not null;

-- Trava de acesso, igual ao resto do app: quem esta' logado usa, quem
-- nao esta' nao ve nada. Sem isto a tabela fica gravavel por qualquer um
-- que leia a chave publica dentro do site -- e ela e' publica por
-- definicao, vai no arquivo que o navegador baixa.
alter table catalogo_fornecedor enable row level security;
drop policy if exists "acesso time (autenticados)" on catalogo_fornecedor;
create policy "acesso time (autenticados)" on catalogo_fornecedor
  for all to authenticated using (true) with check (true);

alter table catalogo_produto enable row level security;
drop policy if exists "acesso time (autenticados)" on catalogo_produto;
create policy "acesso time (autenticados)" on catalogo_produto
  for all to authenticated using (true) with check (true);

create or replace function catalogo_toca() returns trigger as $$
begin new.atualizado_em = now(); return new; end;
$$ language plpgsql;

drop trigger if exists catalogo_produto_toca on catalogo_produto;
create trigger catalogo_produto_toca before update on catalogo_produto
  for each row execute function catalogo_toca();

-- ------------------------------------------------------------
-- A FOTO
--
-- E' o que faz o catalogo ser catalogo: quem escolhe um spot reconhece a
-- peca antes de ler o codigo.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('catalogo', 'catalogo', true)
on conflict (id) do update set public = true;

-- Foto de produto e' publica de proposito: nao ha nada sensivel numa
-- foto de spot, e link publico e' o que permite a imagem aparecer sem
-- uma ida ao servidor por cartao.
drop policy if exists "catalogo le" on storage.objects;
create policy "catalogo le" on storage.objects
  for select using (bucket_id = 'catalogo');

drop policy if exists "catalogo escreve" on storage.objects;
create policy "catalogo escreve" on storage.objects
  for insert to authenticated with check (bucket_id = 'catalogo');

drop policy if exists "catalogo troca" on storage.objects;
create policy "catalogo troca" on storage.objects
  for update to authenticated using (bucket_id = 'catalogo');

drop policy if exists "catalogo apaga" on storage.objects;
create policy "catalogo apaga" on storage.objects
  for delete to authenticated using (bucket_id = 'catalogo');

-- Reaplicavel em banco que ja' tem a tabela:
-- PRODUTO ou ACABAMENTO. Produto e' peca (torneira, spot, coifa): tem
-- codigo, tem preco, vira linha de orcamento. Acabamento e' cor e
-- material (MDF Freijo, laca off white, tecido 2796): nao se compra
-- sozinho, qualifica outra coisa. So' o produto vai pro Executivo.
alter table catalogo_produto add column if not exists tipo_item text not null default 'produto';
alter table catalogo_produto drop constraint if exists catalogo_produto_tipo_check;
alter table catalogo_produto add constraint catalogo_produto_tipo_check
  check (tipo_item in ('produto','acabamento'));
create index if not exists catalogo_produto_tipo_idx on catalogo_produto (tipo_item, verba);

alter table catalogo_produto add column if not exists descricao_criativo text;
alter table catalogo_produto add column if not exists descricao_en       text;

-- Confere o que entrou:
--   select verba, subgrupo, count(*) from catalogo_produto group by 1,2 order by 1,2;
