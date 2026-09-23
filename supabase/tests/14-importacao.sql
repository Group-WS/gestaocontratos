-- ============================================================
-- POLICY · obra_importacao
-- ============================================================
-- O registro de cada importacao (arquivo, quem, quando). Le quem enxerga
-- a obra; registra quem edita, na obra que enxerga, em nome proprio. E
-- nao se edita nem se apaga: registro que muda depois nao prova nada.

begin;
select plan(9);

insert into obra (codigo, nome, gc) values
  ('9501', 'Obra do GC Um',   'gc1@teste.local'),
  ('9502', 'Obra do GC Dois', 'gc2@teste.local')
on conflict (codigo) do update set gc = excluded.gc;

insert into obra_importacao (obra_codigo, documento, arquivo_nome, n_itens, autor) values
  ('9501', 'vendido_planilha', 'planilha-um.xlsx',   10, 'gc1@teste.local'),
  ('9502', 'vendido_planilha', 'planilha-dois.xlsx', 20, 'gc2@teste.local');

set local role anon;
select is_empty('select id from obra_importacao', 'anonimo nao le as importacoes');

set local role authenticated;
set local request.jwt.claims = '{"email":"gc1@teste.local"}';

select is(
  (select count(*) from obra_importacao where obra_codigo = '9501'), 1::bigint,
  'o GC ve as importacoes da obra dele'
);
select is(
  (select count(*) from obra_importacao where obra_codigo = '9502'), 0::bigint,
  'e nao ve as da obra de outro GC'
);

select lives_ok(
  $$ insert into obra_importacao (obra_codigo, documento, arquivo_nome, n_itens, autor)
       values ('9501', 'planilha_executivo', 'executivo.xlsx', 5, 'gc1@teste.local') $$,
  'registra na obra dele, em nome proprio'
);

select throws_ok(
  $$ insert into obra_importacao (obra_codigo, documento, arquivo_nome, n_itens, autor)
       values ('9501', 'vendido_planilha', 'x.xlsx', 1, 'gc2@teste.local') $$,
  '42501', null,
  'ninguem registra em nome de outra pessoa'
);

select throws_ok(
  $$ insert into obra_importacao (obra_codigo, documento, arquivo_nome, n_itens, autor)
       values ('9502', 'vendido_planilha', 'x.xlsx', 1, 'gc1@teste.local') $$,
  '42501', null,
  'nem na obra de outro GC'
);

update obra_importacao set arquivo_nome = 'trocado.xlsx' where obra_codigo = '9501';
select is(
  (select count(*) from obra_importacao where arquivo_nome = 'trocado.xlsx'), 0::bigint,
  'o registro nao se edita'
);

delete from obra_importacao where obra_codigo = '9501';
select is(
  (select count(*) from obra_importacao where obra_codigo = '9501'), 2::bigint,
  'nem se apaga'
);

-- Quem so' acompanha (Mehoo) ve, mas nao registra.
set local request.jwt.claims = '{"email":"mehoo@teste.local"}';
select throws_ok(
  $$ insert into obra_importacao (obra_codigo, documento, arquivo_nome, n_itens, autor)
       values ('9501', 'vendido_planilha', 'x.xlsx', 1, 'mehoo@teste.local') $$,
  '42501', null,
  'perfil que nao edita nao registra'
);

select * from finish(true);
rollback;
