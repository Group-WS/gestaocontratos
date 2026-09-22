-- ============================================================
-- GRAVAÇÃO PROTEGIDA DA OBRA (supabase/salvar-obra.sql e salvar-obra-contrair.sql)
-- ============================================================
-- A gravação só acontece com a trava de quem grava e com a versão que a
-- tela leu. O que não bater é RECUSADO, com o motivo — e nada é escrito.
--
-- As datas aqui não mudam: dentro da transação do teste, now() é um só.
-- É por isso que a trava pega agora está sempre "viva".

begin;
select plan(38);

insert into obra (codigo, nome, gc) values ('9701', 'Obra da gravação protegida', 'gc1@teste.local')
on conflict (codigo) do update set gc = excluded.gc;
insert into obra_dados (obra_codigo, categorias) values ('9701',
  '[{"num":"05","itens":[{"codigo":"5.1","desc":"Spot"}]}]'::jsonb);

select has_column('public', 'obra_dados', 'versao', 'a obra tem versão');
select is((select versao from obra_dados where obra_codigo = '9701'), 1::bigint, 'linha nova nasce na versão 1');

set local role authenticated;

-- ---------- sem a trava ----------
set local request.jwt.claims = '{"email":"gc1@teste.local"}';
select is((select public.salvar_obra('9701', 1, '{"data_entrega":"2026-12-01"}'::jsonb) ->> 'motivo'), 'trava',
  'gravar sem a trava é recusado');
select is((select data_entrega from obra_dados where obra_codigo = '9701'), null::date, '... e nada foi gravado');

-- ---------- com a trava (o que o pegarEdicao faz) ----------
update obra_dados set editando_por = 'gc1@teste.local', editando_desde = now() where obra_codigo = '9701';
select is((select versao from obra_dados where obra_codigo = '9701'), 1::bigint, 'pegar a trava não muda a versão');

select is((select public.salvar_obra('9701', 1, '{"data_entrega":"2026-12-01"}'::jsonb) ->> 'versao'), '2',
  'com a trava e a versão lida, grava — e a versão sobe');
select is((select data_entrega from obra_dados where obra_codigo = '9701'), '2026-12-01'::date, '... com o conteúdo novo');
select is((select editando_por from obra_dados where obra_codigo = '9701'), 'gc1@teste.local', '... e a trava continua de quem gravou');

-- ---------- a cópia velha ----------
select is((select public.salvar_obra('9701', 1, '{"data_entrega":"2027-01-15"}'::jsonb) ->> 'motivo'), 'versao',
  'versão desatualizada é recusada');
select is((select data_entrega from obra_dados where obra_codigo = '9701'), '2026-12-01'::date,
  '... e o que a outra gravação fez continua lá');
select is((select public.salvar_obra('9701', 1, '{}'::jsonb) ->> 'versao'), '2', '... dizendo qual é a versão atual');
select is((select public.salvar_obra('9701', null, '{}'::jsonb) ->> 'motivo'), 'versao', 'sem versão também não grava');

-- ---------- o que não é mudança não conta ----------
select is((select public.salvar_obra('9701', 2, '{"data_entrega":"2026-12-01"}'::jsonb) ->> 'versao'), '2',
  'gravar o mesmo conteúdo não muda a versão');

-- ---------- o cinto de segurança e o formato ----------
select is((select public.salvar_obra('9701', 2, '{"categorias":[]}'::jsonb) ->> 'motivo'), 'vazia',
  'obra sem item não grava por cima de obra com itens');
select is((select jsonb_array_length(categorias -> 0 -> 'itens') from obra_dados where obra_codigo = '9701'), 1,
  '... e os itens ficam');
select is((select public.salvar_obra('9701', 2, '{"categorias":{}}'::jsonb) ->> 'motivo'), 'conteudo_invalido',
  'conteúdo fora do formato é recusado');

-- ---------- a RN-001 continua valendo pela gravação protegida ----------
select throws_ok($$ select public.salvar_obra('9701', 2,
    '{"categorias":[{"num":"05","itens":[{"codigo":"5.1","desc":"Spot","liberadoCompra":{"em":"2026-09-22T10:00:00.000Z","por":"gc1@teste.local"}}]}]}'::jsonb) $$,
  '42501', null, 'o GC não libera item para compra nem pela gravação protegida (RN-001)');

-- ---------- o patch ----------
select is((select public.aplicar_patch_obra('9701',
    '[{"verba":0,"item":0,"campos":{"comprado":true},"confCodigo":"5.1","confDesc":"Spot"}]'::jsonb, 2) ->> 'versao'), '3',
  'o patch com a versão lida grava e sobe a versão');
select is((select public.aplicar_patch_obra('9701',
    '[{"verba":0,"item":0,"campos":{"comprado":false},"confCodigo":"5.1","confDesc":"Spot"}]'::jsonb, 2) ->> 'motivo'), 'versao',
  'patch com versão desatualizada é recusado');
