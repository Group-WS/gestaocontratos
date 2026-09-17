-- ============================================================
-- Só o criador do aditivo, ou um administrador, pode EXCLUIR
-- ============================================================
--
-- Pedido da Priscila em 17/09/2026: "só pode excluir o aditivo o criador do
-- aditivo ou um administrador."
--
-- O app já desabilita o botão para quem não pode, e diz o motivo na dica.
-- Mas isso é a tela. Esta política é a tranca de verdade: vale para qualquer
-- chamada ao banco, venha de onde vier.
--
-- O QUE MUDA
-- A política "acesso time (autenticados)" liberava TUDO — ler, criar,
-- alterar e excluir — para qualquer pessoa logada. Ela dá lugar a quatro,
-- uma por ação: ler, criar e alterar continuam exatamente como estavam, e
-- excluir passa a exigir ser o criador ou administrador.
--
-- NENHUM DADO MUDA. Isto troca só as regras de acesso da tabela.
--
-- PRECISA DE: a função `admin_do_time()`, criada pelo `admin-master.sql`
-- (já rodado). Se ela não existisse, o comando de baixo falharia dizendo o
-- nome dela — e aí é rodar o `admin-master.sql` primeiro.
--
-- COMO RODAR: Supabase → SQL Editor → colar tudo → Run.
-- ============================================================

alter table aditivo enable row level security;

drop policy if exists "acesso time (autenticados)" on aditivo;
drop policy if exists "aditivo: ler" on aditivo;
drop policy if exists "aditivo: criar" on aditivo;
drop policy if exists "aditivo: alterar" on aditivo;
drop policy if exists "aditivo: excluir (criador ou admin)" on aditivo;

create policy "aditivo: ler" on aditivo
  for select to authenticated
  using (true);

create policy "aditivo: criar" on aditivo
  for insert to authenticated
  with check (true);

create policy "aditivo: alterar" on aditivo
  for update to authenticated
  using (true)
  with check (true);

-- `criado_por` guarda o e-mail de quem criou o aditivo.
-- Aditivo antigo, sem criador gravado, fica só para administrador: na
-- dúvida, a exclusão é de quem responde pelo time.
create policy "aditivo: excluir (criador ou admin)" on aditivo
  for delete to authenticated
  using (
    (criado_por is not null and lower(criado_por) = lower(auth.jwt() ->> 'email'))
    or public.admin_do_time()
  );

-- Confere o que ficou (deve listar quatro linhas: select, insert, update, delete):
--   select policyname, cmd from pg_policies where tablename = 'aditivo' order by cmd;
