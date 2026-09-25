-- ============================================================
-- POLICY · Cadastro de Insumos (insumo-cadastro.sql, ADR-008)
-- ============================================================
-- RN-086: so' o administrador cria, edita, apaga e importa; o time le o
--         cadastro e a tabela ativa; historico e importacoes sao do admin.
-- RN-087: insumo pedido ao Sienge (solicitacao concluida ou parcial, mesmo
--         codigo e mesmo texto) nao se apaga — nem pela tela, nem pela
--         importacao. Solicitacao que falhou nao prende.
-- E mais: o autor vem do login, cada mudanca vira linha no historico, a
-- tela nao troca a origem do insumo, e o balde so' aceita o admin.
--
-- Cada chamada das funcoes de importacao e' uma transacao propria em
-- producao (PostgREST); aqui o teste inteiro e' uma transacao so', entao o
-- `app.insumo_importacao` e' limpo depois de cada chamada.

begin;
select plan(34);

-- Solicitacoes ja' gravadas (como o banco as guarda): uma concluida, uma
-- parcial e uma que falhou.
insert into sienge_solicitacao (obra_codigo, building_id, payload, resposta, ok, status) values
  ('9001', 9001, '{"itens":[{"productId":406,"notes":"CADEIRA EIFFEL"}]}', '{}', true, 'concluido'),
  ('9001', 9001, '{"itens":[{"productId":275,"notes":"AR CORRIGIDO"}]}', '{}', false, 'parcial'),
  ('9001', 9001, '{"itens":[{"productId":3065,"notes":"PENDENTE"}]}', '{}', false, 'falhou');

-- ---------- o administrador ----------
set local role authenticated;
set local request.jwt.claims = '{"email":"admin@teste.local"}';

select lives_ok(
  $$ insert into insumo_cadastro (codigo, descricao, unidade, origem, criado_por, atualizado_por)
     values ('406', 'CADEIRA EIFFEL', 'un', 'tela', 'outra@pessoa', 'outra@pessoa') $$,
  'RN-086 · o administrador cria insumo na tela');
select is((select criado_por from insumo_cadastro where descricao = 'CADEIRA EIFFEL'), 'admin@teste.local',
  'o autor vem do login, nunca do corpo');
select is((select acao from insumo_cadastro_historico where descricao = 'CADEIRA EIFFEL' order by id limit 1), 'criou',
  'criar vira linha no histórico');

select throws_ok($$ delete from insumo_cadastro where descricao = 'CADEIRA EIFFEL' $$, '23503', null,
  'RN-087 · insumo pedido ao Sienge (concluída) não se apaga');

select lives_ok(
  $$ insert into insumo_cadastro (codigo, descricao, unidade, origem, criado_por, atualizado_por)
     values ('3065', 'PENDENTE', 'un', 'tela', '', '') $$,
  'o admin cria outro insumo');
select lives_ok($$ delete from insumo_cadastro where descricao = 'PENDENTE' $$,
  'RN-087 · solicitação que falhou não prende o insumo');
select is((select count(*) from insumo_cadastro where descricao = 'PENDENTE'), 0::bigint, '... e ele sai');

select lives_ok(
  $$ insert into insumo_cadastro_importacao (arquivo_nome, por) values ('insumos.xlsx', 'admin@teste.local') $$,
  'o admin registra a importação em nome próprio');

select is(
  insumo_cadastro_gravar(
    (select id from insumo_cadastro_importacao where arquivo_nome = 'insumos.xlsx'),
    '[{"codigo":"275","descricao":"AR","unidade":"un"},{"codigo":"500","descricao":"LIVRE","unidade":"un"}]'::jsonb,
    '[]'::jsonb),
  2, 'a gravação da importação insere o bloco');
select set_config('app.insumo_importacao', '', true);

select is((select origem from insumo_cadastro where descricao = 'AR'), 'sienge', 'o que veio do relatório entra como do Sienge');
select is((select acao from insumo_cadastro_historico where descricao = 'AR' order by id limit 1), 'importou',
  'o histórico diz que veio da importação');

select throws_ok(
  $$ update insumo_cadastro set origem = 'tela', sienge_codigo = null, sienge_descricao = null, sienge_unidade = null
      where descricao = 'AR' $$,
  '23514', null, 'a tela não troca a origem do insumo');

update insumo_cadastro set descricao = 'AR CORRIGIDO' where descricao = 'AR';
select is((select acao from insumo_cadastro_historico where descricao = 'AR CORRIGIDO' order by id desc limit 1), 'editou',
  'editar na tela vira linha no histórico');
