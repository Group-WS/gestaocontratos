-- ============================================================
-- ESCOPOS DE CONTRATACAO
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
-- Reaplicavel: rodar de novo nao quebra nada.
-- ============================================================

-- O escopo nasce da selecao de servicos da Dashboard MO: a soma da mao de
-- obra deles e o ORCADO, e e contra ele que a proposta do fornecedor e
-- comparada.
--
-- O texto do modelo (itens, medicoes, garantia, cronograma, observacoes)
-- fica COPIADO dentro de cada escopo, nao referenciado: o que a empresa
-- contratou hoje nao pode mudar porque alguem editou o modelo amanha.
-- Contrato assinado e um retrato, nao um link.
alter table obra_dados add column if not exists escopos jsonb not null default '[]'::jsonb;

-- Confere o que entrou:
--   select obra_codigo, jsonb_array_length(escopos) as escopos from obra_dados;
