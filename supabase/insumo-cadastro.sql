-- ============================================================
-- CADASTRO DE INSUMOS  ·  23/09/2026  ·  ADR-008
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
--
-- E' REAPLICAVEL e NAO altera dado existente: cria as tabelas, os
-- gatilhos, as funcoes, as regras de acesso e o balde dos arquivos.
-- Roda DEPOIS do rls-reforco.sql (usa meu_perfil() e sou_admin() de la')
-- e do sienge_solicitacao.sql (a RN-087 olha as solicitacoes enviadas).
-- ============================================================
--
-- PRA QUE SERVE
-- A tela Configuracoes -> Cadastro de Insumos: o admin sobe o relatorio
-- "Insumos" do Sienge, confere a previa e grava; ou cria, edita e apaga a
-- mao. Independente do `insumo_sienge` (que o Associar insumos e o Gerador
-- continuam lendo): nada do que ja' existe muda.
--
-- As tabelas:
--   insumo_cadastro             o cadastro (codigo + descricao identificam)
--   insumo_cadastro_historico   cada mudanca vira uma linha (gatilho)
--   insumo_cadastro_importacao  cada importacao: quem, quando, tabela, data
--                               do relatorio, caminho, numeros e o arquivo
--   insumo_tabela_ativa         a tabela de precos que a importacao aceita
--
-- As regras de negocio garantidas aqui (defesa em profundidade, NEG-07):
--   RN-086 — so' o administrador mantem o cadastro: as policies de escrita.
--   RN-087 — insumo com solicitacao enviada ao Sienge nao se apaga: o
--            gatilho antes do delete.
-- As outras duas (RN-088, tabela ativa; RN-089, "vb" fica fora) sao
-- conferidas na leitura do relatorio, na API.
-- ============================================================

-- ---------- busca por trecho (SQL-37) ----------
-- A lista busca por codigo e descricao com ilike '%termo%'. O pg_trgm vive
-- no schema `extensions` no Supabase; num Postgres sem esse schema, no
-- padrao. O indice usa o schema onde ele de fato estiver.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_trgm') then
    if exists (select 1 from pg_namespace where nspname = 'extensions') then
      create extension pg_trgm with schema extensions;
    else
      create extension pg_trgm;
    end if;
  end if;
end $$;

-- ---------- a tabela de precos ativa (RN-088) ----------
-- Uma linha so' (id = true). Comeca com a tabela de hoje; o admin troca no
-- card da propria aba.
create table if not exists public.insumo_tabela_ativa (
  id              boolean primary key default true check (id),
  codigo          text not null check (codigo ~ '^[0-9]{1,10}$'),
  nome            text not null check (char_length(nome) between 1 and 200),
  atualizado_em   timestamptz not null default now(),
  atualizado_por  text
);

insert into public.insumo_tabela_ativa (id, codigo, nome)
values (true, '1', 'TABELA WS BUILDING')
on conflict (id) do nothing;

-- ---------- as importacoes ----------
create table if not exists public.insumo_cadastro_importacao (
  id                  bigint generated always as identity primary key,
  -- Caminho no balde `insumo-importacao`. Fica nulo quando o arquivo sai
  -- pela guarda (so' os 12 ultimos ficam); o registro continua.
  arquivo_caminho     text check (arquivo_caminho is null or char_length(arquivo_caminho) <= 300),
  arquivo_nome        text not null check (char_length(arquivo_nome) between 1 and 300),
  tabela_codigo       text check (tabela_codigo is null or char_length(tabela_codigo) <= 10),
  tabela_nome         text check (tabela_nome is null or char_length(tabela_nome) <= 200),
  relatorio_gerado_em timestamptz,
  -- O caminho escolhido na previa: apagar quem nao veio, ou manter e so'
  -- incluir os novos. Nulo ate' a escolha.
  caminho             text check (caminho is null or caminho in ('apagar', 'manter')),
  -- As escolhas do admin nos conflitos, por id do insumo: "relatorio" ou
  -- "edicao". Guardadas para o "continuar" repetir a mesma decisao.
  conflitos           jsonb not null default '{}'::jsonb,
  confirmou_nome      boolean not null default false,
  status              text not null default 'enviado'
                        check (status in ('enviado', 'recusado', 'previa', 'gravando', 'incompleta', 'concluida')),
  -- Os numeros da previa e do resultado (so' leitura, nunca filtro).
  resumo              jsonb,
  gravadas            integer not null default 0 check (gravadas >= 0),
  apagados            integer not null default 0 check (apagados >= 0),
  por                 text not null check (char_length(por) between 3 and 320),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  concluida_em        timestamptz
);

create index if not exists insumo_cadastro_importacao_recentes_idx
  on public.insumo_cadastro_importacao (criado_em desc);
-- O aviso de "importacao incompleta" procura so' as que pararam no meio.
create index if not exists insumo_cadastro_importacao_abertas_idx
  on public.insumo_cadastro_importacao (criado_em desc)
  where status in ('gravando', 'incompleta');

-- ---------- o cadastro ----------
create table if not exists public.insumo_cadastro (
  id                bigint generated always as identity primary key,
  codigo            text not null check (codigo ~ '^[0-9]{1,10}$'),
  -- Para ordenar como numero (o 10 depois do 9).
  codigo_num        bigint generated always as (codigo::bigint) stored,
  -- O texto EXATAMENTE como veio do Sienge, espacos inclusive (item 2).
  descricao         text not null check (char_length(descricao) between 1 and 1000),
  unidade           text not null check (char_length(unidade) between 1 and 20),
  ativo             boolean not null default true,
  origem            text not null check (origem in ('sienge', 'tela')),
  -- Como veio no ultimo relatorio (so' origem 'sienge'). E' por aqui que a
  -- importacao reconhece o registro mesmo depois de editado na tela, e e'
  -- a diferenca entre estes e os valores de cima que marca a edicao.
  sienge_codigo     text,
  sienge_descricao  text,
  sienge_unidade    text,
  importacao_id     bigint references public.insumo_cadastro_importacao (id) on delete set null,
  criado_por        text not null,
  criado_em         timestamptz not null default now(),
  atualizado_por    text not null,
  atualizado_em     timestamptz not null default now(),
  -- A chave do registro: codigo + descricao (item 2 da ADR-008).
  constraint insumo_cadastro_codigo_descricao_key unique (codigo, descricao),
  constraint insumo_cadastro_retrato_do_sienge_check check (
    (origem = 'sienge' and sienge_codigo is not null and sienge_descricao is not null and sienge_unidade is not null)
    or (origem = 'tela' and sienge_codigo is null and sienge_descricao is null and sienge_unidade is null)
  )
);

-- Um registro do Sienge por codigo + descricao de origem.
create unique index if not exists insumo_cadastro_sienge_key
  on public.insumo_cadastro (sienge_codigo, sienge_descricao) where origem = 'sienge';
-- FK (SQL-30).
create index if not exists insumo_cadastro_importacao_id_idx
  on public.insumo_cadastro (importacao_id);
-- A lista: ordem por codigo, filtro por unidade e por ativo.
create index if not exists insumo_cadastro_ordem_idx
  on public.insumo_cadastro (codigo_num, descricao);
create index if not exists insumo_cadastro_unidade_idx
  on public.insumo_cadastro (unidade, codigo_num);

do $$
declare esquema text;
begin
  select n.nspname into esquema
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pg_trgm';
  execute format('create index if not exists insumo_cadastro_descricao_trgm on public.insumo_cadastro using gin (descricao %I.gin_trgm_ops)', esquema);
  execute format('create index if not exists insumo_cadastro_codigo_trgm on public.insumo_cadastro using gin (codigo %I.gin_trgm_ops)', esquema);
end $$;

-- ---------- o historico ----------
-- Sem FK para o insumo, de proposito: a linha precisa sobreviver ao apagar
-- (e' justamente quando ela e' a unica memoria). Codigo e descricao ficam
-- congelados na linha.
create table if not exists public.insumo_cadastro_historico (
  id             bigint generated always as identity primary key,
  insumo_id      bigint not null,
  acao           text not null check (acao in (
                   'criou', 'editou', 'ativou', 'desativou', 'apagou',
                   'importou', 'atualizou_na_importacao', 'apagou_na_importacao')),
  codigo         text not null,
  descricao      text not null,
  antes          jsonb,
  depois         jsonb,
  -- Sem FK, pelo mesmo motivo: o registro nao segue o destino da importacao.
  importacao_id  bigint,
  autor          text not null,
  criado_em      timestamptz not null default now()
);

create index if not exists insumo_cadastro_historico_insumo_idx
  on public.insumo_cadastro_historico (insumo_id, criado_em desc);
create index if not exists insumo_cadastro_historico_importacao_idx
  on public.insumo_cadastro_historico (importacao_id);

-- ---------- quem e quando: do login, nunca do corpo (SEG-13) ----------
create or replace function public.insumo_cadastro_carimbar()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_autor text := coalesce(nullif(lower((select auth.jwt()) ->> 'email'), ''), 'sistema');
  v_importacao text := nullif(current_setting('app.insumo_importacao', true), '');
begin
  if tg_op = 'INSERT' then
    new.criado_por := v_autor;
    new.criado_em := now();
  else
    new.criado_por := old.criado_por;
    new.criado_em := old.criado_em;
    -- Fora da importacao, a tela mexe so' nos valores e no ativo: a origem e
    -- o retrato do Sienge sao da importacao.
    if v_importacao is null and (
         new.origem is distinct from old.origem
      or new.sienge_codigo is distinct from old.sienge_codigo
      or new.sienge_descricao is distinct from old.sienge_descricao
      or new.sienge_unidade is distinct from old.sienge_unidade
      or new.importacao_id is distinct from old.importacao_id) then
      raise exception 'A origem de um insumo só muda pela importação.' using errcode = '23514';
    end if;
  end if;
  new.atualizado_por := v_autor;
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists insumo_cadastro_carimbo on public.insumo_cadastro;
create trigger insumo_cadastro_carimbo
  before insert or update on public.insumo_cadastro
  for each row execute function public.insumo_cadastro_carimbar();

-- ---------- RN-087 — em uso no Sienge nao se apaga ----------
-- Em uso = algum item de solicitacao CONCLUIDA ou PARCIAL tem o mesmo codigo
-- (productId) e o mesmo texto (notes) do insumo. A mesma condicao de
-- web/src/regras/cadastroDeInsumos.js (STATUS_QUE_CONTAM_COMO_ENVIADA,
-- usosDoInsumo).
create index if not exists sienge_solicitacao_payload_idx
  on public.sienge_solicitacao using gin (payload jsonb_path_ops);

create or replace function public.insumo_em_uso(p_codigo text, p_descricao text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case when coalesce(p_codigo, '') ~ '^[0-9]{1,18}$' then exists (
    select 1
      from public.sienge_solicitacao s
     where s.status in ('concluido', 'parcial')
       and s.payload @> jsonb_build_object('itens', jsonb_build_array(
             jsonb_build_object('productId', p_codigo::bigint, 'notes', p_descricao)))
  ) else false end
$$;

revoke all on function public.insumo_em_uso(text, text) from public, anon;
grant execute on function public.insumo_em_uso(text, text) to authenticated;

create or replace function public.insumo_cadastro_recusar_em_uso()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.insumo_em_uso(old.codigo, old.descricao) then
    raise exception 'RN-087: o insumo % foi pedido ao Sienge e não pode ser apagado.', old.codigo
      using errcode = '23503';
  end if;
  return old;
end $$;

drop trigger if exists insumo_cadastro_rn_087 on public.insumo_cadastro;
create trigger insumo_cadastro_rn_087
  before delete on public.insumo_cadastro
  for each row execute function public.insumo_cadastro_recusar_em_uso();

-- ---------- o historico e' escrito aqui, nao pela tela ----------
create or replace function public.insumo_cadastro_registrar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_autor text := coalesce(nullif(lower((select auth.jwt()) ->> 'email'), ''), 'sistema');
  v_importacao bigint := nullif(current_setting('app.insumo_importacao', true), '')::bigint;
  v_acao text;
begin
  if tg_op = 'INSERT' then
    insert into public.insumo_cadastro_historico (insumo_id, acao, codigo, descricao, antes, depois, importacao_id, autor)
    values (new.id, case when v_importacao is null then 'criou' else 'importou' end,
            new.codigo, new.descricao, null,
            jsonb_build_object('codigo', new.codigo, 'descricao', new.descricao, 'unidade', new.unidade, 'ativo', new.ativo),
            v_importacao, v_autor);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- So' o que a pessoa ve: codigo, descricao, unidade e ativo.
    if (new.codigo, new.descricao, new.unidade, new.ativo)
       is not distinct from (old.codigo, old.descricao, old.unidade, old.ativo) then
      return new;
    end if;
    v_acao := case
      when v_importacao is not null then 'atualizou_na_importacao'
      when (new.codigo, new.descricao, new.unidade) is not distinct from (old.codigo, old.descricao, old.unidade)
        then case when new.ativo then 'ativou' else 'desativou' end
      else 'editou' end;
    insert into public.insumo_cadastro_historico (insumo_id, acao, codigo, descricao, antes, depois, importacao_id, autor)
    values (new.id, v_acao, new.codigo, new.descricao,
            jsonb_build_object('codigo', old.codigo, 'descricao', old.descricao, 'unidade', old.unidade, 'ativo', old.ativo),
            jsonb_build_object('codigo', new.codigo, 'descricao', new.descricao, 'unidade', new.unidade, 'ativo', new.ativo),
            v_importacao, v_autor);
    return new;
  end if;

  insert into public.insumo_cadastro_historico (insumo_id, acao, codigo, descricao, antes, depois, importacao_id, autor)
  values (old.id, case when v_importacao is null then 'apagou' else 'apagou_na_importacao' end,
          old.codigo, old.descricao,
          jsonb_build_object('codigo', old.codigo, 'descricao', old.descricao, 'unidade', old.unidade, 'ativo', old.ativo),
          null, v_importacao, v_autor);
  return old;
end $$;

revoke all on function public.insumo_cadastro_registrar() from public, anon, authenticated;

drop trigger if exists insumo_cadastro_historico on public.insumo_cadastro;
create trigger insumo_cadastro_historico
  after insert or update or delete on public.insumo_cadastro
  for each row execute function public.insumo_cadastro_registrar();

-- ---------- a gravacao da importacao, um bloco por transacao (SQL-39) ----------
-- Security INVOKER: roda com o RLS de quem chamou (RN-086 vale aqui dentro).
-- O numero da importacao vai para o historico pelo `app.insumo_importacao`,
-- que so' vale ate' o fim desta transacao.
create or replace function public.insumo_cadastro_gravar(p_importacao bigint, p_inserir jsonb, p_atualizar jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n_inseridos integer := 0;
  n_atualizados integer := 0;
begin
  perform set_config('app.insumo_importacao', p_importacao::text, true);

  insert into public.insumo_cadastro
    (codigo, descricao, unidade, ativo, origem, sienge_codigo, sienge_descricao, sienge_unidade, importacao_id, criado_por, atualizado_por)
  select x.codigo, x.descricao, x.unidade, true, 'sienge', x.codigo, x.descricao, x.unidade, p_importacao, '', ''
    from jsonb_to_recordset(coalesce(p_inserir, '[]'::jsonb)) as x(codigo text, descricao text, unidade text)
  -- Repetir o bloco (o "continuar" depois de uma falha) nao duplica.
  on conflict (codigo, descricao) do nothing;
  get diagnostics n_inseridos = row_count;

  update public.insumo_cadastro c
     set codigo = x.codigo, descricao = x.descricao, unidade = x.unidade, ativo = x.ativo,
         sienge_codigo = x.sienge_codigo, sienge_descricao = x.sienge_descricao, sienge_unidade = x.sienge_unidade,
         importacao_id = p_importacao
    from jsonb_to_recordset(coalesce(p_atualizar, '[]'::jsonb))
           as x(id bigint, codigo text, descricao text, unidade text, ativo boolean,
                sienge_codigo text, sienge_descricao text, sienge_unidade text)
   where c.id = x.id and c.origem = 'sienge';
  get diagnostics n_atualizados = row_count;

  update public.insumo_cadastro_importacao
     set gravadas = gravadas + n_inseridos + n_atualizados, status = 'gravando', atualizado_em = now()
   where id = p_importacao;

  return n_inseridos + n_atualizados;
end $$;

-- O caminho "apagar": sai o que veio do Sienge e nao veio agora. O que foi
-- pedido ao Sienge (RN-087) fica — aqui e no gatilho.
create or replace function public.insumo_cadastro_apagar(p_importacao bigint, p_ids bigint[])
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  n integer := 0;
begin
  perform set_config('app.insumo_importacao', p_importacao::text, true);

  delete from public.insumo_cadastro c
   where c.id = any (coalesce(p_ids, '{}'))
     and c.origem = 'sienge'
     and not public.insumo_em_uso(c.codigo, c.descricao);
  get diagnostics n = row_count;

  update public.insumo_cadastro_importacao
     set apagados = apagados + n, atualizado_em = now()
   where id = p_importacao;

  return n;
end $$;

-- Os itens pedidos ao Sienge, ja' abertos (codigo, texto, de onde veio). Para
-- a rota montar a previa e dizer ONDE o insumo foi pedido. Invoker: segue o
-- RLS das solicitacoes.
create or replace function public.insumo_itens_pedidos(p_codigo text default null)
returns table (codigo text, texto text, obra_codigo text, solicitacao_id integer, enviado_em timestamptz, status text)
language sql
stable
security invoker
set search_path = ''
as $$
  select i.item ->> 'productId', coalesce(i.item ->> 'notes', ''), s.obra_codigo, s.solicitacao_id, s.enviado_em, s.status
    from public.sienge_solicitacao s
   cross join lateral jsonb_array_elements(
           case when jsonb_typeof(s.payload -> 'itens') = 'array' then s.payload -> 'itens' else '[]'::jsonb end
         ) as i(item)
   where s.status in ('concluido', 'parcial')
     and (p_codigo is null or i.item ->> 'productId' = p_codigo)
$$;

-- As unidades que existem no cadastro, para o filtro da lista.
create or replace function public.insumo_cadastro_unidades()
returns setof text
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct unidade from public.insumo_cadastro order by 1
$$;

revoke all on function public.insumo_cadastro_gravar(bigint, jsonb, jsonb) from public, anon;
revoke all on function public.insumo_cadastro_apagar(bigint, bigint[]) from public, anon;
revoke all on function public.insumo_itens_pedidos(text) from public, anon;
revoke all on function public.insumo_cadastro_unidades() from public, anon;
grant execute on function public.insumo_cadastro_gravar(bigint, jsonb, jsonb) to authenticated;
grant execute on function public.insumo_cadastro_apagar(bigint, bigint[]) to authenticated;
grant execute on function public.insumo_itens_pedidos(text) to authenticated;
grant execute on function public.insumo_cadastro_unidades() to authenticated;

-- ---------- quem le e quem escreve ----------
alter table public.insumo_tabela_ativa enable row level security;
alter table public.insumo_cadastro_importacao enable row level security;
alter table public.insumo_cadastro enable row level security;
alter table public.insumo_cadastro_historico enable row level security;

-- O cadastro: o time le (item 8), so' o admin escreve (RN-086).
drop policy if exists "insumo_cadastro: time le" on public.insumo_cadastro;
create policy "insumo_cadastro: time le" on public.insumo_cadastro
  for select to authenticated
  using ((select public.meu_perfil()) is not null);

drop policy if exists "insumo_cadastro: admin cria" on public.insumo_cadastro;
create policy "insumo_cadastro: admin cria" on public.insumo_cadastro
  for insert to authenticated
  with check ((select public.sou_admin()));

drop policy if exists "insumo_cadastro: admin edita" on public.insumo_cadastro;
create policy "insumo_cadastro: admin edita" on public.insumo_cadastro
  for update to authenticated
  using ((select public.sou_admin()))
  with check ((select public.sou_admin()));

drop policy if exists "insumo_cadastro: admin apaga" on public.insumo_cadastro;
create policy "insumo_cadastro: admin apaga" on public.insumo_cadastro
  for delete to authenticated
  using ((select public.sou_admin()));

-- O historico: so' o admin le. Ninguem escreve direto (o gatilho escreve).
drop policy if exists "insumo_cadastro_historico: admin le" on public.insumo_cadastro_historico;
create policy "insumo_cadastro_historico: admin le" on public.insumo_cadastro_historico
  for select to authenticated
  using ((select public.sou_admin()));

-- As importacoes: so' o admin, em nome proprio. Sem delete.
drop policy if exists "insumo_cadastro_importacao: admin le" on public.insumo_cadastro_importacao;
create policy "insumo_cadastro_importacao: admin le" on public.insumo_cadastro_importacao
  for select to authenticated
  using ((select public.sou_admin()));

drop policy if exists "insumo_cadastro_importacao: admin registra" on public.insumo_cadastro_importacao;
create policy "insumo_cadastro_importacao: admin registra" on public.insumo_cadastro_importacao
  for insert to authenticated
  with check ((select public.sou_admin()) and por = lower((select auth.jwt()) ->> 'email'));

drop policy if exists "insumo_cadastro_importacao: admin atualiza" on public.insumo_cadastro_importacao;
create policy "insumo_cadastro_importacao: admin atualiza" on public.insumo_cadastro_importacao
  for update to authenticated
  using ((select public.sou_admin()))
  with check ((select public.sou_admin()));

-- A tabela ativa: o time le (a importacao confere contra ela), o admin troca.
drop policy if exists "insumo_tabela_ativa: time le" on public.insumo_tabela_ativa;
create policy "insumo_tabela_ativa: time le" on public.insumo_tabela_ativa
  for select to authenticated
  using ((select public.meu_perfil()) is not null);

drop policy if exists "insumo_tabela_ativa: admin troca" on public.insumo_tabela_ativa;
create policy "insumo_tabela_ativa: admin troca" on public.insumo_tabela_ativa
  for update to authenticated
  using ((select public.sou_admin()))
  with check ((select public.sou_admin()));

-- ---------- o balde dos arquivos importados (SEG-34) ----------
-- Privado, so' xlsx, ate' 10 MB. O caminho e' gerado pela API.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('insumo-importacao', 'insumo-importacao', false, 10485760,
        array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "insumo-importacao: admin le" on storage.objects;
create policy "insumo-importacao: admin le" on storage.objects
  for select to authenticated
  using (bucket_id = 'insumo-importacao' and (select public.sou_admin()));

drop policy if exists "insumo-importacao: admin envia" on storage.objects;
create policy "insumo-importacao: admin envia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'insumo-importacao' and (select public.sou_admin()));

drop policy if exists "insumo-importacao: admin troca" on storage.objects;
create policy "insumo-importacao: admin troca" on storage.objects
  for update to authenticated
  using (bucket_id = 'insumo-importacao' and (select public.sou_admin()))
  with check (bucket_id = 'insumo-importacao' and (select public.sou_admin()));

drop policy if exists "insumo-importacao: admin apaga" on storage.objects;
create policy "insumo-importacao: admin apaga" on storage.objects
  for delete to authenticated
  using (bucket_id = 'insumo-importacao' and (select public.sou_admin()));

-- ---------- CONFERIR ----------
-- Tem que devolver: a tabela 1 ativa, o cadastro vazio, o balde privado.
--   select codigo, nome from public.insumo_tabela_ativa;
--   select count(*) from public.insumo_cadastro;
--   select id, public, file_size_limit from storage.buckets where id = 'insumo-importacao';
