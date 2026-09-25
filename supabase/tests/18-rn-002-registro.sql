-- ============================================================
-- RN-002 · TRAVA NO EXECUTIVO E REGISTRO DAS MUDANCAS
--          (supabase/rn-002-compras-com-registro.sql)
-- ============================================================
-- A linha aprovada da planilha do Executivo nao muda. O item aprovado da
-- lista de trabalho (Compras) muda, e cada campo que mudou vira uma linha
-- em obra_item_aprovado_log. O registro so' e' lido por quem enxerga a
-- obra e nao se edita nem se apaga.

begin;
select plan(10);

insert into obra (codigo, nome, gc) values
  ('9801', 'Obra do registro', 'gc1@teste.local'),
  ('9802', 'Obra de outro GC', 'gc2@teste.local')
on conflict (codigo) do update set gc = excluded.gc;

insert into obra_dados (obra_codigo, categorias, editando_por, editando_desde) values ('9801',
  '[{"num":"05",
     "itens":[{"idLinha":"L1","desc":"Spot","marca":"A","custo":10,"liberadoCompra":{"em":"2026-09-22T10:00:00.000Z","por":"admin@teste.local"}},
              {"idLinha":"L2","desc":"Fita","custo":5}],
     "itensPlanilhaExecutivo":[{"idLinha":"L1","desc":"Spot","marca":"A","custo":10},
                               {"idLinha":"L2","desc":"Fita","custo":5}]}]'::jsonb,
  'gc1@teste.local', now());

set local role authenticated;
set local request.jwt.claims = '{"email":"gc1@teste.local"}';

-- ---------- a trava: so' a planilha do Executivo ----------
select throws_ok($$ select public.salvar_obra('9801', 1, jsonb_build_object('categorias', jsonb_set(
    (select categorias from obra_dados where obra_codigo = '9801'), '{0,itensPlanilhaExecutivo,0,custo}', '12'))) $$,
  '42501', null, 'mudar a linha aprovada no Executivo e'' recusado');
select is((select count(*) from obra_item_aprovado_log where obra_codigo = '9801'), 0::bigint,
  '... e nada vai para o registro');

select is((select public.salvar_obra('9801', 1, jsonb_build_object('categorias', jsonb_set(
    (select categorias from obra_dados where obra_codigo = '9801'), '{0,itensPlanilhaExecutivo,1,custo}', '6'))) ->> 'versao'), '2',
  'mudar linha nao aprovada no Executivo passa');
select is((select count(*) from obra_item_aprovado_log where obra_codigo = '9801'), 0::bigint,
  '... sem registro (o item nao esta'' aprovado)');

-- ---------- Compras: o item aprovado muda e fica no registro ----------
select is((select public.salvar_obra('9801', 2, jsonb_build_object('categorias', jsonb_set(jsonb_set(
    (select categorias from obra_dados where obra_codigo = '9801'), '{0,itens,0,marca}', '"B"'), '{0,itens,0,custo}', '11'))) ->> 'versao'), '3',
  'mudar o item aprovado em Compras passa');
select is((select array_agg(campo order by campo) from obra_item_aprovado_log where obra_codigo = '9801'),
  array['custo', 'marca'], '... com um registro por campo');
select is((select row(antes, depois, autor, id_linha)::text from obra_item_aprovado_log where obra_codigo = '9801' and campo = 'marca'),
  row('"A"'::jsonb, '"B"'::jsonb, 'gc1@teste.local', 'L1')::text, '... com antes, depois, quem e a linha');

-- ---------- o registro so' cresce e so' quem ve a obra le ----------
select throws_ok($$ insert into obra_item_aprovado_log (obra_codigo, campo, autor) values ('9801', 'x', 'gc1@teste.local') $$,
  '42501', null, 'ninguem escreve no registro direto');
delete from obra_item_aprovado_log where obra_codigo = '9801';
select is((select count(*) from obra_item_aprovado_log where obra_codigo = '9801'), 2::bigint, 'o registro nao se apaga');

set local request.jwt.claims = '{"email":"gc2@teste.local"}';
select is((select count(*) from obra_item_aprovado_log where obra_codigo = '9801'), 0::bigint,
  'quem nao ve a obra nao le o registro');

select * from finish(true);
rollback;
