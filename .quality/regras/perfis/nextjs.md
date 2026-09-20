# Perfil · `nextjs`

> Next.js App Router (≥ 16.3.3) na Vercel, com Supabase para banco e autenticação via
> `@supabase/ssr`. As regras comuns (`00` a `09`) valem inteiras; este arquivo diz **como** elas
> se aplicam nesta stack.

## NX-01 · Estrutura `[REVISÃO]`

```
src/
├── app/                          INTERFACE: rotas — só composição, sem regra de negócio
│   ├── (auth)/login/page.tsx     AuthShell
│   ├── (app)/                    área autenticada (AppShell no layout)
│   │   ├── layout.tsx
│   │   └── clientes/
│   │       ├── page.tsx          listagem (CrudPage)
│   │       ├── loading.tsx       skeleton da listagem
│   │       ├── error.tsx         SystemFrame
│   │       ├── novo/page.tsx
│   │       └── [id]/page.tsx     detalhe
│   ├── api/webhooks/…/route.ts   Route Handlers só para webhook, integração, download
│   ├── auth/confirm/route.ts
│   ├── layout.tsx · not-found.tsx · global-error.tsx
├── components/
│   ├── ds.ts                     fronteira client do design system (NX-09)
│   └── app/                      AppShell e navegação (até o DS publicar os shells)
├── features/<feature>/           FLUXO
│   ├── components/               componentes da feature ('use client' só nas folhas)
│   ├── actions.ts                Server Actions: auth → valida → domain → persiste → revalida
│   ├── queries.ts                leituras (server-only) — Data Access Layer
│   └── schemas.ts                contratos Zod
├── domain/<contexto>/            REGRAS DE NEGÓCIO puras + testes (NEG-01)
├── lib/
│   ├── supabase/{client,server,proxy,admin}.ts
│   ├── auth/session.ts           requireUser()
│   ├── browser-storage.ts        único acesso ao storage (NAV-03)
│   └── env.ts
├── types/database.types.ts       gerado — nunca editar
└── proxy.ts                      renovação de sessão + redirecionamento (NX-04)
supabase/ (migrations, tests, seed.sql) · e2e/ · docs/regras-de-negocio/ · docs/funcionalidades/
```

Manifesto típico:

```json
"perfil": "nextjs",
"caminhos": {
  "frontend": ["src"],
  "api": ["src"],
  "regrasDeNegocio": ["src/domain"],
  "catalogoDeRegras": "docs/regras-de-negocio",
  "migrations": "supabase/migrations",
  "testesDoBanco": "supabase/tests",
  "testesE2E": ["e2e"],
  "ignorar": ["src/types/database.types.ts"]
},
"designSystem": {
  "arquivosDePagina": ["src/app/**/page.tsx"],
  "fronteiraCliente": "src/components/ds.ts"
},
"seguranca": {
  "helpersDeAutenticacao": ["requireUser"],
  "clientesAdministrativos": ["createAdminClient"],
  "rotasPublicas": ["src/app/auth/confirm/route.ts"]
}
```

## Autenticação

### NX-02 · `@supabase/ssr`, nunca os pacotes antigos `[AUTO]`

A sessão usa `@supabase/ssr` (cookies). `@supabase/auth-helpers-nextjs` e
`@supabase/auth-helpers-react` são proibidos. Os clients são criados só em `lib/supabase/`.

### NX-03 · Servidor não usa `getSession()` `[AUTO]`

Em código que roda no servidor (Server Components, Server Actions, Route Handlers, `proxy.ts`,
`lib/`), `supabase.auth.getSession()` é proibido. Use `getClaims()` (verifica a assinatura do JWT
localmente, com chaves assimétricas) ou `getUser()` para operação sensível
([SEG-02](../03-seguranca-e-acesso.md)).

### NX-04 · `proxy.ts` renova a sessão; a autorização mora perto do dado `[REVISÃO]`

- No Next.js 16, `middleware.ts` virou `proxy.ts` (roda em Node.js). O proxy renova a sessão e
  redireciona quem não está logado — é UX e primeira barreira.
