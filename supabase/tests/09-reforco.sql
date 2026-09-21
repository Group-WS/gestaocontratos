-- ============================================================
-- POLICY · o reforco de 21/09/2026 (supabase/rls-reforco.sql)
-- ============================================================
-- Cada bloco e' um buraco da varredura de seguranca, fechado — e, do lado,
-- o uso normal do app, que tem que continuar funcionando. Teste que so'
-- prova o "nao" deixa passar a policy que nega tudo.

begin;
select plan(32);

insert into obra (codigo, nome, gc) values
  ('9501', 'Obra do GC Um',   'gc1@teste.local'),
  ('9502', 'Obra do GC Dois', 'gc2@teste.local')
on conflict (codigo) do update set gc = excluded.gc, nome = excluded.nome;
insert into obra_dados (obra_codigo) values ('9501'), ('9502') on conflict (obra_codigo) do nothing;
insert into obra_versao (obra_codigo, conteudo, n_itens) values ('9501', '{}'::jsonb, 1);
insert into sienge_solicitacao (obra_codigo, building_id, payload, resposta, ok)
  values ('9501', 9501, '{}'::jsonb, '{}'::jsonb, true);
insert into storage.objects (bucket_id, name) values
  ('obra-arquivos', '9501/caderno/1-a.pdf'),
  ('obra-arquivos', '9502/caderno/1-b.pdf'),
  ('catalogo', 'pessoas/gc2-teste.local/1.jpg'),
  ('catalogo', 'produtos/1.jpg');
insert into obra_comentario (obra_codigo, verba_num, texto, autor)
  values ('9501', '01', 'recado do GC Um', 'gc1@teste.local');
insert into comprador_grupo (grupo, comprador_email) values ('95 - Teste', 'admin@teste.local');
insert into prestador_interno (especialidade, funcao) values ('Teste', 'Oficial 95');
insert into sienge_obra (codigo, nome, cidade, estado) values ('9501', 'Obra Sienge', 'Floripa', 'SC')
on conflict (codigo) do nothing;

-- ---------- 1. ninguem apaga obra pelo app ----------
set local role authenticated;
set local request.jwt.claims = '{"email":"mehoo@teste.local"}';
delete from obra where codigo = '9501';
delete from obra_dados where obra_codigo = '9501';
select is((select count(*) from obra where codigo = '9501'), 1::bigint,
  'a Mehoo ve a obra, mas nao apaga');
select is((select count(*) from obra_dados where obra_codigo = '9501'), 1::bigint,
  'nem os dados dela');

set local request.jwt.claims = '{"email":"gc1@teste.local"}';
delete from obra where codigo = '9501';
select is((select count(*) from obra where codigo = '9501'), 1::bigint,
  'nem o GC apaga a propria obra (limpeza e'' do SQL Editor)');
select lives_ok($$ update obra set nome = 'Obra do GC Um (editada)' where codigo = '9501' $$,
  'o GC continua alterando a obra dele');
select is((select nome from obra where codigo = '9501'), 'Obra do GC Um (editada)',
  '... e a alteracao vale');

-- ---------- 2. historico so' se le; o rastro do Sienge nao some ----------
delete from obra_versao where obra_codigo = '9501';
update obra_versao set n_itens = 0 where obra_codigo = '9501';
select is((select count(*) from obra_versao where obra_codigo = '9501' and n_itens = 1), 1::bigint,
  'o GC nao apaga nem reescreve o historico da obra dele');
delete from sienge_solicitacao where obra_codigo = '9501';
select is((select count(*) from sienge_solicitacao where obra_codigo = '9501'), 1::bigint,
  'nem apaga o rastro do que foi pedido ao Sienge');
select lives_ok($$ insert into sienge_solicitacao (obra_codigo, building_id, payload, resposta, ok)
                   values ('9501', 9501, '{}'::jsonb, '{}'::jsonb, false) $$,
  'e continua registrando o envio na obra dele');

-- ---------- 3. aditivo: so' na propria obra, autoria pelo login ----------
select throws_ok($$ insert into aditivo (obra_codigo, seq, numero) values ('9502', 7, 'AD-9502-7') $$,
  '42501', null, 'o GC nao cria aditivo na obra de outro GC');
