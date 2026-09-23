-- ============================================================
-- REGISTRO DAS IMPORTACOES DA OBRA  ·  23/09/2026
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
--
-- E' REAPLICAVEL e NAO altera dado nenhum: so' cria a tabela, os indices
-- e as regras de acesso. Roda DEPOIS do rls-reforco.sql (usa o
-- meu_perfil() e o minhas_obras() de la').
-- ============================================================
--
-- PRA QUE SERVE
-- Subir o Vendido Contrato, o Vendido Planilha ou a Planilha Executivo
-- nao deixava rastro: nem o nome do arquivo, nem quem subiu, nem quando.
-- A unica pista era o historico da obra (obra_versao), que guarda o
-- conteudo mas nao diz de onde ele veio. "De onde saiu esse valor?" nao
-- tinha resposta.
--
-- Cada linha e' UMA importacao: o arquivo, quem, quando, quantos itens
-- vieram e o que aconteceu com as verbas — quais foram trocadas e quais
-- ficaram com a importacao anterior (a importacao troca so' as verbas que
-- vieram no arquivo; decisao de 23/09/2026: manter e avisar).
--
-- POR QUE TABELA PROPRIA, E NAO DENTRO DE obra_dados
-- Porque o registro nao pode seguir o destino do conteudo: restaurar uma
-- versao antiga da obra, ou uma gravacao por cima, levaria o historico
-- junto. Aqui ele so' cresce — nao ha' policy de update nem de delete.
-- ============================================================

create table if not exists public.obra_importacao (
  id              bigint generated always as identity primary key,
  obra_codigo     text not null references public.obra (codigo) on delete cascade,

  -- Qual dos tres documentos. Lista fechada: sao os tres botoes de
  -- importar que existem hoje.
  documento       text not null
                    check (documento in ('vendido_contrato', 'vendido_planilha', 'planilha_executivo')),

  arquivo_nome    text not null check (char_length(btrim(arquivo_nome)) between 1 and 255),
  arquivo_tamanho bigint check (arquivo_tamanho is null or arquivo_tamanho >= 0),

  -- O que veio no arquivo.
  n_itens         integer not null check (n_itens >= 0),

  -- O que aconteceu com as verbas, pelo numero da EAP ("02", "05"...).
  -- trocadas: vieram no arquivo e substituiram o que havia.
  -- mantidas: ja' tinham itens e NAO vieram no arquivo — ficaram com a
  --           importacao anterior.
  verbas_trocadas text[] not null default '{}',
  verbas_mantidas text[] not null default '{}',

  -- O autor e' o e-mail do login. Quem grava e' a API, que carimba o
  -- e-mail do token; o `with check` abaixo recusa assinar por outro.
  autor           text not null,
  criado_em       timestamptz not null default now()
);

-- A leitura e' sempre "as importacoes desta obra, da mais nova pra mais
-- antiga". Tambem cobre a FK (SQL-30): obra_codigo e' a primeira coluna.
create index if not exists obra_importacao_obra_idx
  on public.obra_importacao (obra_codigo, criado_em desc);

alter table public.obra_importacao enable row level security;

-- LER: quem enxerga a obra.
drop policy if exists "obra_importacao: ler" on public.obra_importacao;
create policy "obra_importacao: ler" on public.obra_importacao
  for select to authenticated
  using (obra_codigo in (select public.minhas_obras()));

-- REGISTRAR: quem edita (os mesmos perfis que gravam a obra), numa obra
-- que enxerga, e so' em nome proprio.
drop policy if exists "obra_importacao: registrar" on public.obra_importacao;
create policy "obra_importacao: registrar" on public.obra_importacao
  for insert to authenticated
  with check (
    (select public.meu_perfil()) in ('master', 'admin', 'geral', 'gc')
    and obra_codigo in (select public.minhas_obras())
    and autor = lower((select auth.jwt()) ->> 'email')
  );

-- Sem update e sem delete, de proposito: registro de importacao que se
-- edita depois nao prova nada. Sem policy, o RLS recusa os dois.

-- ---------- CONFERIR ----------
-- Tem que devolver 0 — a tabela comeca vazia.
--   select count(*) from public.obra_importacao;
