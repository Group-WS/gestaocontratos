-- ============================================================
-- APAGA A VERBA 32 (EXECUCAO E MAO DE OBRA) DA EAP PADRAO
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
-- Reaplicavel: rodar de novo nao quebra nada.
-- ============================================================

-- Ela existia pra receber mao de obra solta. A mao de obra agora fica
-- dentro do proprio grupo — a da iluminacao e da iluminacao — entao o
-- grupo perdeu a funcao.
--
-- DESATIVA, nao deleta: obra antiga que tenha itens nesse grupo continua
-- podendo mostrar de onde eles vieram. Item nenhum se perde — grupo fora
-- do padrao vai pro fim da lista marcado, e o dinheiro dele conta no CMV
-- igual (regra da empresa: o que nao e padrao e acrescido no final).
update eap_grupo set ativo = false where num = '32';

-- Pra voltar atras:
--   update eap_grupo set ativo = true where num = '32';

-- Confere:
--   select num, nome, ativo from eap_grupo order by ordem;
