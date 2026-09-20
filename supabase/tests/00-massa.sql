-- ============================================================
-- MASSA DE TESTE · roda antes dos testes de policy
-- ============================================================
-- Cinco pessoas, uma de cada perfil que decide alguma coisa, e duas
-- obras com donos diferentes. E' o minimo pra perguntar "quem ve o que":
-- sem uma obra de OUTRO GC, nenhum teste de acesso negado prova nada.

insert into pessoa (email, nome, cargo, perfil, ativo) values
  ('master@teste.local', 'Marta Master', 'Coordenação',    'master', true),
  ('admin@teste.local',  'Ana Admin',    'Coordenação',    'admin',  true),
  ('geral@teste.local',  'Gabi Geral',   'Projetos',       'geral',  true),
  ('gc1@teste.local',    'Gil GC Um',    'GC',             'gc',     true),
  ('gc2@teste.local',    'Gal GC Dois',  'GC',             'gc',     true),
  ('mehoo@teste.local',  'Mel Mehoo',    'Compras',        'mehoo',  true),
  ('fila@teste.local',   'Fabio da Fila','',                null,    true)
on conflict (email) do update set perfil = excluded.perfil, ativo = true;

insert into obra (codigo, nome, gc) values
  ('9001', 'Obra do GC Um',  'gc1@teste.local'),
  ('9002', 'Obra do GC Dois','gc2@teste.local'),
  ('9003', 'Obra sem dono',  null)
on conflict (codigo) do update set gc = excluded.gc;

insert into obra_dados (obra_codigo) values ('9001'), ('9002'), ('9003')
on conflict (obra_codigo) do nothing;

insert into obra_versao (obra_codigo, conteudo, n_itens) values
  ('9001', '{}'::jsonb, 1), ('9002', '{}'::jsonb, 1)
on conflict do nothing;
