-- ============================================================
-- ÚLTIMO ACESSO e ONLINE AGORA  ·  tela Equipe e acessos
-- ============================================================
--
-- Rodar UMA vez no SQL Editor do Supabase. Pode rodar de novo: nada
-- quebra e nada se perde.
--
-- O que muda:
--   1. a tabela `pessoa` ganha a coluna `ultimo_acesso`;
--   2. nasce a função `registrar_acesso()`, que o app chama ao abrir e de
--      2 em 2 minutos enquanto está aberto na tela.
--
-- A Equipe mostra "online agora" para quem marcou acesso nos últimos
-- 3 minutos, e a data e a hora do último acesso para os demais. Antes de
-- rodar isto, o app segue funcionando igual e a tela avisa que falta.
-- ============================================================

alter table pessoa add column if not exists ultimo_acesso timestamptz;

-- Cada pessoa marca a PRÓPRIA linha, e só ela.
--
-- `security definer` porque, com o RLS de perfis ligado (rls-perfis.sql),
-- ninguém escreve na própria linha — e é assim que tem que ser: senão
-- qualquer um se promoveria a admin. A função mexe só nesta coluna e só
-- na linha de quem chama; o e-mail vem do login, não de parâmetro.
create or replace function public.registrar_acesso()
returns void
language sql volatile security definer set search_path = public
as $$
  update pessoa set ultimo_acesso = now()
   where email = lower(auth.jwt() ->> 'email');
$$;

revoke all on function public.registrar_acesso() from public;
grant execute on function public.registrar_acesso() to authenticated;

-- Para conferir depois:
--   select email, nome, perfil, ultimo_acesso from pessoa order by ultimo_acesso desc nulls last;
