-- ============================================================
-- GRAVAÇÃO PROTEGIDA DA OBRA · trava e versão conferidas no banco
-- Como usar: Supabase → SQL Editor → colar tudo → Run.
-- Reaplicável: rodar de novo não duplica nada e não apaga nada.
-- Rode DEPOIS de rn-001-liberacao-de-compra.sql (bloco 6 do README).
-- ============================================================
--
-- POR QUE ISTO EXISTE
-- O app gravava a obra com um UPSERT da linha inteira de `obra_dados`, e o
-- comentário dele dizia que só quem estava com a trava conseguia — mas o
-- UPSERT não tinha condição nenhuma. Três jeitos de perder trabalho em
-- silêncio, todos possíveis antes deste arquivo:
--
--   1. CÓPIA VELHA. A e B abrem a obra às 9h. B edita e sai às 9h10. Às
--      9h20 A habilita a edição na tela aberta desde as 9h e mexe num campo:
--      a cópia das 9h vai inteira por cima do trabalho de B.
--   2. TRAVA IGNORADA. A trava vence em 5 minutos sem gravação. Se as
--      gravações de A falham (rede) e B assume, a volta da rede de A grava
--      o documento dele por cima do de B.
--   3. FORA DE ORDEM. Duas gravações seguidas da mesma tela, a primeira
--      mais lenta: ela chega depois e desfaz a segunda.
--
-- O QUE MUDA
--   - `obra_dados.versao`: um número que sobe sozinho a cada mudança de
--     CONTEÚDO (gatilho). Pegar e soltar a trava não mexem nele.
--   - `salvar_obra(codigo, versao, conteudo)`: a gravação inteira. Só grava
--     se a trava for de quem está gravando E se a versão for a mesma que a
--     tela leu. Se não bater, NÃO grava e devolve o motivo — a tela avisa.
--   - `aplicar_patch_obra(codigo, patches, versao)`: o patch passa a
--     conferir as duas coisas também. Chamado sem a versão (o app de antes
--     deste arquivo), segue a regra antiga, para não quebrar quem está com
--     a aba aberta durante a troca.
--   - `restaurar_versao_obra(codigo, id)`: restaurar deixa de ser um UPSERT
--     do navegador e passa pelo mesmo tipo de conferência.
--   - Gatilho de trava: gravação direta de conteúdo por cima da trava VIVA
--     de outra pessoa é recusada — inclusive a do app antigo.
--   - Histórico mais fino: toda gravação inteira vira versão (antes era uma
--     por hora). A poda continua, e guarda também os marcos de hora em
--     hora, para as cópias finas não empurrarem as antigas para fora.
--
-- COMPATÍVEL COM O APP NO AR (SQL-03). Nada aqui recusa uma gravação que o
-- app de hoje faz no uso normal: ele só grava com a trava dele. O que passa
-- a ser recusado é exatamente o estrago (gravar por cima da trava viva de
-- outra pessoa). O fechamento completo — o app antigo parar de gravar
-- direto — está em `salvar-obra-contrair.sql`, que roda DEPOIS do deploy.
--
-- Nenhum dado de obra é alterado ao rodar este arquivo.
-- ============================================================

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ---------- 1. A versão da linha ----------
-- `default 1` preenche as linhas que já existem sem reescrever a tabela.
alter table public.obra_dados add column if not exists versao bigint not null default 1;

-- As colunas que NÃO são conteúdo: a trava e o carimbo de quem gravou.
-- Mudança só nelas não é trabalho de ninguém — não muda a versão, não vira
-- histórico e não esbarra na trava.
create or replace function private.obra_dados_controle()
returns text[]
language sql immutable set search_path = ''
as $$
  select array['versao', 'editando_por', 'editando_desde', 'atualizado_por', 'atualizado_em']
$$;

-- A versão sobe quando QUALQUER coluna de conteúdo muda — inclusive coluna
-- criada depois deste arquivo, porque a comparação é da linha inteira menos
-- as de controle. Quem grava não escolhe o número: o gatilho sempre decide.
create or replace function private.obra_dados_conta_versao()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if (to_jsonb(new) - private.obra_dados_controle())
     is distinct from (to_jsonb(old) - private.obra_dados_controle()) then
    new.versao := old.versao + 1;
  else
    new.versao := old.versao;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_obra_dados_versao_numero on public.obra_dados;
