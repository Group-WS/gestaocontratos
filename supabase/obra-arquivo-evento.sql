-- ============================================================
-- REGISTRO DOS ARQUIVOS DA OBRA  ·  23/09/2026
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
--
-- E' REAPLICAVEL e NAO altera dado nenhum: so' cria a tabela, o indice e
-- as regras de acesso. Roda DEPOIS do rls-reforco.sql (usa meu_perfil(),
-- minhas_obras() e admin_do_time() de la').
-- ============================================================
--
-- PRA QUE SERVE
-- O historico da obra mostrava os arquivos anexados a partir do que a obra
-- guarda HOJE: um caderno trocado mostrava so' a versao atual, e um anexo
-- removido sumia sem deixar rastro. Aqui cada gesto vira uma linha: quem
-- anexou, trocou ou removeu qual arquivo, e quando.
--
-- Mesmo molde do obra_importacao: tabela propria (o registro nao segue o
-- destino do conteudo da obra), so' cresce, autor carimbado pelo login.
--
-- O CONTRATO so' e' lido por administrador, como o arquivo dele no Storage
-- (contrato-restrito.sql): o registro de "anexou o contrato" diz o nome do
-- arquivo, e isso e' do contrato tambem.
-- ============================================================

create table if not exists public.obra_arquivo_evento (
  id               bigint generated always as identity primary key,
  obra_codigo      text not null references public.obra (codigo) on delete cascade,

  acao             text not null check (acao in ('anexou', 'trocou', 'removeu')),

  -- Qual arquivo da obra: os cadernos pela chave deles, o contrato, a
  -- apresentacao, a aprovacao assinada do cliente, ou um anexo avulso.
  tipo             text not null check (tipo in (
                     'criativo', 'especificacao', 'marcenaria', 'projeto',
                     'contrato', 'apresentacao', 'assinatura', 'avulso')),

  titulo           text not null check (char_length(btrim(titulo)) between 1 and 255),
  arquivo_nome     text not null check (char_length(btrim(arquivo_nome)) between 1 and 255),
  -- Na troca, o nome do arquivo que saiu.
  arquivo_anterior text check (arquivo_anterior is null or char_length(arquivo_anterior) <= 255),
  -- O caminho no Storage: e' o que liga o evento ao arquivo que a obra
  -- guarda hoje (o historico usa pra nao contar o mesmo arquivo duas vezes).
  caminho          text check (caminho is null or char_length(caminho) <= 1024),

  autor            text not null,
  criado_em        timestamptz not null default now()
);

-- A leitura e' "os eventos desta obra, do mais novo pro mais antigo".
-- Tambem cobre a FK (SQL-30).
create index if not exists obra_arquivo_evento_obra_idx
  on public.obra_arquivo_evento (obra_codigo, criado_em desc);

alter table public.obra_arquivo_evento enable row level security;

-- LER: quem enxerga a obra; o contrato, so' administrador.
drop policy if exists "obra_arquivo_evento: ler" on public.obra_arquivo_evento;
create policy "obra_arquivo_evento: ler" on public.obra_arquivo_evento
  for select to authenticated
  using (
    obra_codigo in (select public.minhas_obras())
    and (tipo <> 'contrato' or (select public.admin_do_time()))
  );

-- REGISTRAR: quem edita, na obra que enxerga, em nome proprio; o contrato,
-- so' administrador (e' so' ele que sobe o contrato).
drop policy if exists "obra_arquivo_evento: registrar" on public.obra_arquivo_evento;
create policy "obra_arquivo_evento: registrar" on public.obra_arquivo_evento
  for insert to authenticated
  with check (
    (select public.meu_perfil()) in ('master', 'admin', 'geral', 'gc')
    and obra_codigo in (select public.minhas_obras())
    and autor = lower((select auth.jwt()) ->> 'email')
    and (tipo <> 'contrato' or (select public.admin_do_time()))
  );

-- Sem update e sem delete, de proposito: sem policy, o RLS recusa os dois.

-- ---------- CONFERIR ----------
-- Tem que devolver 0 — a tabela comeca vazia.
--   select count(*) from public.obra_arquivo_evento;
