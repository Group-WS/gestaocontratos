-- ============================================================
-- EAP PADRAO DA EMPRESA — 32 grupos
--
-- Toda planilha que sobe (Vendido Contrato, Vendido Planilha,
-- Executivo) e lida contra esta tabela: o app pega o NOME do grupo
-- escrito no arquivo e acha aqui o grupo padrao correspondente.
--
-- Por que casa por nome e nao por numero: a numeracao briga entre
-- documentos. O contrato escreve "6 CLIMATIZACAO/ EXAUSTAO" e a planilha
-- escreve "7 CLIMATIZACAO/ EXAUSTAO" — o numero diverge, o nome nao.
--
-- `apelidos` sao RADICAIS comparados sobre o nome sem acento, espaco nem
-- pontuacao: "climatiza" cobre climatizacao e climatização; "persian"
-- cobre persiana e persianas. Ganha o apelido MAIS LONGO que casar, pra
-- "adega climatizada" nao cair em Climatizacao por conter "climatiza".
--
-- `analisar = false` marca o grupo que aparece no comparativo mas nao e
-- conferido item a item (N/A). O valor dele continua contando no CMV:
-- "nao conferimos" nao e o mesmo que "nao custa dinheiro".
-- ============================================================
create table if not exists eap_grupo (
  num        text primary key,                    -- "01".."32"
  nome       text not null,
  apelidos   text[] not null default '{}',        -- radicais usados no depara
  analisar   boolean not null default true,       -- false = N/A (nao confere item a item)
  motivo_na  text,                                -- por que nao confere
  ordem      int not null,
  ativo      boolean not null default true,
  criado_em  timestamptz default now()
);

alter table eap_grupo enable row level security;

drop policy if exists "acesso time (autenticados)" on eap_grupo;
create policy "acesso time (autenticados)" on eap_grupo
  for all to authenticated using (true) with check (true);

-- Reaplicavel: rodar de novo atualiza nome/apelidos sem duplicar.
insert into eap_grupo (num, nome, apelidos, analisar, motivo_na, ordem) values
  ('01', 'Arquitetura e Engenharia', array['arquitetura','engenharia','projetoarquitetonico']::text[], false, 'Padrão em toda obra — não muda de contrato pra contrato', 1),
  ('02', 'Serviços Complementares', array['servicoscomplementar','complementar']::text[], false, 'Padrão em toda obra — não muda de contrato pra contrato', 2),
  ('03', 'Civil', array['civil','alvenaria','demolicao']::text[], true, null, 3),
  ('04', 'Impermeabilização', array['impermeabiliza']::text[], true, null, 4),
  ('05', 'Instalações Elétricas e Iluminação', array['instalacaoeletrica','instalacoeseletric','eletrica','eletric','iluminacao','luminotecnic']::text[], true, null, 5),
  ('06', 'Instalações Hidrosanitárias', array['hidrosanitar','hidraulic','hidro']::text[], true, null, 6),
  ('07', 'Instalações Preventivo de Incêndio', array['preventivodeincendio','preventivo','incendio','sprinkler']::text[], true, null, 7),
  ('08', 'Instalações de Comunicação e Dados', array['comunicacaoedados','cabeamento','cabeacaoestruturada','dados','redelogica']::text[], true, null, 8),
  ('09', 'Sistema de Gás', array['sistemadegas','gas','glp']::text[], true, null, 9),
  ('10', 'Gesso e Drywall', array['gesso','drywall','forro']::text[], true, null, 10),
  ('11', 'Revestimento Cerâmico', array['revestimentoceramic','ceramic','porcelanato','azulejo']::text[], true, null, 11),
  ('12', 'Elementos em Madeira', array['elementosemmadeira','madeira','deck']::text[], true, null, 12),
  ('13', 'Piso Vinílico e Carpete', array['pisovinilic','vinilic','carpete']::text[], true, null, 13),
  ('14', 'Papel de Parede', array['papeldeparede','papelparede']::text[], true, null, 14),
  ('15', 'Rodapés e Boiseries', array['rodape','boiserie']::text[], true, null, 15),
  ('16', 'Revestimentos Especiais', array['revestimentoespecial']::text[], true, null, 16),
  ('17', 'Parede Verde', array['paredeverde','jardimvertical']::text[], true, null, 17),
  ('18', 'Pintura', array['pintura','pintor']::text[], true, null, 18),
  ('19', 'Esquadrias', array['esquadria']::text[], true, null, 19),
  ('20', 'Climatização / Exaustão', array['climatiza','exausta','arcondicionado']::text[], true, null, 20),
  ('21', 'Móveis Sob Medida', array['marcenaria','sobmedida','moveisplanejado']::text[], false, 'Móveis sob medida não são conferidos item a item nesta etapa', 21),
  ('22', 'Serralheria', array['serralheria','serralher','metalon']::text[], true, null, 22),
  ('23', 'Vidros e Espelhos', array['vidracaria','vidro','espelho']::text[], true, null, 23),
  ('24', 'Móveis Soltos', array['moveissolto','solto']::text[], true, null, 24),
  ('25', 'Estofados', array['estofado','estofaria','tapecaria']::text[], true, null, 25),
  ('26', 'Pedras — Mármores e Granitos', array['marmoraria','marmore','granito','pedra']::text[], true, null, 26),
  ('27', 'Louças, Metais e Equipamentos Especiais', array['louca','metaissanitario','equipamentoespecial','metais']::text[], true, null, 27),
  ('28', 'Eletroeletrônico', array['eletroeletronic','eletrodomestic','eletronic','eletro']::text[], true, null, 28),
  ('29', 'Adega Climatizada', array['adegaclimatizada','adega']::text[], true, null, 29),
  ('30', 'Cortinas e Persianas', array['cortina','persian']::text[], true, null, 30),
  ('31', 'Itens Decorativos', array['decorativo','decoracao']::text[], true, null, 31),
  ('32', 'Execução e Mão de Obra', array['execucao','maodeobra']::text[], false, 'Valor fictício criado na venda pra separar margem — não representa item real', 32)
on conflict (num) do update set
  nome = excluded.nome,
  apelidos = excluded.apelidos,
  analisar = excluded.analisar,
  motivo_na = excluded.motivo_na,
  ordem = excluded.ordem;
