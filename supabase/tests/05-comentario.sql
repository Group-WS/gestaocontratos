-- ============================================================
-- POLICY · obra_comentario
-- ============================================================
-- O recado da obra e' assinado. A leitura e' do time inteiro de
-- proposito (e' um mural), mas a assinatura nao pode ser falsificada:
-- sem o `with check`, bastaria mandar outro e-mail no payload pra
-- escrever em nome de outra pessoa.

begin;
select plan(5);

insert into obra (codigo, nome, gc) values ('9201', 'Obra do mural', 'gc1@teste.local')
on conflict (codigo) do update set gc = excluded.gc;

insert into obra_comentario (obra_codigo, verba_num, texto, autor) values
  ('9201', '01', 'recado do GC dois', 'gc2@teste.local');

set local role anon;
select is_empty('select texto from obra_comentario', 'anonimo nao le os recados');

set local role authenticated;
set local request.jwt.claims = '{"email":"gc1@teste.local"}';

select isnt_empty(
  'select texto from obra_comentario',
  'o time le os recados (o mural e' || '''' || ' de todos)'
);

select throws_ok(
  $$ insert into obra_comentario (obra_codigo, verba_num, texto, autor)
       values ('9201', '01', 'nao fui eu', 'gc2@teste.local') $$,
  '42501',
  null,
  'ninguem assina em nome de outra pessoa'
);

select lives_ok(
  $$ insert into obra_comentario (obra_codigo, verba_num, texto, autor)
       values ('9201', '01', 'este sou eu', 'gc1@teste.local') $$,
  'assinando com o proprio e-mail, escreve'
);

delete from obra_comentario where autor = 'gc2@teste.local';
select is(
  (select count(*) from obra_comentario where autor = 'gc2@teste.local'), 1::bigint,
  'e nao apaga o recado de outra pessoa'
);

select * from finish(true);
rollback;
