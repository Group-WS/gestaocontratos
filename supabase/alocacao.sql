-- ============================================================
-- ALOCACAO DE RECURSO PADRAO, POR DESCRICAO
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
-- Reaplicavel: rodar de novo nao quebra nada.
-- ============================================================

-- "Anotacao de responsabilidade tecnica - RRT" e mao de obra em toda obra
-- que a empresa faz. "Cacambas de entulho" tambem. Corrigir isso obra a
-- obra e refazer a mesma decisao pra sempre — e basta esquecer uma vez
-- pra o valor cair na coluna errada e o contrato nascer menor.
--
-- Aqui fica a decisao da empresa: mexeu numa obra, toda obra com a mesma
-- descricao passa a nascer certa. A obra especifica ainda pode discordar
-- (o campo `alocacaoManual` do item ganha deste padrao).
create table if not exists alocacao_padrao (
  -- descricao sem acento, sem caixa e sem espaco dobrado. E a chave
  -- porque o mesmo item vem escrito de tres jeitos entre planilhas.
  descricao_norm text primary key,
  descricao      text not null,      -- como foi escrito da ultima vez
  alocacao       text not null check (alocacao in ('MAT','MO','AMBOS')),
  por            text,
  em             timestamptz default now()
);

alter table alocacao_padrao enable row level security;

drop policy if exists "time le alocacao padrao" on alocacao_padrao;
create policy "time le alocacao padrao" on alocacao_padrao
  for select to authenticated using (true);

drop policy if exists "time grava alocacao padrao" on alocacao_padrao;
create policy "time grava alocacao padrao" on alocacao_padrao
  for insert to authenticated with check (true);

drop policy if exists "time atualiza alocacao padrao" on alocacao_padrao;
create policy "time atualiza alocacao padrao" on alocacao_padrao
  for update to authenticated using (true);

drop policy if exists "time apaga alocacao padrao" on alocacao_padrao;
create policy "time apaga alocacao padrao" on alocacao_padrao
  for delete to authenticated using (true);

-- Confere o que entrou:
--   select descricao, alocacao, por from alocacao_padrao order by em desc;
