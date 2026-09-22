-- ============================================================
-- RN-001 · SO' O ADMINISTRADOR LIBERA A COMPRA — garantia no banco
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
-- Reaplicavel: rodar de novo nao quebra nada.
-- Rode DEPOIS de rls-reforco.sql (bloco 6): usa public.meu_perfil().
-- ============================================================
--
-- Ficha: docs/regras-de-negocio/RN-001-liberacao-de-compra.md
-- Regra (a mesma conta, em JS): web/src/regras/liberacaoDeCompra.js
--
-- A tela ja' so' oferece "liberar para compra" e "liberar sem o cliente" ao
-- administrador. Mas a liberacao mora dentro do JSON da obra
-- (obra_dados.categorias[].itens[].liberadoCompra = { em, por }), e o banco
-- aceitava qualquer gravacao de quem edita: um GC marcava o item como
-- liberado direto pela API — e com o nome de outra pessoa no carimbo.
--
-- COMO O GATILHO DECIDE. Os itens nao tem identificador estavel (a posicao
-- muda quando entra ou sai linha), entao a comparacao e' pelo carimbo e
-- pela contagem: o que a gravacao ACRESCENTA, em relacao a linha de antes.
--   - liberacao pela alocacao (viaAlocacao, decisao de 17/09/2026): quem
--     edita, em nome proprio;
--   - qualquer outra liberacao, inclusive sem o cliente: so' admin ou
--     master, em nome proprio;
--   - restaurar versao nao e' liberar de novo: o carimbo volta, no maximo
--     tantas vezes quanto aparecia numa versao guardada (obra_versao).
--     Copiar o carimbo antigo para OUTROS itens passa da conta e e' recusado.
-- Tirar liberacao nao e' tratado aqui (substituir a planilha zera todas).
--
-- So' vale para o papel do app (authenticated). O SQL Editor grava como
-- quiser — e fica no historico, como sempre.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- RN-001 · os carimbos de liberacao de uma obra, contados por conteudo.
create or replace function private.rn001_carimbos(cats jsonb)
returns table (campo text, valor jsonb, qtd bigint)
language sql immutable set search_path = ''
as $$
  select k.campo, it -> k.campo, count(*)
    from jsonb_array_elements(case when jsonb_typeof(cats) = 'array' then cats else '[]'::jsonb end) as c,
         jsonb_array_elements(case when jsonb_typeof(c -> 'itens') = 'array' then c -> 'itens' else '[]'::jsonb end) as it,
         (values ('liberadoCompra'), ('liberadoSemCliente')) as k(campo)
   where coalesce(it -> k.campo, 'null'::jsonb) not in ('null'::jsonb, 'false'::jsonb)
   group by 1, 2
$$;

-- RN-001 · quantas vezes, no maximo, o carimbo aparecia numa versao da obra.
create or replace function private.rn001_vezes_no_historico(p_obra text, p_campo text, p_carimbo jsonb)
returns bigint
language sql stable set search_path = ''
as $$
  select coalesce(max(h.qtd), 0)
    from public.obra_versao v
   cross join lateral private.rn001_carimbos(v.conteudo -> 'categorias') h
   where v.obra_codigo = p_obra and h.campo = p_campo and h.valor = p_carimbo
$$;

-- RN-001 · o gatilho.
create or replace function private.rn001_confere_liberacao()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  quem          text := lower(trim(coalesce((select auth.jwt()) ->> 'email', '')));
  pode_liberar  boolean;
  v             record;
  objeto        boolean;
  proprio       boolean;
  via_alocacao  boolean;
begin
  if current_user <> 'authenticated' then return new; end if;
  if tg_op = 'UPDATE' and new.categorias is not distinct from old.categorias then return new; end if;

  -- meu_perfil() ja' so' devolve perfil de pessoa ATIVA.
  pode_liberar := coalesce((select public.meu_perfil()) in ('admin', 'master'), false);

  for v in
    select n.campo, n.valor, n.qtd as total
      from private.rn001_carimbos(new.categorias) n
      left join private.rn001_carimbos(case when tg_op = 'UPDATE' then old.categorias else '[]'::jsonb end) a
        on a.campo = n.campo and a.valor = n.valor
     where n.qtd > coalesce(a.qtd, 0)
  loop
    -- coalesce em tudo: campo ausente no carimbo e' NULL no SQL, e um NULL
    -- aqui atravessaria os `continue when` e cairia na recusa errada.
    objeto := coalesce(jsonb_typeof(v.valor) = 'object', false);
    proprio := objeto and coalesce(lower(trim(v.valor ->> 'por')) = quem, false);
    via_alocacao := v.campo = 'liberadoCompra' and objeto
                    and coalesce((v.valor -> 'viaAlocacao') = 'true'::jsonb, false);

    -- O caminho de sempre: pela alocacao, ou pelo administrador, em nome proprio.
    continue when via_alocacao and proprio;
    continue when not via_alocacao and pode_liberar and (proprio or not objeto);
    -- Restauracao de versao.
    continue when objeto and v.total <= private.rn001_vezes_no_historico(new.obra_codigo, v.campo, v.valor);

    if via_alocacao or (pode_liberar and objeto) then
      raise exception 'RN-001: a liberação é registrada em nome de quem está logado.' using errcode = '42501';
    end if;
    raise exception 'RN-001: só o administrador libera a compra.' using errcode = '42501';
  end loop;
  return new;
end;
$$;

revoke execute on function private.rn001_carimbos(jsonb) from public, anon;
revoke execute on function private.rn001_vezes_no_historico(text, text, jsonb) from public, anon;
revoke execute on function private.rn001_confere_liberacao() from public, anon;
grant execute on function private.rn001_carimbos(jsonb) to authenticated;
grant execute on function private.rn001_vezes_no_historico(text, text, jsonb) to authenticated;

-- Nome com "rn_001" antes de "versao": os gatilhos BEFORE rodam em ordem
-- alfabetica, e a gravacao recusada nao chega a virar versao.
drop trigger if exists trg_obra_dados_rn_001 on public.obra_dados;
create trigger trg_obra_dados_rn_001 before insert or update on public.obra_dados
  for each row execute function private.rn001_confere_liberacao();

-- Confere DEPOIS de rodar:
--   select tgname from pg_trigger where tgrelid = 'public.obra_dados'::regclass and not tgisinternal order by 1;
