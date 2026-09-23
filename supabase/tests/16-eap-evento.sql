-- ============================================================
-- POLICY · sienge_eap_evento
-- ============================================================
-- Quem mexeu no EAP Sienge: importou, tornou padrao, ligou, trocou ou
-- desligou uma verba. LE so' administrador; REGISTRA quem mexe no cadastro
-- de referencia (master, admin, geral, gc), sempre em nome proprio. Nao se
-- edita nem se apaga.

begin;
select plan(8);

insert into sienge_eap_evento (acao, versao_id, versao_nome, verba_num, codigo, autor) values
  ('importou',  1, 'EAP INICIAL', null, null,             'admin@teste.local'),
  ('ligou',     1, 'EAP INICIAL', '20', '04.001.001.001', 'gc1@teste.local');

set local role anon;
select is_empty('select id from sienge_eap_evento', 'anonimo nao le o registro');

set local role authenticated;
set local request.jwt.claims = '{"email":"gc1@teste.local"}';

-- O GC edita o mapa e NAO le o registro: a leitura e' de administrador.
select is(
  (select count(*) from sienge_eap_evento), 0::bigint,
  'o GC nao le o registro, nem o que ele mesmo gravou'
);
select lives_ok(
  $$ insert into sienge_eap_evento (acao, versao_id, verba_num, codigo, codigo_anterior, autor)
       values ('trocou', 1, '20', '04.001.001.002', '04.001.001.001', 'gc1@teste.local') $$,
  'mas registra o proprio gesto'
);
select throws_ok(
  $$ insert into sienge_eap_evento (acao, versao_id, verba_num, autor)
       values ('desligou', 1, '20', 'admin@teste.local') $$,
  '42501', null,
  'ninguem registra em nome de outra pessoa'
);

set local request.jwt.claims = '{"email":"admin@teste.local"}';
select is(
  (select count(*) from sienge_eap_evento), 3::bigint,
  'o administrador le o registro inteiro'
);

-- So' cresce: sem policy de update e de delete, o RLS recusa os dois
-- calado (a linha continua la').
delete from sienge_eap_evento;
select is(
  (select count(*) from sienge_eap_evento), 3::bigint,
  'o registro nao se apaga'
);
update sienge_eap_evento set autor = 'outro@teste.local';
select is(
  (select count(*) from sienge_eap_evento where autor = 'outro@teste.local'), 0::bigint,
  'e nao se edita'
);

-- Gesto que nao existe nao entra: o check da coluna e' a lista fechada.
select throws_ok(
  $$ insert into sienge_eap_evento (acao, autor) values ('inventou', 'admin@teste.local') $$,
  '23514', null,
  'so as acoes previstas entram'
);

select * from finish(true);
rollback;
