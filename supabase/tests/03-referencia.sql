-- ============================================================
-- POLICY · tabelas de referencia
-- ============================================================
-- Catalogo, insumo e EAP nao sao de obra nenhuma: quem tem perfil le,
-- quem opera escreve. O que se prova: quem esta na fila (sem perfil) nao
-- le, e o anonimo nunca le.

begin;
select plan(4);

set local role anon;
select is_empty('select codigo from insumo_sienge', 'anonimo nao le referencia');

set local role authenticated;
set local request.jwt.claims = '{"email":"fila@teste.local"}';
select is_empty(
  'select codigo from insumo_sienge',
  'quem esta na fila ainda nao le referencia'
);

set local request.jwt.claims = '{"email":"gc1@teste.local"}';
select lives_ok(
  $$ select codigo from insumo_sienge $$,
  'o GC le a referencia'
);

set local request.jwt.claims = '{"email":"mehoo@teste.local"}';
select lives_ok(
  $$ select codigo from obra where codigo = '9001' $$,
  'a Mehoo enxerga as obras, pro painel dela'
);

select * from finish();
rollback;
