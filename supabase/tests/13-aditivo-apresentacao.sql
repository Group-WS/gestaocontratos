-- ============================================================
-- GRAVAÇÃO PROTEGIDA DO ADITIVO E DA APRESENTAÇÃO
-- (supabase/salvar-aditivo-apresentacao.sql)
-- ============================================================
-- Os dois documentos que moram fora da obra só gravam com a versão que a
-- tela leu. Versão diferente é RECUSADA, com o motivo — e nada é escrito.
--
-- Dentro da transação do teste, now() é um só. É por isso que a regra do
-- histórico "de hora em hora" não dispara aqui: o que se vê é a regra da
-- gravação inteira, que é a que o app usa.

begin;
select plan(44);

insert into obra (codigo, nome, gc) values
  ('9111', 'Obra do aditivo protegido', 'gc1@teste.local'),
  ('9112', 'Obra do outro GC',          'gc2@teste.local')
on conflict (codigo) do update set gc = excluded.gc;

select has_column('public', 'aditivo', 'versao', 'o aditivo tem versão');
select has_column('public', 'apresentacao', 'versao', 'a apresentação tem versão');

set local role authenticated;
set local request.jwt.claims = '{"email":"gc1@teste.local"}';

-- ---------- criar: o número sai do banco ----------
select is((select public.criar_aditivo('9111', '{"descricao":"Primeiro"}'::jsonb) ->> 'numero'), '9111/1',
  'o número do aditivo sai do banco');
select is((select public.criar_aditivo('9111', '{"descricao":"Segundo"}'::jsonb) ->> 'numero'), '9111/2',
  '... e o próximo continua a contagem, sem a tela contar nada');
select is((select criado_por from aditivo where numero = '9111/1'), 'gc1@teste.local',
  'quem criou sai do login');
select is((select versao from aditivo where numero = '9111/1'), 1::bigint,
  'aditivo novo nasce na versão 1');

-- Os ids ficam guardados: lidos de dentro de um papel que não enxerga a
-- obra, viriam nulos, e o teste passaria pelo motivo errado.
do $$
begin
  perform set_config('teste.ad1', (select id::text from aditivo where numero = '9111/1'), true);
  perform set_config('teste.ad2', (select id::text from aditivo where numero = '9111/2'), true);
end $$;

-- ---------- gravar com a versão lida ----------
select is((select public.salvar_aditivo(current_setting('teste.ad1')::uuid, 1,
    '{"descricao":"Vidro temperado","total_adicao":1200.5}'::jsonb) ->> 'versao'), '2',
  'com a versão lida, grava — e a versão sobe');
select is((select descricao from aditivo where numero = '9111/1'), 'Vidro temperado',
  '... com o conteúdo novo');
select is((select atualizado_por from aditivo where numero = '9111/1'), 'gc1@teste.local',
  '... e quem alterou sai do login');

-- ---------- a cópia velha ----------
select is((select public.salvar_aditivo(current_setting('teste.ad1')::uuid, 1,
    '{"descricao":"Por cima"}'::jsonb) ->> 'motivo'), 'versao',
  'versão desatualizada é recusada');
select is((select descricao from aditivo where numero = '9111/1'), 'Vidro temperado',
  '... e o que a outra pessoa gravou continua lá');
select is((select public.salvar_aditivo(current_setting('teste.ad1')::uuid, 1, '{}'::jsonb) ->> 'versao'), '2',
  '... dizendo qual é a versão de agora');
select is((select public.salvar_aditivo(current_setting('teste.ad1')::uuid, 1, '{}'::jsonb) ->> 'atualizadoPor'),
  'gc1@teste.local', '... e quem a alterou');
select is((select public.salvar_aditivo(current_setting('teste.ad1')::uuid, null, '{}'::jsonb) ->> 'motivo'), 'versao',
  'sem versão também não grava');

-- ---------- o que não é mudança não conta ----------
select is((select public.salvar_aditivo(current_setting('teste.ad1')::uuid, 2,
    '{"descricao":"Vidro temperado"}'::jsonb) ->> 'versao'), '2',
  'gravar o mesmo conteúdo não muda a versão');

-- ---------- o formato ----------
select is((select public.salvar_aditivo(current_setting('teste.ad1')::uuid, 2,
    '{"status":"quase"}'::jsonb) ->> 'motivo'), 'campos_invalidos',
  'fase que não existe é recusada');
