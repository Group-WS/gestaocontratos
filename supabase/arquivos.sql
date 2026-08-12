-- ============================================================
-- ARQUIVOS DA OBRA — guardar o que foi subido, nao so o resultado
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
-- Reaplicavel: rodar de novo nao quebra nada.
-- ============================================================

-- Hoje o PDF do contrato e lido, os campos sao extraidos e o arquivo e
-- descartado. So o RESULTADO fica gravado.
--
-- O problema aparece toda vez que o leitor melhora: o conserto vale so pra
-- importacoes novas, e a unica saida e a pessoa achar o arquivo de novo e
-- subir. Nesta semana isso aconteceu tres vezes com o mesmo contrato.
--
-- Guardando o arquivo, o app passa a saber que o leitor mudou desde a
-- ultima leitura e oferece reprocessar num clique — sem caçar arquivo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'obra-arquivos',
  'obra-arquivos',
  false,                      -- privado: contrato de cliente nao e publico
  52428800,                   -- 50 MB por arquivo
  array['application/pdf','application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel.sheet.macroEnabled.12',
        'text/csv','image/png','image/jpeg']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Mesma regra do resto do app: quem esta logado no time acessa.
drop policy if exists "time le arquivos da obra" on storage.objects;
create policy "time le arquivos da obra" on storage.objects
  for select to authenticated using (bucket_id = 'obra-arquivos');

drop policy if exists "time grava arquivos da obra" on storage.objects;
create policy "time grava arquivos da obra" on storage.objects
  for insert to authenticated with check (bucket_id = 'obra-arquivos');

drop policy if exists "time atualiza arquivos da obra" on storage.objects;
create policy "time atualiza arquivos da obra" on storage.objects
  for update to authenticated using (bucket_id = 'obra-arquivos');

drop policy if exists "time apaga arquivos da obra" on storage.objects;
create policy "time apaga arquivos da obra" on storage.objects
  for delete to authenticated using (bucket_id = 'obra-arquivos');

-- Onde cada arquivo da obra esta guardado, e com qual versao do leitor ele
-- foi processado.
--
-- Formato:
--   { "contrato":  { "caminho": "...", "nome": "...", "versaoLeitor": 3,
--                    "em": "2026-08-12T...", "por": "email" },
--     "planilha":  { ... },
--     "executivo": { ... } }
--
-- A versao do leitor e o que permite dizer "o leitor mudou desde a sua
-- ultima importacao" sem adivinhar.
alter table obra_dados add column if not exists arquivos jsonb not null default '{}'::jsonb;

-- Confere o que entrou:
--   select id, public, file_size_limit from storage.buckets where id = 'obra-arquivos';
--   select column_name from information_schema.columns
--   where table_name = 'obra_dados' and column_name = 'arquivos';
