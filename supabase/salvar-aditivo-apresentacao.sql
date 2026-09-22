-- ============================================================
-- GRAVAÇÃO PROTEGIDA DO ADITIVO E DA APRESENTAÇÃO · versão conferida no banco
-- Como usar: Supabase → SQL Editor → colar tudo → Run.
-- Reaplicável: rodar de novo não duplica nada e não apaga nada.
-- Rode DEPOIS de salvar-obra.sql (bloco 7 do README).
-- ============================================================
--
-- POR QUE ISTO EXISTE
-- A obra já grava com versão conferida no banco (salvar-obra.sql). Os dois
-- documentos que moram fora dela não gravavam:
--
--   ADITIVO — o documento inteiro ia por `id`, sem conferir nada. Duas
--     pessoas no mesmo aditivo: a segunda a gravar apagava o trabalho da
--     primeira, em silêncio. E só o botão "Salvar" gravava: sair da tela ou
--     fechar a aba jogava fora o que tinha sido digitado.
--   APRESENTAÇÃO — mesma coisa, com gravação automática a cada 1,5 s. Como
--     grava a capa e os slides inteiros, duas pessoas na mesma revisão se
--     sobrescreviam sem nenhum aviso.
--
-- O QUE MUDA
--   - `versao` nas duas tabelas: um número que sobe sozinho a cada mudança
--     de conteúdo. Quem grava não escolhe o número — o gatilho decide.
--   - `salvar_aditivo` e `salvar_apresentacao`: só gravam se a versão for a
--     mesma que a tela leu. Se não for, recusam e dizem quem alterou e
--     quando, para a tela avisar em vez de gravar por cima.
--   - `criar_aditivo`: o número ("2405/3") passa a sair do banco, com trava
--     por obra. Dois aditivos criados no mesmo segundo não brigam mais pelo
--     mesmo número.
--   - `criar_apresentacao`: a revisão nova nasce aqui, e revisão repetida é
--     recusada com motivo, não com erro cru do Postgres.
--   - A autoria da apresentação passa a sair do LOGIN, como já era no
--     aditivo (o `atualizado_por` vinha do navegador e podia ser qualquer
--     coisa).
--   - `aditivo_versao`: o histórico do aditivo, uma cópia a cada gravação
--     inteira, com poda. O aditivo é documento de contrato e podia ser
--     apagado sem deixar rastro nenhum.
--
-- SEM TRAVA, DE PROPÓSITO. A obra tem trava porque é grande e a edição é
-- longa; aqui as duas telas gravam sozinhas, e a versão faz o conflito
-- aparecer em segundos — na primeira gravação de quem chegou depois, e não
-- no fim do trabalho. Uma trava a mais só adicionaria passos na tela.
--
-- COMPATÍVEL COM O APP NO AR (SQL-03). Nada aqui recusa o que o app de hoje
-- faz: ele grava direto nas duas tabelas e continua gravando, só que agora
-- cada gravação sobe a versão (e o aditivo entra no histórico). Nenhum dado
-- é alterado ao rodar este arquivo.
-- ============================================================

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ---------- 1. A versão das duas linhas ----------
-- `default 1` preenche as linhas que já existem sem reescrever a tabela.
alter table public.aditivo      add column if not exists versao bigint not null default 1;
alter table public.apresentacao add column if not exists versao bigint not null default 1;

-- A mesma conta das duas tabelas, e da obra: a versão sobe quando QUALQUER
-- coluna de conteúdo muda — inclusive coluna criada depois deste arquivo,
-- porque a comparação é da linha inteira menos as colunas de controle.
--
-- As de controle vêm como argumentos do gatilho (`tg_argv`), então uma
-- função só serve as duas tabelas e a lista fica à vista de quem lê o
-- `create trigger`.
create or replace function private.conta_versao()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if (to_jsonb(new) - tg_argv::text[]) is distinct from (to_jsonb(old) - tg_argv::text[]) then
    new.versao := old.versao + 1;
  else
    new.versao := old.versao;
  end if;
  return new;
end;
$$;