create trigger trg_obra_dados_versao_numero
  before update on public.obra_dados
  for each row execute function private.obra_dados_conta_versao();

-- ---------- 2. Contar itens sem depender do search_path ----------
-- `public.obra_conta_itens` chama `obra_len_lista` sem o schema, e por isso
-- quebra dentro de função com `search_path` vazio. Esta é a mesma conta, só
-- com o que vem do próprio Postgres.
create or replace function private.obra_conta_itens(cats jsonb)
returns integer
language sql immutable set search_path = ''
as $$
  select coalesce((
    select sum(
             case when jsonb_typeof(c -> 'itens') = 'array' then jsonb_array_length(c -> 'itens') else 0 end
           + case when jsonb_typeof(c -> 'itensContrato') = 'array' then jsonb_array_length(c -> 'itensContrato') else 0 end
           + case when jsonb_typeof(c -> 'itensPlanilha') = 'array' then jsonb_array_length(c -> 'itensPlanilha') else 0 end
           + case when jsonb_typeof(c -> 'itensPlanilhaExecutivo') = 'array' then jsonb_array_length(c -> 'itensPlanilhaExecutivo') else 0 end)
      from jsonb_array_elements(case when jsonb_typeof(cats) = 'array' then cats else '[]'::jsonb end) as c
  ), 0)::integer
$$;

-- ---------- 3. Escrever o conteúdo (uso interno) ----------
-- Cada coluna só é escrita quando veio no conteúdo; a que não veio fica como
-- está. É o que deixa um app mais antigo — que não conhece uma coluna nova —
-- gravar sem apagá-la.
--
-- SECURITY INVOKER: roda como quem chamou, então o RLS e o gatilho da RN-001
-- continuam valendo. `confere.gravacao` diz aos gatilhos por onde a gravação
-- veio (histórico e trava leem isso) e só vale até o fim da transação.
--
-- `p_trava`: o dono da trava depois da gravação, que também a renova. Nulo
-- deixa a trava como está (a restauração não mexe nela).
create or replace function private.obra_dados_escrever(p_codigo text, p_conteudo jsonb, p_quem text, p_origem text, p_trava text)
returns bigint
language plpgsql security invoker set search_path = ''
as $$
declare
  c    jsonb := coalesce(p_conteudo, '{}'::jsonb);
  nova bigint;
