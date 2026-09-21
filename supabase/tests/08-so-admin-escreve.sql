-- ============================================================
-- POLICY · comprador_grupo e prestador_interno
-- ============================================================
-- Nestas duas a leitura e' do time inteiro de proposito — o painel filtra
-- por comprador, e a calculadora de mao de obra e' de todo mundo. O que
-- nao e' de todo mundo e' MUDAR: quem compra o que, e quanto custa a hora
-- de cada funcao, e' decisao de administrador.
--
-- Por isso estas duas tabelas aparecem na lista das que ainda tem uma
-- policy `using (true)`: e' a de SELECT, e e' intencional. Este teste
-- existe pra que essa lista nao precise ser explicada de novo — e pra
-- que a escrita nao afrouxe junto, algum dia.

begin;
select plan(6);

insert into comprador_grupo (grupo, comprador_email) values ('90 - Teste', 'admin@teste.local')
  on conflict do nothing;
insert into prestador_interno (especialidade, funcao) values ('Teste', 'Oficial de teste');

set local role anon;
select is_empty('select grupo from comprador_grupo',        'anonimo nao le os compradores');
select is_empty('select funcao from prestador_interno',     'anonimo nao le os prestadores');

set local role authenticated;
set local request.jwt.claims = '{"email":"gc1@teste.local"}';

select isnt_empty('select grupo from comprador_grupo',      'o time le quem compra o que');
select isnt_empty('select funcao from prestador_interno',   'o time le os prestadores');

-- Escrever, nao.
delete from comprador_grupo where grupo = '90 - Teste';
select is(
  (select count(*) from comprador_grupo where grupo = '90 - Teste'), 1::bigint,
  'quem nao e administrador nao mexe em quem compra o que'
);

select throws_ok(
  $$ insert into prestador_interno (especialidade, funcao) values ('Teste', 'Inventado') $$,
  '42501',
  null,
  'nem cadastra prestador'
);

select * from finish(true);
rollback;
