# 05 · Design system

> **Nenhuma tela existe sem design system vinculado.** O padrão da Group WS é o
> `@group-ws/ws-ui` (repositório `Group-WS/groupws-design-system`). O projeto não "segue o
> estilo" do DS: ele **usa** os tokens, os componentes e os templates do DS, e não cria os seus.
> É isso que faz duas telas com a mesma intenção terem as mesmas proporções, espaços e tamanhos
> em qualquer projeto.

## Vínculo

### DS-01 · Design system vinculado `[AUTO]`

O manifesto declara o DS em `designSystem`:

| Campo | Valor |
|---|---|
| `pacote` | `@group-ws/ws-ui` (padrão) |
| `vinculo` | `pacote` (instalado via npm, **recomendado**) ou `copia` (plantado pelo `create-app` do DS) |
| `pastasDoDesignSystem` | Obrigatório com `copia`: pastas copiadas do DS (`components/ui`, `components/tkws`, barrels, `styles`…) |
| `templatesDePagina` | Templates de página que a versão instalada do DS oferece |
| `fontes` | Famílias tipográficas do DS |
| `adr` | Obrigatório quando o DS **não** é o `@group-ws/ws-ui`: caminho do ADR que aprovou o outro DS |

O gate confere que o pacote está nas dependências (vínculo por pacote) ou que as pastas existem e
não estão vazias (vínculo por cópia). **Sem DS vinculado, o estado é SEM VÍNCULO** e nenhuma
tarefa de código começa.

#### Projeto sem design system

A primeira tarefa é vincular. São dois caminhos:

1. **Vincular o `@group-ws/ws-ui`** — o caminho padrão. Siga `docs/CONSUMIR-O-PACOTE.md` do
   repositório do DS (pacote) ou `npm run create-app` do DS (cópia).