select is((select categorias -> 0 -> 'itens' -> 0 ->> 'comprado' from obra_dados where obra_codigo = '9701'), 'true',
  '... e o patch recusado não escreveu nada');

-- ---------- o histórico ----------
select is((select count(*) from obra_versao where obra_codigo = '9701'), 1::bigint,
  'até aqui, uma versão: a da primeira gravação inteira (o patch não passou da hora)');
select is((select public.salvar_obra('9701', 3, '{"data_entrega":"2027-02-01"}'::jsonb) ->> 'versao'), '4',
  'outra gravação inteira');
select is((select count(*) from obra_versao where obra_codigo = '9701'), 2::bigint, 'toda gravação inteira vira versão');
select is((select public.aplicar_patch_obra('9701',
    '[{"verba":0,"item":0,"campos":{"canalCompra":"sienge"},"confCodigo":"5.1","confDesc":"Spot"}]'::jsonb, 4) ->> 'versao'), '5',
  'um patch');
select is((select count(*) from obra_versao where obra_codigo = '9701'), 2::bigint, '... segue a regra de hora em hora');

-- ---------- outra pessoa, com a trava viva de gc1 ----------
set local request.jwt.claims = '{"email":"geral@teste.local"}';
select is((select public.salvar_obra('9701', 5, '{"data_entrega":"2027-03-01"}'::jsonb) ->> 'motivo'), 'trava',
  'a trava viva de outra pessoa recusa a gravação');
select throws_ok($$ update obra_dados set data_entrega = '2027-03-01' where obra_codigo = '9701' $$,
  '55006', null, 'gravar direto por cima da trava viva de outra pessoa é recusado');
select is((select public.aplicar_patch_obra('9701',
    '[{"verba":0,"item":0,"campos":{"comprado":false}}]'::jsonb, 5) ->> 'motivo'), 'trava', 'o patch também respeita a trava');
select is((select public.aplicar_patch_obra('9701',
    '[{"verba":0,"item":0,"campos":{"comprado":false}}]'::jsonb) ->> 'motivo'), 'trava de outra pessoa',
  'o app antigo, que chama sem a versão, segue a regra de antes');
select is((select public.restaurar_versao_obra('9701', (select max(id) from obra_versao where obra_codigo = '9701')) ->> 'motivo'),
  'trava', 'nem restaurar versão passa por cima de quem está editando');

-- ---------- o fechamento (salvar-obra-contrair.sql) ----------
set local request.jwt.claims = '{"email":"gc1@teste.local"}';
select throws_like($$ update obra_dados set data_entrega = '2027-03-01' where obra_codigo = '9701' $$,
  '%versão antiga%', 'com a trava viva, gravar direto (a aba do app antigo) é recusado: só as funções gravam');

-- ---------- restaurar ----------
select is((select public.restaurar_versao_obra('9701', (select max(id) from obra_versao where obra_codigo = '9701')) ->> 'versao'), '6',
  'restaurar uma versão passa pela função e sobe a versão');
select is((select public.salvar_obra('9701', 5, '{"data_entrega":"2027-03-01"}'::jsonb) ->> 'motivo'), 'versao',
  '... e quem tinha a cópia de antes da restauração não grava por cima dela');
select is((select public.restaurar_versao_obra('9701', (select id from obra_versao where obra_codigo = '9001' limit 1)) ->> 'motivo'),
  'outra_obra', 'versão de outra obra não é restaurada');

-- ---------- sem trava viva, a gravação direta segue ----------
-- É o caminho que o teste da RN-001 exercita (10-rn-001-liberacao.sql).
update obra_dados set editando_por = null, editando_desde = null where obra_codigo = '9701';
select lives_ok($$ update obra_dados set data_entrega = '2027-04-01' where obra_codigo = '9701' $$,
  'sem trava viva, a gravação direta segue');
update obra_dados set editando_por = 'gc1@teste.local', editando_desde = now() where obra_codigo = '9701';
select is((select public.salvar_obra('9701', 6, '{"data_entrega":"2027-05-01"}'::jsonb) ->> 'motivo'), 'versao',
  'mudança feita fora da gravação protegida também muda a versão');

-- ---------- a poda ----------
do $$
declare
  v bigint := (select versao from obra_dados where obra_codigo = '9701');
  r jsonb;
begin
  for i in 1..30 loop
    r := public.salvar_obra('9701', v, jsonb_build_object('cadernos', jsonb_build_object('n', i)));
    if not coalesce((r ->> 'ok')::boolean, false) then
      raise exception 'a gravação % falhou: %', i, r;
    end if;
    v := (r ->> 'versao')::bigint;
  end loop;
end $$;
select ok((select count(*) from obra_versao where obra_codigo = '9701') <= 25,
  'a poda segura o histórico: depois de 30 gravações ficam as 24 mais novas e os marcos');

-- ---------- quem não entrou ----------
set local role anon;
select throws_ok($$ select public.salvar_obra('9701', 1, '{}'::jsonb) $$, '42501', null, 'anônimo não chama a gravação');

select * from finish(true);
rollback;
