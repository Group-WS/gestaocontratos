-- ============================================================
-- SOLICITACOES DE COMPRA ENVIADAS AO SIENGE
--
-- O registro de tudo que este app ESCREVEU no ERP. Nao e' espelho das
-- solicitacoes do Sienge (ele continua sendo o dono delas): e' o rastro
-- de cada envio feito daqui -- o que foi mandado, o que o Sienge
-- respondeu item a item, quem apertou o botao e quando.
--
-- ESCRITO ANTES DO ENVIO, nao depois.
--
-- Essa ordem e' a coisa mais importante deste arquivo. Gravar depois
-- parece natural ("registro o que aconteceu") e tem um buraco fatal: se
-- o navegador fecha, a aba trava ou a resposta se perde entre o Sienge e
-- aqui, a solicitacao EXISTE la e nao existe aqui. A pessoa nao tem como
-- saber, reenvia, e agora sao duas.
--
-- Entao a linha nasce com status 'enviando', antes da primeira chamada,
-- e e' atualizada quando a resposta volta. Linha que ficou em 'enviando'
-- e' exatamente a pergunta "sera que entrou?" -- e a tela sabe responder
-- consultando o Sienge (reconciliacao).
--
-- Rodar de novo e' seguro: tudo aqui e' 'if not exists'.
-- ============================================================

create table if not exists sienge_solicitacao (
  id             bigint generated always as identity primary key,
  obra_codigo    text not null,
  building_id    integer not null,
  -- Null enquanto o Sienge nao devolveu o numero (ou se o cabecalho falhou).
  solicitacao_id integer,
  enviado_por    text,
  enviado_em     timestamptz default now(),
  -- O corpo enviado, como foi enviado.
  payload        jsonb not null,
  -- Resultado item a item, com a mensagem do Sienge quando recusou.
  resposta       jsonb not null,
  -- Todos os itens entraram? Falso enquanto nao se sabe.
  ok             boolean not null
);

-- Colunas acrescentadas em 15/09/2026, quando o registro passou a ser
-- escrito antes do envio. Separadas em 'add column if not exists' pra
-- quem ja tinha rodado a versao anterior deste arquivo.
alter table sienge_solicitacao
  -- enviando     -- saiu daqui, resposta ainda nao voltou
  -- concluido    -- todos os itens entraram
  -- parcial      -- a solicitacao existe, mas algum item foi recusado
  -- falhou       -- nem a solicitacao foi criada; nada existe no Sienge
  -- abandonado   -- ficou sem resposta e alguem conferiu: nao entrou
  add column if not exists status text not null default 'concluido',
  -- A chave da TENTATIVA, gerada no navegador antes de enviar. E' ela
  -- que impede o duplo clique (e o F5 no meio) de virar duas
  -- solicitacoes: a segunda gravacao esbarra no indice unico abaixo.
  add column if not exists idempotency_key uuid,
  -- Assinatura do CONTEUDO (obra + itens + quantidades). Duas tentativas
  -- diferentes do mesmo lote tem chaves diferentes e a mesma assinatura
  -- -- e' o que deixa a tela avisar "isto ja foi enviado na solicitacao
  -- 23488" em vez de criar a segunda calada.
  add column if not exists assinatura text,
  add column if not exists atualizado_em timestamptz default now(),
  -- Quando alguem reconcilia um envio sem resposta, fica registrado o
  -- que a consulta ao Sienge encontrou.
  add column if not exists reconciliado_em timestamptz,
  add column if not exists reconciliado_por text;

alter table sienge_solicitacao
  drop constraint if exists sienge_solicitacao_status_check;
alter table sienge_solicitacao
  add constraint sienge_solicitacao_status_check
  check (status in ('enviando', 'concluido', 'parcial', 'falhou', 'abandonado'));

create unique index if not exists sienge_solicitacao_idempotency
  on sienge_solicitacao (idempotency_key) where idempotency_key is not null;

create index if not exists sienge_solicitacao_obra
  on sienge_solicitacao (obra_codigo, enviado_em desc);

-- A pergunta "sobrou algum envio sem resposta?" e' feita toda vez que a
-- tela de Compras abre -- tem que ser barata.
create index if not exists sienge_solicitacao_pendentes
  on sienge_solicitacao (obra_codigo) where status = 'enviando';

create index if not exists sienge_solicitacao_assinatura
  on sienge_solicitacao (obra_codigo, assinatura) where assinatura is not null;

alter table sienge_solicitacao enable row level security;

drop policy if exists "acesso time (autenticados)" on sienge_solicitacao;
create policy "acesso time (autenticados)" on sienge_solicitacao
  for all to authenticated using (true) with check (true);
