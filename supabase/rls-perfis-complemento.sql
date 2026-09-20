-- ============================================================
-- RLS POR PERFIL · AS OUTRAS DEZ TABELAS
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
-- Reaplicavel: rodar de novo nao quebra nada.
-- Rode LOGO DEPOIS de supabase/rls-perfis.sql, na mesma sessao.
-- ============================================================
--
-- POR QUE ESTE ARQUIVO EXISTE
--
-- O rls-perfis.sql recorta sete tabelas: pessoa, obra, obra_dados,
-- aditivo, insumo_preco, eap_grupo e alocacao_padrao. Outras dez ficaram
-- com a politica antiga, `to authenticated using (true)` — e entre elas
-- estao as que guardam o que a obra tem de mais especifico:
--
--   obra_versao        o historico inteiro de cada obra
--   apresentacao       o caderno da obra, por revisao
--   sienge_solicitacao o que foi pedido de compra, e por quem
--
-- Fechar obra e deixar obra_versao aberta nao fecha nada: quem quisesse
-- ler a obra alheia leria o historico dela. Ou o recorte vale nas dez, ou
-- nao vale em nenhuma.
--
-- As outras sete sao REFERENCIA — catalogo, insumo, EAP do Sienge, lista
-- de obras do Sienge. Nao pertencem a obra nenhuma, entao quem tem perfil
-- le; escrever fica com quem edita. E' o mesmo desenho que o rls-perfis.sql
-- ja' usa pra insumo_preco e eap_grupo.

-- ---------- limpeza ----------
-- Apaga TODA policy destas tabelas, por enumeracao e nao por nome.
--
-- Politicas se SOMAM: uma sobrevivente dizendo `using (true)` anula todo o
-- recorte abaixo, sem erro e sem aviso. Nao e' hipotese — foi o que
-- aconteceu no primeiro teste deste arquivo: obra_versao tinha uma policy
-- chamada "leitura do time (autenticados)", criada no obra-versao.sql, e o
-- historico da obra alheia continuava a vista mesmo com a obra fechada.
-- Drop por nome so' fecha o buraco que voce ja' conhece.
do $$
declare t text; pol record;
begin
  foreach t in array array[
    'obra_versao','apresentacao','sienge_solicitacao',
    'sienge_obra','sienge_eap_versao','sienge_eap_item','sienge_eap_mapa',
    'insumo_sienge','catalogo_fornecedor','catalogo_produto'
  ] loop
    for pol in
      select polname from pg_policy where polrelid = format('public.%I', t)::regclass
    loop
      execute format('drop policy if exists %I on public.%I', pol.polname, t);
    end loop;
  end loop;
end $$;

-- ---------- por obra: seguem minhas_obras() ----------
-- Quem escreve e' quem opera a obra. A Mehoo enxerga (o painel dela
-- precisa), mas nao altera — mesma linha do rls-perfis.sql.
do $$
declare t text;
begin
  foreach t in array array['obra_versao','apresentacao','sienge_solicitacao'] loop
    execute format($f$
      create policy "leio da minha obra" on %I for select to authenticated
        using (obra_codigo in (select public.minhas_obras()))
    $f$, t);

    execute format($f$
      create policy "escrevo na minha obra" on %I for all to authenticated
        using (obra_codigo in (select public.minhas_obras())
               and public.meu_perfil() in ('master','admin','geral','gc'))
        with check (obra_codigo in (select public.minhas_obras())
               and public.meu_perfil() in ('master','admin','geral','gc'))
    $f$, t);
  end loop;
end $$;

-- ---------- referencia: quem entrou le, quem edita escreve ----------
-- sienge_eap_item e sienge_eap_mapa nao tem coluna de obra: elas penduram
-- na versao da EAP (sienge_eap_versao), que tambem e' referencia. Tratar as
-- tres junto e' o que mantem a leitura coerente — versao visivel com itens
-- invisiveis nao serve pra nada.
do $$
declare t text;
begin
  foreach t in array array[
    'sienge_obra','sienge_eap_versao','sienge_eap_item','sienge_eap_mapa',
    'insumo_sienge','catalogo_fornecedor','catalogo_produto'
  ] loop
    execute format($f$
      create policy "leio referencia" on %I for select to authenticated
        using (public.meu_perfil() is not null)
    $f$, t);

    execute format($f$
      create policy "escrevo referencia" on %I for all to authenticated
        using (public.meu_perfil() in ('master','admin','geral','gc'))
        with check (public.meu_perfil() in ('master','admin','geral','gc'))
    $f$, t);
  end loop;
end $$;

-- Confere DEPOIS de rodar. Nenhuma linha deve sobrar aqui: e' a lista das
-- politicas que ainda deixam passar qualquer um logado.
--
--   select c.relname as tabela, p.polname as politica
--     from pg_policy p join pg_class c on c.oid = p.polrelid
--    where c.relnamespace = 'public'::regnamespace
--      and pg_get_expr(p.polqual, p.polrelid) = 'true'
--    order by 1, 2;
--
-- E, com a sua conta, os numeros devem bater com a tela:
--   select count(*) from obra_versao;
--   select count(*) from apresentacao;
