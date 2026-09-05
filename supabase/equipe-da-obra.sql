-- ============================================================
-- EQUIPE DA OBRA — dois papéis novos, além do GC.
--
-- Mesma ideia de `gc`: guarda o e-mail de quem responde, o nome sai da
-- Equipe na hora de mostrar. Cada um em coluna própria porque uma obra
-- pode ter os três ao mesmo tempo, e nenhum é obrigatório.
-- ============================================================

alter table obra add column if not exists tailor_made text;
alter table obra add column if not exists responsavel_executivo text;
