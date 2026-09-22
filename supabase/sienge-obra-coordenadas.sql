-- ============================================================
-- SIENGE_OBRA · COORDENADAS -- o pino de cada obra no mapa do Início
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
-- Reaplicável: rodar de novo não duplica nada e não apaga nada.
-- Rode DEPOIS de sienge_obra.sql (bloco 3 do README).
-- ============================================================
--
-- O mapa de obras do DS (ObrasMap) põe um pino por obra, e para isso
-- precisa de latitude e longitude. A tabela só tinha cidade, estado e o
-- endereço completo do Sienge.
--
-- EXPANDIR (SQL-03): três colunas NOVAS e opcionais. O app no ar não lê
-- nenhuma delas, então este arquivo roda a qualquer hora, antes do app
-- novo. As coordenadas entram depois, pelo arquivo que o script
-- web/scripts/geocodificar-obras.mjs gera (sienge-obra-coordenadas-dados.sql).
--
--   lat, lng       graus decimais (WGS84), numeric(9, 6): ~10 cm, sem o
--                  arredondamento de ponto flutuante (SQL-21). Nulo = obra
--                  sem pino: continua na lista do mapa, fora do mapa.
--                  Nunca (0, 0).
--   geo_precisao   'endereco' quando o Google achou o endereço; 'cidade'
--                  quando só deu para achar a cidade (o pino fica no centro
--                  dela). A tela pode avisar quais são aproximadas.
--
-- Nenhuma policy muda: a tabela continua só de leitura para o time
-- (policy "leitura time (autenticados)" do sienge_obra.sql); quem grava é
-- o SQL Editor.
-- ============================================================

alter table public.sienge_obra add column if not exists lat numeric(9, 6);
alter table public.sienge_obra add column if not exists lng numeric(9, 6);
alter table public.sienge_obra add column if not exists geo_precisao text;

-- Coordenada fora do Brasil ou (0, 0) é erro de geocodificação, não obra.
alter table public.sienge_obra drop constraint if exists sienge_obra_coordenada_check;
alter table public.sienge_obra add constraint sienge_obra_coordenada_check check (
  (lat is null and lng is null)
  or (lat between -34 and 6 and lng between -74 and -28 and not (lat = 0 and lng = 0))
);

alter table public.sienge_obra drop constraint if exists sienge_obra_geo_precisao_check;
alter table public.sienge_obra add constraint sienge_obra_geo_precisao_check
  check (geo_precisao is null or geo_precisao in ('endereco', 'cidade'));

-- Confere:
--   select count(*) filter (where lat is not null) as com_pino,
--          count(*) filter (where lat is null)     as sem_pino
--     from public.sienge_obra;
