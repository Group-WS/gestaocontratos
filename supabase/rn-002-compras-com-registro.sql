-- ============================================================
-- RN-002 · A TRAVA FICA SO' NO EXECUTIVO; COMPRAS MUDA COM REGISTRO
--          (25/09/2026)
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
-- Reaplicavel: rodar de novo nao quebra nada. Roda DEPOIS do
-- rn-002-item-aprovado-no-executivo.sql (substitui o gatilho dele) e do
-- rls-reforco.sql (usa minhas_obras()).
-- ============================================================
--
-- Ficha: docs/regras-de-negocio/RN-002-item-aprovado-no-executivo.md
-- Regra (a mesma conta, em JS): web/src/regras/itemAprovadoNoExecutivo.js
--
-- Antes, o gatilho recusava qualquer gravacao que mudasse um item aprovado
-- na lista de trabalho (itens) — e Compras de Produtos, que so' mexe nela,
-- ficava travada tambem. Agora:
--
-- 1. A TRAVA olha so' a planilha do Executivo (itensPlanilhaExecutivo): a
--    linha cujo id (ADR-007) tem item travado (aprovado para compra,
--    solicitado, comprado, com canal, avulso ou de aditivo) precisa
--    continuar existindo depois com os mesmos campos. A linha sem id nao e'
--    travada aqui (a migracao do ADR-007 deu id a todas); a tela segue
--    travando pela descricao.
--
-- 2. O REGISTRO: na lista de trabalho o item aprovado pode mudar, e cada
--    campo travado que muda vira uma linha em obra_item_aprovado_log —
--    quem, quando, campo, antes e depois.
--
-- A trava so' vale para o papel do app (authenticated); o registro vale
-- para toda gravacao.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- RN-002 · o valor conta como "ligado" (o mesmo verdadeiro do JavaScript).
create or replace function private.rn002_ligado(v jsonb)
returns boolean
language sql immutable set search_path = ''
as $$
  select v is not null and v not in ('null'::jsonb, 'false'::jsonb, '""'::jsonb, '0'::jsonb)
$$;