-- `atualizado_em` e `atualizado_por` são carimbo, não conteúdo: gravar o
-- mesmo documento de novo não inventa uma versão nova.
drop trigger if exists trg_aditivo_versao on public.aditivo;
create trigger trg_aditivo_versao
  before update on public.aditivo
  for each row execute function private.conta_versao('versao', 'atualizado_por', 'atualizado_em');

drop trigger if exists trg_apresentacao_versao on public.apresentacao;
create trigger trg_apresentacao_versao
  before update on public.apresentacao
  for each row execute function private.conta_versao('versao', 'atualizado_por', 'atualizado_em');

-- ---------- 2. Quem criou e quem alterou a apresentação saem do login ----------
-- Igual ao `aditivo_autoria` do rls-reforco.sql (SEG-13): o corpo do pedido
-- não decide autoria. Só vale para o papel do app (`authenticated`) — o SQL
-- Editor e a massa de teste gravam como quiserem.
create or replace function private.apresentacao_autoria()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  quem text := lower((select auth.jwt()) ->> 'email');
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      new.criado_por := quem;
    else
      new.criado_por := old.criado_por;
    end if;
    new.atualizado_por := quem;
  end if;
  return new;
end;
$$;

-- Nome antes de "trg_apresentacao_versao": gatilhos do mesmo evento correm
-- em ordem alfabética, e a autoria precisa estar carimbada antes da conta.
drop trigger if exists apresentacao_autoria on public.apresentacao;
create trigger apresentacao_autoria
  before insert or update on public.apresentacao
  for each row execute function private.apresentacao_autoria();

-- ---------- 3. O que a tela pode mandar ----------
-- Conteúdo com o tipo errado derruba a gravação inteira com um erro que não
-- diz o que fazer. Estas funções conferem antes, e a API devolve "campo
-- inválido" com o nome do campo.
create or replace function private.aditivo_campos_validos(c jsonb)
returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(
    (not c ? 'descricao'       or jsonb_typeof(c -> 'descricao') in ('string', 'null'))
    and (not c ? 'status'      or (c ->> 'status') in ('rascunho', 'aguardando', 'aprovado', 'reprovado'))
    and (not c ? 'dados'       or jsonb_typeof(c -> 'dados') = 'object')
    and (not c ? 'total_supressao' or jsonb_typeof(c -> 'total_supressao') = 'number')
    and (not c ? 'total_adicao'    or jsonb_typeof(c -> 'total_adicao') = 'number'),
  false)
$$;

create or replace function private.apresentacao_campos_validos(c jsonb)
returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(
    (not c ? 'capa'       or jsonb_typeof(c -> 'capa') = 'object')
    and (not c ? 'slides' or jsonb_typeof(c -> 'slides') = 'array')
    and (not c ? 'idioma' or jsonb_typeof(c -> 'idioma') = 'string')
    and (not c ? 'arquivo'   or jsonb_typeof(c -> 'arquivo') in ('string', 'null'))
    and (not c ? 'gerado_em' or jsonb_typeof(c -> 'gerado_em') in ('string', 'null')),
  false)
$$;

-- ---------- 4. Gravar o aditivo ----------
-- SECURITY INVOKER: roda como quem chamou, então a RLS ("só na minha obra",
-- rls-reforco.sql) e o gatilho da autoria continuam valendo.
--
-- `for update` segura a linha até o fim da transação: duas gravações que
-- leram a mesma versão entram em fila, e a segunda vê a versão nova e é
-- recusada — em vez de as duas passarem na conferência e a última vencer.
--
-- `confere.gravacao` diz ao histórico que esta é uma gravação inteira (e
-- não um UPDATE avulso no SQL Editor); vale só até o fim da transação.
create or replace function public.salvar_aditivo(p_id uuid, p_versao bigint, p_campos jsonb)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  quem  text := lower(trim(coalesce((select auth.jwt()) ->> 'email', '')));
  c     jsonb := coalesce(p_campos, '{}'::jsonb);
  linha public.aditivo%rowtype;
  nova  bigint;