begin
  perform set_config('confere.gravacao', p_origem, true);

  update public.obra_dados d set
    categorias                 = case when c ? 'categorias' then c -> 'categorias' else d.categorias end,
    cadernos                   = case when c ? 'cadernos' then c -> 'cadernos' else d.cadernos end,
    arquivos                   = case when c ? 'arquivos' then c -> 'arquivos' else d.arquivos end,
    aprovacoes                 = case when c ? 'aprovacoes' then c -> 'aprovacoes' else d.aprovacoes end,
    escopos                    = case when c ? 'escopos' then c -> 'escopos' else d.escopos end,
    etapas_concluidas          = case when c ? 'etapas_concluidas' then c -> 'etapas_concluidas' else d.etapas_concluidas end,
    depara_aprovado            = case when c ? 'depara_aprovado' then (c ->> 'depara_aprovado')::boolean else d.depara_aprovado end,
    executivo_liberado_direto  = case when c ? 'executivo_liberado_direto' then (c ->> 'executivo_liberado_direto')::boolean else d.executivo_liberado_direto end,
    compras_liberadas          = case when c ? 'compras_liberadas' then (c ->> 'compras_liberadas')::boolean else d.compras_liberadas end,
    cliente_assinou_em         = case when c ? 'cliente_assinou_em' then (c ->> 'cliente_assinou_em')::date else d.cliente_assinou_em end,
    cliente_assinatura_por     = case when c ? 'cliente_assinatura_por' then c ->> 'cliente_assinatura_por' else d.cliente_assinatura_por end,
    cliente_assinatura_arq     = case when c ? 'cliente_assinatura_arq' then nullif(c -> 'cliente_assinatura_arq', 'null'::jsonb) else d.cliente_assinatura_arq end,
    cliente_assinatura_obs     = case when c ? 'cliente_assinatura_obs' then c ->> 'cliente_assinatura_obs' else d.cliente_assinatura_obs end,
    compra_sem_assinatura_por  = case when c ? 'compra_sem_assinatura_por' then c ->> 'compra_sem_assinatura_por' else d.compra_sem_assinatura_por end,
    compra_sem_assinatura_em   = case when c ? 'compra_sem_assinatura_em' then (c ->> 'compra_sem_assinatura_em')::timestamptz else d.compra_sem_assinatura_em end,
    compra_sem_assinatura_just = case when c ? 'compra_sem_assinatura_just' then c ->> 'compra_sem_assinatura_just' else d.compra_sem_assinatura_just end,
    cmv_liberado               = case when c ? 'cmv_liberado' then (c ->> 'cmv_liberado')::numeric else d.cmv_liberado end,
    cmv_liberado_em            = case when c ? 'cmv_liberado_em' then (c ->> 'cmv_liberado_em')::timestamptz else d.cmv_liberado_em end,
    cmv_liberado_por           = case when c ? 'cmv_liberado_por' then c ->> 'cmv_liberado_por' else d.cmv_liberado_por end,
    data_entrega               = case when c ? 'data_entrega' then (c ->> 'data_entrega')::date else d.data_entrega end,
    atualizado_por             = p_quem,
    editando_por               = coalesce(p_trava, d.editando_por),
    editando_desde             = case when p_trava is null then d.editando_desde else now() end
   where d.obra_codigo = p_codigo
  returning d.versao into nova;

  -- O sinal vale só para esta escrita: um UPDATE direto depois dela, na mesma
  -- transação, não pode passar por gravação protegida.
  perform set_config('confere.gravacao', '', true);
  return nova;
end;
$$;

-- O formato de cada coluna, conferido ANTES de escrever. Tipo errado vira
-- recusa com motivo, e não um erro de conversão no meio da gravação.
create or replace function private.obra_conteudo_valido(p_conteudo jsonb)
returns boolean
language sql immutable set search_path = ''
as $$
  select jsonb_typeof(p_conteudo) = 'object' and not exists (
    select 1 from jsonb_each(p_conteudo) e
     where (e.key in ('categorias', 'aprovacoes', 'arquivos', 'escopos') and jsonb_typeof(e.value) <> 'array')
        or (e.key in ('cadernos', 'etapas_concluidas') and jsonb_typeof(e.value) <> 'object')
        or (e.key in ('depara_aprovado', 'executivo_liberado_direto', 'compras_liberadas') and jsonb_typeof(e.value) <> 'boolean')
        or (e.key = 'cmv_liberado' and jsonb_typeof(e.value) not in ('number', 'null'))
        or (e.key = 'cliente_assinatura_arq' and jsonb_typeof(e.value) not in ('object', 'null'))
        or (e.key in ('cliente_assinatura_por', 'cliente_assinatura_obs', 'compra_sem_assinatura_por',
                      'compra_sem_assinatura_just', 'cmv_liberado_por', 'cliente_assinou_em', 'data_entrega',
                      'cmv_liberado_em', 'compra_sem_assinatura_em')
            and jsonb_typeof(e.value) not in ('string', 'null'))
  )
$$;

-- ---------- 4. A gravação inteira ----------
create or replace function public.salvar_obra(p_codigo text, p_versao bigint, p_conteudo jsonb)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  quem   text := lower(trim(coalesce((select auth.jwt()) ->> 'email', '')));
  linha  record;
  nova   bigint;