-- RN-002 · as digitais das linhas (so' os campos travados), contadas.
-- ids nulo = todas as linhas; senao, so' as linhas com esses ids.
drop function if exists private.rn002_digitais(jsonb, boolean);
create or replace function private.rn002_digitais(cats jsonb, ids text[])
returns table (digital jsonb, qtd bigint)
language sql immutable set search_path = ''
as $$
  select jsonb_build_array(
           coalesce(l -> 'desc', 'null'::jsonb), coalesce(l -> 'especificacao', 'null'::jsonb),
           coalesce(l -> 'marca', 'null'::jsonb), coalesce(l -> 'ambiente', 'null'::jsonb),
           coalesce(l -> 'un', 'null'::jsonb),
           coalesce(l -> 'qtdVendida', 'null'::jsonb), coalesce(l -> 'qtdExecutivo', 'null'::jsonb),
           coalesce(l -> 'custo', 'null'::jsonb), coalesce(l -> 'custoUnitario', 'null'::jsonb),
           coalesce(l -> 'custoMaterial', 'null'::jsonb), coalesce(l -> 'custoMO', 'null'::jsonb),
           coalesce(l -> 'totalMaterial', 'null'::jsonb), coalesce(l -> 'totalMO', 'null'::jsonb),
           to_jsonb(coalesce(l -> 'excluido' = 'true'::jsonb, false))
         ), count(*)
    from jsonb_array_elements(case when jsonb_typeof(cats) = 'array' then cats else '[]'::jsonb end) as c,
         jsonb_array_elements(case when jsonb_typeof(c -> 'itensPlanilhaExecutivo') = 'array' then c -> 'itensPlanilhaExecutivo' else '[]'::jsonb end) as l
   where ids is null or (l ->> 'idLinha') = any (ids)
   group by 1
$$;

-- RN-002 · o item da lista de trabalho esta' travado?
create or replace function private.rn002_travado(it jsonb)
returns boolean
language sql immutable set search_path = ''
as $$
  select private.rn002_ligado(it -> 'liberadoCompra') or private.rn002_ligado(it -> 'comprado')
      or private.rn002_ligado(it -> 'canalCompra') or private.rn002_ligado(it -> 'solicitado')
      or private.rn002_ligado(it -> 'avulso') or private.rn002_ligado(it -> 'aditivo')
$$;

-- RN-002 · os ids das linhas com item travado.
create or replace function private.rn002_ids_travados(cats jsonb)
returns text[]
language sql immutable set search_path = ''
as $$
  select coalesce(array_agg(distinct it ->> 'idLinha'), '{}')
    from jsonb_array_elements(case when jsonb_typeof(cats) = 'array' then cats else '[]'::jsonb end) as c,
         jsonb_array_elements(case when jsonb_typeof(c -> 'itens') = 'array' then c -> 'itens' else '[]'::jsonb end) as it
   where coalesce(it ->> 'idLinha', '') <> '' and private.rn002_travado(it)
$$;

-- RN-002 · o gatilho da trava (so' a planilha do Executivo). Mesmo nome
-- do de antes: o create or replace troca o corpo, o gatilho fica.
create or replace function private.rn002_confere_travados()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  ids text[];
begin
  if current_user <> 'authenticated' then return new; end if;
  if tg_op <> 'UPDATE' or new.categorias is not distinct from old.categorias then return new; end if;

  ids := private.rn002_ids_travados(old.categorias);
  if cardinality(ids) = 0 then return new; end if;

  if exists (
    select 1
      from private.rn002_digitais(old.categorias, ids) a
      left join private.rn002_digitais(new.categorias, null) n on n.digital = a.digital
     where coalesce(n.qtd, 0) < a.qtd
  ) then
    raise exception 'RN-002: item aprovado para compra não pode ser editado nem removido no Executivo. Desfaça a aprovação antes.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------- RN-002 · o registro das mudancas no item aprovado ----------
-- So' cresce: sem policy de insert, update ou delete; quem escreve e' o
-- gatilho abaixo (security definer).
create table if not exists public.obra_item_aprovado_log (
  id           bigint generated always as identity primary key,
  obra_codigo  text not null references public.obra (codigo) on delete cascade,
  verba        text,
  id_linha     text,
  descricao    text,
  campo        text not null check (char_length(campo) between 1 and 40),
  antes        jsonb,
  depois       jsonb,
  autor        text not null,
  criado_em    timestamptz not null default now()
);

-- Leitura: "as mudancas desta obra, da mais nova para a mais antiga" e
-- "as de um item". Cobre a FK (SQL-30).
create index if not exists obra_item_aprovado_log_obra_idx
  on public.obra_item_aprovado_log (obra_codigo, criado_em desc);
create index if not exists obra_item_aprovado_log_linha_idx
  on public.obra_item_aprovado_log (obra_codigo, id_linha, criado_em desc);

alter table public.obra_item_aprovado_log enable row level security;

drop policy if exists "obra_item_aprovado_log: ler" on public.obra_item_aprovado_log;
create policy "obra_item_aprovado_log: ler" on public.obra_item_aprovado_log
  for select to authenticated
  using (obra_codigo in (select public.minhas_obras()));

-- RN-002 · a mesma conta de alteracoesEmItensAprovados (JS): o item casa
-- pela verba, pelo id da linha e pela ordem entre os de mesmo id; sem id,
-- pela posicao na verba.
create or replace function private.rn002_itens_por_chave(cats jsonb)
returns table (chave text, verba text, item jsonb)
language sql immutable set search_path = ''
as $$
  select concat_ws('|', c ->> 'num', b.base,
           (row_number() over (partition by c ->> 'num', b.base order by i.pos) - 1)::text),
         c ->> 'num', i.it
    from jsonb_array_elements(case when jsonb_typeof(cats) = 'array' then cats else '[]'::jsonb end) as c,
         jsonb_array_elements(case when jsonb_typeof(c -> 'itens') = 'array' then c -> 'itens' else '[]'::jsonb end)
           with ordinality as i(it, pos),
         lateral (select case when coalesce(i.it ->> 'idLinha', '') <> ''
                              then 'id:' || (i.it ->> 'idLinha')
                              else 'pos:' || (i.pos - 1)::text end as base) b
$$;

create or replace function private.rn002_registra_mudancas()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  quem text := coalesce(lower((select auth.jwt()) ->> 'email'), new.atualizado_por, current_user);
begin
  if new.categorias is not distinct from old.categorias then return null; end if;

  insert into public.obra_item_aprovado_log (obra_codigo, verba, id_linha, descricao, campo, antes, depois, autor)
  select new.obra_codigo, a.verba, a.item ->> 'idLinha', a.item ->> 'desc', m.campo, m.antes, m.depois, quem
    from private.rn002_itens_por_chave(old.categorias) a
    left join private.rn002_itens_por_chave(new.categorias) n on n.chave = a.chave
    cross join lateral (
      select 'removido'::text as campo, 'true'::jsonb as antes, null::jsonb as depois
       where n.item is null
      union all
      select k.campo, k.antes, k.depois
        from (select f.campo,
                     case when f.campo = 'excluido' then to_jsonb(coalesce(a.item -> 'excluido' = 'true'::jsonb, false))
                          else nullif(a.item -> f.campo, 'null'::jsonb) end as antes,
                     case when f.campo = 'excluido' then to_jsonb(coalesce(n.item -> 'excluido' = 'true'::jsonb, false))
                          else nullif(n.item -> f.campo, 'null'::jsonb) end as depois
                from unnest(array['desc', 'especificacao', 'marca', 'ambiente', 'un',
                                  'qtdVendida', 'qtdExecutivo',
                                  'custo', 'custoUnitario', 'custoMaterial', 'custoMO', 'totalMaterial', 'totalMO',
                                  'excluido']) as f(campo)
               where n.item is not null) k
       where k.antes is distinct from k.depois
    ) m
   where private.rn002_travado(a.item);
  return null;
end;
$$;

revoke execute on function private.rn002_travado(jsonb) from public, anon;
revoke execute on function private.rn002_ids_travados(jsonb) from public, anon;
revoke execute on function private.rn002_itens_por_chave(jsonb) from public, anon;
revoke execute on function private.rn002_registra_mudancas() from public, anon, authenticated;
grant execute on function private.rn002_travado(jsonb) to authenticated;
grant execute on function private.rn002_ids_travados(jsonb) to authenticated;

drop trigger if exists trg_obra_dados_rn_002_registro on public.obra_dados;
create trigger trg_obra_dados_rn_002_registro after update on public.obra_dados
  for each row execute function private.rn002_registra_mudancas();

revoke execute on function private.rn002_ligado(jsonb) from public, anon;
revoke execute on function private.rn002_digitais(jsonb, text[]) from public, anon;
revoke execute on function private.rn002_confere_travados() from public, anon;
grant execute on function private.rn002_ligado(jsonb) to authenticated;
grant execute on function private.rn002_digitais(jsonb, text[]) to authenticated;

-- Nome com "rn_002" antes de "versao": os gatilhos BEFORE rodam em ordem
-- alfabetica, e a gravacao recusada nao chega a virar versao.
drop trigger if exists trg_obra_dados_rn_002 on public.obra_dados;
create trigger trg_obra_dados_rn_002 before update on public.obra_dados
  for each row execute function private.rn002_confere_travados();

-- Confere DEPOIS de rodar:
--   select tgname from pg_trigger where tgrelid = 'public.obra_dados'::regclass and not tgisinternal order by 1;
