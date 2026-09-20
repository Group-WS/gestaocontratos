# Perfil · `webapp-vite-hono`

> SPA React + Vite no front, API Hono no servidor, Supabase para banco e autenticação — o formato
> do `code-template-webapp`. As regras comuns (`00` a `09`) valem inteiras; este arquivo diz
> **como** elas se aplicam nesta stack.

## VH-01 · Estrutura `[REVISÃO]`

```
apps/
├── web/                         SPA (React 19 + Vite + TanStack Router/Query + DS Group WS)
│   └── src/
│       ├── components/
│       │   ├── ui/ tkws/ atoms/ …   DS por cópia (espelho — DS-02) ou nada, se DS por pacote
│       │   └── app/                 AppShell, navegação (até o DS publicar os shells)
│       ├── features/<feature>/      FLUXO: <Feature>Page.tsx, componentes, hooks.ts (Query)
│       ├── lib/
│       │   ├── api.ts               cliente hono/client com Authorization: Bearer
│       │   ├── supabase.ts          supabase-js SÓ para auth
│       │   └── browser-storage.ts   único acesso ao storage (NAV-03)
│       └── main.tsx
└── api/                         API Hono
    └── src/
        ├── app.ts               encadeia as rotas e exporta AppType (contrato RPC)
        ├── env.ts               variáveis validadas com Zod (ARQ-05)
        ├── middleware/auth.ts   requireAuth
        ├── lib/supabase.ts      supabaseForUser (RLS) · createAdminClient (SEG-15)
        └── routes/<feature>.ts  FLUXO: valida → autoriza → chama domain → persiste → responde
packages/
└── shared/src/
    ├── schemas/                 contratos Zod (front e API)
    ├── domain/<contexto>/       REGRAS DE NEGÓCIO puras + testes (NEG-01)
    └── database.types.ts        gerado — nunca editar
supabase/
├── migrations/                  SQL-01
├── tests/                       pgTAP (TST-03)
└── seed.sql
e2e/                             Playwright (TST-04)
docs/
├── regras-de-negocio/           fichas RN-NNN (NEG-02)
└── funcionalidades/             fluxos (recomendado)
```

Manifesto típico:

```json
"perfil": "webapp-vite-hono",
"caminhos": {
  "frontend": ["apps/web/src"],
  "api": ["apps/api/src"],
  "regrasDeNegocio": ["packages/shared/src/domain"],
  "catalogoDeRegras": "docs/regras-de-negocio",
  "migrations": "supabase/migrations",
  "testesDoBanco": "supabase/tests",
  "testesE2E": ["e2e"],
  "ignorar": ["**/database.types.ts"]
},
"seguranca": {
  "helpersDeAutenticacao": ["requireAuth"],
  "clientesAdministrativos": ["supabaseAdmin", "createAdminClient"],
  "rotasPublicas": []
}
```

## Front

### VH-02 · O front não acessa dados do Supabase `[AUTO]`

No `apps/web`, o client do Supabase serve **só para autenticação** (`supabase.auth.*`). Nada de
`supabase.from(...)`, `supabase.rpc(...)`, `supabase.storage` ou `supabase.channel(...)`: todo dado
passa pela API, onde a autorização e as regras de negócio são aplicadas.

Precisa de Realtime ou de upload direto para o Storage? É decisão de arquitetura: registre (ADR)
e use escape com o motivo (`gate-allow VH-02: upload direto por URL assinada emitida pela API`).

### VH-03 · Chamadas pela camada `api` `[REVISÃO]`

- Chamadas usam o cliente tipado (`hono/client`) de `lib/api.ts`, que anexa
  `Authorization: Bearer <access_token>` da sessão atual.
- Cada feature tem `hooks.ts` com TanStack Query: chaves `['<feature>', ...params]`, `staleTime`
  explícito ([PERF-03](../08-performance.md)), mutações que invalidam as chaves afetadas.
- Tela não chama `fetch` direto.

### VH-04 · Sessão e rotas protegidas `[REVISÃO]`

- A sessão do supabase-js fica no navegador (permitido, [NAV-01](../04-dados-no-navegador.md)) e é
  declarada no manifesto como `tipo: "sessao"`.
- O router redireciona para o login quando não há sessão (UX). A barreira real é a API
  ([SEG-11](../03-seguranca-e-acesso.md)).
- Logout segue [NAV-06](../04-dados-no-navegador.md).

## API

### VH-05 · Toda rota autenticada `[AUTO]`

Todo arquivo em `apps/api/src/routes/` aplica um helper de `seguranca.helpersDeAutenticacao`
(`.use('*', requireAuth)`), salvo os listados em `seguranca.rotasPublicas`. Rota pública que recebe
webhook valida a **assinatura** do remetente antes de ler o corpo.

### VH-06 · Escrita validada com schema `[AUTO]`

Rota com `.post`, `.put` ou `.patch` valida o corpo com `zValidator('json', schema)`, usando o schema
de `@repo/shared`. Parâmetros de rota e query também passam por `zValidator` ([ARQ-03](../01-arquitetura.md)).

### VH-07 · Rota é fluxo, não regra `[REVISÃO]`

