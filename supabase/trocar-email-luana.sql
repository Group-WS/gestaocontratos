-- ============================================================
-- E-MAIL DA LUANA GAMA OLIVEIRA
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
-- Pode rodar antes ou depois de publicar. Rodar de novo nao faz nada.
-- ============================================================
--
-- A Luana Gama Oliveira (Compras) estava cadastrada com o e-mail provisorio
-- teste@groupws.com.br. O e-mail e' a chave da pessoa (e' com ele que o
-- login da Microsoft se identifica), por isso o app nao deixa trocar na
-- tela: aqui a troca vai junto com tudo que aponta pra ele.
--
-- Apontavam pro teste@ (conferido em 15/09/2026):
--   - 10 grupos de compra em que ela e' a compradora (comprador_grupo);
--   - a obra 2450 (Ed. Wall Street, 602), onde ela aparece como Executivo.
--     Se o Executivo dessa obra for outra pessoa, troque na pagina da obra.

begin;

-- Se ela ja entrou pelo link com o e-mail novo antes disto, o app criou uma
-- linha vazia na fila (sem perfil). Essa sai: fica a dela, com cargo e grupos.
delete from pessoa
 where email = 'luana.oliveira@groupws.com.br' and perfil is null
   and exists (select 1 from pessoa where email = 'teste@groupws.com.br');

update pessoa set email = 'luana.oliveira@groupws.com.br'
 where email = 'teste@groupws.com.br';

update comprador_grupo set comprador_email = 'luana.oliveira@groupws.com.br'
 where lower(comprador_email) = 'teste@groupws.com.br';

update obra set responsavel_executivo = 'luana.oliveira@groupws.com.br'
 where lower(responsavel_executivo) = 'teste@groupws.com.br';
update obra set gc = 'luana.oliveira@groupws.com.br'
 where lower(gc) = 'teste@groupws.com.br';
update obra set tailor_made = 'luana.oliveira@groupws.com.br'
 where lower(tailor_made) = 'teste@groupws.com.br';

commit;

-- Confere: a primeira volta a linha dela; as outras duas, nada.
--   select email, nome, cargo, perfil from pessoa where email = 'luana.oliveira@groupws.com.br';
--   select grupo from comprador_grupo where comprador_email = 'teste@groupws.com.br';
--   select codigo from obra where 'teste@groupws.com.br' in (lower(gc), lower(tailor_made), lower(responsavel_executivo));
