-- ============================================================
-- OBSERVACOES NA OBRA  ·  19/09/2026
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
--
-- E' REAPLICAVEL e NAO altera dado nenhum: so' cria a tabela, o indice
-- e as regras de acesso.
-- ============================================================
--
-- PRA QUE SERVE
-- Pedido dela: "outras pessoas podem criar alertas para aquelas que vao
-- executar essa tarefa" — "falta comprar divisor de talher", "nao pode
-- esquecer de ver o tapetinho das gavetas".
--
-- E' a primeira coisa no app que NAO e' decisao registrada. Justificativa
-- de remocao, conferencia de alerta e liberacao sao carimbos de quem
-- decidiu. Isto aqui e' recado pra quem executa depois.
--
-- POR QUE TABELA PROPRIA, E NAO DENTRO DE obra_dados.categorias
-- Porque `categorias` e' trocada inteira quando alguem substitui a
-- Planilha Executivo, e foi ela que uma gravacao vazia zerou em tres
-- obras em 18/09/2026. Recado que some junto com a planilha nao serve.
-- Aqui ele sobrevive a reimportacao, a troca de produto e a tudo mais.
--
-- E porque comentar NAO PODE exigir a trava de edicao da obra: quem quer
-- deixar um aviso nao pode ter que tomar a obra de quem esta' trabalhando
-- nela. Sendo outra tabela, o comentario nao passa pelo salvamento da obra.
-- ============================================================

create table if not exists obra_comentario (
  id          bigint generated always as identity primary key,
  obra_codigo text not null,
  verba_num   text not null,

  -- NULL = observacao da VERBA. Preenchido = observacao de um PRODUTO.
  --
  -- E' a DESCRICAO NORMALIZADA do produto, nao a posicao dele na lista.
  -- Posicao desgruda: basta alguem inserir uma linha acima e o recado
  -- passa a apontar pro produto errado — pior que recado nenhum. E o
  -- codigo nao serve de chave: a obra 2450 tem 198 de 269 itens sem ele.
  -- A descricao normalizada e' o mesmo pareamento que o "Entrou, saiu ou
  -- mudou" ja' usa, e sobrevive a reimportacao da planilha.
  --
  -- Efeito colateral proposital: produto partido em MAT e MO mostra o
  -- mesmo recado nas duas linhas. E' o mesmo produto.
  item_chave  text,

  texto       text not null check (length(btrim(texto)) > 0),
  autor       text not null,
  criado_em   timestamptz not null default now()
);

-- A leitura e' sempre "as observacoes desta obra", e a tela separa por
-- verba depois de receber tudo — sao poucas linhas por obra.
create index if not exists obra_comentario_obra_idx
  on obra_comentario (obra_codigo, criado_em);

alter table obra_comentario enable row level security;

-- LER: o time inteiro. O recado existe pra ser lido por quem executa.
drop policy if exists "leitura do time" on obra_comentario;
create policy "leitura do time" on obra_comentario
  for select to authenticated using (true);

-- ESCREVER: todo mundo que entra no app (decisao dela em 19/09/2026), e
-- so' em nome PROPRIO — o `with check` impede assinar como outra pessoa.
drop policy if exists "comentar em nome proprio" on obra_comentario;
create policy "comentar em nome proprio" on obra_comentario
  for insert to authenticated
  with check (autor = lower(auth.jwt() ->> 'email'));

-- APAGAR: o autor, ou um administrador.
--
-- Nao ha' "resolvido" nesta versao (escolha dela: "por enquanto nao").
-- Sem resolver E sem apagar, um comentario errado ficaria pra sempre —
-- entao o apagar e' o minimo pra isto nao virar lixo permanente.
drop policy if exists "apagar o proprio, ou admin" on obra_comentario;
create policy "apagar o proprio, ou admin" on obra_comentario
  for delete to authenticated
  using (autor = lower(auth.jwt() ->> 'email') or public.admin_do_time());

-- Editar um comentario ja' escrito nao existe de proposito: recado alterado
-- depois de lido confunde mais do que ajuda. Quem errou apaga e escreve de
-- novo, e a data nova conta a verdade.

-- ---------- CONFERIR ----------
-- Tem que devolver 0 — a tabela comeca vazia.
--   select count(*) from obra_comentario;