begin
  if quem = '' then
    return jsonb_build_object('ok', false, 'motivo', 'sem_usuario');
  end if;
  if not private.aditivo_campos_validos(c) then
    return jsonb_build_object('ok', false, 'motivo', 'campos_invalidos');
  end if;

  select * into linha from public.aditivo a where a.id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'sem_linha');
  end if;

  if p_versao is null or linha.versao <> p_versao then
    return jsonb_build_object(
      'ok', false, 'motivo', 'versao',
      'versao', linha.versao,
      'atualizadoPor', linha.atualizado_por,
      'atualizadoEm', linha.atualizado_em);
  end if;

  perform set_config('confere.gravacao', 'inteira', true);

  update public.aditivo a set
    descricao       = case when c ? 'descricao' then c ->> 'descricao' else a.descricao end,
    status          = case when c ? 'status' then c ->> 'status' else a.status end,
    dados           = case when c ? 'dados' then c -> 'dados' else a.dados end,
    total_supressao = case when c ? 'total_supressao' then (c ->> 'total_supressao')::numeric else a.total_supressao end,
    total_adicao    = case when c ? 'total_adicao' then (c ->> 'total_adicao')::numeric else a.total_adicao end,
    atualizado_em   = now()
  where a.id = p_id
  returning a.versao into nova;

  perform set_config('confere.gravacao', '', true);
  return jsonb_build_object('ok', true, 'versao', nova);
end;
$$;

-- ---------- 5. Criar o aditivo, com o número vindo do banco ----------
-- O número era contado na tela ("o maior que eu enxergo, mais um"), e duas
-- pessoas criando ao mesmo tempo pediam o mesmo "2405/3" — uma das duas
-- levava um erro cru de chave repetida.
--
-- A trava por obra (`pg_advisory_xact_lock`) faz a segunda esperar a
-- primeira terminar, e então contar de novo. Número apagado NÃO volta a ser
-- usado: `max(seq) + 1`, e não `quantidade + 1` — o "2405/3" que já foi para
-- o cliente não pode nascer de novo em outro documento.
create or replace function public.criar_aditivo(p_obra text, p_campos jsonb)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  quem  text := lower(trim(coalesce((select auth.jwt()) ->> 'email', '')));
  c     jsonb := coalesce(p_campos, '{}'::jsonb);
  obra  text := trim(coalesce(p_obra, ''));
  nova  public.aditivo%rowtype;
  prox  integer;
begin
  if quem = '' then
    return jsonb_build_object('ok', false, 'motivo', 'sem_usuario');
  end if;
  if obra = '' then
    return jsonb_build_object('ok', false, 'motivo', 'sem_obra');
  end if;
  if not private.aditivo_campos_validos(c) then
    return jsonb_build_object('ok', false, 'motivo', 'campos_invalidos');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('aditivo:' || obra, 0));

  select coalesce(max(a.seq), 0) + 1 into prox from public.aditivo a where a.obra_codigo = obra;

  insert into public.aditivo (obra_codigo, seq, numero, descricao, dados, total_supressao, total_adicao)
  values (
    obra,
    prox,
    obra || '/' || prox,
    coalesce(c ->> 'descricao', ''),
    coalesce(c -> 'dados', '{}'::jsonb),
    coalesce((c ->> 'total_supressao')::numeric, 0),
    coalesce((c ->> 'total_adicao')::numeric, 0))
  returning * into nova;

  return jsonb_build_object('ok', true, 'id', nova.id, 'seq', nova.seq,
                            'numero', nova.numero, 'versao', nova.versao);
end;
$$;

-- ---------- 6. Gravar e criar a apresentação ----------
create or replace function public.salvar_apresentacao(p_id uuid, p_versao bigint, p_conteudo jsonb)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  quem  text := lower(trim(coalesce((select auth.jwt()) ->> 'email', '')));
  c     jsonb := coalesce(p_conteudo, '{}'::jsonb);
  linha public.apresentacao%rowtype;
  nova  bigint;