- **Autorização nunca fica só no proxy** (lição do `CVE-2025-29927` e dos bypasses de 2026), e
  **nem só no layout**: por causa da renderização parcial, o layout não é reexecutado em toda
  navegação. A checagem fica na página, na Server Action, no Route Handler e na consulta (DAL), e o
  RLS é a última linha.

```ts
// src/proxy.ts
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)'],
}
```

```ts
// src/lib/supabase/proxy.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { env } from '@/lib/env'

const PUBLIC_PATHS = ['/login', '/auth']

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
      },
    },
  })

  // Nada entre createServerClient e getClaims: a renovação da sessão depende desta chamada.
  const { data } = await supabase.auth.getClaims()
  const isPublic = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path))

  if (!data?.claims && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', request.nextUrl.pathname) // só caminho interno (SEG-05)
    return NextResponse.redirect(url)
  }

  return response
}
```

```ts
// src/lib/auth/session.ts
import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/** Usuário autenticado da requisição atual, verificado. Memoizado por requisição. */
export const requireUser = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) redirect('/login')
  return { userId: data.claims.sub, supabase }
})
```

### NX-05 · Toda Server Action autenticada `[AUTO]`

Server Actions são endpoints HTTP públicos: qualquer um pode chamá-las fora da interface. Toda
função exportada de um arquivo `'use server'` chama um helper de `seguranca.helpersDeAutenticacao`
antes de qualquer outra coisa.

```ts
// src/features/projects/actions.ts
'use server'

import { updateTag } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/session'
import { canChangeProjectValue } from '@/domain/projects/value'
import { toActionError, type ActionResult } from '@/lib/errors'
import { changeValueSchema } from './schemas'

export async function changeProjectValue(input: unknown): Promise<ActionResult> {
  const { supabase } = await requireUser()

  const parsed = changeValueSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION', fieldErrors: z.flattenError(parsed.error).fieldErrors } }
  }

  const { data: project, error } = await supabase
    .from('projects')
    .select('id, status')
    .eq('id', parsed.data.projectId)
    .single()
  if (error) return toActionError(error)

  // RN-021 — valor do contrato só muda enquanto a obra não foi encerrada
  if (!canChangeProjectValue(project)) {
    return { ok: false, error: { code: 'PROJECT_FINISHED', message: 'Obra encerrada não permite alterar o valor do contrato.' } }
  }

  const { error: updateError } = await supabase
    .from('projects')
    .update({ contract_value: parsed.data.contractValue })
    .eq('id', project.id)
  if (updateError) return toActionError(updateError)

  updateTag(`project:${project.id}`)
  return { ok: true }
}
```

### NX-06 · Todo Route Handler autenticado `[AUTO]`

Cada método exportado (`GET`, `POST`…) de um `route.ts` chama um helper de autenticação, salvo os
arquivos em `seguranca.rotasPublicas`. Webhook público valida a assinatura antes de ler o corpo.
Cron da Vercel valida `Authorization: Bearer ${CRON_SECRET}`.

## Segredos e fronteira servidor/cliente

### NX-07 · Segredo só em módulo `server-only` `[AUTO]`

Arquivo que lê chave secreta (`SUPABASE_SECRET_KEY`, `SERVICE_ROLE`, tokens de terceiros) ou cria
o client administrativo começa com `import 'server-only'`. Se um componente client importar esse
módulo, o build quebra — antes de a chave vazar para o bundle.

### NX-08 · `NEXT_PUBLIC_` é público `[AUTO via SEG-20]`

Tudo com prefixo `NEXT_PUBLIC_` vai embutido no JavaScript do navegador. Só URL do Supabase,
publishable key e valores sem risco. Ver [SEG-20](../03-seguranca-e-acesso.md).

### NX-09 · Design system pela fronteira client `[AUTO]`

O `@group-ws/ws-ui` (até a v1.2.0) é empacotado sem a diretiva `'use client'` e usa hooks e
contexto do React. Importado direto num Server Component, quebra em tempo de execução
("createContext is not a function"), sem aviso no build. Até o DS publicar a correção:

- os componentes do DS são importados **só** pelo arquivo de fronteira
  (`designSystem.fronteiraCliente`), que começa com `'use client'` e reexporta **por nome**;
