-- ============================================================
-- TAYLOR MADE — o perfil, e o recorte de obras pelos TRES papeis
--
-- Rodar no SQL Editor do Supabase. Pode rodar mais de uma vez: tudo aqui
-- e' `create or replace` ou `drop ... if exists`.
--
-- POR QUE ISTO E' OBRIGATORIO, e nao um ajuste fino:
--
-- As colunas `tailor_made` e `responsavel_executivo` ja' existem desde
-- equipe-da-obra.sql. O que nao existe e' o banco SABER delas na hora de
-- decidir o que cada pessoa enxerga. A funcao minhas_obras() testa so' o
-- `gc`, e o perfil 'taylor' nem aparece no CASE — ele cai no `else false`.
--
-- Sem este arquivo, uma Taylor Made entra no app e ve ZERO obras. A tela
-- aparece vazia e parece defeito de interface, quando o corte esta' aqui.
--
-- DOIS CONSERTOS, e o segundo nao tem a ver com a Taylor:
--
--   1. 'taylor' entra na lista de perfis validos e no recorte de obras.
--
--   2. 'canal' tambem entra na lista de perfis validos. Ele NUNCA entrou:
--      pessoa-canal.sql criou a coluna `canal` mas nao mexeu no
--      `pessoa_perfil_check`, que continua com os cinco de perfis.sql. Ou
--      seja, salvar alguem como "Canal de compra" hoje e' rejeitado pelo
--      banco. Se alguem ja' tentou e achou que era bug do app, era isto.
-- ============================================================

-- ---------- 1. Os perfis que o banco aceita ----------
-- Sete agora: os cinco originais, mais 'canal' (que faltava) e 'taylor'.
alter table pessoa drop constraint if exists pessoa_perfil_check;
alter table pessoa add constraint pessoa_perfil_check
  check (perfil is null or perfil in ('master','admin','geral','gc','mehoo','canal','taylor'));

-- ---------- 2. As obras que EU enxergo ----------
-- A mudanca e' ESTRITAMENTE ADITIVA: ninguem perde obra de vista.
--
-- "obra sem GC todo mundo ve" continua valendo palavra por palavra. Trocar
-- isso por "obra sem nenhum dos tres responsaveis" le' melhor e esta'
-- errado: uma obra com Taylor e sem GC sumiria da tela de todos os GCs, e
-- ninguem poderia trabalhar nela.
--
-- O GC ganha de quebra as obras em que ele e' o Executivo ou a Taylor —
-- que e' o que ele ja' deveria ver, e nao via.
create or replace function public.minhas_obras()
returns setof text
language sql stable security definer set search_path = public
as $$
  select o.codigo from obra o
   where case public.meu_perfil()
           when 'master' then true
           when 'admin'  then true
           when 'geral'  then true
           -- GC e Taylor Made: as obras em que respondem por QUALQUER um
           -- dos tres papeis, mais as que ainda nao tem GC
           when 'gc'     then o.gc is null
                              or lower(o.gc) = lower(auth.jwt() ->> 'email')
                              or lower(o.tailor_made) = lower(auth.jwt() ->> 'email')
                              or lower(o.responsavel_executivo) = lower(auth.jwt() ->> 'email')
           when 'taylor' then o.gc is null
                              or lower(o.gc) = lower(auth.jwt() ->> 'email')
                              or lower(o.tailor_made) = lower(auth.jwt() ->> 'email')
                              or lower(o.responsavel_executivo) = lower(auth.jwt() ->> 'email')
           -- a Mehoo ve todas, dentro do painel dela
           when 'mehoo'  then true
           else false
         end
$$;

-- ---------- 3. A Taylor Made NAO escreve ----------
-- As politicas de escrita listam os perfis que podem, uma a uma
-- (rls-perfis.sql). 'taylor' nao esta' em nenhuma delas, entao ela ja'
-- nasce so'-leitura no banco — do mesmo jeito que 'mehoo' e 'canal'.
-- Nada a fazer aqui; fica escrito para quem vier conferir nao procurar.

-- ---------- CONFERIR ----------
-- 1) Os sete perfis aceitos:
--    select pg_get_constraintdef(oid) from pg_constraint
--     where conname = 'pessoa_perfil_check';
--
-- 2) Em quais obras uma pessoa responde, por qualquer papel:
--    select codigo, gc, tailor_made, responsavel_executivo
--      from obra
--     where 'marina@groupws.com.br' in (lower(gc), lower(tailor_made),
--                                       lower(responsavel_executivo));
--
-- 3) Depois de marcar alguem como 'taylor' na Equipe, entrar com a conta
--    dela e confirmar que as obras aparecem e que nada e' editavel.