begin
  if quem = '' then
    return jsonb_build_object('ok', false, 'motivo', 'sem_usuario');
  end if;
  if not private.apresentacao_campos_validos(c) then
    return jsonb_build_object('ok', false, 'motivo', 'campos_invalidos');
  end if;

  select * into linha from public.apresentacao a where a.id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'sem_linha');
  end if;

  if p_versao is null or linha.versao <> p_versao then
    return jsonb_build_object(
      'ok', false, 'motivo', 'versao',
      'versao', linha.versao,
      'atualizadoPor', linha.atualizado_por,
      'atualizadoEm', linha.atualizado_em);
  end if;

  perform set_config('confere.gravacao', 'inteira', true);

  update public.apresentacao a set
    capa          = case when c ? 'capa' then c -> 'capa' else a.capa end,
    slides        = case when c ? 'slides' then c -> 'slides' else a.slides end,
    idioma        = case when c ? 'idioma' then c ->> 'idioma' else a.idioma end,
    arquivo       = case when c ? 'arquivo' then c ->> 'arquivo' else a.arquivo end,
    gerado_em     = case when c ? 'gerado_em' then (c ->> 'gerado_em')::timestamptz else a.gerado_em end,
    atualizado_em = now()
  where a.id = p_id
  returning a.versao into nova;

  perform set_config('confere.gravacao', '', true);
  return jsonb_build_object('ok', true, 'versao', nova);
end;
$$;

-- A revisão nova (a "cópia da 00") nasce aqui. Revisão que já existe é
-- recusada com motivo: a tela diz "a REV 01 já existe" em vez de mostrar o
-- erro de índice único do Postgres.
create or replace function public.criar_apresentacao(p_obra text, p_rev text, p_conteudo jsonb)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  quem  text := lower(trim(coalesce((select auth.jwt()) ->> 'email', '')));
  c     jsonb := coalesce(p_conteudo, '{}'::jsonb);
  -- `v_` porque `rev` também é o nome da coluna: sem isso o Postgres não
  -- sabe qual dos dois está no `where`.
  v_obra text := trim(coalesce(p_obra, ''));
  v_rev  text := trim(coalesce(p_rev, '00'));
  nova  public.apresentacao%rowtype;
begin
  if quem = '' then
    return jsonb_build_object('ok', false, 'motivo', 'sem_usuario');
  end if;
  if v_obra = '' then
    return jsonb_build_object('ok', false, 'motivo', 'sem_obra');
  end if;
  if not private.apresentacao_campos_validos(c) then
    return jsonb_build_object('ok', false, 'motivo', 'campos_invalidos');
  end if;
  if exists (select 1 from public.apresentacao a where a.obra_codigo = v_obra and a.rev = v_rev) then
    return jsonb_build_object('ok', false, 'motivo', 'rev_existe', 'rev', v_rev);
  end if;

  insert into public.apresentacao (obra_codigo, rev, capa, slides, idioma)
  values (
    v_obra,
    v_rev,
    coalesce(c -> 'capa', '{}'::jsonb),
    coalesce(c -> 'slides', '[]'::jsonb),
    coalesce(c ->> 'idioma', 'pt'))
  returning * into nova;

  return jsonb_build_object('ok', true, 'id', nova.id, 'rev', nova.rev, 'versao', nova.versao);
end;
$$;

-- ---------- 7. O histórico do aditivo ----------
-- Mesma ideia do `obra_versao`: quem guarda é o BANCO, num gatilho, e não o
-- app — assim o UPDATE rodado à mão no SQL Editor também entra. Guarda a
-- linha INTEIRA de antes, então coluna nova já nasce no histórico.
--
-- E pega o apagamento: o aditivo podia ser excluído por quem o criou sem
-- deixar rastro do que havia nele.
-- SEM chave estrangeira para `aditivo`, de propósito (como o obra_versao):
-- a cópia tem que sobreviver ao apagamento da linha que a originou — que é
-- justamente quando ela é a única coisa que resta.
create table if not exists public.aditivo_versao (
  id             bigint generated always as identity primary key,
  aditivo_id     uuid not null,
  obra_codigo    text not null,
  -- O que dá para ler sem abrir o JSONB gordo, que é o que a lista mostra.
  numero         text,
  status         text,
  total_supressao numeric not null default 0,
  total_adicao    numeric not null default 0,
  -- Esta cópia foi guardada porque o aditivo foi APAGADO.
  apagado        boolean not null default false,
  conteudo       jsonb not null,
  atualizado_por text,
  criado_em      timestamptz not null default now()
);

create index if not exists aditivo_versao_aditivo_idx
  on public.aditivo_versao (aditivo_id, criado_em desc);
