# 09 · Testes e qualidade

> O nível mínimo de testes da Group WS é o **essencial**: o que protege regra de negócio,
> isolamento de dados e acesso. Ele é pequeno de propósito — e por isso não tem exceção.

## Testes essenciais

| O quê | Ferramenta | Onde | Regra |
|---|---|---|---|
| Regras de negócio | Vitest | ao lado do arquivo em `domain/` | [NEG-03](02-regras-de-negocio.md) · TST-02 |
| Policies RLS (permitido **e** negado) | pgTAP (`supabase test db`) | `supabase/tests/` | TST-03 |
| Login | Playwright | `caminhos.testesE2E` | TST-04 |
| Acesso negado | Playwright | `caminhos.testesE2E` | TST-04 |

### TST-01 · Gate e validações rodam no CI `[AUTO]`

O workflow `.github/workflows/quality-gate.yml` existe (instalado com o padrão) e roda o gate e os
testes do banco em todo PR. O CI do projeto roda também os `comandosDeValidacao` do manifesto
(lint, typecheck, test, build). Merge na branch principal exige CI verde.

### TST-02 · Regras de negócio testadas pelos exemplos `[REVISÃO]`

Além da existência do teste ([NEG-03](02-regras-de-negocio.md), automática), o teste cobre **todos
os exemplos da ficha** e os limites: valor exato do limite, logo abaixo, logo acima, vazio, nulo.

### TST-03 · Toda tabela exposta tem teste de policy `[AUTO]`

Toda tabela criada num schema exposto aparece em algum teste de `supabase/tests/` que tenha pelo
menos uma asserção de **acesso negado** (`is_empty`, `throws_ok` ou `throws_like`). O mínimo por
tabela:

- usuário autorizado **consegue** a operação do caso de uso;
- usuário autenticado **sem vínculo** não vê nem altera;
- anônimo não vê nem altera.

Molde em [07-supabase-e-sql](07-supabase-e-sql.md#testes-do-banco).

### TST-04 · E2E de login e de acesso negado `[AUTO]`

Nas pastas de `caminhos.testesE2E` existem specs do Playwright marcadas com as tags `@login` e
`@acesso-negado`:

```ts
import { test, expect } from '@playwright/test'

test('entra com e-mail e senha válidos', { tag: '@login' }, async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(process.env.E2E_USER_EMAIL!)
  await page.getByLabel('Senha').fill(process.env.E2E_USER_PASSWORD!)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('navigation')).toBeVisible()
})

test('usuário sem vínculo não abre obra de outra organização', { tag: '@acesso-negado' }, async ({ page }) => {
  // storageState do usuário "outsider" configurado no projeto do Playwright
  await page.goto(`/obras/${process.env.E2E_OTHER_ORG_PROJECT_ID}`)
  await expect(page.getByText('Registro não encontrado')).toBeVisible()
})
```

Os E2E rodam contra Supabase local ou um projeto de teste isolado, nunca produção (TST-07).

### TST-05 · Nada de teste focado ou pulado `[AUTO]`

`.only`, `.skip`, `xit`, `xdescribe`, `fit` e `fdescribe` não chegam ao repositório. Teste que não
passa é consertado ou removido com justificativa no PR — nunca silenciado.

### TST-06 · Bug corrigido ganha teste `[REVISÃO]`

Correção de bug em regra de negócio, policy ou fluxo de acesso vem com o teste que reproduzia o
bug antes da correção.

### TST-07 · Teste não toca produção `[REVISÃO]`

Testes usam Supabase local (`supabase start`) ou um projeto de teste dedicado, com dados
sintéticos. Nenhum teste, script de seed ou agente de IA roda contra o banco de produção. Servidor
MCP do Supabase conectado a agente: só em projeto de desenvolvimento e em modo somente leitura.

## Qualidade de código

### TST-08 · TypeScript estrito `[AUTO]`

- `strict: true` no `tsconfig`.
- Sem `any` (`: any`, `as any`, `<any>`) — use `unknown` e refine.
- Sem `@ts-ignore` e sem `@ts-nocheck`. Quando um erro de tipo é esperado e justificado:
  `@ts-expect-error` com o motivo na mesma linha.

### TST-09 · Sem `console.log` no front e nas regras `[AUTO]`

No código do front e em `domain/`, nada de `console.log`, `console.debug` ou `console.info`. No
servidor, use o logger estruturado ([ARQ-10](01-arquitetura.md)).

### TST-10 · Convenções do repositório `[REVISÃO]`

Formatação e lint seguem a configuração do próprio repositório (nos projetos com o design system
por cópia, o front **não** usa Prettier). Não reformate arquivos que a tarefa não tocou.

## Definição de pronto

Uma tarefa só está pronta quando **tudo** abaixo é verdade:

- [ ] Gate sem violações (ou, em adequação, sem violação nova) — `node .quality/checks/gate.mjs`.
- [ ] Comandos de validação do projeto verdes (lint, typecheck, test, build).
- [ ] Testes essenciais da mudança escritos e passando (regra de negócio, policy, E2E quando a
      mudança toca login ou acesso).
- [ ] Tela nova ou alterada: arquétipo do [06-padroes-de-tela](06-padroes-de-tela.md) com todos
      os estados (carregando, vazio, vazio com filtro, erro, sem permissão).
- [ ] Migration: RLS, policies com papel, índices das FKs e das consultas, tipos regenerados, teste
      pgTAP.
- [ ] Consulta nova de listagem ou relatório: plano de execução anexado ao PR.
- [ ] Regra de negócio: nenhuma alterada sem pedido explícito; fichas atualizadas quando alteradas.
- [ ] Nada novo no navegador além de sessão e cache declarado.
- [ ] Relatório do gate na resposta final ou na descrição do PR.
