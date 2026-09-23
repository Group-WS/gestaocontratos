-- ============================================================
-- RN-002 · ITEM APROVADO PARA COMPRA NAO SE EDITA NEM SE REMOVE NO EXECUTIVO
--          — garantia no banco
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
-- Reaplicavel: rodar de novo nao quebra nada.
-- ============================================================
--
-- Ficha: docs/regras-de-negocio/RN-002-item-aprovado-no-executivo.md
-- Decisao: docs/ADR-006-executivo-trava-item-aprovado.md
-- Regra (a mesma conta, em JS): web/src/regras/itemAprovadoNoExecutivo.js
--
-- A tela ja' nao deixa editar, remover nem substituir a linha aprovada. O
-- gatilho garante o mesmo para quem grava pela API: cada item travado de
-- antes (aprovado para compra, solicitado, comprado, com canal, avulso ou
-- de aditivo) precisa continuar existindo depois com os mesmos campos da
-- planilha. Os itens nao tem identificador estavel, entao a conta e' por
-- conteudo, como na RN-001.
--
-- Vale para todos, inclusive o administrador (decisao de 23/09/2026): para
-- mexer, desfaz-se a aprovacao antes. Substituir ou limpar a planilha e
-- restaurar versao que mude item travado tambem sao recusados.
--
-- So' vale para o papel do app (authenticated). O SQL Editor grava como
-- quiser — e fica no historico, como sempre.

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

-- RN-002 · as digitais dos itens de uma obra (so' os campos travados), contadas.
create or replace function private.rn002_digitais(cats jsonb, so_travados boolean)
returns table (digital jsonb, qtd bigint)
language sql immutable set search_path = ''
as $$
  select jsonb_build_array(
           coalesce(it -> 'desc', 'null'::jsonb), coalesce(it -> 'especificacao', 'null'::jsonb),
           coalesce(it -> 'marca', 'null'::jsonb), coalesce(it -> 'ambiente', 'null'::jsonb),
           coalesce(it -> 'un', 'null'::jsonb),
           coalesce(it -> 'qtdVendida', 'null'::jsonb), coalesce(it -> 'qtdExecutivo', 'null'::jsonb),
           coalesce(it -> 'custo', 'null'::jsonb), coalesce(it -> 'custoUnitario', 'null'::jsonb),
           coalesce(it -> 'custoMaterial', 'null'::jsonb), coalesce(it -> 'custoMO', 'null'::jsonb),
           coalesce(it -> 'totalMaterial', 'null'::jsonb), coalesce(it -> 'totalMO', 'null'::jsonb),
           to_jsonb(coalesce(it -> 'excluido' = 'true'::jsonb, false))
         ), count(*)
    from jsonb_array_elements(case when jsonb_typeof(cats) = 'array' then cats else '[]'::jsonb end) as c,
         jsonb_array_elements(case when jsonb_typeof(c -> 'itens') = 'array' then c -> 'itens' else '[]'::jsonb end) as it
   where not so_travados
      or private.rn002_ligado(it -> 'liberadoCompra') or private.rn002_ligado(it -> 'comprado')
      or private.rn002_ligado(it -> 'canalCompra') or private.rn002_ligado(it -> 'solicitado')
      or private.rn002_ligado(it -> 'avulso') or private.rn002_ligado(it -> 'aditivo')
   group by 1
$$;

-- RN-002 · o gatilho.
create or replace function private.rn002_confere_travados()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then return new; end if;
  if tg_op <> 'UPDATE' or new.categorias is not distinct from old.categorias then return new; end if;

  if exists (
    select 1
      from private.rn002_digitais(old.categorias, true) a
      left join private.rn002_digitais(new.categorias, false) n on n.digital = a.digital
     where coalesce(n.qtd, 0) < a.qtd
  ) then
    raise exception 'RN-002: item aprovado para compra não pode ser editado nem removido no Executivo. Desfaça a aprovação antes.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function private.rn002_ligado(jsonb) from public, anon;
revoke execute on function private.rn002_digitais(jsonb, boolean) from public, anon;
revoke execute on function private.rn002_confere_travados() from public, anon;
grant execute on function private.rn002_ligado(jsonb) to authenticated;
grant execute on function private.rn002_digitais(jsonb, boolean) to authenticated;

-- Nome com "rn_002" antes de "versao": os gatilhos BEFORE rodam em ordem
-- alfabetica, e a gravacao recusada nao chega a virar versao.
drop trigger if exists trg_obra_dados_rn_002 on public.obra_dados;
create trigger trg_obra_dados_rn_002 before update on public.obra_dados
  for each row execute function private.rn002_confere_travados();

-- Confere DEPOIS de rodar:
--   select tgname from pg_trigger where tgrelid = 'public.obra_dados'::regclass and not tgisinternal order by 1;