A rota **orquestra**: valida a entrada → confere autorização → chama a função de `domain/` →
persiste com o client do usuário → responde. Condição de negócio escrita dentro da rota é violação
de [NEG-04](../02-regras-de-negocio.md).

> O `code-template-webapp` até a v1 deste padrão dizia "regra de negócio vive aqui [na rota]". Esse
> comentário está superado por este gate.

### VH-08 · Client do usuário por padrão `[REVISÃO]`

Rotas usam `c.var.supabase` — o client criado com o token do usuário, com RLS ativo. O client
administrativo segue [SEG-15](../03-seguranca-e-acesso.md) (automática: todo uso tem escape com
motivo).

### VH-09 · Resposta de erro padronizada `[REVISÃO]`

```ts
// { error: { code: 'CUSTOMER_CNPJ_TAKEN', message: 'Já existe um cliente com este CNPJ.' } }
```

`error.message` do Supabase nunca vai na resposta ([SEG-33](../03-seguranca-e-acesso.md),
automática); vai para o log, junto do identificador de correlação.

### VH-10 · CORS por ambiente `[REVISÃO]`

Origens em variável de ambiente (`CORS_ORIGINS`), nunca fixas no código nem `*` com credenciais
([SEG-36](../03-seguranca-e-acesso.md), automática para o `*`). Em produção com front e API no mesmo
domínio (rewrite da Vercel), o CORS nem precisa ser liberado.

### VH-11 · Chaves do Supabase `[REVISÃO]`

- `apps/web/.env`: `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` — só isso.
- `apps/api/.env`: URL, publishable key e `SUPABASE_SECRET_KEY` (`sb_secret_…`).
- As chaves legadas `anon` e `service_role` estão em descontinuação pelo Supabase (anunciada para
  o fim de 2026): projeto novo já nasce com publishable/secret; projeto existente migra.

## Molde de rota

```ts
// apps/api/src/routes/projects.ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { canChangeProjectValue, createProjectSchema, idParamSchema } from '@repo/shared'
import { requireAuth, type AuthVariables } from '../middleware/auth'
import { failure, toApiError } from '../lib/errors'

export const projectsRoute = new Hono<{ Variables: AuthVariables }>()
  .use('*', requireAuth)

  .get('/', async (c) => {
    const { data, error } = await c.var.supabase
      .from('projects')
      .select('id, name, status, contract_value, customer:customers(id, name)')
      .order('created_at', { ascending: false })
      .range(0, 49)
    if (error) return toApiError(c, error)
    return c.json(data)
  })

  .patch('/:id/value', zValidator('param', idParamSchema), zValidator('json', createProjectSchema.pick({ contract_value: true })), async (c) => {
    const { id } = c.req.valid('param')
    const input = c.req.valid('json')

    const { data: project, error } = await c.var.supabase
      .from('projects')
      .select('id, status')
      .eq('id', id)
      .single()
    if (error) return toApiError(c, error)

    // RN-021 — valor do contrato só muda enquanto a obra não foi encerrada
    if (!canChangeProjectValue(project)) {
      return failure(c, 422, 'PROJECT_FINISHED', 'Obra encerrada não permite alterar o valor do contrato.')
    }

    const { error: updateError } = await c.var.supabase
      .from('projects')
      .update({ contract_value: input.contract_value })
      .eq('id', id)
    if (updateError) return toApiError(c, updateError)
    return c.json({ ok: true })
  })
```

```ts
// apps/api/src/lib/errors.ts
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { PostgrestError } from '@supabase/supabase-js'
import { logger } from './logger'

const KNOWN: Record<string, { status: ContentfulStatusCode; code: string; message: string }> = {
  '23505': { status: 409, code: 'CONFLICT', message: 'Já existe um registro com estes dados.' },
  '23503': { status: 409, code: 'IN_USE', message: 'Não é possível concluir: existem registros vinculados.' },
  '42501': { status: 403, code: 'FORBIDDEN', message: 'Você não tem permissão para esta ação.' },
  PGRST116: { status: 404, code: 'NOT_FOUND', message: 'Registro não encontrado.' },
}

export function failure(c: Context, status: ContentfulStatusCode, code: string, message: string) {
  return c.json({ error: { code, message } }, status)
}

export function toApiError(c: Context, error: PostgrestError) {
  const known = KNOWN[error.code]
  if (known) return failure(c, known.status, known.code, known.message)
  const correlationId = crypto.randomUUID()
  logger.error({ correlationId, code: error.code, details: error.message }, 'database error')
  return failure(c, 500, 'UNEXPECTED', `Algo deu errado do nosso lado. Código: ${correlationId}`)
}
```

## Vercel

### VH-12 · Deploy `[REVISÃO]`

- Front e API no mesmo projeto e domínio (API em função sob `/api`, rewrite do SPA para
  `index.html`).
- Funções na região do banco ([PERF-09](../08-performance.md)): `"regions": ["gru1"]` para
  Supabase em `sa-east-1`.
- Cabeçalhos de segurança do [SEG-35](../03-seguranca-e-acesso.md) no `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    }
  ]
}
```

- Preview com Deployment Protection ligada e apontando para projeto Supabase de desenvolvimento
  ([SEG-23](../03-seguranca-e-acesso.md)).