create index if not exists aditivo_versao_obra_idx
  on public.aditivo_versao (obra_codigo, criado_em desc);

alter table public.aditivo_versao enable row level security;

-- Só leitura, e só da própria obra — como o histórico da obra. Escrever é
-- coisa do gatilho (security definer), e não tem policy nenhuma: nem quem
-- edita apaga o histórico.
drop policy if exists "leio da minha obra" on public.aditivo_versao;
create policy "leio da minha obra" on public.aditivo_versao for select to authenticated
  using (obra_codigo in (select public.minhas_obras()));

create or replace function public.aditivo_guarda_versao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  apagando  boolean := tg_op = 'DELETE';
  inteira   boolean := coalesce(current_setting('confere.gravacao', true), '') = 'inteira';
  controle  text[] := array['versao', 'atualizado_por', 'atualizado_em'];
  ultima    timestamptz;
  guardar   boolean;
begin
  -- Gravação que não mexeu no conteúdo não vira versão.
  if not apagando then
    if (to_jsonb(new) - controle) is not distinct from (to_jsonb(old) - controle) then
      return new;
    end if;
  end if;

  select max(v.criado_em) into ultima
    from public.aditivo_versao v where v.aditivo_id = old.id;

  -- Toda gravação inteira vira versão; o UPDATE avulso, de hora em hora —
  -- senão um script de correção encheria a tabela. Apagar, sempre.
  guardar := apagando or inteira or ultima is null or ultima < now() - interval '1 hour';

  if guardar then
    insert into public.aditivo_versao
      (aditivo_id, obra_codigo, numero, status, total_supressao, total_adicao, apagado, conteudo, atualizado_por)
    values
      (old.id, old.obra_codigo, old.numero, old.status, old.total_supressao, old.total_adicao,
       apagando, to_jsonb(old), old.atualizado_por);

    -- PODA: ficam as 24 cópias mais novas de cada aditivo, mais todo
    -- apagamento dos últimos 30 dias — que é justamente o que ninguém pode
    -- perder, porque a linha original já não existe.
    delete from public.aditivo_versao v
     where v.aditivo_id = old.id
       and not (v.apagado and v.criado_em > now() - interval '30 days')
       and v.id not in (
             select r.id from public.aditivo_versao r
              where r.aditivo_id = old.id
              order by r.criado_em desc, r.id desc
              limit 24);
  end if;

  return case when apagando then old else new end;
end;
$$;

drop trigger if exists trg_aditivo_guarda_versao on public.aditivo;
create trigger trg_aditivo_guarda_versao
  before update or delete on public.aditivo
  for each row execute function public.aditivo_guarda_versao();

-- ---------- 8. Quem pode chamar ----------
do $$
declare f text;
begin
  foreach f in array array[
    'public.salvar_aditivo(uuid, bigint, jsonb)',
    'public.criar_aditivo(text, jsonb)',
    'public.salvar_apresentacao(uuid, bigint, jsonb)',
    'public.criar_apresentacao(text, text, jsonb)',
    'private.conta_versao()',
    'private.apresentacao_autoria()',
    'private.aditivo_campos_validos(jsonb)',
    'private.apresentacao_campos_validos(jsonb)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- O gatilho do histórico roda sozinho, como dono: ninguém o chama.
revoke execute on function public.aditivo_guarda_versao() from public, anon, authenticated;

-- ---------- 9. CONFERIR ----------
--   select column_name from information_schema.columns
--    where table_name in ('aditivo','apresentacao') and column_name = 'versao';   -- 2 linhas
--   select proname from pg_proc
--    where proname in ('salvar_aditivo','criar_aditivo','salvar_apresentacao','criar_apresentacao');  -- 4
--   select tgname from pg_trigger
--    where tgrelid = 'public.aditivo'::regclass and not tgisinternal order by 1;
--     -- aditivo_autoria, trg_aditivo_guarda_versao, trg_aditivo_versao
--   select tgname from pg_trigger
--    where tgrelid = 'public.apresentacao'::regclass and not tgisinternal order by 1;
--     -- apresentacao_autoria, trg_apresentacao_versao
--   select count(*) from public.aditivo_versao;                                   -- 0 no começo
