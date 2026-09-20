# 07 · Supabase, banco e SQL

> O banco é a fonte da verdade e a última linha de defesa. Toda mudança de schema é versionada,
> toda tabela exposta tem RLS, e toda consulta que a tela faz é pensada para o volume de dados
> de daqui a dois anos, não o de hoje.

## Migrations

### SQL-01 · Schema só por migration `[REVISÃO]`

Toda mudança de schema — tabela, coluna, índice, policy, função, trigger, bucket, grant — é um
arquivo em `supabase/migrations/` criado com `supabase migration new <nome>` e aplicado por
`supabase db push` (ou pelo CI). O SQL Editor do dashboard serve para **ler** e investigar em
produção, não para criar objeto: o que não está em migration não existe para o próximo ambiente.

### SQL-02 · Migration aplicada não se edita `[AUTO]`

Migration que já está na branch principal **não é alterada, renomeada nem removida**. Corrigir é
escrever uma migration nova. Editar a antiga faz produção e desenvolvimento divergirem em
silêncio.

### SQL-03 · Migrations compatíveis com o app no ar `[REVISÃO]`

Deploy do app e migration do banco não são atômicos. Toda migration funciona com a versão do app
**que já está em produção**:

1. **Expandir** — adicionar coluna nula ou com default, tabela nova, índice. Publicar.
2. **Migrar** — app novo passa a escrever e ler o formato novo; backfill em lote se preciso.
3. **Contrair** — em outra migration, depois do deploy estável: remover coluna antiga, tornar
   `not null`, apagar tabela.

Renomear coluna ou tabela em uso = expandir e contrair, nunca `rename` direto.

### SQL-04 · Tipos regenerados junto `[REVISÃO]`

Depois de migration que muda o schema exposto: `supabase gen types --lang typescript` (ou o
script do projeto, ex.: `pnpm db:types`), com o arquivo gerado no **mesmo commit**.

## RLS e segurança no banco

### SQL-10 · RLS em toda tabela exposta `[AUTO]`

Toda tabela criada num schema exposto pela Data API (`supabase.schemasExpostos`, padrão
`public`) tem `alter table … enable row level security` nas migrations.

### SQL-11 · Policy com papel explícito `[AUTO]`

Toda policy declara o papel (`to authenticated`, `to anon`, `to service_role`) e é separada por
operação (`for select`, `for insert`, `for update`, `for delete`). `insert` e `update` usam
`with check`, para impedir gravar linha que o usuário não poderia ler.

### SQL-12 · Função em policy dentro de `select` `[AUTO]`

`auth.uid()` e `auth.jwt()` em policy aparecem como `(select auth.uid())`. Assim o Postgres
avalia a função **uma vez por consulta**, e não uma vez por linha — em tabela grande, a diferença
chega a ordens de grandeza. Vale também para funções próprias sem argumento de linha
(`(select private.current_org_ids())`).

### SQL-13 · Metadado do usuário não decide acesso `[AUTO]`

Policy e função de autorização não leem `raw_user_meta_data` / `user_metadata`: o usuário edita
esses campos. Use tabelas próprias com RLS ou `raw_app_meta_data` / `app_metadata`.

### SQL-14 · Função `security definer` blindada `[AUTO]`

Toda função `security definer`:

- declara `set search_path = ''` e usa nomes qualificados (`public.orders`, `auth.uid()`);
- mora num schema **não exposto** (ex.: `private`) quando não deve ser chamada pela Data API;
- tem `revoke execute … from public, anon` quando não é pública.

(O gate verifica o `search_path`; o restante é revisão.)

### SQL-15 · View respeita RLS `[AUTO]`

View em schema exposto é criada `with (security_invoker = true)`; sem isso, ela roda com as
permissões do dono e **ignora o RLS**. Materialized view não tem RLS e, por isso, nunca fica em
schema exposto: mora em `private` e é servida por função que aplica a checagem de acesso.

### SQL-16 · Advisors sem alerta `[REVISÃO]`

Security Advisor e Performance Advisor do Supabase (dashboard ou
`supabase db advisors`, quando disponível na versão da CLI) sem alertas de nível `warn` ou acima
antes do go-live e depois de migration relevante.

### Molde de tabela

```sql
-- supabase/migrations/20260917120000_create_projects.sql

create table public.projects (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  customer_id      uuid not null references public.customers (id) on delete restrict,
  name             text not null check (char_length(name) between 1 and 200),
  status           text not null default 'draft'
                     check (status in ('draft', 'active', 'finished', 'cancelled')),
  contract_value   numeric(14, 2) not null default 0 check (contract_value >= 0),
  starts_on        date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.projects enable row level security;

-- Índices: toda FK + as consultas reais da listagem (organização + status + recência)
create index projects_customer_id_idx on public.projects (customer_id);
create index projects_org_status_created_idx
  on public.projects (organization_id, status, created_at desc);

-- Policies: uma por operação, papel explícito, função dentro de select
create policy projects_select on public.projects
  for select to authenticated
  using (organization_id in (select private.current_user_org_ids()));

create policy projects_insert on public.projects
  for insert to authenticated
  with check (organization_id in (select private.current_user_org_ids()));

create policy projects_update on public.projects
  for update to authenticated
  using (organization_id in (select private.current_user_org_ids()))
  with check (organization_id in (select private.current_user_org_ids()));

create policy projects_delete on public.projects
  for delete to authenticated
  using (organization_id in (select private.current_user_org_ids()));

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function private.set_updated_at();
```

