-- ============================================================
-- LIMPAR AS OBRAS DE TESTE  ·  16/09/2026
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
--
-- NAO E' REAPLICAVEL NO SENTIDO DE VOLTAR ATRAS: isto APAGA dados.
-- Rodar de novo nao piora nada (o que ja saiu, saiu), mas nao existe
-- desfazer. Leia a lista antes de rodar.
--
-- Pedido dela em 16/09/2026: "hoje somente a 2450 e a 2498 sao reais".
-- As 12 obras abaixo voltam a ser NOVAS OBRAS, pra recomecar o cadastro.
-- ============================================================
--
-- O QUE SAI:
--   1. obra_dados  — planilhas (vendido, contrato, executivo), itens do
--      plano, aprovacoes de conferencia, etapas concluidas, CMV liberado,
--      assinatura do cliente e as REFERENCIAS de cadernos e anexos.
--   2. sienge_solicitacao da obra 2519 — as 11 solicitacoes enviadas.
--      ESCOLHA DELA, contra a minha sugestao: eu recomendei manter o
--      historico, porque essas solicitacoes EXISTEM no Sienge de verdade
--      e apagar aqui nao desfaz nada la — so' perde o rastro deste lado.
--   3. obra — a linha que marca a obra como "iniciada". E' o que faz ela
--      voltar pra lista de Novas obras.
--
-- O QUE FICA, DE PROPOSITO:
--   * ADITIVOS: o 2405/1 (aprovado, R$ 2.589, fechaduras) e o 2307/1
--     (rascunho vazio). Nenhum delete toca a tabela `aditivo`.
--   * APRESENTACOES: todas as 6 (2256, 2307, 2506, 2517, 2562, 2654).
--     Nenhum delete toca a tabela `apresentacao`.
--   * OS ARQUIVOS FISICOS: eles moram no deposito `obra-arquivos`, em
--     pastas por obra, e NAO em obra_dados. Continuam todos la:
--       2031/especificacao (1)   2204/criativo (1)
--       2307/apresentacao (2)    2506/apresentacao (2)
--       2517/apresentacao (9) + 2517/criativo (1)
--     O que se perde e' o ATALHO para eles dentro da obra. Pra reaver,
--     basta anexar de novo depois do novo cadastro.
--
-- NAO HA' CASCATA: nenhuma chave estrangeira aponta pra `obra`, entao
-- apagar a linha dela nao arrasta aditivo, apresentacao nem arquivo.
-- Conferido no repo em 16/09/2026.
-- ============================================================

-- ---------- 1. ANTES: o que vai ser atingido ----------
-- Rode isto primeiro e confira os numeros com o que voce espera.
select 'obra_dados'         as tabela, count(*) as linhas from obra_dados
 where obra_codigo in ('2506','2256','2562','2519','2497','2466','2204','2517','2654','2405','2307','2031')
union all
select 'obra (iniciadas)',  count(*) from obra
 where codigo      in ('2506','2256','2562','2519','2497','2466','2204','2517','2654','2405','2307','2031')
union all
select 'solicitacoes 2519', count(*) from sienge_solicitacao where obra_codigo = '2519'
union all
select 'aditivos (FICAM)',  count(*) from aditivo
union all
select 'apresentacoes (FICAM)', count(*) from apresentacao;

-- ---------- 2. Os dados das obras ----------
delete from obra_dados
 where obra_codigo in ('2506','2256','2562','2519','2497','2466','2204','2517','2654','2405','2307','2031');

-- ---------- 3. As solicitacoes da 2519 (escolha dela) ----------
delete from sienge_solicitacao where obra_codigo = '2519';

-- ---------- 4. Devolver as obras para "Novas obras" ----------
delete from obra
 where codigo in ('2506','2256','2562','2519','2497','2466','2204','2517','2654','2405','2307','2031');

-- ---------- 5. DEPOIS: conferir ----------
-- As tres primeiras linhas tem que dar 0. As duas ultimas NAO podem ter
-- mudado: sao o aditivo e as apresentacoes que ficam.
select 'obra_dados'         as tabela, count(*) as linhas from obra_dados
 where obra_codigo in ('2506','2256','2562','2519','2497','2466','2204','2517','2654','2405','2307','2031')
union all
select 'obra (iniciadas)',  count(*) from obra
 where codigo      in ('2506','2256','2562','2519','2497','2466','2204','2517','2654','2405','2307','2031')
union all
select 'solicitacoes 2519', count(*) from sienge_solicitacao where obra_codigo = '2519'
union all
select 'aditivos (FICAM)',  count(*) from aditivo
union all
select 'apresentacoes (FICAM)', count(*) from apresentacao;

-- As obras que sobram iniciadas devem ser so' a 2450 e a 2498:
--   select codigo, nome, situacao from obra order by codigo;
