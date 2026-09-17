-- ============================================================
-- O cadastro de insumos ATIVOS do Sienge, numa tabela só
-- ============================================================
--
-- Pedido da Priscila em 17/09/2026: "atualize o banco de dados de insumos
-- ativos do sienge para fazer a associacao corretamente. ex, mesa de centro
-- nao ta ativo, n pode mostrar oque esta inativo."
--
-- O QUE ESTAVA ERRADO, e não era o que parecia
-- A associação mostrava "MOBÍLIA SOLTA - MESA DE CENTRO/LATERAL". Esse
-- insumo NÃO foi desativado: o código dele (411) continua ativo no Sienge,
-- com outro nome — "MOBÍLIA SOLTA - MESAS AUXILIARES". O nome velho vinha
-- da base de preços (`insumo_preco`), que guarda uma linha por COMPRA: são
-- 10.507 linhas, e as antigas, com o nome antigo, são maioria. A
-- associação mostrava o nome mais repetido, e o mais repetido era o velho.
--
-- Então o problema não é esconder linha de preço: é ter, em algum lugar, a
-- lista do que o Sienge chama de insumo HOJE. É esta tabela.
--
-- O QUE ELA GUARDA
-- Uma linha por código do cadastro, com o nome atual. É o relatório de
-- Insumos do Sienge inteiro, e nada mais: 2.702 linhas no relatório de
-- 17/09/2026. Quem não está aqui não é oferecido na associação; quem está,
-- é oferecido com o nome de agora.
--
-- A BASE DE PREÇOS NÃO É TOCADA. O preço realmente pago continua onde
-- está, inclusive o de insumo que saiu do cadastro — ele é histórico da
-- obra, não some porque o Sienge desativou o item.
--
-- NENHUM DADO É ALTERADO AO RODAR ISTO: a tabela nasce vazia, e enquanto
-- estiver vazia o app se comporta exatamente como hoje. Quem a preenche é
-- a importação do cadastro de Insumos, na tela Banco de Preços.
--
-- RODAR DE NOVO É SEGURO (tudo é `if not exists`).
--
-- COMO RODAR: Supabase → SQL Editor → colar tudo → Run.
-- ============================================================

create table if not exists insumo_sienge (
  codigo        text primary key,
  descricao     text not null,
  unidade       text not null default '',
  preco_tabela  numeric,
  -- De qual importação esta linha veio. Duas importações do mesmo dia não
  -- criam linha nova: a chave é o código.
  importado_em  timestamptz not null default now(),
  importado_por text
);

create index if not exists idx_insumo_sienge_descricao on insumo_sienge (descricao);

alter table insumo_sienge enable row level security;

-- Mesma regra das outras tabelas de referência da casa: todo mundo do time
-- lê e escreve. O cadastro do Sienge não é dado de obra nem de pessoa.
drop policy if exists "acesso time (autenticados)" on insumo_sienge;
create policy "acesso time (autenticados)" on insumo_sienge
  for all
  to authenticated
  using (true)
  with check (true);

-- Confere que ficou de pé (deve dar 0 antes da primeira importação):
--   select count(*) from insumo_sienge;
