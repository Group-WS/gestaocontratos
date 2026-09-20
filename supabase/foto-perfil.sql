-- ============================================================
-- FOTO DE PERFIL  ·  avatar da pessoa no trilho, no Início e na Equipe
-- ============================================================
--
-- Rodar UMA vez no SQL Editor do Supabase. Pode rodar de novo: nada
-- quebra e nada se perde.
--
-- O que muda:
--   1. a tabela `pessoa` ganha a coluna `foto`;
--   2. nasce a função `definir_foto(caminho)`, que o app chama quando a
--      pessoa escolhe ou remove a própria foto.
--
-- A imagem em si NÃO fica aqui: ela vai para o balde público `catalogo`,
-- na pasta `pessoas/`, e esta coluna guarda só o caminho lá dentro — o
-- mesmo desenho do Catálogo (`catalogo.sql`), onde `imagem` também é
-- caminho e nunca URL. Guardar a URL amarraria o banco ao domínio do
-- Storage, que não é nosso.
--
-- Antes de rodar isto, o app segue funcionando igual: a troca de foto
-- avisa que falta rodar este arquivo, e todo avatar continua nas iniciais.
-- ============================================================

alter table pessoa add column if not exists foto text;

-- Cada pessoa troca a PRÓPRIA foto, e só ela.
--
-- `security definer` pelo mesmo motivo de `registrar_acesso()`: com o RLS
-- de perfis ligado (rls-perfis.sql), ninguém escreve na própria linha, e é
-- assim que tem que ser — senão qualquer um se promoveria a admin. A
-- função mexe só nesta coluna e só na linha de quem chama; o e-mail vem
-- do login, não de parâmetro.
--
-- O caminho é obrigado a começar em `pessoas/`: sem isso, alguém poderia
-- apontar o próprio avatar para qualquer imagem do balde — inclusive a
-- foto de um produto do Catálogo.
--
-- Caminho vazio APAGA a foto. É o caminho de volta: quem se arrependeu da
-- foto precisa conseguir voltar para as iniciais sem pedir para ninguém.
create or replace function public.definir_foto(caminho text)
returns void
language plpgsql volatile security definer set search_path = public
as $$
begin
  if caminho is not null and caminho <> '' and caminho not like 'pessoas/%' then
    raise exception 'caminho de foto inválido: %', caminho;
  end if;
  update pessoa
     set foto = nullif(caminho, '')
   where email = lower(auth.jwt() ->> 'email');
end;
$$;

revoke all on function public.definir_foto(text) from public;
grant execute on function public.definir_foto(text) to authenticated;

-- Para conferir depois:
--   select email, nome, foto from pessoa where foto is not null;
--   select routine_name from information_schema.routines
--    where routine_schema = 'public' and routine_name = 'definir_foto';
