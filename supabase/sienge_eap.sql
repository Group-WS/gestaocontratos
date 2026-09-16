-- ============================================================
-- EAP DO SIENGE — a estrutura de apropriacao do orcamento
--
-- Toda solicitacao de compra enviada ao Sienge precisa dizer ONDE o
-- produto e apropriado: uma referencia de item do orcamento
-- ("04.001.001.001") e uma unidade construtiva. Nenhum dos dois existia
-- no GC -- a planilha da obra tem a EAP DA CASA (as 35 verbas de
-- `eap_grupo`), que tem outra numeracao e outros nomes.
--
-- Por isso sao DUAS coisas aqui: a EAP do Sienge (importada do relatorio
-- de orcamento em Excel) e o MAPA que liga cada verba do GC a uma folha
-- dela. O mapa e' cadastro, nao calculo: "20 Climatizacao / Exaustao" ->
-- "04.001.001.001 Climatizacao, ventilacao e exaustao [MAT]" e' uma
-- decisao de quem conhece as duas pontas.
--
-- VERSIONADO de proposito: importar uma planilha nova NAO sobrescreve a
-- anterior, cria outra versao. O orcamento do Sienge tem versao propria
-- e muda; uma solicitacao enviada ano passado precisa continuar
-- explicavel pela EAP que valia naquele dia.
--
-- Depois deste arquivo, rode `sienge_eap_seed.sql` -- ele planta a
-- "EAP INICIAL - TKWS INTERIORES" (unidade construtiva 9) ja com o mapa,
-- pra o cadastro nascer utilizavel em vez de vazio.
-- ============================================================

create table if not exists sienge_eap_versao (
  id               bigint generated always as identity primary key,
  nome             text not null,        -- "EAP INICIAL - TKWS INTERIORES"
  unidade_id       integer not null,     -- o buildingUnitId da apropriacao
  obra_modelo      text,                 -- "15 - OBRA MODELO" (de onde saiu o relatorio)
  versao_orcamento text,                 -- "3 - 15/04/2026 - 11:29:20"
  data_base        date,
  -- A que abre selecionada. Uma so' por vez -- garantido pelo indice abaixo.
  padrao           boolean not null default false,
  importado_por    text,
  importado_em     timestamptz default now()
);

-- Duas versoes marcadas como padrao deixariam a tela escolher por sorte.
create unique index if not exists sienge_eap_versao_uma_padrao
  on sienge_eap_versao (padrao) where padrao;

create table if not exists sienge_eap_item (
  versao_id bigint not null references sienge_eap_versao(id) on delete cascade,
  codigo    text not null,               -- "04.001.001.001"
  descricao text not null,
  nivel     smallint not null check (nivel between 1 and 4),
  unidade   text,
  -- Nivel 4. So' a folha e' apropriavel; os tres niveis de cima ficam
  -- guardados porque a tela mostra a arvore como o Sienge mostra.
  folha     boolean not null,
  primary key (versao_id, codigo)
);

create index if not exists sienge_eap_item_folha on sienge_eap_item (versao_id) where folha;

-- Verba do GC -> folha da EAP.
--
-- Global, nao por obra: as verbas e a EAP sao as mesmas em toda obra. A
-- versao entra na chave pra o mapa nao apontar pro vazio quando alguem
-- importa uma EAP nova -- a importacao copia o mapa da versao anterior
-- pros codigos que continuam existindo, e o que perdeu par aparece na
-- tela em vez de sumir.
create table if not exists sienge_eap_mapa (
  versao_id    bigint not null references sienge_eap_versao(id) on delete cascade,
  verba_num    text not null,            -- "20" (eap_grupo.num)
  codigo       text not null,
  definido_por text,
  definido_em  timestamptz default now(),
  primary key (versao_id, verba_num),
  -- Verba nao pode apontar pra codigo que nao esta na mesma versao.
  foreign key (versao_id, codigo) references sienge_eap_item (versao_id, codigo) on delete cascade
);

alter table sienge_eap_versao enable row level security;
alter table sienge_eap_item   enable row level security;
alter table sienge_eap_mapa   enable row level security;

drop policy if exists "acesso time (autenticados)" on sienge_eap_versao;
create policy "acesso time (autenticados)" on sienge_eap_versao
  for all to authenticated using (true) with check (true);

drop policy if exists "acesso time (autenticados)" on sienge_eap_item;
create policy "acesso time (autenticados)" on sienge_eap_item
  for all to authenticated using (true) with check (true);

drop policy if exists "acesso time (autenticados)" on sienge_eap_mapa;
create policy "acesso time (autenticados)" on sienge_eap_mapa
  for all to authenticated using (true) with check (true);
