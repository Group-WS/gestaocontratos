-- ============================================================
-- ESTEIRA DA OBRA — conclusao de etapa e assinatura do cliente
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
-- Reaplicavel: rodar de novo nao quebra nada.
-- ============================================================

-- Quem concluiu cada etapa e quando.
--
-- Formato: { "vendido_contrato": { "por": "email", "em": "2026-08-10T..." }, ... }
--
-- Por que JSON e nao coluna por etapa: a esteira ainda vai ganhar etapa
-- (a assinatura do cliente acabou de entrar entre a conferencia e a
-- compra). Coluna por etapa obrigaria uma migracao a cada mudanca de
-- processo, e o processo e justamente a parte que muda.
--
-- Duas etapas NAO usam este campo, de proposito: o Depara e concluido
-- pela liberacao do CMV e a Planilha de Compra pela liberacao das
-- compras. Essas ja gravam quem e quando nos campos proprios delas —
-- registrar de novo aqui criaria duas verdades sobre o mesmo fato.
alter table obra_dados add column if not exists etapas_concluidas jsonb not null default '{}'::jsonb;

-- Assinatura do projeto executivo pelo cliente.
--
-- E um PORTAO, nao um carimbo: sem ela a Planilha de Compra nao libera.
-- O anexo e a prova — se uma compra for questionada depois, o documento
-- assinado precisa estar aqui dentro, nao no e-mail de alguem.
alter table obra_dados add column if not exists cliente_assinou_em      date;
alter table obra_dados add column if not exists cliente_assinatura_por  text;   -- quem registrou no sistema
alter table obra_dados add column if not exists cliente_assinatura_arq  jsonb;  -- { nome, tamanho, url }
alter table obra_dados add column if not exists cliente_assinatura_obs  text;

-- Excecao: superior liberou a compra SEM a assinatura registrada.
--
-- Existe porque travar de vez para a obra quando o cliente assinou no
-- papel e ninguem registrou. Fica gravado quem autorizou e por que —
-- excecao sem justificativa vira rotina, e rotina sem registro vira
-- "ninguem sabe quem liberou".
alter table obra_dados add column if not exists compra_sem_assinatura_por  text;
alter table obra_dados add column if not exists compra_sem_assinatura_em   timestamptz;
alter table obra_dados add column if not exists compra_sem_assinatura_just text;

-- Confere o que entrou:
--   select column_name from information_schema.columns
--   where table_name = 'obra_dados' order by ordinal_position;
