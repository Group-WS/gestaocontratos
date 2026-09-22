-- ============================================================
-- GRAVAÇÃO PROTEGIDA DA OBRA · fechamento (contrair)
-- Como usar: Supabase → SQL Editor → colar tudo → Run.
-- Reaplicável: rodar de novo não duplica nada e não apaga nada.
--
-- RODE SÓ DEPOIS QUE O APP NOVO ESTIVER NO AR (deploy da gravação pela API,
-- `/api/obras/:codigo/gravar`). Antes disso, este arquivo impede o app que
-- está em produção de gravar. Pré-requisito: `salvar-obra.sql`.
-- ============================================================
--
-- O QUE FALTAVA
-- O `salvar-obra.sql` já recusa gravar por cima da trava viva de OUTRA
-- pessoa. Mas uma aba aberta antes do deploy continua rodando o app antigo,
-- que grava a obra inteira direto na tabela, sem versão — e com a trava
-- dele, que é o caso da cópia velha: habilitar a edição numa tela aberta
-- desde cedo e gravar por cima do que outra pessoa fez nesse meio tempo.
--
-- A PARTIR DAQUI: enquanto houver trava viva na obra, o conteúdo só muda
-- pelas funções (`salvar_obra`, `aplicar_patch_obra`,
-- `restaurar_versao_obra`), que conferem trava e versão. A gravação direta
-- é recusada com uma mensagem que diz o que fazer; a aba antiga para de
-- gravar e a pessoa recarrega, pegando o app novo.
--
-- Sem trava viva, a gravação direta segue como antes: é o caminho que o
-- teste da RN-001 (tests/10-rn-001-liberacao.sql) exercita, e fechá-lo
-- exigiria mudar o teste de uma regra protegida — decisão que fica com o
-- time, à parte desta.
-- ============================================================

create or replace function private.obra_dados_respeita_trava()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  quem   text := lower(trim(coalesce((select auth.jwt()) ->> 'email', '')));
  dono   text := lower(trim(coalesce(old.editando_por, '')));
  viva   boolean := dono <> '' and old.editando_desde > now() - interval '5 minutes';
  funcao boolean := coalesce(current_setting('confere.gravacao', true), '') in ('inteira', 'patch', 'restauracao');
begin
  if current_user <> 'authenticated' then return new; end if;
  if (to_jsonb(new) - private.obra_dados_controle())
     is not distinct from (to_jsonb(old) - private.obra_dados_controle()) then
    return new;
  end if;
  if viva and dono <> quem then
    raise exception '% está editando esta obra agora. Para não gravar por cima, esta alteração não foi salva.', old.editando_por
      using errcode = '55006';
  end if;
  if viva and not funcao then
    raise exception 'Esta aba está com uma versão antiga do sistema e não grava mais a obra. Copie o que precisar e recarregue a página.'
      using errcode = '55006';
  end if;
  return new;
end;
$$;

revoke execute on function private.obra_dados_respeita_trava() from public, anon;

-- CONFERIR: com a trava viva de alguém, um UPDATE direto de conteúdo feito
-- pelo papel do app tem que falhar com a mensagem acima.
