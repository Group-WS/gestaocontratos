-- ============================================================
-- STATUS MANUAL no painel "Onde estao as obras".
--
-- O status automatico (Confere > nome "Entregue" > codigo <=1500 >
-- ativa por padrao) e' um palpite. Quem olha a lista de verdade sabe
-- melhor -- este campo deixa marcar/desmarcar uma obra na mao, e essa
-- marcacao manda MAIS que qualquer regra automatica.
--
-- NULL continua "sem marcacao manual, usa a regra automatica".
-- ============================================================

alter table sienge_obra add column if not exists status_manual text
  check (status_manual in ('ativa', 'finalizada'));

-- A leitura ja era liberada pro time; agora a escrita tambem precisa
-- ser, pra quem clica no check gravar de fato (com a propria sessao
-- logada, nunca com chave de servico).
drop policy if exists "escrita time (autenticados)" on sienge_obra;
create policy "escrita time (autenticados)" on sienge_obra
  for update
  to authenticated
  using (true)
  with check (true);