select is((select public.salvar_aditivo(current_setting('teste.ad1')::uuid, 2,
    '{"dados":[]}'::jsonb) ->> 'motivo'), 'campos_invalidos',
  'documento fora do formato é recusado');
select is((select public.salvar_aditivo('00000000-0000-0000-0000-000000000000'::uuid, 1, '{}'::jsonb) ->> 'motivo'),
  'sem_linha', 'aditivo que não existe é recusado sem erro cru');
select is((select public.salvar_aditivo(current_setting('teste.ad1')::uuid, 2,
    '{"status":"aprovado"}'::jsonb) ->> 'ok'), 'true',
  'a fase do aditivo grava pela mesma função');

-- ---------- a obra do outro GC ----------
set local request.jwt.claims = '{"email":"gc2@teste.local"}';
select is((select public.salvar_aditivo(current_setting('teste.ad1')::uuid, 3,
    '{"descricao":"De outra obra"}'::jsonb) ->> 'motivo'), 'sem_linha',
  'quem não enxerga a obra não grava o aditivo dela');
select is((select numero from public.aditivo_versao
            where aditivo_id = current_setting('teste.ad1')::uuid limit 1), null::text,
  'e nem enxerga o histórico dela');

-- ---------- o histórico ----------
set local request.jwt.claims = '{"email":"gc1@teste.local"}';
do $$
begin
  perform set_config('teste.hist',
    (select count(*)::text from public.aditivo_versao where aditivo_id = current_setting('teste.ad1')::uuid), true);
  perform public.salvar_aditivo(current_setting('teste.ad1')::uuid,
    (select versao from public.aditivo where id = current_setting('teste.ad1')::uuid),
    '{"descricao":"Mais uma alteração"}'::jsonb);
end $$;
select is((select count(*) from public.aditivo_versao where aditivo_id = current_setting('teste.ad1')::uuid),
  current_setting('teste.hist')::bigint + 1,
  'cada gravação inteira vira uma cópia no histórico');
select is((select conteudo ->> 'descricao' from public.aditivo_versao
            where aditivo_id = current_setting('teste.ad1')::uuid order by id desc limit 1), 'Vidro temperado',
  '... com o documento como estava ANTES da gravação');

-- Apagar é o caso que mais importa: a linha some, e o histórico é tudo o
-- que sobra do documento.
do $$ begin delete from public.aditivo where id = current_setting('teste.ad2')::uuid; end $$;
select is((select count(*) from public.aditivo where id = current_setting('teste.ad2')::uuid), 0::bigint,
  'quem criou o aditivo pode apagá-lo');
select is((select apagado from public.aditivo_versao
            where aditivo_id = current_setting('teste.ad2')::uuid order by id desc limit 1), true,
  '... e o apagamento fica guardado no histórico');
select is((select conteudo ->> 'numero' from public.aditivo_versao
            where aditivo_id = current_setting('teste.ad2')::uuid order by id desc limit 1), '9111/2',
  '... com o documento inteiro que existia');

-- A poda: 30 gravações inteiras seguidas não podem encher a tabela.
do $$
declare
  v bigint := (select versao from public.aditivo where id = current_setting('teste.ad1')::uuid);
  r jsonb;
begin
  for i in 1..30 loop
    r := public.salvar_aditivo(current_setting('teste.ad1')::uuid, v,
           jsonb_build_object('descricao', 'alteração ' || i));
    if not coalesce((r ->> 'ok')::boolean, false) then
      raise exception 'a gravação % falhou: %', i, r;
    end if;
    v := (r ->> 'versao')::bigint;
  end loop;
end $$;
select ok((select count(*) from public.aditivo_versao where aditivo_id = current_setting('teste.ad1')::uuid) <= 24,
  'a poda segura o histórico: depois de 30 gravações ficam as 24 mais novas');

-- O histórico não se reescreve: quem edita a obra não insere nem apaga.
select throws_ok($$
    insert into public.aditivo_versao (aditivo_id, obra_codigo, conteudo)
    values (current_setting('teste.ad1')::uuid, '9111', '{}'::jsonb) $$,
  '42501', null, 'ninguém escreve no histórico do aditivo');