update insumo_cadastro set ativo = false where descricao = 'AR CORRIGIDO';
select is((select acao from insumo_cadastro_historico where descricao = 'AR CORRIGIDO' order by id desc limit 1), 'desativou',
  'desligar também');

select is(
  insumo_cadastro_apagar(
    (select id from insumo_cadastro_importacao where arquivo_nome = 'insumos.xlsx'),
    array(select id from insumo_cadastro where descricao in ('AR CORRIGIDO', 'LIVRE'))),
  1, 'o caminho "apagar" tira só o que não está em uso');
select set_config('app.insumo_importacao', '', true);
select is((select count(*) from insumo_cadastro where descricao = 'AR CORRIGIDO'), 1::bigint,
  'RN-087 · o pedido na solicitação parcial segura o insumo na importação');
select is((select acao from insumo_cadastro_historico where descricao = 'LIVRE' order by id desc limit 1), 'apagou_na_importacao',
  'o que saiu pela importação fica no histórico');
select is(insumo_em_uso('406', 'CADEIRA EIFFEL'), true, 'RN-087 · mesmo código e mesmo texto está em uso');
select is(insumo_em_uso('406', 'CADEIRA PAULISTANO'), false, 'RN-087 · mesmo código, outro texto, não');

-- ---------- quem nao e' administrador ----------
set local request.jwt.claims = '{"email":"gc1@teste.local"}';

select isnt_empty('select id from insumo_cadastro', 'o time lê o cadastro');
select throws_ok(
  $$ insert into insumo_cadastro (codigo, descricao, unidade, origem, criado_por, atualizado_por)
     values ('1', 'INVENTADO', 'un', 'tela', '', '') $$,
  '42501', null, 'RN-086 · quem não é administrador não cria');
update insumo_cadastro set unidade = 'pc' where descricao = 'CADEIRA EIFFEL';
select is((select unidade from insumo_cadastro where descricao = 'CADEIRA EIFFEL'), 'un', 'RN-086 · nem edita');
delete from insumo_cadastro where descricao = 'AR CORRIGIDO';
select is((select count(*) from insumo_cadastro where descricao = 'AR CORRIGIDO'), 1::bigint, 'RN-086 · nem apaga');
select is_empty('select id from insumo_cadastro_historico', 'o histórico é só do administrador');
select is_empty('select id from insumo_cadastro_importacao', 'as importações são só do administrador');
select throws_ok(
  $$ select insumo_cadastro_gravar(1, '[{"codigo":"1","descricao":"X","unidade":"un"}]'::jsonb, '[]'::jsonb) $$,
  '42501', null, 'RN-086 · nem importa pela função');
select isnt_empty('select codigo from insumo_tabela_ativa', 'o time lê a tabela ativa');
update insumo_tabela_ativa set codigo = '2';
select is((select codigo from insumo_tabela_ativa), '1', 'RN-086 · só o administrador troca a tabela ativa');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('insumo-importacao', 'importacoes/1.xlsx') $$,
  '42501', null, 'o balde dos relatórios não aceita quem não é administrador');

-- ---------- quem esta' na fila (sem perfil) ----------
set local request.jwt.claims = '{"email":"fila@teste.local"}';
select is_empty('select id from insumo_cadastro', 'quem está na fila não lê o cadastro');
select is_empty('select codigo from insumo_tabela_ativa', 'nem a tabela ativa');

-- ---------- o administrador envia o arquivo ----------
set local request.jwt.claims = '{"email":"admin@teste.local"}';
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('insumo-importacao', 'importacoes/1.xlsx') $$,
  'o administrador sobe o relatório no balde');

-- ---------- anonimo ----------
set local role anon;
select is_empty('select id from insumo_cadastro', 'anônimo não lê o cadastro');
-- Conferido pelo privilegio, sem executar: chamar funcao negada como anon
-- derruba o Postgres 17 da imagem local do Supabase (segfault), o que
-- esconderia o resultado dos outros testes.
select ok(
  not has_function_privilege('anon', 'public.insumo_cadastro_unidades()', 'execute')
  and not has_function_privilege('anon', 'public.insumo_cadastro_gravar(bigint, jsonb, jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.insumo_cadastro_apagar(bigint, bigint[])', 'execute')
  and not has_function_privilege('anon', 'public.insumo_itens_pedidos(text)', 'execute'),
  'anônimo não chama as funções do cadastro');

select * from finish(true);
rollback;
