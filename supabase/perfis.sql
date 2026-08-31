-- ============================================================
-- PERFIS DE ACESSO
-- Como usar: Supabase -> SQL Editor -> cole tudo -> Run.
-- Reaplicavel: rodar de novo nao quebra nada.
-- Ver docs/SPEC-acessos.md e docs/ADR-001-perfis-de-acesso.md
-- ============================================================

-- Um perfil por pessoa, e so' um. NULO e' o estado de espera: entrou
-- pelo link, ainda nao foi liberada, nao ve nada.
alter table pessoa add column if not exists perfil text;

alter table pessoa drop constraint if exists pessoa_perfil_check;
alter table pessoa add constraint pessoa_perfil_check
  check (perfil is null or perfil in ('admin','geral','gc','mehoo'));

-- Quando entrou, quando foi liberada e por quem. A primeira e' o que
-- ordena a fila; as outras duas sao o registro de quem deu o acesso.
alter table pessoa add column if not exists entrou_em    timestamptz;
alter table pessoa add column if not exists liberado_em  timestamptz;
alter table pessoa add column if not exists liberado_por text;

-- Quem ja era admin continua admin.
update pessoa set perfil = 'admin' where admin is true and perfil is null;

-- Quem ja estava cadastrado e nao era admin vira 'geral' -- ele ja
-- estava usando o sistema, e joga-lo na sala de espera seria tirar o
-- acesso de quem ja tinha.
update pessoa set perfil = 'geral' where perfil is null and entrou_em is null;

-- O PRIMEIRO ADMINISTRADOR.
-- Sem isto a sala de espera tranca todo mundo, inclusive quem deveria
-- liberar: ninguem entra porque ninguem tem perfil, e ninguem ganha
-- perfil porque nao ha admin pra dar.
insert into pessoa (email, nome, cargo, perfil, ativo)
values ('priscila.wayhs@groupws.com.br', 'Priscila Wayhs', 'Coordenação', 'admin', true)
on conflict (email) do update set perfil = 'admin', ativo = true;

-- Confere o que entrou:
--   select email, nome, perfil, ativo, entrou_em from pessoa order by perfil, nome;
