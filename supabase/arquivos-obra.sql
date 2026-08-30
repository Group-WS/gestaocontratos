-- ============================================================
-- ARQUIVOS AVULSOS DA OBRA
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
-- Reaplicavel: rodar de novo nao quebra nada.
-- ============================================================

-- Os cadernos do Executivo tem lugar fixo (uma chave cada) porque sao
-- sempre os mesmos quatro. Isto aqui e' o resto: contrato assinado, ART,
-- foto de medicao, memorial — coisa que a obra junta e nao cabe num
-- campo com nome proprio.
--
-- Lista, e nao mapa: aqui a mesma obra tem N arquivos do mesmo tipo, e
-- uma chave por arquivo obrigaria a inventar nome pra cada um.
alter table obra_dados add column if not exists arquivos jsonb not null default '[]'::jsonb;

-- A coluna JA EXISTIA numa versao anterior, guardando `{}` — objeto, nao
-- lista. Em JavaScript `{} || []` devolve o objeto, e `.forEach` num
-- objeto derruba a tela inteira; foi exatamente o que aconteceu na
-- primeira subida desta tela.
--
-- O app ja se defende disso na leitura (e continua se defendendo, porque
-- coluna compartilhada com versao anterior nunca chega no formato que a
-- versao nova espera). Isto aqui limpa o que ficou gravado.
update obra_dados
   set arquivos = '[]'::jsonb
 where jsonb_typeof(arquivos) is distinct from 'array';

alter table obra_dados alter column arquivos set default '[]'::jsonb;

-- Confere o que entrou:
--   select obra_codigo, jsonb_typeof(arquivos), jsonb_array_length(arquivos) from obra_dados;