A função de pertencimento, uma vez por projeto:

```sql
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.current_user_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organization_id
  from public.organization_members m
  where m.user_id = (select auth.uid())
$$;

revoke all on function private.current_user_org_ids() from public, anon;
grant execute on function private.current_user_org_ids() to authenticated;
```

> O modelo de autorização ainda está pendente ([03-seguranca-e-acesso](03-seguranca-e-acesso.md#decisões-pendentes-do-modelo-de-autorização)).
> O molde mostra isolamento por organização porque é o caso mais comum; projeto de organização
> única troca a função, não o formato das policies.

## Modelagem

### SQL-20 · Integridade declarada `[REVISÃO]`

- Chave primária em toda tabela (`uuid default gen_random_uuid()` ou
  `bigint generated always as identity`).
- FK com `on delete` explícito (`cascade`, `restrict` ou `set null`, decidido caso a caso).
- `not null` por padrão; nulo só quando "não informado" é um estado real.
- Domínio fechado com `check` (ou tabela de apoio quando a lista é editável pelo usuário).
- Unicidade de negócio com `unique`, citando a regra ([NEG-07](02-regras-de-negocio.md)).

### SQL-21 · Tipos certos `[AUTO]`

- Data e hora: `timestamptz` — nunca `timestamp` sem fuso.
- Dinheiro: `numeric(p, s)` — nunca `float`, `real`, `double precision` ou `money`.
- Texto: `text` com `check` de tamanho — não `varchar(n)` nem `char(n)`.
- Documento (CPF, CNPJ, CEP, telefone): `text` — nunca número (zero à esquerda, CNPJ
  alfanumérico).

(O gate verifica `timestamp` sem fuso, tipos de ponto flutuante e `money`.)

### SQL-22 · Colunas de controle `[REVISÃO]`

`created_at` e `updated_at` (`timestamptz`, com trigger de atualização) em toda tabela de
negócio; `created_by` quando saber o autor importa. Exclusão lógica (`deleted_at`) só quando o
negócio exige recuperação, com índice parcial `where deleted_at is null` e policies que filtram o
excluído.

### SQL-23 · JSONB com parcimônia `[REVISÃO]`

`jsonb` só para dado sem estrutura estável que não é filtrado nem ordenado. Campo consultado vira
coluna. Se precisar filtrar dentro do JSON, índice GIN ou de expressão.

## Performance de SQL

> Meta: **p95 ≤ 100 ms** em consultas de listagem e detalhe; **≤ 500 ms** em relatório. O
> `statement_timeout` dos papéis (`anon` 3 s, `authenticated` 8 s) é um freio de segurança, não
> uma meta — e não se aumenta para "resolver" consulta lenta.

### SQL-30 · Índice em toda chave estrangeira `[AUTO]`

Toda coluna com `references` é a primeira coluna de algum índice (ou da PK / de um `unique`).
Sem isso, `delete` na tabela pai e `join` pela FK fazem varredura completa.

### SQL-31 · Índices seguem as consultas reais `[REVISÃO]`

- Índice composto na ordem: colunas de **igualdade** primeiro, depois **intervalo** ou
  **ordenação** (`(organization_id, status, created_at desc)`).
- Índice parcial para o subconjunto consultado sempre (`where deleted_at is null`,
  `where status = 'active'`).
- Coluna usada em policy é indexada.
- Índice sem uso ou duplicado (Performance Advisor, `supabase inspect db index-stats`) é removido:
  todo índice custa em escrita.
- Em tabela grande de produção, `create index concurrently` — que não roda dentro de transação;
  confira como a ferramenta aplica aquela migration.

### SQL-32 · Só as colunas usadas `[AUTO]`

Nunca `select('*')` no código. A consulta lista as colunas que a tela ou a rota usa:

```ts
// ❌
const { data } = await supabase.from('projects').select('*')

// ✅
const { data } = await supabase
  .from('projects')
  .select('id, name, status, contract_value, customer:customers(id, name)')
```

### SQL-33 · Toda listagem é paginada no banco `[REVISÃO]`

- `range(from, to)` com tamanho máximo de página de 100.
- Offset é aceitável enquanto a navegação não passa de ~10 mil linhas. Acima disso, rolagem
  infinita ou exportação usam **paginação por cursor** (keyset):
  `.lt('created_at', cursor).order('created_at', { ascending: false }).limit(50)`.
- A Data API devolve no máximo 1.000 linhas por padrão — não aumente o limite para trazer "tudo".

### SQL-34 · Contagem com custo consciente `[REVISÃO]`

`count: 'exact'` executa `count(*)` completo. Em tabela grande, use `count: 'estimated'` (exato
para poucos resultados, estimado acima disso) ou mostre "carregar mais" sem total.

### SQL-35 · Sem N+1 `[REVISÃO]`

Nenhuma consulta dentro de laço. Dados relacionados vêm:

- do *embed* do PostgREST (`select('id, name, customer:customers(id, name)')`);
- de uma view (`security_invoker`) ou função SQL (RPC) para a tela;
- ou de **uma** consulta em lote com `.in('id', ids)`.

### SQL-36 · Filtro no banco e explícito `[REVISÃO]`

- Filtrar, ordenar, agrupar e somar **no banco** — nunca buscar tudo e filtrar em JavaScript.
- Mesmo com RLS, a consulta leva o filtro explícito (`.eq('organization_id', orgId)`): o planner
  usa o índice e a intenção fica clara.

### SQL-37 · Busca textual com índice `[REVISÃO]`

- `ilike '%termo%'` exige índice trigram: `create extension if not exists pg_trgm;` e
  `create index … using gin (name gin_trgm_ops)`.
- Busca insensível a acento: coluna gerada normalizada (ou índice de expressão com função
  `immutable` que chama `unaccent`) e a mesma normalização no termo buscado.
- Busca por relevância em texto longo: full-text search (`tsvector` gerado + GIN, configuração
  `portuguese`).
- No front: debounce e mínimo de 2 caracteres ([TELA-11](06-padroes-de-tela.md)).

### SQL-38 · Condições que usam índice `[REVISÃO]`

- Sem função sobre coluna indexada no `where`: `date(created_at) = '2026-09-17'` vira
  `created_at >= '2026-09-17' and created_at < '2026-09-18'`.
- `exists (select 1 …)` em vez de `count(*) > 0`.
- `or` entre colunas diferentes costuma impedir índice: avalie `union all` ou índices separados.
- `not in (subconsulta)` com nulos dá resultado errado e é lento: use `not exists`.

### SQL-39 · Escrita em lote e transação no banco `[REVISÃO]`

- Inserção e atualização em lote (`insert([...])`, `upsert`), nunca uma chamada por linha.
- Operação que precisa ser atômica em mais de uma tabela é **uma função SQL** (RPC), que roda numa
  transação. Duas chamadas seguidas da Data API não são atômicas.

### SQL-40 · Relatório e dashboard sem varrer tabela a cada acesso `[REVISÃO]`

Agregação no banco (view ou RPC). Se ainda for caro: tabela de resumo ou materialized view em
`private`, atualizada por job (`pg_cron`) e servida por função com checagem de acesso
([SQL-15](#sql-15--view-respeita-rls-auto)).

### SQL-41 · Plano de execução no PR `[REVISÃO]`

Consulta nova de listagem, busca ou relatório entra com `explain (analyze, buffers)` rodado sobre
volume realista (seed com, no mínimo, o volume esperado para dois anos). Sem `Seq Scan` em tabela
com mais de 10 mil linhas no caminho da tela. O plano vai na descrição do PR.

### SQL-42 · Conexão direta ao Postgres `[REVISÃO]`

Quando o servidor usa driver Postgres direto (e não a Data API): em ambiente serverless, pooler
em **modo transação** (porta 6543), prepared statements desligados e pool pequeno por instância.

### SQL-43 · Observar em produção `[REVISÃO]`

Mensalmente: Query Performance do dashboard (baseado em `pg_stat_statements`) e
`supabase inspect db outliers`. As 10 consultas com maior tempo total têm dono e plano de ação.

## Testes do banco

Ver [TST-03](09-testes-e-qualidade.md). Molde de teste pgTAP de policy:

```sql
-- supabase/tests/projects_rls.test.sql
begin;
select plan(3);

-- Usuários de teste: membro da organização A e usuário sem vínculo
select tests.create_supabase_user('member_a');
select tests.create_supabase_user('outsider');
-- (seed das organizações, vínculo e de um projeto da organização A omitido)

select tests.authenticate_as('member_a');
select isnt_empty($$ select id from public.projects $$, 'membro vê projetos da própria organização');

select tests.authenticate_as('outsider');
select is_empty($$ select id from public.projects $$, 'usuário sem vínculo não vê projeto nenhum');

select tests.clear_authentication();
select is_empty($$ select id from public.projects $$, 'anônimo não vê projeto nenhum');

select * from finish();
rollback;
```

> `tests.create_supabase_user` e `tests.authenticate_as` vêm do pacote
> `supabase_test_helpers` (database.dev). Sem ele, simule o usuário com
> `set local role authenticated;` e `set local request.jwt.claims = '{"sub": "<uuid>"}';`.