2. **Criar e vincular outro DS** — só quando o produto exige identidade própria, com ADR aprovado
   pela liderança técnica. O novo DS nasce como repositório próprio, publicado como pacote e
   atendendo aos [requisitos mínimos](#requisitos-mínimos-de-um-design-system-vinculável). Recomenda-se
   partir de um fork do `@group-ws/ws-ui`, trocando tokens e marca, para herdar componentes,
   templates e guardrails.

Não existe terceiro caminho: "estilizar à mão por enquanto" é o que este gate impede.

### DS-02 · O DS não se edita dentro do projeto `[REVISÃO]`

Com vínculo por cópia, as pastas do DS são **espelho**: não se altera componente, token ou
template ali. Precisa de variante, prop ou correção? A mudança vai para o repositório do DS e
volta por sincronização. Fork local de componente do DS é dívida que regride o padrão para todos.

## Uso

As verificações `[AUTO]` abaixo valem para o **código do app** — o front do projeto menos as
pastas do DS.

### DS-03 · Cor só por token `[AUTO]`

Sem hex, `rgb()`, `hsl()` ou `oklch()` literais e sem a paleta padrão do Tailwind
(`bg-blue-500`, `text-gray-600`). Cor vem de token do DS (`bg-surface-1`, `text-soft`,
`var(--brand)`, variantes dos componentes).

### DS-04 · Tipografia do DS `[AUTO]`

Só as famílias de `designSystem.fontes` (no `@group-ws/ws-ui`: **Host Grotesk** e **JetBrains
Mono**). Nada de `Inter`, `Fraunces`, `Roboto` ou fonte importada pelo projeto. Tamanhos e pesos
vêm dos componentes e utilitários do DS — título de página é o do `PageShell`, não um `<h1>`
estilizado.

### DS-05 · Sem valor arbitrário e sem `style` inline `[AUTO]`

Classes com valor arbitrário (`p-[13px]`, `w-[437px]`, `text-[13px]`, `grid-cols-[240px_1fr]`) e
o atributo `style` não aparecem no código do app. Medida é decisão do DS: se o layout precisa de
uma medida que o DS não oferece, é lacuna ([DS-12](#ds-12--lacuna-do-ds-não-vira-componente-local-revisão)).

### DS-06 · Régua de espaçamento de 4 px `[AUTO]`

Espaçamentos e tamanhos em múltiplos de 4 px: sem classes fracionadas do Tailwind (`p-1.5`,
`gap-2.5`, `mt-0.5`, `h-3.5`).

### DS-07 · Sem elemento nativo quando há componente `[AUTO]`

No código do app, não se escreve `<button>`, `<input>`, `<select>`, `<textarea>`, `<table>`,
`<dialog>` nem `<h1>`. Use `Button`, `Input`/`CPFInput`/`CNPJInput`/`MoneyInput`/`NumberInput`/`DateField`, `Select`/
`SelectField`, `Textarea`, `EditorialTable`/`Table`, `Dialog`/`Sheet`, e o título do template.

### DS-08 · Sem contêiner montado à mão `[AUTO]`

Um `div` com borda + raio + espaçamento interno + fundo ou sombra é um card feito à mão. Use
`Card` (e as partes `CardHeader`, `CardContent`, `CardFooter`) ou o template da tela.

### DS-09 · Sem outra biblioteca de UI `[AUTO]`

Proibido importar no código do app: outras bibliotecas de componentes (MUI, Ant Design, Chakra,
Mantine, PrimeReact, React Bootstrap, Headless UI), primitivos Radix direto (`@radix-ui/*`: use o
componente do DS que os encapsula), outras bibliotecas de ícones (`react-icons`, Heroicons, Font
Awesome, Phosphor, Tabler) e outras bibliotecas de toast ou alerta (`react-toastify`,
`react-hot-toast`, `sweetalert2`). Ícones: `lucide-react`. Toast: `sonner`, pelo `<Toaster />` do
shell.

### DS-10 · Sem `alert`, `confirm` ou `prompt` nativos `[AUTO]`

Confirmação é `ConfirmDialog`; aviso que exige leitura é `MessageDialog`; retorno de ação é toast.

### DS-11 · Tema só por token `[AUTO]`

Claro e escuro são trocados pelo atributo `data-theme` no `<html>`, e todo token tem valor nos
dois temas. O código do app não usa a variante `dark:` do Tailwind nem pergunta qual é o tema para
escolher cor. A preferência de tema segue [NAV-02](04-dados-no-navegador.md): mora no banco.

### DS-12 · Lacuna do DS não vira componente local `[REVISÃO]`

Faltou componente, variante, template ou medida:

1. Procure no DS (showcase e `PromptCard` de cada componente, patterns em `src/pages/patterns/`).
2. Se existe algo próximo, **componha com os componentes do DS sem estilo próprio** e registre a
   lacuna no relatório do gate.
3. Se não dá para compor sem violar DS-03 a DS-08, **pare**: abra uma issue no repositório do DS
   descrevendo a necessidade e pergunte ao dev como seguir.

### DS-13 · Marca oficial `[AUTO]`

Com o `@group-ws/ws-ui`, a marca do produto é o componente `GroupWsLogo`, em uso no shell
(variante `full` no brand/sidebar, `mark` no trilho recolhido). O gate confere que a marca está em
uso; projeto sem marca por decisão declara `designSystem.exigirLogo: false`.

### DS-14 · Acessibilidade WCAG 2.2 AA `[REVISÃO]`

- Todo campo tem rótulo visível associado; obrigatoriedade indicada no rótulo.
- Foco visível em todo elemento interativo; ordem de tabulação segue a leitura; tudo funciona
  por teclado; `Esc` fecha overlays.
- Botão só com ícone tem `aria-label`; ícone decorativo tem `aria-hidden`.
- Estado nunca só por cor: badge de status tem texto; erro de campo tem mensagem.
- Contraste garantido pelos tokens — por isso cor fora de token é proibida.
- Alvo de toque e clique com pelo menos 24 × 24 px.
- Movimento respeita `prefers-reduced-motion` (os componentes do DS já respeitam).
- `<html lang="pt-BR">`.

### DS-15 · Proporções vêm do DS `[REVISÃO]`

Altura de campo, régua da toolbar, raio, espaçamento entre seções, largura de colunas de
formulário e margens de página são **decisões do DS**, embutidas nos componentes e templates. O
projeto não as redefine — nem com classes, nem com wrappers "só para ajustar". Duas telas com a
mesma intenção precisam ficar **idênticas** em estrutura, espaço e tamanho
([06-padroes-de-tela](06-padroes-de-tela.md)).

## Requisitos mínimos de um design system vinculável

Vale para o `@group-ws/ws-ui` e para qualquer DS aprovado por ADR.

| Área | Mínimo |
|---|---|
| Tokens | Cor semântica (superfícies, texto, marca, linhas, estados), tipografia, escala de espaço em 4 px, raios, sombras, motion — **nos dois temas** |
| Primitivos | Button, Input, inputs com máscara (CPF, CNPJ, CEP, moeda), NumberInput, DateField, Select, Checkbox, RadioGroup, Switch, Textarea, Label, Form (campo + mensagem), Card, Badge, Tabs, Dialog, Sheet/Drawer, Popover, Tooltip, DropdownMenu, Table, Pagination, Skeleton, Spinner, EmptyState, Alert, Banner, Breadcrumb, Avatar |
| Compostos | ConfirmDialog, MessageDialog, ActiveFilters, BulkActionBar, PaginationFooter, DetailHero, WizardSteps, NotificationBell |
| Templates | AppShell, AuthShell, PageShell, CrudPage, FormPage, FormDialog, DetailPage, SettingsPage, SystemFrame ([06-padroes-de-tela](06-padroes-de-tela.md)) |
| Distribuição | Pacote versionado (semver), compatível com o perfil do projeto (Vite e Next.js App Router) |
| Guardrail | Verificação automática própria das regras inquebráveis (no `@group-ws/ws-ui`: `check:ds`) |
| Documentação | Showcase navegável, com uso, props e anti-patterns de cada componente |

> **Estado do `@group-ws/ws-ui` (v1.2.0):** atende tokens, primitivos, compostos, guardrail e
> documentação. **Templates:** exporta `PageShell` e `SystemFrame`; `AppShell`, `AuthShell`,
> `CrudPage`, `FormPage`, `FormDialog`, `DetailPage` e `SettingsPage` estão na fila de promoção
> para o pacote. **Next.js:** o bundle ainda não declara `'use client'` ([NX-09](perfis/nextjs.md)).
> **Tema:** a store `useTheme` persiste só no `localStorage`, e precisa aceitar a preferência
> vinda do banco ([NAV-02](04-dados-no-navegador.md)). O acompanhamento está em
> `docs/PENDENCIAS-DO-DESIGN-SYSTEM.md` do repositório do padrão.
