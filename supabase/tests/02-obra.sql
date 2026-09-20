-- ============================================================
-- POLICY · obra, obra_dados e obra_versao
-- ============================================================
-- O que se prova aqui: o GC ve as obras dele e as sem dono — e SO' essas.
--
-- E, principalmente, que o historico acompanha a obra. Fechar `obra` e
-- deixar `obra_versao` aberta nao fecharia nada: quem quisesse ler a obra
-- alheia leria o historico dela. E' o que o rls-perfis-complemento.sql
-- conserta, e o que o ultimo teste cobra.

begin;
select plan(8);

-- ---------- anonimo ----------
set local role anon;
select is_empty('select codigo from obra', 'anonimo nao le obra');
select is_empty('select obra_codigo from obra_versao', 'anonimo nao le o historico');

-- ---------- gc1 ----------
set local role authenticated;
set local request.jwt.claims = '{"email":"gc1@teste.local"}';

select is(
  (select count(*) from obra where codigo = '9001'), 1::bigint,
  'o GC ve a obra dele'
);
select is(
  (select count(*) from obra where codigo = '9003'), 1::bigint,
  'o GC ve a obra sem dono (e assim assume a dele)'
);
select is(
  (select count(*) from obra where codigo = '9002'), 0::bigint,
  'o GC NAO ve a obra de outro GC'
);
select is(
  (select count(*) from obra_dados where obra_codigo = '9002'), 0::bigint,
  'nem os dados dela'
);
select is(
  (select count(*) from obra_versao where obra_codigo = '9002'), 0::bigint,
  'nem o historico dela'
);

-- ---------- quem esta na fila ----------
set local request.jwt.claims = '{"email":"fila@teste.local"}';
select is_empty(
  'select codigo from obra',
  'quem esta na fila nao ve obra nenhuma'
);

select * from finish(true);
rollback;