begin
  if quem = '' then
    return jsonb_build_object('ok', false, 'motivo', 'sem_usuario');
  end if;
  if p_conteudo is null or not private.obra_conteudo_valido(p_conteudo) then
    return jsonb_build_object('ok', false, 'motivo', 'conteudo_invalido');
  end if;

  -- `for update` segura a linha até o fim: duas gravações ao mesmo tempo
  -- entram em fila, e a segunda confere a versão que a primeira deixou.
  select d.versao, lower(trim(coalesce(d.editando_por, ''))) as dono, d.editando_por, d.editando_desde,
         d.atualizado_por, d.atualizado_em, d.categorias
    into linha
    from public.obra_dados d
   where d.obra_codigo = p_codigo
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'sem_linha');
  end if;

  -- A TRAVA É DE QUEM GRAVA. Trava vencida que ninguém assumiu continua sendo
  -- de quem a tinha (gravar renova); trava de outra pessoa, viva ou vencida,
  -- recusa — o app assume de novo pelo caminho de sempre, se estiver livre.
  if linha.dono <> quem then
    return jsonb_build_object('ok', false, 'motivo', 'trava',
      'por', linha.editando_por, 'desde', linha.editando_desde);
  end if;

  -- A VERSÃO É A QUE A TELA LEU. Diferente = alguém mudou a obra depois que
  -- esta tela a carregou, e gravar agora apagaria esse trabalho.
  if p_versao is null or linha.versao <> p_versao then
    return jsonb_build_object('ok', false, 'motivo', 'versao', 'versao', linha.versao,
      'atualizado_por', linha.atualizado_por, 'atualizado_em', linha.atualizado_em);
  end if;

  -- CINTO DE SEGURANÇA (19/09/2026, obra 2450): obra sem item nenhum não grava
  -- por cima de obra com itens. Era conferido só no navegador; aqui vale para
  -- qualquer caminho, na mesma transação da gravação.
  if p_conteudo ? 'categorias'
     and private.obra_conta_itens(p_conteudo -> 'categorias') = 0
     and private.obra_conta_itens(linha.categorias) > 0 then
    return jsonb_build_object('ok', false, 'motivo', 'vazia');
  end if;

  -- Gravar renova a trava: quem está trabalhando não perde a obra no meio.
  nova := private.obra_dados_escrever(p_codigo, p_conteudo, quem, 'inteira', linha.editando_por);

  return jsonb_build_object('ok', true, 'versao', nova);
end;
$$;

revoke execute on function public.salvar_obra(text, bigint, jsonb) from public, anon;
grant execute on function public.salvar_obra(text, bigint, jsonb) to authenticated;

-- ---------- 5. O patch, com trava e versão ----------
-- A assinatura muda (ganha `p_versao`), então a antiga sai: duas versões da
-- função com os mesmos nomes de parâmetro deixariam o PostgREST sem saber
-- qual chamar. Quem chama só com código e patches cai nesta, com a versão
-- vazia — é o app de antes deste arquivo, e ele segue a regra de antes.
drop function if exists public.aplicar_patch_obra(text, jsonb);

create or replace function public.aplicar_patch_obra(p_codigo text, p_patches jsonb, p_versao bigint default null)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  atual      jsonb;
  linha      record;
  p          jsonb;
  vi         int;
  ii         int;
  alvo       jsonb;
  aplicados  int := 0;
  recusados  jsonb := '[]'::jsonb;
  marcas     jsonb := '{}'::jsonb;
  col        text;
  nova       bigint;
  quem       text := lower(trim(coalesce((select auth.jwt()) ->> 'email', '')));
