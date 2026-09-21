-- ============================================================
-- POLICY · as tabelas de referencia, uma a uma
-- ============================================================
-- Catalogo, EAP, insumo e a lista de obras do Sienge nao pertencem a obra
-- nenhuma: quem tem perfil le, quem opera escreve. Duas coisas se provam
-- aqui, e a segunda e' a que costuma passar em branco:
--
--   1. o anonimo nao le NENHUMA delas;
--   2. quem entrou mas ainda nao tem perfil (a sala de espera) tambem nao.
--
-- O item 2 e' o que separa "esta logado" de "foi liberado". Antes do
-- recorte por perfil, entrar com qualquer conta da empresa ja' dava
-- acesso ao catalogo inteiro e a tabela de precos.

begin;
select plan(23);

insert into eap_grupo (num, nome, ordem) values ('90', 'Verba de teste', 900)
  on conflict (num) do nothing;
insert into insumo_preco (codigo, descricao, custo_unitario, data_ref)
  values ('INS-90', 'Insumo de teste', 10.5, current_date);
insert into alocacao_padrao (descricao_norm, descricao, alocacao)
  values ('teste', 'Teste', 'MAT');
insert into insumo_sienge (codigo, descricao, unidade) values ('SIE-90', 'Insumo Sienge', 'un')
  on conflict (codigo) do nothing;
insert into catalogo_fornecedor (nome) values ('Fornecedor de teste');
insert into catalogo_produto (verba, descricao) values ('90', 'Produto de teste');
insert into sienge_obra (codigo, nome, cidade, estado) values ('9301', 'Obra Sienge', 'Floripa', 'SC')
  on conflict (codigo) do nothing;
insert into sienge_eap_versao (nome, unidade_id) values ('EAP de teste', 1);
insert into sienge_eap_item (versao_id, codigo, descricao, nivel, folha)
  select id, '01.001', 'Item de teste', 1, true from sienge_eap_versao where nome = 'EAP de teste';
insert into sienge_eap_mapa (versao_id, verba_num, codigo)
  select id, '90', '01.001' from sienge_eap_versao where nome = 'EAP de teste';

-- ---------- 1. o anonimo nao le nada ----------
set local role anon;
select is_empty('select num from eap_grupo',               'anonimo nao le eap_grupo');
select is_empty('select codigo from insumo_preco',         'anonimo nao le insumo_preco');
select is_empty('select descricao from alocacao_padrao',   'anonimo nao le alocacao_padrao');
select is_empty('select codigo from insumo_sienge',        'anonimo nao le insumo_sienge');
select is_empty('select nome from catalogo_fornecedor',    'anonimo nao le catalogo_fornecedor');
select is_empty('select descricao from catalogo_produto',  'anonimo nao le catalogo_produto');
select is_empty('select codigo from sienge_obra',          'anonimo nao le sienge_obra');
select is_empty('select nome from sienge_eap_versao',      'anonimo nao le sienge_eap_versao');
select is_empty('select codigo from sienge_eap_item',      'anonimo nao le sienge_eap_item');
select is_empty('select codigo from sienge_eap_mapa',      'anonimo nao le sienge_eap_mapa');

-- ---------- 2. logado, sem perfil: tambem nao ----------
set local role authenticated;
set local request.jwt.claims = '{"email":"fila@teste.local"}';
select is_empty('select num from eap_grupo',               'na fila, nao le eap_grupo');
select is_empty('select codigo from insumo_preco',         'na fila, nao le insumo_preco');
select is_empty('select descricao from alocacao_padrao',   'na fila, nao le alocacao_padrao');
select is_empty('select codigo from insumo_sienge',        'na fila, nao le insumo_sienge');
select is_empty('select nome from catalogo_fornecedor',    'na fila, nao le catalogo_fornecedor');
select is_empty('select descricao from catalogo_produto',  'na fila, nao le catalogo_produto');
select is_empty('select codigo from sienge_obra',          'na fila, nao le sienge_obra');
select is_empty('select nome from sienge_eap_versao',      'na fila, nao le sienge_eap_versao');
select is_empty('select codigo from sienge_eap_item',      'na fila, nao le sienge_eap_item');
select is_empty('select codigo from sienge_eap_mapa',      'na fila, nao le sienge_eap_mapa');

-- ---------- 3. com perfil, le ----------
set local request.jwt.claims = '{"email":"gc1@teste.local"}';
select isnt_empty('select num from eap_grupo',            'com perfil, le a referencia');
select isnt_empty('select descricao from catalogo_produto','com perfil, le o catalogo');

-- ---------- 4. a Mehoo le, mas nao escreve ----------
-- O painel dela precisa enxergar tudo; mudar o catalogo, nao.
set local request.jwt.claims = '{"email":"mehoo@teste.local"}';
delete from catalogo_produto where descricao = 'Produto de teste';
select is(
  (select count(*) from catalogo_produto where descricao = 'Produto de teste'), 1::bigint,
  'a Mehoo nao apaga o catalogo: o produto continua la'
);

select * from finish(true);
rollback;
