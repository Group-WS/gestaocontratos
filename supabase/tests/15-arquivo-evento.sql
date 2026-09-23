-- ============================================================
-- POLICY · obra_arquivo_evento
-- ============================================================
-- Quem anexou, trocou ou removeu qual arquivo da obra. Le quem enxerga a
-- obra (o contrato, so' administrador); registra quem edita, na obra que
-- enxerga, em nome proprio. Nao se edita nem se apaga.

begin;
select plan(10);

insert into obra (codigo, nome, gc) values
  ('9601', 'Obra do GC Um',   'gc1@teste.local'),
  ('9602', 'Obra do GC Dois', 'gc2@teste.local')
on conflict (codigo) do update set gc = excluded.gc;

insert into obra_arquivo_evento (obra_codigo, acao, tipo, titulo, arquivo_nome, autor) values
  ('9601', 'anexou', 'marcenaria', 'Caderno de Marcenaria', 'marcenaria.pdf', 'gc1@teste.local'),
  ('9601', 'anexou', 'contrato',   'Contrato',              'contrato.pdf',   'admin@teste.local'),
  ('9602', 'anexou', 'avulso',     'Planta',                'planta.pdf',     'gc2@teste.local');

set local role anon;
select is_empty('select id from obra_arquivo_evento', 'anonimo nao le os eventos');

set local role authenticated;
set local request.jwt.claims = '{"email":"gc1@teste.local"}';

select is(
  (select count(*) from obra_arquivo_evento where obra_codigo = '9601' and tipo <> 'contrato'), 1::bigint,
  'o GC ve os eventos da obra dele'
);
select is(
  (select count(*) from obra_arquivo_evento where tipo = 'contrato'), 0::bigint,
  'mas nao o do contrato'
);
select is(
  (select count(*) from obra_arquivo_evento where obra_codigo = '9602'), 0::bigint,
  'e nao ve os da obra de outro GC'
);

select lives_ok(
  $$ insert into obra_arquivo_evento (obra_codigo, acao, tipo, titulo, arquivo_nome, arquivo_anterior, autor)
       values ('9601', 'trocou', 'marcenaria', 'Caderno de Marcenaria', 'marcenaria-v2.pdf', 'marcenaria.pdf', 'gc1@teste.local') $$,
  'registra na obra dele, em nome proprio'
);
select throws_ok(
  $$ insert into obra_arquivo_evento (obra_codigo, acao, tipo, titulo, arquivo_nome, autor)
       values ('9601', 'anexou', 'avulso', 'x', 'x.pdf', 'gc2@teste.local') $$,
  '42501', null,
  'ninguem registra em nome de outra pessoa'
);
select throws_ok(
  $$ insert into obra_arquivo_evento (obra_codigo, acao, tipo, titulo, arquivo_nome, autor)
       values ('9601', 'anexou', 'contrato', 'Contrato', 'c.pdf', 'gc1@teste.local') $$,
  '42501', null,
  'o GC nao registra o contrato'
);

delete from obra_arquivo_evento where obra_codigo = '9601';
select is(
  (select count(*) from obra_arquivo_evento where obra_codigo = '9601' and tipo <> 'contrato'), 2::bigint,
  'o registro nao se apaga'
);

set local request.jwt.claims = '{"email":"admin@teste.local"}';
select is(
  (select count(*) from obra_arquivo_evento where tipo = 'contrato'), 1::bigint,
  'o administrador ve o do contrato'
);
select lives_ok(
  $$ insert into obra_arquivo_evento (obra_codigo, acao, tipo, titulo, arquivo_nome, autor)
       values ('9601', 'removeu', 'contrato', 'Contrato', 'contrato.pdf', 'admin@teste.local') $$,
  'e registra o contrato'
);

select * from finish(true);
rollback;