insert into aditivo (obra_codigo, seq, numero, criado_por) values ('9501', 7, 'AD-9501-7', 'admin@teste.local');
select is((select criado_por from aditivo where numero = 'AD-9501-7'), 'gc1@teste.local',
  'a autoria do aditivo sai do login, e nao do pedido');
update aditivo set criado_por = 'admin@teste.local' where numero = 'AD-9501-7';
select is((select criado_por from aditivo where numero = 'AD-9501-7'), 'gc1@teste.local',
  'e nao se troca depois (e'' ela que decide quem apaga)');

-- ---------- 4. arquivos da obra ----------
select is((select count(*) from storage.objects where bucket_id = 'obra-arquivos' and name like '9501/%'), 1::bigint,
  'o GC ve os arquivos da obra dele');
select is((select count(*) from storage.objects where bucket_id = 'obra-arquivos' and name like '9502/%'), 0::bigint,
  'e nao ve os de obra alheia');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('obra-arquivos', '9502/caderno/2-x.pdf') $$,
  '42501', null, 'nem grava arquivo na obra alheia');
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('obra-arquivos', '9501/caderno/2-x.pdf') $$,
  'na dele, grava');
delete from storage.objects where bucket_id = 'obra-arquivos' and name like '9502/%';

set local request.jwt.claims = '{"email":"mehoo@teste.local"}';
select is((select count(*) from storage.objects where bucket_id = 'obra-arquivos' and name like '95__/caderno/1-%'), 2::bigint,
  'a Mehoo le os arquivos de todas as obras');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('obra-arquivos', '9501/caderno/3.pdf') $$,
  '42501', null, 'mas nao grava arquivo nenhum');

set local request.jwt.claims = '{"email":"fila@teste.local"}';
select is_empty($$ select name from storage.objects where bucket_id = 'obra-arquivos' $$,
  'quem esta na fila nao le arquivo de obra nenhuma');

set local role postgres;
select is((select count(*) from storage.objects where bucket_id = 'obra-arquivos' and name like '9502/%'), 1::bigint,
  'o arquivo da obra alheia continua la'' (o GC nao apagou)');
set local role authenticated;

-- ---------- 5. bucket catalogo ----------
set local role anon;
select is_empty($$ select name from storage.objects where bucket_id = 'catalogo' $$,
  'anonimo nao lista o catalogo (as pastas levam e-mail)');
set local role authenticated;
select is_empty($$ select name from storage.objects where bucket_id = 'catalogo' $$,
  'nem quem esta na fila');

set local request.jwt.claims = '{"email":"gc1@teste.local"}';
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('catalogo', 'pessoas/gc2-teste.local/2.jpg') $$,
  '42501', null, 'ninguem grava foto na pasta de outra pessoa');
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('catalogo', 'pessoas/gc1-teste.local/2.jpg') $$,
  'a propria foto, grava');
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('catalogo', 'produtos/2.jpg') $$,
  'foto de produto: quem edita o catalogo grava');

set local request.jwt.claims = '{"email":"mehoo@teste.local"}';
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('catalogo', 'produtos/3.jpg') $$,
  '42501', null, 'a Mehoo nao grava foto de produto');

-- ---------- 6. o que e' do time, so' para quem tem perfil ----------
set local request.jwt.claims = '{"email":"fila@teste.local"}';
select is_empty($$ select texto from obra_comentario $$, 'quem esta na fila nao le os recados');
select is_empty($$ select grupo from comprador_grupo $$, 'nem os e-mails dos compradores');
select is_empty($$ select funcao from prestador_interno $$, 'nem a tabela de diarias');
select throws_ok($$ insert into obra_comentario (obra_codigo, verba_num, texto, autor)
                    values ('9501', '01', 'oi', 'fila@teste.local') $$,
  '42501', null, 'nem escreve recado');

-- ---------- 7. sienge_obra: so' o status ----------
set local request.jwt.claims = '{"email":"gc1@teste.local"}';
select throws_ok($$ update sienge_obra set nome = 'outro nome' where codigo = '9501' $$,
  '42501', null, 'o app nao reescreve nome nem endereco do Sienge');
select lives_ok($$ update sienge_obra set status_manual = 'finalizada' where codigo = '9501' $$,
  'mas marca a obra como finalizada');

-- ---------- 8. funcoes ----------
select ok(not has_function_privilege('anon', 'public.meu_perfil()', 'execute'),
  'anonimo nao executa as funcoes de perfil');

select * from finish(true);
rollback;
