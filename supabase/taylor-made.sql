-- ============================================================
-- TAYLOR MADE — o perfil no banco
--
-- Rodar no SQL Editor do Supabase. Pode rodar mais de uma vez.
--
-- A PARTE 1 e' a que importa hoje e nao depende de nada.
-- A PARTE 2 so' faz sentido DEPOIS que o rls-perfis.sql for rodado, e ela
-- se protege sozinha: se as funcoes dele nao existirem, ela avisa e passa
-- adiante em vez de quebrar o arquivo inteiro.
--
-- (Da primeira vez este arquivo quebrou com "function public.meu_perfil()
--  does not exist" — ele assumia o rls-perfis.sql aplicado, e nao esta'.)
-- ============================================================

-- ---------- 1. Os perfis que o banco aceita ----------
--
-- Sete: os cinco originais, mais 'taylor' e 'canal'.
--
-- O 'canal' NUNCA entrou aqui. O pessoa-canal.sql criou a coluna `canal` e
-- nao mexeu na trava, que continua com a lista do perfis.sql. Ou seja:
-- salvar alguem como "Canal de compra" e' rejeitado pelo banco ate' hoje.
-- Se alguem ja' tentou e achou que era bug do app, era isto.
alter table pessoa drop constraint if exists pessoa_perfil_check;
alter table pessoa add constraint pessoa_perfil_check
  check (perfil is null or perfil in ('master','admin','geral','gc','mehoo','canal','taylor'));


-- ---------- 2. O corte por perfil, SE ele existir ----------
--
-- Hoje a RLS das tabelas e' a do schema.sql: `to authenticated using
-- (true)`. Quem esta' autenticado le' e escreve tudo, e quem recorta por
-- perfil e' so' a tela. O rls-perfis.sql seria quem passa esse corte pro
-- banco — e ele nao foi rodado.
--
-- Enquanto nao for, nao ha' o que consertar aqui: a Taylor Made ve as
-- obras dela normalmente, porque nao existe corte nenhum no servidor.
--
-- O bloco abaixo so' age se `meu_perfil()` existir. Se existir, ele
-- ensina `minhas_obras()` a olhar os TRES papeis — a mudanca e'
-- estritamente aditiva, ninguem perde obra de vista, e "obra sem GC todo
-- mundo ve" continua valendo palavra por palavra. O GC ganha de quebra as
-- obras em que ele e' o Executivo ou a Taylor, que ele ja' deveria ver.
do $migra$
begin
  if to_regprocedure('public.meu_perfil()') is null then
    raise notice '--';
    raise notice '-- PULEI a parte 2: a funcao public.meu_perfil() nao existe,';
    raise notice '-- o que quer dizer que supabase/rls-perfis.sql nunca foi rodado.';
    raise notice '-- Sem ele o banco nao recorta obra por perfil: a politica em vigor';
    raise notice '-- e a do schema.sql, "to authenticated using (true)", e quem esta';
    raise notice '-- autenticado le tudo. O recorte por perfil hoje e so da tela.';
    raise notice '--';
    raise notice '-- A parte 1 rodou e e o que a Taylor Made precisa agora.';
    raise notice '-- Se um dia o rls-perfis.sql for aplicado, rode este arquivo de novo.';
    raise notice '--';
  else
    execute $sql$
      create or replace function public.minhas_obras()
      returns setof text
      language sql stable security definer set search_path = public
      as $corpo$
        select o.codigo from obra o
         where case public.meu_perfil()
                 when 'master' then true
                 when 'admin'  then true
                 when 'geral'  then true
                 when 'gc'     then o.gc is null
                                    or lower(o.gc) = lower(auth.jwt() ->> 'email')
                                    or lower(o.tailor_made) = lower(auth.jwt() ->> 'email')
                                    or lower(o.responsavel_executivo) = lower(auth.jwt() ->> 'email')
                 when 'taylor' then o.gc is null
                                    or lower(o.gc) = lower(auth.jwt() ->> 'email')
                                    or lower(o.tailor_made) = lower(auth.jwt() ->> 'email')
                                    or lower(o.responsavel_executivo) = lower(auth.jwt() ->> 'email')
                 when 'mehoo'  then true
                 else false
               end
      $corpo$;
    $sql$;
    raise notice 'minhas_obras() agora conta os tres papeis (GC, Taylor Made, Executivo).';
  end if;
end
$migra$;


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
-- 3) Depois de marcar alguem como Taylor Made na Equipe, entrar com a
--    conta dela e confirmar que as obras aparecem e que nada e editavel.