do $$ begin delete from public.aditivo_versao where aditivo_id = current_setting('teste.ad1')::uuid; end $$;
select ok((select count(*) from public.aditivo_versao where aditivo_id = current_setting('teste.ad1')::uuid) > 0,
  'e nem apaga o que está lá');

-- ---------- a apresentação ----------
select is((select public.criar_apresentacao('9111', '00',
    '{"capa":{"obra":"Casa do teste"},"slides":[]}'::jsonb) ->> 'versao'), '1',
  'a apresentação nasce na versão 1');
select is((select public.criar_apresentacao('9111', '00', '{}'::jsonb) ->> 'motivo'), 'rev_existe',
  'revisão repetida é recusada com motivo, e não com erro de índice');
select is((select criado_por from apresentacao where obra_codigo = '9111' and rev = '00'), 'gc1@teste.local',
  'quem criou a apresentação sai do login');

do $$
begin
  perform set_config('teste.ap1',
    (select id::text from public.apresentacao where obra_codigo = '9111' and rev = '00'), true);
end $$;

select is((select public.salvar_apresentacao(current_setting('teste.ap1')::uuid, 1,
    '{"slides":[{"ambiente":"Sala"}]}'::jsonb) ->> 'versao'), '2',
  'com a versão lida, a apresentação grava e a versão sobe');
select is((select jsonb_array_length(slides) from apresentacao where id = current_setting('teste.ap1')::uuid), 1,
  '... com os slides novos');
select is((select public.salvar_apresentacao(current_setting('teste.ap1')::uuid, 1,
    '{"slides":[]}'::jsonb) ->> 'motivo'), 'versao',
  'a tela que ficou para trás não apaga os slides de quem gravou antes');
select is((select public.salvar_apresentacao(current_setting('teste.ap1')::uuid, 2,
    '{"arquivo":"9111/apresentacao/rev00.pdf","gerado_em":"2026-09-22T10:00:00Z"}'::jsonb) ->> 'ok'), 'true',
  'o PDF gerado é carimbado pela mesma função');
select is((select public.salvar_apresentacao(current_setting('teste.ap1')::uuid, 3,
    '{"slides":{}}'::jsonb) ->> 'motivo'), 'campos_invalidos',
  'slides fora do formato são recusados');

-- O app que ainda grava direto (antes do deploy) também sobe a versão: a
-- aba que tinha a cópia anterior é recusada em vez de gravar por cima.
do $$
begin
  perform set_config('teste.ap_versao',
    (select versao::text from public.apresentacao where id = current_setting('teste.ap1')::uuid), true);
  update public.apresentacao set idioma = 'en', atualizado_por = 'ninguem@teste.local'
   where id = current_setting('teste.ap1')::uuid;
end $$;
select is((select versao from apresentacao where id = current_setting('teste.ap1')::uuid),
  current_setting('teste.ap_versao')::bigint + 1,
  'gravação direta na apresentação também sobe a versão');
select is((select atualizado_por from apresentacao where id = current_setting('teste.ap1')::uuid), 'gc1@teste.local',
  '... e a autoria continua sendo a do login, não a do corpo do pedido');
select is((select public.salvar_apresentacao(current_setting('teste.ap1')::uuid,
    current_setting('teste.ap_versao')::bigint, '{"slides":[]}'::jsonb) ->> 'motivo'), 'versao',
  '... então a tela que não viu essa mudança é recusada');

-- ---------- a obra do outro GC ----------
set local request.jwt.claims = '{"email":"gc2@teste.local"}';
select is((select public.salvar_apresentacao(current_setting('teste.ap1')::uuid, 1, '{"slides":[]}'::jsonb) ->> 'motivo'),
  'sem_linha', 'quem não enxerga a obra não grava a apresentação dela');
select throws_ok($$ select public.criar_aditivo('9111', '{"descricao":"Na obra alheia"}'::jsonb) $$,
  '42501', null, 'nem cria aditivo na obra de outro GC');

-- ---------- quem não entrou ----------
set local role anon;
select throws_ok($$ select public.salvar_aditivo('00000000-0000-0000-0000-000000000000'::uuid, 1, '{}'::jsonb) $$,
  '42501', null, 'anônimo não chama a gravação do aditivo');
select throws_ok($$ select public.criar_apresentacao('9111', '01', '{}'::jsonb) $$,
  '42501', null, 'anônimo não cria apresentação');

select * from finish(true);
rollback;
