-- ============================================================
-- RENUMERA A EAP: Sonorização e Automação entram no lugar de
-- "Execução e Mão de Obra" — que sai do 32 e passa a ser 34.
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
-- NÃO reaplicável: rode uma vez só (a segunda vez não encontra mais
-- nada em '32' pra mover, e não faz nada — mas não roda de novo à toa).
-- ============================================================

-- Padronização pedida: 32 = Sonorização, 33 = Automação, 34 =
-- Execução e Mão de Obra, todos juntos no final da EAP. O grupo de
-- Execução e Mão de Obra já existia em '32' (desativado desde
-- remove-verba-32.sql) — pra abrir espaço sem perder o dado de obra
-- antiga que já tenha custo lançado nele, o número dele muda de lugar.

begin;

-- 1) Abre espaço: tira "Execução e Mão de Obra" do 32 pra um número que
--    não colide com nada (não existe verba '99').
update eap_grupo set num = '99' where num = '32';

-- 2) Sonorização e Automação descem pros números certos.
update eap_grupo set num = '32', ordem = 32 where num = '33';   -- Sonorização
update eap_grupo set num = '33', ordem = 33 where num = '34';   -- Automação

-- 3) "Execução e Mão de Obra" ocupa o 34, que acabou de esvaziar.
update eap_grupo set num = '34', ordem = 34 where num = '99';

-- 4) Obra antiga que já tenha custo lançado em "Execução e Mão de
--    Obra" guarda esse valor com num='32' dentro de obra_dados.categorias
--    — é JSON, o banco não atualiza sozinho quando o grupo muda de
--    número. Sem este passo, um custo real e antigo passaria a aparecer
--    rotulado como "Sonorização" na tela: dinheiro certo, nome errado.
update obra_dados
set categorias = (
  select jsonb_agg(
    case when elem->>'num' = '32'
      then jsonb_set(elem, '{num}', '"34"')
      else elem
    end
  )
  from jsonb_array_elements(categorias) elem
)
where categorias @> '[{"num": "32"}]'::jsonb;

commit;

-- Confere depois de rodar:
--   select num, nome, ordem, ativo from eap_grupo order by ordem;
-- Espera-se: ... 31 Itens Decorativos, 32 Sonorização, 33 Automação,
-- 34 Execução e Mão de Obra (ativo = false, é o de sempre).
