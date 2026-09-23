-- ============================================================
-- REGISTRO DO EAP SIENGE  ·  23/09/2026
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
--
-- E' REAPLICAVEL e NAO altera dado nenhum: so' cria a tabela, o indice e
-- as regras de acesso. Roda DEPOIS do rls-reforco.sql (usa meu_perfil() e
-- sou_admin() de la') e do sienge_eap.sql.
-- ============================================================
--
-- PRA QUE SERVE
-- O EAP Sienge guardava so' o ESTADO de hoje: quem importou a versao
-- (sienge_eap_versao.importado_por) e o ultimo autor de cada ligacao
-- (sienge_eap_mapa.definido_por). Trocar a verba de folha apagava o autor
-- anterior, desligar a verba apagava a linha inteira, e "Tornar padrao" --
-- que decide a EAP com que TODA solicitacao de compra sai -- nao deixava
-- carimbo nenhum.
--
-- Aqui cada gesto vira uma linha: quem ligou, trocou, desligou, importou,
-- tornou padrao ou excluiu, o que era antes, o que ficou, e de onde veio
-- (a tela /eap ou o envio da solicitacao dentro de uma obra).
--
-- Mesmo molde do obra_arquivo_evento e do obra_importacao: tabela propria,
-- so' cresce, autor carimbado pelo login (SEG-13), sem update e sem delete.
--
-- SEM FK PRA VERSAO, de proposito: o registro precisa sobreviver a exclusao
-- da versao -- e' justamente o caso em que ele e' a unica memoria do que
-- existia. Por isso a linha guarda tambem o NOME da versao, congelado.
--
-- QUEM LE: so' administrador (Admin master e Administrador). O GC edita o
-- mapa e nao ve o registro.
-- ============================================================

create table if not exists public.sienge_eap_evento (
  id            bigint generated always as identity primary key,

  acao          text not null check (acao in (
                  'importou', 'tornou_padrao', 'ligou', 'trocou', 'desligou', 'excluiu')),

  -- Sem FK: ver o cabecalho. `versao_nome` e' o nome congelado no dia.
  versao_id     bigint,
  versao_nome   text check (versao_nome is null or char_length(versao_nome) <= 400),

  -- Mapa verba -> folha. `codigo` e' o que ficou; `codigo_anterior`, o que saiu.
  verba_num     text check (verba_num is null or char_length(verba_num) <= 40),
  codigo        text check (codigo is null or char_length(codigo) <= 200),
  codigo_anterior text check (codigo_anterior is null or char_length(codigo_anterior) <= 200),

  -- De onde veio o gesto: nulo e' a tela /eap; preenchido e' o envio da
  -- solicitacao de compra dentro daquela obra. Texto, sem FK, porque o
  -- registro nao segue o destino da obra.
  obra_codigo   text check (obra_codigo is null or char_length(obra_codigo) <= 40),

  -- Os numeros da importacao (itens, folhas, verbas herdadas e orfas) e o
  -- que mais cada acao precisar dizer sem virar coluna.
  detalhe       jsonb,

  autor         text not null,
  criado_em     timestamptz not null default now()
);

-- A leitura e' "os eventos, do mais novo pro mais antigo", as vezes de uma
-- versao so'.
create index if not exists sienge_eap_evento_recentes_idx
  on public.sienge_eap_evento (criado_em desc);
create index if not exists sienge_eap_evento_versao_idx
  on public.sienge_eap_evento (versao_id, criado_em desc);

alter table public.sienge_eap_evento enable row level security;

-- LER: so' administrador.
drop policy if exists "sienge_eap_evento: ler" on public.sienge_eap_evento;
create policy "sienge_eap_evento: ler" on public.sienge_eap_evento
  for select to authenticated
  using ((select public.sou_admin()));

-- REGISTRAR: quem pode mexer no cadastro de referencia, em nome proprio.
drop policy if exists "sienge_eap_evento: registrar" on public.sienge_eap_evento;
create policy "sienge_eap_evento: registrar" on public.sienge_eap_evento
  for insert to authenticated
  with check (
    (select public.meu_perfil()) in ('master', 'admin', 'geral', 'gc')
    and autor = lower((select auth.jwt()) ->> 'email')
  );

-- Sem update e sem delete, de proposito: sem policy, o RLS recusa os dois.

-- ---------- CONFERIR ----------
-- Tem que devolver 0 — a tabela comeca vazia.
--   select count(*) from public.sienge_eap_evento;
