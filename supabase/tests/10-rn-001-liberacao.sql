-- ============================================================
-- RN-001 · só o administrador libera a compra (supabase/rn-001-liberacao-de-compra.sql)
-- ============================================================
-- Os exemplos da ficha (docs/regras-de-negocio/RN-001-liberacao-de-compra.md)
-- contra o banco: pela gravacao direta da obra E pelo patch
-- (aplicar_patch_obra), que sao os dois caminhos do app.

begin;
select plan(15);

insert into obra (codigo, nome, gc) values ('9601', 'Obra da RN-001', 'gc1@teste.local')
on conflict (codigo) do update set gc = excluded.gc;
insert into obra_dados (obra_codigo, categorias) values ('9601',
  '[{"num":"05","itens":[{"codigo":"5.1","desc":"Spot"},{"codigo":"5.2","desc":"Luminaria"},{"codigo":"5.3","desc":"Pendente"}]}]'::jsonb)
on conflict (obra_codigo) do update set categorias = excluded.categorias;

set local role authenticated;

-- ---------- o GC ----------
set local request.jwt.claims = '{"email":"gc1@teste.local"}';
select throws_ok($$
  update obra_dados set categorias = jsonb_set(categorias, '{0,itens,0,liberadoCompra}',
    '{"em":"2026-09-21T13:00:00.000Z","por":"gc1@teste.local"}') where obra_codigo = '9601' $$,
  '42501', null, 'o GC nao libera item para compra');
select throws_ok($$
  update obra_dados set categorias = jsonb_set(categorias, '{0,itens,0,liberadoSemCliente}',
    '{"em":"2026-09-21T13:00:00.000Z","por":"gc1@teste.local","motivo":"ok por e-mail"}') where obra_codigo = '9601' $$,
  '42501', null, 'nem libera sem a aprovacao do cliente');
select throws_ok($$
  select public.aplicar_patch_obra('9601',
    '[{"verba":0,"item":1,"campos":{"liberadoCompra":{"em":"2026-09-21T13:00:00.000Z","por":"gc1@teste.local"}}}]'::jsonb) $$,
  '42501', null, 'nem pelo patch item a item');
select lives_ok($$
  update obra_dados set categorias = jsonb_set(categorias, '{0,itens,2,liberadoCompra}',
    '{"em":"2026-09-21T13:05:00.000Z","por":"gc1@teste.local","viaAlocacao":true}') where obra_codigo = '9601' $$,
  'corrigindo a alocacao, o GC faz o item entrar liberado (decisao de 17/09/2026)');
select throws_ok($$
  update obra_dados set categorias = jsonb_set(categorias, '{0,itens,1,liberadoCompra}',
    '{"em":"2026-09-21T13:06:00.000Z","por":"admin@teste.local","viaAlocacao":true}') where obra_codigo = '9601' $$,
  '42501', null, '... mas em nome proprio, nunca no de outra pessoa');

-- ---------- o administrador ----------
set local request.jwt.claims = '{"email":"admin@teste.local"}';
select lives_ok($$
  update obra_dados set categorias = jsonb_set(categorias, '{0,itens,0,liberadoCompra}',
    '{"em":"2026-09-21T14:00:00.000Z","por":"admin@teste.local"}') where obra_codigo = '9601' $$,
  'o administrador libera, no nome dele');
select throws_ok($$
  update obra_dados set categorias = jsonb_set(categorias, '{0,itens,1,liberadoCompra}',
    '{"em":"2026-09-21T14:01:00.000Z","por":"diretor@teste.local"}') where obra_codigo = '9601' $$,
  '42501', null, 'e nao grava a liberacao no nome de outra pessoa');

-- ---------- de volta ao GC ----------
set local request.jwt.claims = '{"email":"gc1@teste.local"}';
select lives_ok($$
  update obra_dados set categorias = jsonb_set(categorias, '{0,itens,0,comprado}', 'true') where obra_codigo = '9601' $$,
  'o GC segue editando o item liberado (o carimbo nao muda)');
select throws_ok($$
  update obra_dados set categorias = jsonb_set(categorias, '{0,itens,1,liberadoCompra}',
    categorias -> 0 -> 'itens' -> 0 -> 'liberadoCompra') where obra_codigo = '9601' $$,
  '42501', null, 'e nao copia o carimbo do administrador para outro item');
select lives_ok($$
  update obra_dados set categorias =
    '[{"num":"05","itens":[{"codigo":"5.1","desc":"Spot"},{"codigo":"5.2","desc":"Luminaria"},{"codigo":"5.3","desc":"Pendente"}]}]'::jsonb
   where obra_codigo = '9601' $$,
  'substituir a planilha tira as liberacoes: a regra nao impede');

-- ---------- restaurar versao ----------
set local role postgres;
insert into obra_versao (obra_codigo, conteudo, n_itens) values ('9601', jsonb_build_object('categorias',
  '[{"num":"05","itens":[{"codigo":"5.1","desc":"Spot","liberadoCompra":{"em":"2026-09-20T10:00:00.000Z","por":"admin@teste.local"}},{"codigo":"5.2","desc":"Luminaria"},{"codigo":"5.3","desc":"Pendente"}]}]'::jsonb), 3);
set local role authenticated;
set local request.jwt.claims = '{"email":"gc1@teste.local"}';
select lives_ok($$
  update obra_dados set categorias = (select conteudo -> 'categorias' from obra_versao
    where obra_codigo = '9601' and conteudo::text like '%2026-09-20T10:00:00.000Z%' limit 1)
   where obra_codigo = '9601' $$,
  'restaurar uma versao traz de volta a liberacao que ela tinha');
select is((select categorias -> 0 -> 'itens' -> 0 -> 'liberadoCompra' ->> 'por' from obra_dados where obra_codigo = '9601'),
  'admin@teste.local', '... com o nome de quem liberou de verdade');
select throws_ok($$
  update obra_dados set categorias = jsonb_set(jsonb_set(categorias,
      '{0,itens,1,liberadoCompra}', categorias -> 0 -> 'itens' -> 0 -> 'liberadoCompra'),
      '{0,itens,2,liberadoCompra}', categorias -> 0 -> 'itens' -> 0 -> 'liberadoCompra')
   where obra_codigo = '9601' $$,
  '42501', null, 'mas espalhar o carimbo antigo por mais itens do que ele tinha e recusado');

-- ---------- quem nao e' o app ----------
set local role postgres;
select lives_ok($$
  update obra_dados set categorias = jsonb_set(categorias, '{0,itens,1,liberadoCompra}',
    '{"em":"2026-09-21T15:00:00.000Z","por":"master@teste.local"}') where obra_codigo = '9601' $$,
  'o SQL Editor (postgres) nao passa pela regra — e fica no historico');
select ok(exists (select 1 from pg_trigger where tgrelid = 'public.obra_dados'::regclass and tgname = 'trg_obra_dados_rn_001'),
  'o gatilho da RN-001 esta na obra_dados');

select * from finish(true);
rollback;
