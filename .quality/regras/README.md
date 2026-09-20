# Regras do padrão de qualidade Group WS

> Estes arquivos são a **fonte da verdade** do gate. Valem para Codex, Claude Code e pessoas.
> Não edite aqui dentro do projeto: mudança de regra acontece no repositório
> `Group-WS/groupws-dev-quality` e chega por uma nova versão copiada. O gate confere a
> integridade destes arquivos (`GATE-03`).

## O que ler antes de cada tipo de tarefa

Leia **sempre** o [protocolo do gate](00-protocolo-do-gate.md). Depois, só o que a tarefa toca —
não carregue tudo de uma vez.

| Se a tarefa… | Leia antes de escrever código |
|---|---|
| cria ou altera tela, componente, shell, formulário, modal, mensagem | [05-design-system](05-design-system.md) · [06-padroes-de-tela](06-padroes-de-tela.md) · [04-dados-no-navegador](04-dados-no-navegador.md) |
| cria ou altera tabela, migration, policy, função SQL, consulta | [07-supabase-e-sql](07-supabase-e-sql.md) · [03-seguranca-e-acesso](03-seguranca-e-acesso.md) |
| cria ou altera rota de API, server action, route handler, login, sessão | [03-seguranca-e-acesso](03-seguranca-e-acesso.md) · [01-arquitetura](01-arquitetura.md) · o seu perfil |
| toca cálculo, validação de negócio, status, prazo, valor, elegibilidade | [02-regras-de-negocio](02-regras-de-negocio.md) — **regras protegidas** |
| guarda qualquer coisa no navegador (storage, cookie, cache, estado persistido) | [04-dados-no-navegador](04-dados-no-navegador.md) |
| adiciona ou troca dependência | [01-arquitetura](01-arquitetura.md) · [03-seguranca-e-acesso](03-seguranca-e-acesso.md) |
| mexe em lentidão, listagem grande, relatório, dashboard | [08-performance](08-performance.md) · [07-supabase-e-sql](07-supabase-e-sql.md) |
| qualquer tarefa, antes de encerrar | [09-testes-e-qualidade](09-testes-e-qualidade.md) |

Perfil do projeto (declarado em `.quality/manifest.json` → `perfil`):

- `webapp-vite-hono` → [perfis/webapp-vite-hono.md](perfis/webapp-vite-hono.md)
- `nextjs` → [perfis/nextjs.md](perfis/nextjs.md)

## Como ler uma regra

Cada regra tem um identificador (`SEG-20`, `SQL-12`…) e um marcador:

| Marcador | Significado |
|---|---|
| `[AUTO]` | Verificada pelo `gate.mjs`. Violação reprova o gate. |
| `[AUTO via X]` | Verificada pelo `gate.mjs` por meio da regra X (o relatório mostra X). |
| `[REVISÃO]` | Obrigatória, mas não dá para verificar por script. Quem confere é o agente na saída e a revisão do PR. |
| `[RECOMENDADA]` | Padrão esperado. Desviar exige justificativa no PR. |

Tudo que não é `[RECOMENDADA]` é obrigatório. O identificador é o que aparece no relatório do
gate, nos comentários de escape (`gate-allow SQL-32: motivo`) e na revisão de PR.

## Índice

| Arquivo | Prefixo | Assunto |
|---|---|---|
| [00-protocolo-do-gate](00-protocolo-do-gate.md) | `GATE` | Entrada, bloqueio, adequação, saída, escapes |
| [01-arquitetura](01-arquitetura.md) | `ARQ` | Camadas, dependências, validação, erros |
| [02-regras-de-negocio](02-regras-de-negocio.md) | `NEG` | Regra de negócio × fluxo de funcionalidade, catálogo, proteção |
| [03-seguranca-e-acesso](03-seguranca-e-acesso.md) | `SEG` | Autenticação, autorização, segredos, entrada, LGPD |
| [04-dados-no-navegador](04-dados-no-navegador.md) | `NAV` | O que pode e o que não pode ficar no navegador |
| [05-design-system](05-design-system.md) | `DS` | Vínculo, tokens, componentes, proporções |
| [06-padroes-de-tela](06-padroes-de-tela.md) | `TELA` | Shells, CRUD, formulário, detalhe, contêineres, feedback, estados |
| [07-supabase-e-sql](07-supabase-e-sql.md) | `SQL` | Migrations, RLS, modelagem, performance de SQL |
| [08-performance](08-performance.md) | `PERF` | Front, API, orçamentos |
| [09-testes-e-qualidade](09-testes-e-qualidade.md) | `TST` | Testes essenciais, qualidade de código, definição de pronto |
| [perfis/webapp-vite-hono](perfis/webapp-vite-hono.md) | `VH` | SPA React + Vite, API Hono, Supabase |
| [perfis/nextjs](perfis/nextjs.md) | `NX` | Next.js App Router, Server Actions, `proxy.ts` |