begin
  if quem = '' then
    return jsonb_build_object('ok', false, 'motivo', 'sem usuario identificado');
  end if;

  select d.categorias, d.versao, lower(trim(coalesce(d.editando_por, ''))) as dono, d.editando_por,
         d.editando_desde, d.atualizado_por, d.atualizado_em
    into linha
    from public.obra_dados d
   where d.obra_codigo = p_codigo
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'obra sem linha em obra_dados');
  end if;
  atual := linha.categorias;

  if p_versao is not null then
    -- O app novo: a mesma conferência da gravação inteira.
    if linha.dono <> quem then
      return jsonb_build_object('ok', false, 'motivo', 'trava', 'por', linha.editando_por, 'desde', linha.editando_desde);
    end if;
    if linha.versao <> p_versao then
      return jsonb_build_object('ok', false, 'motivo', 'versao', 'versao', linha.versao,
        'atualizado_por', linha.atualizado_por, 'atualizado_em', linha.atualizado_em);
    end if;
  elsif linha.dono <> '' and linha.dono <> quem and linha.editando_desde > now() - interval '5 minutes' then
    -- O app antigo: a regra de antes (trava de outra pessoa, ainda viva, recusa).
    return jsonb_build_object('ok', false, 'motivo', 'trava de outra pessoa', 'por', linha.dono);
  end if;

  for p in select value from jsonb_array_elements(p_patches) loop
    vi := (p->>'verba')::int;

    if p ? 'item' then
      ii := (p->>'item')::int;
      alvo := atual -> vi -> 'itens' -> ii;

      -- CONFERE ANTES DE ESCREVER: o item é endereçado por posição, e o app
      -- manda o código e a descrição que viu. Não bateu, recusa.
      if alvo is null
         or (p ? 'confCodigo' and coalesce(alvo->>'codigo', '') <> coalesce(p->>'confCodigo', ''))
         or (p ? 'confDesc'   and coalesce(alvo->>'desc', '')   <> coalesce(p->>'confDesc', '')) then
        recusados := recusados || jsonb_build_array(p);
        continue;
      end if;

      atual := jsonb_set(atual, array[vi::text, 'itens', ii::text], alvo || (p->'campos'));
      aplicados := aplicados + 1;

    elsif p ? 'mapa' then
      if atual -> vi is null then
        recusados := recusados || jsonb_build_array(p);
        continue;
      end if;
      atual := jsonb_set(
        atual,
        array[vi::text, p->>'mapa', p->>'chave'],
        coalesce(atual -> vi -> (p->>'mapa') -> (p->>'chave'), '{}'::jsonb) || (p->'campos'),
        true
      );
      aplicados := aplicados + 1;

    elsif p ? 'coluna' then
      col := p->>'coluna';
      if col in ('aprovacoes', 'etapas_concluidas', 'depara_aprovado',
                 'executivo_liberado_direto', 'compras_liberadas',
                 'cmv_liberado', 'cmv_liberado_em', 'cmv_liberado_por',
                 'cliente_assinou_em', 'cliente_assinatura_por',
                 'cliente_assinatura_arq', 'cliente_assinatura_obs',
                 'compra_sem_assinatura_por', 'compra_sem_assinatura_em',
                 'compra_sem_assinatura_just', 'data_entrega') then
        marcas := marcas || jsonb_build_object(col, p->'valor');
        aplicados := aplicados + 1;
      else
        recusados := recusados || jsonb_build_array(p);
      end if;

    else
      recusados := recusados || jsonb_build_array(p);
    end if;
  end loop;

  -- Gravar renova a trava (e o app antigo, como sempre, a assume se estava livre).
  nova := private.obra_dados_escrever(p_codigo, marcas || jsonb_build_object('categorias', atual), quem, 'patch',
    case when linha.dono = quem then linha.editando_por else quem end);

  return jsonb_build_object('ok', true, 'aplicados', aplicados, 'recusados', recusados, 'versao', nova);
end;
$$;

revoke execute on function public.aplicar_patch_obra(text, jsonb, bigint) from public, anon;
grant execute on function public.aplicar_patch_obra(text, jsonb, bigint) to authenticated;

-- ---------- 6. Restaurar uma versão ----------
-- Era um UPSERT feito pelo navegador. Aqui ele confere a trava (restaurar por
-- cima de quem está editando apagaria o trabalho dessa pessoa) e passa pela
-- mesma escrita de sempre — a versão sobe, e a tela de quem estiver com a
-- obra aberta fica sabendo na próxima gravação.
create or replace function public.restaurar_versao_obra(p_codigo text, p_versao_id bigint)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  quem      text := lower(trim(coalesce((select auth.jwt()) ->> 'email', '')));
  guardada  record;
  linha     record;
  conteudo  jsonb;
  nova      bigint;
