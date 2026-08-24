-- ============================================================
-- ARQUIVOS DA OBRA — guardar o que foi subido, nao so o resultado
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
-- Reaplicavel: rodar de novo nao quebra nada.
-- ============================================================

-- Deposito dos arquivos que a equipe anexa na obra.
--
-- Em uso HOJE por: os tres cadernos do Executivo e o documento assinado
-- pelo cliente. Antes deste bucket o app guardava so o nome do arquivo e
-- um endereco "blob:", que o navegador apaga ao fechar a aba — na tela
-- parecia anexado, e depois do F5 o "Baixar" apontava pro nada. No
-- documento assinado era pior: ele e a prova de que o cliente aprovou a
-- compra, e a prova nunca chegou a existir.
--
-- Enquanto este SQL nao rodar, anexar da erro dizendo exatamente isso.
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

-- AINDA NAO USADA pelo app. Fica pronta aqui pro passo seguinte: guardar
-- tambem os arquivos de ORIGEM (contrato, planilha, executivo), que hoje
-- sao lidos e descartados.
--
-- Hoje o caderno e o documento assinado ja moram em colunas proprias
-- (`cadernos` e `cliente_assinatura_arq`), no mesmo formato:
--   { "caminho": "...", "nome": "...", "tamanhoKB": 812,
--     "em": "2026-08-12T...", "por": "email" }
--
-- Pros arquivos de origem entra mais um campo, `versaoLeitor` — e o que
-- vai permitir dizer "o leitor mudou desde a sua ultima importacao,
-- quer reprocessar?" sem a pessoa ter que cacar o arquivo de novo.
alter table obra_dados add column if not exists arquivos jsonb not null default '{}'::jsonb;

-- Confere o que entrou:
--   select id, public, file_size_limit from storage.buckets where id = 'obra-arquivos';
--   select column_name from information_schema.columns
--   where table_name = 'obra_dados' and column_name = 'arquivos';
