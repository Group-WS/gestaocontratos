-- ============================================================
-- POLICY · pessoa
-- Roda com: supabase test db   (ou veja supabase/tests/README.md)
-- ============================================================
-- O que se prova aqui: ninguem se promove.
--
-- A tabela pessoa e' a que decide todo o resto — perfil errado nela vira
-- acesso errado em tudo. Antes do pessoa-escrita-restrita.sql, a policy
-- era `using (true)`, e um update de uma linha no console do navegador
-- fazia qualquer um virar master. E' esse update que os testes abaixo
-- precisam ver FALHAR.

begin;
select plan(6);

-- ---------- anonimo ----------
set local role anon;
select is_empty(
  'select email from pessoa',
  'anonimo nao le a tabela pessoa'
);

-- ---------- quem esta na fila (sem perfil) ----------
set local role authenticated;
set local request.jwt.claims = '{"email":"fila@teste.local"}';

select is(
  (select count(*) from pessoa where email = 'fila@teste.local'), 1::bigint,
  'quem esta na fila le a propria linha'
);

select lives_ok(
  $$ update pessoa set perfil = 'master' where email = 'fila@teste.local' $$,
  'o update da autopromocao nao estoura...'
);
select is(
  (select perfil from pessoa where email = 'fila@teste.local'), null,
  '...e nao muda nada: ninguem se promove a master'
);

-- ---------- gc ----------
set local request.jwt.claims = '{"email":"gc1@teste.local"}';
select is(
  (select count(*) from pessoa where email = 'gc2@teste.local'), 0::bigint,
  'o GC nao le a linha de outra pessoa'
);

-- ---------- master ----------
set local request.jwt.claims = '{"email":"master@teste.local"}';
select isnt_empty(
  'select email from pessoa',
  'o admin master le a equipe inteira'
);

select * from finish();
rollback;