begin
  if quem = '' then
    return jsonb_build_object('ok', false, 'motivo', 'sem_usuario');
  end if;

  select h.obra_codigo, h.conteudo, h.n_itens, h.criado_em
    into guardada
    from public.obra_versao h
   where h.id = p_versao_id;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'sem_versao');
  end if;
  if guardada.obra_codigo <> p_codigo then
    return jsonb_build_object('ok', false, 'motivo', 'outra_obra');
  end if;

  -- Só o que EXISTE na versão e é conteúdo: coluna criada depois da cópia
  -- não aparece nela, e a trava e a identidade da linha nunca voltam.
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
    into conteudo
    from jsonb_each(guardada.conteudo) e
   where e.key in ('categorias', 'cadernos', 'arquivos', 'aprovacoes', 'depara_aprovado',
                   'executivo_liberado_direto', 'compras_liberadas', 'etapas_concluidas',
                   'cliente_assinou_em', 'cliente_assinatura_por', 'cliente_assinatura_arq',
                   'cliente_assinatura_obs', 'compra_sem_assinatura_por', 'compra_sem_assinatura_em',
                   'compra_sem_assinatura_just', 'cmv_liberado', 'cmv_liberado_em', 'cmv_liberado_por',
                   'data_entrega', 'escopos');

  select lower(trim(coalesce(d.editando_por, ''))) as dono, d.editando_por, d.editando_desde
    into linha
    from public.obra_dados d
   where d.obra_codigo = p_codigo
     for update;

  if not found then
    -- A obra foi APAGADA, e não só sobrescrita: volta a linha, depois o conteúdo.
    insert into public.obra_dados (obra_codigo) values (p_codigo);
  elsif linha.dono <> '' and linha.dono <> quem and linha.editando_desde > now() - interval '5 minutes' then
    return jsonb_build_object('ok', false, 'motivo', 'trava', 'por', linha.editando_por, 'desde', linha.editando_desde);
  end if;

  nova := private.obra_dados_escrever(p_codigo, conteudo, quem, 'restauracao', null);
  return jsonb_build_object('ok', true, 'versao', nova, 'restaurou', guardada.n_itens, 'de', guardada.criado_em);
end;
$$;

revoke execute on function public.restaurar_versao_obra(text, bigint) from public, anon;
grant execute on function public.restaurar_versao_obra(text, bigint) to authenticated;

-- ---------- 7. Ninguém grava por cima da trava viva de outra pessoa ----------
-- Vale para a gravação DIRETA (o UPSERT do app antigo, a API do Supabase
-- chamada na mão). As funções acima já conferem por conta própria.
--
-- Só conteúdo: pegar e soltar a trava continuam como sempre. E só o papel do
-- app (authenticated): o SQL Editor grava como quiser — e fica no histórico.
create or replace function private.obra_dados_respeita_trava()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  quem text := lower(trim(coalesce((select auth.jwt()) ->> 'email', '')));
  dono text := lower(trim(coalesce(old.editando_por, '')));
begin
  if current_user <> 'authenticated' then return new; end if;
  if (to_jsonb(new) - private.obra_dados_controle())
     is not distinct from (to_jsonb(old) - private.obra_dados_controle()) then
    return new;
  end if;
  if dono <> '' and dono <> quem and old.editando_desde > now() - interval '5 minutes' then
    raise exception '% está editando esta obra agora. Para não gravar por cima, esta alteração não foi salva.', old.editando_por
      using errcode = '55006';
  end if;
  return new;
end;
$$;

-- Nome entre "rn_001" e "versao": a RN-001 confere antes, e a gravação
-- recusada não chega a virar versão.
drop trigger if exists trg_obra_dados_trava on public.obra_dados;
create trigger trg_obra_dados_trava
  before update on public.obra_dados
  for each row execute function private.obra_dados_respeita_trava();

-- ---------- 8. Histórico mais fino ----------
-- `marco`: a cópia foi guardada porque passou uma hora desde o marco
-- anterior. As cópias que já existem eram todas desse tipo (a regra antiga),
-- então nascem marcadas; as novas nascem como cópia comum.
alter table public.obra_versao add column if not exists marco boolean not null default true;
alter table public.obra_versao alter column marco set default false;

