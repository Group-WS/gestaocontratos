-- ============================================================
-- POLICY · aditivo
-- ============================================================
-- O aditivo e' dinheiro a mais numa obra, e a regra dele tem duas partes
-- que so' um teste separa: quem ENXERGA (quem enxerga a obra) e quem
-- APAGA (so' quem criou, ou um administrador — pedido de 17/09/2026).
--
-- A parte de apagar e' facil de perder sem perceber: basta alguem recriar
-- uma policy `for all` sobre a tabela que a exclusao volta a valer pra
-- todo mundo, sem erro nenhum. E' o que o teste 4 cobra.

begin;
select plan(6);

insert into obra (codigo, nome, gc) values
  ('9101', 'Obra do GC Um',   'gc1@teste.local'),
  ('9102', 'Obra do GC Dois', 'gc2@teste.local')
on conflict (codigo) do update set gc = excluded.gc;

insert into aditivo (obra_codigo, seq, numero, criado_por) values
  ('9101', 1, 'AD-01', 'gc1@teste.local'),
  ('9102', 1, 'AD-02', 'gc2@teste.local');

-- ---------- anonimo ----------
set local role anon;
select is_empty('select numero from aditivo', 'anonimo nao le aditivo');

-- ---------- o GC dono da obra ----------
set local role authenticated;
set local request.jwt.claims = '{"email":"gc1@teste.local"}';

select is(
  (select count(*) from aditivo where obra_codigo = '9101'), 1::bigint,
  'o GC ve o aditivo da obra dele'
);
select is(
  (select count(*) from aditivo where obra_codigo = '9102'), 0::bigint,
  'e nao ve o da obra de outro GC'
);

-- Apagar o que e' de outro nao pode nem quando a obra e' visivel: aqui o
-- 9101 e' a obra DELE, mas o aditivo foi criado por outra pessoa.
set local role postgres;
insert into aditivo (obra_codigo, seq, numero, criado_por)
  values ('9101', 2, 'AD-03', 'geral@teste.local');
set local role authenticated;
set local request.jwt.claims = '{"email":"gc1@teste.local"}';

delete from aditivo where numero = 'AD-03';
select is(
  (select count(*) from aditivo where numero = 'AD-03'), 1::bigint,
  'o GC nao apaga aditivo que nao criou, mesmo na obra dele'
);

-- ---------- administrador ----------
set local request.jwt.claims = '{"email":"admin@teste.local"}';
delete from aditivo where numero = 'AD-03';
select is(
  (select count(*) from aditivo where numero = 'AD-03'), 0::bigint,
  'o administrador apaga'
);

-- ---------- quem esta na fila ----------
set local request.jwt.claims = '{"email":"fila@teste.local"}';
select is_empty(
  'select numero from aditivo',
  'quem esta na fila nao ve aditivo nenhum'
);

select * from finish(true);
rollback;
