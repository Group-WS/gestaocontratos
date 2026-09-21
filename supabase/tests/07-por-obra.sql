-- ============================================================
-- POLICY · apresentacao e sienge_solicitacao
-- ============================================================
-- As duas guardam coisa que e' de UMA obra: o caderno que vai pro cliente
-- e o que foi pedido de compra, com quem pediu. Elas seguem
-- `minhas_obras()` — e o teste existe porque, ate' o
-- rls-perfis-complemento.sql, seguiam `using (true)`: a obra podia estar
-- fechada e o caderno dela, aberto.

begin;
select plan(7);

insert into obra (codigo, nome, gc) values
  ('9401', 'Obra do GC Um',   'gc1@teste.local'),
  ('9402', 'Obra do GC Dois', 'gc2@teste.local')
on conflict (codigo) do update set gc = excluded.gc;

insert into apresentacao (obra_codigo) values ('9401'), ('9402');
insert into sienge_solicitacao (obra_codigo, building_id, payload, resposta, ok) values
  ('9401', 9401, '{}'::jsonb, '{}'::jsonb, true),
  ('9402', 9402, '{}'::jsonb, '{}'::jsonb, true);

set local role anon;
select is_empty('select obra_codigo from apresentacao',       'anonimo nao le o caderno');
select is_empty('select obra_codigo from sienge_solicitacao', 'anonimo nao le as solicitacoes');

set local role authenticated;
set local request.jwt.claims = '{"email":"gc1@teste.local"}';

select is(
  (select count(*) from apresentacao where obra_codigo = '9401'), 1::bigint,
  'o GC ve o caderno da obra dele'
);
select is(
  (select count(*) from apresentacao where obra_codigo = '9402'), 0::bigint,
  'e nao ve o caderno da obra de outro GC'
);
select is(
  (select count(*) from sienge_solicitacao where obra_codigo = '9401'), 1::bigint,
  'o GC ve o que foi pedido na obra dele'
);
select is(
  (select count(*) from sienge_solicitacao where obra_codigo = '9402'), 0::bigint,
  'e nao ve o que foi pedido na obra de outro GC'
);

set local request.jwt.claims = '{"email":"fila@teste.local"}';
select is_empty(
  'select obra_codigo from apresentacao',
  'quem esta na fila nao ve caderno nenhum'
);

select * from finish(true);
rollback;