-- Mesma função do obra-versao.sql, com quatro mudanças:
--   - TODA GRAVAÇÃO INTEIRA vira versão (`confere.gravacao = 'inteira'`),
--     não só uma por hora. O patch e a gravação direta seguem de hora em
--     hora — e a queda (perder item ou aprovação) e o apagamento, sempre.
--   - "Mexeu no conteúdo" passa a olhar a linha inteira menos as colunas de
--     controle, e não só as cinco colunas JSON: a data de entrega, o CMV e a
--     assinatura do cliente também são trabalho de alguém.
--   - A poda guarda as 24 mais novas E os 24 marcos mais novos, além das
--     quedas de 30 dias. Sem os marcos, uma tarde de digitação empurraria
--     para fora a cópia de ontem.
--   - `search_path` vazio e nomes qualificados, como pede o reforço.
create or replace function public.obra_dados_guarda_versao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  antes        integer;
  depois       integer;
  ultimo_marco timestamptz;
  eh_queda     boolean;
  eh_marco     boolean;
  apagando     boolean := tg_op = 'DELETE';
  inteira      boolean := coalesce(current_setting('confere.gravacao', true), '') = 'inteira';
begin
  if not apagando then
    -- Gravação que não mexeu no conteúdo não vira versão (pegar e soltar a
    -- trava, renovar a trava ao gravar o mesmo conteúdo).
    if (to_jsonb(new) - private.obra_dados_controle())
       is not distinct from (to_jsonb(old) - private.obra_dados_controle()) then
      return new;
    end if;
  end if;

  antes  := private.obra_conta_itens(old.categorias);
  depois := case when apagando then 0 else private.obra_conta_itens(new.categorias) end;

  eh_queda := depois < antes
           or (case when apagando then 0 else public.obra_conta_liberados(new.categorias) end)
              < public.obra_conta_liberados(old.categorias);

  select max(v.criado_em) into ultimo_marco
    from public.obra_versao v
   where v.obra_codigo = old.obra_codigo and v.marco;
  eh_marco := ultimo_marco is null or ultimo_marco < now() - interval '1 hour';

  if apagando or eh_queda or inteira or eh_marco then
    insert into public.obra_versao (obra_codigo, conteudo, n_itens, queda, atualizado_por, marco)
    values (old.obra_codigo, to_jsonb(old), antes, eh_queda, old.atualizado_por, eh_marco);

    -- PODA: ficam as 24 mais novas, os 24 marcos mais novos e toda queda dos
    -- últimos 30 dias.
    delete from public.obra_versao v
     where v.obra_codigo = old.obra_codigo
       and not (v.queda and v.criado_em > now() - interval '30 days')
       and v.id not in (
             select r.id from public.obra_versao r
              where r.obra_codigo = old.obra_codigo
              order by r.criado_em desc, r.id desc
              limit 24)
       and v.id not in (
             select m.id from public.obra_versao m
              where m.obra_codigo = old.obra_codigo and m.marco
              order by m.criado_em desc, m.id desc
              limit 24);
  end if;

  return case when apagando then old else new end;
end;
$$;

revoke execute on function private.obra_dados_controle() from public, anon;
revoke execute on function private.obra_dados_conta_versao() from public, anon;
revoke execute on function private.obra_conta_itens(jsonb) from public, anon;
revoke execute on function private.obra_dados_escrever(text, jsonb, text, text, text) from public, anon;
revoke execute on function private.obra_conteudo_valido(jsonb) from public, anon;
revoke execute on function private.obra_dados_respeita_trava() from public, anon;
grant execute on function private.obra_dados_controle() to authenticated;
grant execute on function private.obra_conta_itens(jsonb) to authenticated;
grant execute on function private.obra_dados_escrever(text, jsonb, text, text, text) to authenticated;
grant execute on function private.obra_conteudo_valido(jsonb) to authenticated;

-- ---------- 9. CONFERIR ----------
--   select column_name from information_schema.columns
--    where table_name = 'obra_dados' and column_name = 'versao';               -- 1 linha
--   select proname from pg_proc
--    where proname in ('salvar_obra', 'aplicar_patch_obra', 'restaurar_versao_obra');  -- 3 linhas
--   select tgname from pg_trigger
--    where tgrelid = 'public.obra_dados'::regclass and not tgisinternal order by 1;
