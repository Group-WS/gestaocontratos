-- ============================================================
-- Gravar só o que mudou, em vez da obra inteira
-- ============================================================
--
-- Fatia 1 do ADR-004 (docs/ADR-004-editar-por-tela.md), aprovado por ela em
-- 17/09/2026.
--
-- POR QUE ISTO EXISTE
-- Hoje o app grava a linha INTEIRA de `obra_dados` a cada 1,2 s: a coluna
-- `categorias` (todas as verbas e todos os itens) mais umas vinte colunas.
-- Duas pessoas na mesma obra gravariam o documento completo cada uma, e a
-- última apagaria o trabalho da outra em silêncio. É por isso que a trava é
-- da obra inteira, e é isso que precisa mudar antes da trava por tela.
--
-- Esta função aplica UMA MUDANÇA por vez, dentro do banco: "na verba 27,
-- item 3, comprado = true". Quem estiver mexendo em outro campo não é
-- afetado, porque ninguém mais reescreve o resto.
--
-- NENHUM DADO É ALTERADO AO RODAR ESTE ARQUIVO. Ele só cria a função.
-- Enquanto ela não existir, o app continua gravando como sempre — ele testa
-- e volta ao jeito antigo sozinho.
--
-- COMO RODAR: Supabase → SQL Editor → colar tudo → Run.
-- ============================================================

create or replace function public.aplicar_patch_obra(p_codigo text, p_patches jsonb)
returns jsonb
language plpgsql
security invoker
as $$
declare
  atual      jsonb;
  dono       text;
  desde      timestamptz;
  p          jsonb;
  vi         int;
  ii         int;
  alvo       jsonb;
  aplicados  int := 0;
  recusados  jsonb := '[]'::jsonb;
  quem       text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if quem = '' then
    return jsonb_build_object('ok', false, 'motivo', 'sem usuario identificado');
  end if;

  -- `for update` segura a linha até o fim: dois patches ao mesmo tempo
  -- entram em fila em vez de um sobrescrever o outro.
  select categorias, lower(coalesce(editando_por, '')), editando_desde
    into atual, dono, desde
    from obra_dados
   where obra_codigo = p_codigo
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'obra sem linha em obra_dados');
  end if;

  -- A mesma regra do salvamento de hoje: grava quem está com a trava. Trava
  -- de outra pessoa, ainda viva, recusa — e o app avisa em vez de perder o
  -- trabalho calado. Os 5 minutos são o MINUTOS_ATE_TRAVA_EXPIRAR do app.
  if dono <> '' and dono <> quem and desde > now() - interval '5 minutes' then
    return jsonb_build_object('ok', false, 'motivo', 'trava de outra pessoa', 'por', dono);
  end if;

  for p in select value from jsonb_array_elements(p_patches) loop
    vi := (p->>'verba')::int;

    if p ? 'item' then
      ii := (p->>'item')::int;
      alvo := atual -> vi -> 'itens' -> ii;

      -- CONFERE ANTES DE ESCREVER. O item é endereçado por POSIÇÃO, e
      -- posição muda quando alguém insere ou apaga linha. O app manda o
      -- código e a descrição que ele viu; se não baterem, o patch é
      -- recusado e o app grava do jeito antigo. Sem esta conferência, a
      -- alteração cairia na linha errada — silenciosamente.
      if alvo is null
         or (p ? 'confCodigo' and coalesce(alvo->>'codigo', '') <> coalesce(p->>'confCodigo', ''))
         or (p ? 'confDesc'   and coalesce(alvo->>'desc', '')   <> coalesce(p->>'confDesc', '')) then
        recusados := recusados || jsonb_build_array(p);
        continue;
      end if;

      atual := jsonb_set(atual, array[vi::text, 'itens', ii::text], alvo || (p->'campos'));
      aplicados := aplicados + 1;

    elsif p ? 'mapa' then
      -- Patch num mapa da VERBA, e não num item: é assim que a compra de um
      -- item de aditivo é guardada (`comprasAditivo`), porque o item de
      -- aditivo não mora na planilha da obra.
      if atual -> vi is null then
        recusados := recusados || jsonb_build_array(p);
        continue;
      end if;
      atual := jsonb_set(
        atual,
        array[vi::text, p->>'mapa', p->>'chave'],
        coalesce(atual -> vi -> (p->>'mapa') -> (p->>'chave'), '{}'::jsonb) || (p->'campos'),
        true
      );
      aplicados := aplicados + 1;

    else
      recusados := recusados || jsonb_build_array(p);
    end if;
  end loop;

  update obra_dados
     set categorias     = atual,
         atualizado_em  = now(),
         atualizado_por = quem,
         -- Gravar renova a trava, igual ao salvamento de hoje: quem está
         -- trabalhando não perde a obra no meio.
         editando_por   = quem,
         editando_desde = now()
   where obra_codigo = p_codigo;

  return jsonb_build_object('ok', true, 'aplicados', aplicados, 'recusados', recusados);
end
$$;

grant execute on function public.aplicar_patch_obra(text, jsonb) to authenticated;

-- Confere que ficou de pé:
--   select proname from pg_proc where proname = 'aplicar_patch_obra';
