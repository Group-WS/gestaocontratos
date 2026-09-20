# 04 · Dados no navegador

> **O banco é a fonte da verdade de todo dado e de toda configuração.** O navegador guarda só
> duas coisas: **sessão** (login, credenciais) e **cache** (cópia descartável do que já está no
> banco). Se apagar o armazenamento do navegador faz o usuário perder algo além do login, a
> regra foi violada.

## O teste

Antes de gravar qualquer coisa no navegador, responda:

1. **É sessão ou credencial de login?** → permitido.
2. **Existe no banco ou no servidor, e isto é só uma cópia para evitar ida à rede?** → é cache,
   permitido nas condições de [NAV-05](#nav-05--cache-com-validade-versão-e-limpeza-revisão).
3. **Qualquer outra resposta** → vai para o banco.

## Exemplos

| Situação | No navegador? | Onde fica |
|---|---|---|
| Access e refresh token do Supabase | ✅ sessão | Gerenciado pela biblioteca do Supabase |
| "Lembrar este dispositivo" no login | ✅ sessão | Wrapper, declarado no manifesto (ver [SEG-03](03-seguranca-e-acesso.md)) |
| Tema claro/escuro escolhido | ❌ como fonte · ✅ como cache | Banco (`user_preferences`); cache local só para não "piscar" na abertura |
| Colunas visíveis, ordem e densidade da tabela | ❌ | Banco (`user_preferences` ou `saved_views`) |
| Visões e filtros salvos pelo usuário | ❌ | Banco (`saved_views`) |
| Filtro aplicado agora na listagem | — não é armazenamento | URL (`?status=ativo&page=2`) |
| Rascunho de formulário | ❌ | Banco (rascunho com status) ou memória enquanto a tela está aberta |
| Carrinho, seleção pendente, etapa do assistente | ❌ | Banco |
| Organização ativa escolhida | ❌ como fonte | Banco (último acesso) ou cookie de sessão emitido pelo servidor |
| Lista de cidades/UF para um select | ✅ cache | Servidor; cache com validade |
| Resposta da API de clientes, persistida entre sessões | ❌ | Cache só em memória (TanStack Query), nunca persistido |
| Permissões do usuário | ❌ persistidas | Memória; a decisão real é do servidor |
| Feature flags | ❌ persistidas | Servidor |

## Regras

### NAV-01 · Só sessão e cache `[REVISÃO]`

O navegador (localStorage, sessionStorage, IndexedDB, Cache Storage, cookies criados pelo
front) guarda somente:

- **sessão** — tokens e credenciais de autenticação, geridos pela biblioteca do Supabase ou pelo
  wrapper;
- **cache** — cópia descartável de dado cuja fonte da verdade está no banco ou no servidor.

Configuração, preferência, dado de negócio, rascunho e estado de processo **nunca** têm o
navegador como fonte da verdade.

### NAV-02 · Configuração e preferência moram no banco `[REVISÃO]`

Tema, idioma, colunas, densidade, visões e filtros salvos, notificações e qualquer "lembrar minha
escolha" são gravados no banco (ex.: `public.user_preferences`, com RLS por usuário) e seguem o
usuário entre dispositivos. O navegador pode manter **cópia em cache** para abrir mais rápido —
com a regra de [NAV-05](#nav-05--cache-com-validade-versão-e-limpeza-revisão).

### NAV-03 · Acesso só pelo wrapper `[AUTO]`

Código do projeto não usa diretamente `localStorage`, `sessionStorage`, `indexedDB`,
`document.cookie`, `caches.open`, nem middlewares de persistência (`persist` do Zustand,
`createJSONStorage`, `persistQueryClient`, `PersistQueryClientProvider`). Todo acesso passa pelo
wrapper declarado em `manifest.navegador.wrapper` (molde abaixo).

Duas exceções, ambas explícitas:

- a sessão gerida internamente pela biblioteca do Supabase (não há código do projeto acessando o
  storage);
- arquivos dedicados **só** a sessão e credenciais, listados em `navegador.arquivosDeSessao`
  (ex.: `apps/web/src/features/auth/saved-login.ts` para "lembrar este dispositivo";
  `src/lib/supabase/**` no Next.js). Cada chave que eles gravam também é declarada em
  `navegador.permitidos` com `tipo: "sessao"`. Arquivo de sessão que grava preferência ou dado
  de negócio é violação de NAV-01.

### NAV-04 · Toda chave declarada no manifesto `[AUTO]`

Cada chave de cache do wrapper existe em `manifest.navegador.permitidos` com `tipo`, `motivo`,
`fonteDaVerdade` e `validade` — e vice-versa. Chave de sessão também é declarada, com `tipo:
"sessao"`, para ficar documentada.

```json
"navegador": {
  "wrapper": "apps/web/src/lib/browser-storage.ts",
  "arquivosDeSessao": ["apps/web/src/features/auth/saved-login.ts"],
  "permitidos": [
    { "chave": "sb-<project-ref>-auth-token", "tipo": "sessao", "motivo": "Sessão do Supabase Auth, gerida pelo supabase-js" },
    { "chave": "remembered-login", "tipo": "sessao", "motivo": "Lembrar este dispositivo no login (saved-login.ts)" },
    { "chave": "cache:theme", "tipo": "cache", "motivo": "Evitar tema errado piscando na abertura", "fonteDaVerdade": "public.user_preferences.theme", "validade": "30d" }
  ]
}
```

### NAV-05 · Cache com validade, versão e limpeza `[REVISÃO]`

Todo cache:

- tem **validade** (`expiresAt`) e é ignorado depois dela;
- tem **versão** no envelope — mudou o formato, a versão muda e o cache antigo é descartado;
- é **revalidado** contra o servidor (o cache acelera, não decide);
- não guarda dado pessoal além do estritamente necessário para a finalidade;
- é apagado no logout e na troca de organização.

### NAV-06 · Logout limpa tudo `[REVISÃO]`

Logout faz, nesta ordem: `supabase.auth.signOut()` → `clearBrowserData()` do wrapper → limpeza
do cache em memória (`queryClient.clear()`) → aviso às outras abas (`BroadcastChannel`) para
também saírem.

### NAV-07 · Nada sensível na URL `[REVISÃO]`

Token, código de verificação, CPF, e-mail e telefone não vão para query string: ficam no
histórico, em logs de servidor e no cabeçalho `Referer`. Estado de filtro na URL é permitido e
**recomendado** ([TELA-15](06-padroes-de-tela.md)), desde que o filtro não seja dado pessoal.

## Molde do wrapper

Um arquivo por projeto, no caminho declarado no manifesto. É o **único** arquivo do front que
toca o storage.

```ts
// browser-storage.ts — ÚNICO acesso ao armazenamento do navegador.
// Regra: .quality/regras/04-dados-no-navegador.md. Toda chave de ALLOWED_KEYS também está
// declarada em .quality/manifest.json → navegador.permitidos (o gate confere os dois lados).

const ENVELOPE_VERSION = 1
const DAY = 24 * 60 * 60 * 1000

export const ALLOWED_KEYS = {
  'cache:theme': { ttlMs: 30 * DAY },
} as const

export type AllowedKey = keyof typeof ALLOWED_KEYS

type Envelope<T> = { version: number; expiresAt: number; data: T }

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null // modo privado, cookies bloqueados, ambiente sem window
  }
}

export function readCache<T>(key: AllowedKey): T | null {
  const raw = storage()?.getItem(key)
  if (!raw) return null
  try {
    const envelope = JSON.parse(raw) as Envelope<T>
    if (envelope.version !== ENVELOPE_VERSION || envelope.expiresAt < Date.now()) {
      storage()?.removeItem(key)
      return null
    }
    return envelope.data
  } catch {
    storage()?.removeItem(key)
    return null
  }
}

export function writeCache<T>(key: AllowedKey, data: T): void {
  const envelope: Envelope<T> = {
    version: ENVELOPE_VERSION,
    expiresAt: Date.now() + ALLOWED_KEYS[key].ttlMs,
    data,
  }
  try {
    storage()?.setItem(key, JSON.stringify(envelope))
  } catch {
    // cota cheia ou storage indisponível: cache é descartável, seguir sem ele
  }
}

/** Chamado no logout e na troca de organização. */
export function clearBrowserData(): void {
  for (const key of Object.keys(ALLOWED_KEYS)) storage()?.removeItem(key)
}
```
