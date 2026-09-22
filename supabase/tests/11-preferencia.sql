-- ============================================================
-- POLICY · preferencia (supabase/preferencia.sql)
-- ============================================================
-- Preferencia e' de cada um: a pessoa le e grava as proprias, nao ve nem
-- mexe nas dos outros — e anonimo nao chega perto.

begin;
select plan(7);

insert into preferencia (email, chave, valor) values
  ('gc1@teste.local', 'obras.modo', '"squad"'),
  ('gc2@teste.local', 'obras.modo', '"numero"');

set local role anon;
select throws_ok($$ select chave from preferencia $$, '42501', null, 'anonimo nem le a tabela');

set local role authenticated;
set local request.jwt.claims = '{"email":"gc1@teste.local"}';
select is((select count(*) from preferencia), 1::bigint, 'a pessoa ve so'' as proprias preferencias');
select is((select valor #>> '{}' from preferencia where chave = 'obras.modo'), 'squad', '... com o valor dela');
select throws_ok($$ insert into preferencia (email, chave, valor) values ('gc2@teste.local', 'obras.so_minhas', 'true') $$,
  '42501', null, 'e nao grava preferencia no nome de outra pessoa');
update preferencia set valor = '"squad"' where email = 'gc2@teste.local';
select lives_ok($$ insert into preferencia (email, chave, valor) values ('gc1@teste.local', 'obras.so_minhas', 'true') $$,
  'grava a propria');
select throws_ok($$ insert into preferencia (email, chave, valor) values ('gc1@teste.local', 'Chave Invalida!', 'true') $$,
  '23514', null, 'chave fora do formato e'' recusada pelo banco');

set local role postgres;
select is((select valor #>> '{}' from preferencia where email = 'gc2@teste.local' and chave = 'obras.modo'), 'numero',
  'a preferencia da outra pessoa ficou intacta');

select * from finish(true);
rollback;