- `export *` é proibido na fronteira (o Next.js não suporta `export *` em fronteira client);
- arquivo sem `'use client'` que importa `@group-ws/ws-ui` direto reprova no gate. O CSS
  (`@group-ws/ws-ui/styles.css` e `styles/*.css`) pode ser importado no `layout.tsx`.

```ts
// src/components/ds.ts
'use client'

export {
  Badge,
  Button,
  Card,
  CardContent,
  ConfirmDialog,
  EditorialNameCell,
  EditorialTable,
  PageShell,
  PaginationFooter,
  SystemFrame,
} from '@group-ws/ws-ui'
```

Server Component compõe o template passando dados já buscados; interatividade fica nos
componentes client da feature.

### NX-10 · Tema sem piscar, com fonte da verdade no banco `[REVISÃO]`

O `data-theme` do `<html>` é renderizado no servidor a partir da preferência do usuário (banco),
com cópia em cookie de cache para visitantes e primeira pintura. A store de tema do DS não é a
fonte da verdade ([NAV-02](../04-dados-no-navegador.md)).

## Dados, cache e mutações

### NX-11 · Cache compartilhado nunca guarda dado de usuário `[REVISÃO]`

- `'use cache'` e `'use cache: remote'` só para dado público ou de referência.
- Dado que depende do usuário, da organização ou de permissão: sem cache compartilhado — no máximo
  `'use cache: private'`, com a checagem de acesso **fora** da função cacheada.
- Funções cacheadas não recebem o client do Supabase autenticado.

### NX-12 · Mutação por Server Action; Route Handler para integração `[REVISÃO]`

- Mutação da interface: Server Action ([NX-05](#nx-05--toda-server-action-autenticada-auto)).
- Route Handler: webhook, integração externa, download, cron.
- Revalidação: `updateTag(tag)` quando o usuário precisa ver a própria escrita na hora;
  `revalidateTag(tag, 'max')` para os demais (a forma com um argumento está descontinuada).

### NX-13 · Data Access Layer `[REVISÃO]`

Leituras ficam em `features/<feature>/queries.ts` (ou `lib/dal/`), com `import 'server-only'`,
checagem de acesso e retorno de DTO — só os campos que a interface usa, nunca a linha inteira do
banco.

## Interface

### NX-14 · Server Components por padrão `[REVISÃO]`

`'use client'` só nas folhas interativas (formulário, tabela com seleção, filtros). Página inteira
marcada como client é violação.

### NX-15 · Arquivos de estado de rota `[REVISÃO]`

Todo segmento com dados tem `loading.tsx` (skeleton do arquétipo) e `error.tsx`; a aplicação tem
`not-found.tsx` e `global-error.tsx`. Todos com `SystemFrame` e as mensagens do
[catálogo](../06-padroes-de-tela.md#tela-51--catálogo-de-mensagens-revisão).

### NX-16 · Imagem e fonte do Next.js `[AUTO]`

- `<img>` é proibido no código do app: use `next/image`.
- Fontes com `next/font/google` usando só as famílias do DS (`Host_Grotesk`, `JetBrains_Mono`) —
  [DS-04](../05-design-system.md).

## Configuração e plataforma

### NX-17 · `next.config.ts` seguro `[REVISÃO]`

```ts
// next.config.ts
import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
```

- `experimental.serverActions.allowedOrigins` só quando há proxy reverso na frente, com domínios
  exatos.
- `productionBrowserSourceMaps` desligado (padrão); source maps vão para a ferramenta de erros, não
  para o público.

### NX-18 · Versão e atualização `[REVISÃO]`

- Next.js na linha estável atual, com os patches de segurança (mínimos automáticos em
  [SEG-41](../03-seguranca-e-acesso.md)).
- Lint com a CLI do ESLint (`next lint` não existe mais no Next.js 16).
- Node.js 24 LTS na Vercel e no CI (Node 20 está sendo descontinuado na Vercel em 01/10/2026).
- Funções em `gru1` quando o Supabase está em `sa-east-1` ([PERF-09](../08-performance.md)).
