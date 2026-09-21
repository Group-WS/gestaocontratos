# Padrão de UI do Confere · migração para o `@group-ws/ws-ui`

> Fonte da verdade para quem migra uma tela. Complementa `.quality/regras/05-design-system.md`
> e `06-padroes-de-tela.md` (que valem integralmente). Aqui está **o mapa concreto** do que o
> app tinha para o que o DS oferece, e as decisões já tomadas para este projeto.

## 0. Regras que travam o gate (não negociáveis)

- Sem `<button>`, `<input>`, `<select>`, `<textarea>`, `<table>`, `<dialog>`, `<h1>` no código do app.
- Sem `style={{…}}` inline e sem classe com valor arbitrário (`p-[13px]`, `w-[437px]`).
- Sem hex, `rgb()`, `rgba()` fora de token. Cor = classe de token (`bg-surface-1`, `text-text-soft`,
  `border-line-2`, `text-danger`) ou `var(--token)` dentro de CSS.
- Espaçamento na régua de 4 px: `gap-1/2/3/4/6/8`, `p-2/3/4/6`, `mt-4`… Nunca `gap-2.5`, `p-1.5`.
- Sem `window.confirm` / `alert` / `prompt`. Confirmação = `confirmar()`; aviso que bloqueia =
  `mensagem()`; retorno de ação = `avisar.ok()` / `avisar.erro()` (tudo em `src/lib/confirmar.jsx`).
- Sem card feito à mão (div com borda + raio + padding + fundo) → `Card`.
- Ícones: `lucide-react`. Título de página: `PageShell`, nunca `<h1>` próprio.

## 1. Botões (TELA-52)

| Intenção | Componente | Classes legadas que substitui |
|---|---|---|
| Primária (uma por área) | `<Button>` (variant default) | `.btn-start .btn-import .btn-aprovar .btn-nova-solicitacao .btn-avulsa .btn-download .btn-criar .btn-doc .btn-lancar .btn-avancar .btn-salvar-data .btn-approve .btn-atalho .btn-liberar .btn-template .obs-salvar .troca-btn-ok .cat-primario .cat-novo .ap-primario .ap-add .auth-botao` |
| Secundária (cancelar, voltar, fechar) | `<Button variant="outline">` | `.btn-cancelar .btn-reabrir .btn-concluir .btn-voltar .btn-sel-tudo .btn-editar-linha .btn-reabrir-etapa .btn-associar-sel .btn-abrir-escopo .obs-cancelar .troca-btn .cat-btn-arq .ap-btn` |
| Destaque secundário com marca | `<Button variant="secondary">` | `.btn-compra .btn-apres` |
| Discreta / link de ação | `<Button variant="ghost" size="sm">` | `.troca-link .btn-sugestao .btn-juntar .btn-limpar-sel-claro .cat-limpar .clear-btn` |
| Destrutiva | `<Button variant="danger">` (ou `ghost` com `text-danger` para ações de linha) | `.btn-limpar-import .btn-cadastrar .btn-desaprovar .btn-linha-excluir-confirma .obs-apagar .cf-doc-x .btn-apagar-escopo .ad-icon.del` |
| Só ícone | `<Button variant="ghost" size="icon" aria-label="…">` | `.btn-lupa .btn-copiar .btn-info .icon-btn .ad-icon .btn-linha-*` |
| Compacta em tabela/linha | qualquer variante com `size="sm"` | tudo que era h30 |

- Rótulo: verbo no infinitivo + objeto ("Liberar compra", "Exportar planilha"). Nunca "OK", "Sim".
- Rodapé de formulário/dialog: `outline` à esquerda do primário, ambos à direita
  (`<DialogFooter>` ou `<div className="flex justify-end gap-2">`).
- Ícone dentro do botão: `<Icone size={16} />` + texto; só ícone exige `aria-label`.
- Botão que faz upload: `<Button asChild variant="outline"><label>…<input type="file" className="sr-only" /></label></Button>` (o `<input type="file">` é a única exceção tolerada de input nativo, sempre `sr-only` dentro do `label`).

## 2. Cabeçalho de página e navegação

- **Toda tela** (view de módulo e aba interna da obra) renderiza dentro de `<PageShell title description actions toolbar breadcrumbs>`. O `title` é o mesmo rótulo do menu. `actions` recebe a única ação primária da tela. `toolbar` recebe busca + filtros (linha única; use `flex flex-wrap gap-2`).
- Substitui: `.eyebrow + .title-row`, `.gc-bloco-head`, `.flat-panel-header/.flat-panel-title`, `.ger-topo`, `.ad-topo`, `.arq-topo-n`, `.secao-intro`, `.ap-topo`, `.cat-abas`.
- Abas: `<Tabs><TabsList variant="underline">` para navegação entre seções da obra (`.tabbar/.tab`, `.nav-grupo`), `variant="pill"` para segmentos/filtros (`.gc-chip`, `.gc-aba`, `.funil-no`, toggles `"on"`). Nunca `<button className="on">`.
- Chips de filtro (`.filter-chip`, `.cfiltro`, `.tipo-chip`): `<ToggleGroup type="single">` com `ToggleGroupItem`; filtros ativos → `ActiveFilters` + `FilterChip`.

## 3. Campos (TELA-22)

| Legado | DS |
|---|---|
| `<input className="form-input">`, inputs sem classe | `<Field><Label htmlFor>…</Label><Input id/></Field>` |
| `<select className="form-select / form-input / cmp-forn-sel / mae-sel">` | `Select` + `SelectTrigger/SelectValue/SelectContent/SelectItem` (padrão `Choice` do `features/dashboard/DashboardPage.jsx`) |
| `<textarea>` | `Textarea` |
| `<input type="checkbox">`, `.mo-check`, `.check`, `.fo-check` | `Checkbox` (+ `Label`) |
| `<input type="radio">` | `RadioGroup` / `RadioGroupItem` |
| `<input type="date">` | `DateField` (ou `Input type="date"` quando não há RHF) |
| valor monetário | `MoneyInput`; número `NumberInput` |
| busca | `<Input icon={<Search size={16}/>} placeholder="Buscar…" aria-label="Buscar">` |
| `SelectBusca` caseiro | `Command` (combobox) do DS |

Rótulo sempre acima e visível; placeholder não substitui rótulo. Ajuda: `FieldHint`. Erro: `state="error"` + `FieldHint state="error"`.

## 4. Tabelas, listas e estados

- Tabela = `Table/TableHeader/TableRow/TableHead/TableBody/TableCell` (ou `EditorialTable` quando é listagem de entidade com ações). Larguras por classe Tailwind (`w-24`, `w-40`), nunca `style={{width}}`. Envolver em `<div className="overflow-x-auto">` (responsividade).
- Cabeçalho de grupo colapsável (`.vend-head`, `.grp-head`, `.conf-stat`): `Collapsible` do DS com `aria-expanded` nativo, ou `Accordion`.
- Vazio (`.compras-empty`, `.vazio-box`, `.empty-note`, `vazioTitulo`): `EmptyState icon title description action` — textos do catálogo TELA-51 ("Nenhuma obra cadastrada ainda", "Nenhum resultado para os filtros aplicados").
- Carregando: `Skeleton` (nunca "Carregando…" solto). Erro de seção: `Alert tone="danger"` + botão "Tentar novamente". Aviso: `Alert tone="warning"`; sucesso pós-ação: toast.
- Badges (`.pill`, `.chip`, `.ad-tag`, `.ini-fase-pilula`, `.vend-count`, `.aloc`, `.tag-avulso`, `.cat-forn`): `Badge tone=` (`success|warning|alert|danger|brand|neutral|purple`). Badge nunca é botão: ação de linha é `Button size="sm"`.
- KPIs (`.ini-cel`, `.gc-total`, `.big-card-value`, `.conf-stat`): `KpiMini` (ou `KpiHero` para o número principal da tela).
- Modais caseiros (`.sobreposto-*`, `.cat-modal`, `.sim-painel`, `.detalhe-caixa`): `Dialog` + `DialogContent` + `DialogHeader/DialogTitle/DialogBody/DialogFooter`. Lateral/contextual: `Sheet`.
- Alertas inline (`.aviso-migracao`, `.import-erro`, `.import-ok`, `.import-bar`, `.aviso-pobre`, `.grupo-alerta`, `.assoc-resultado`, `.cat-erro/.cat-ok`, `.auth-erro`): `Alert` com o tom **semântico certo** (erro real = `danger`, nunca âmbar).
- Contêiner: `Card` (+ `CardHeader/CardTitle/CardDescription/CardContent`). Sem Card dentro de Card.

## 5. Tipografia e espaço

- Título de página: só o `PageShell`. Título de seção: `CardTitle` ou `<h2 className="text-base font-semibold">`. Rótulo mono uppercase: classe `label-mono` do DS. Texto secundário: `text-sm text-text-soft`; auxiliar: `text-xs text-text-mute`.
- Tamanhos permitidos: `text-xs` (12) · `text-sm` (14) · `text-base` (15/16) · `text-lg` · `text-2xl` (números de KPI). Nada de 9.5/10.5/11.5/12.5/13.5 px.
- Espaço entre seções: `space-y-6`; dentro de card: `space-y-4`; entre controles: `gap-2`. Margens de página são do `PageShell` — o app não define `.main { padding }`.
- Raio: só o dos componentes (não escrever `rounded-*` em div solta a não ser `rounded-lg` de agrupamento).

## 6. Responsividade (mobile-first)

- Grades: `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3` (nunca coluna fixa). KPIs: `grid-cols-2 lg:grid-cols-4`.
- Toolbars e barras de ação: `flex flex-wrap gap-2`; ações de cabeçalho empilham no mobile (`flex-col sm:flex-row`).
- Tabelas: `overflow-x-auto` no wrapper; colunas secundárias com `hidden md:table-cell`.
- Formulários: `grid gap-4 md:grid-cols-2`; campo largo `md:col-span-2`.
- Dialog: `size="full"` para conteúdo longo (fica tela cheia no mobile).
- Sidebar: escondida abaixo de `lg`, aberta por botão de menu (`Sheet` no mobile). Nada com largura fixa em px acima de 100% da viewport.
- Nenhum `width: NNNpx` inline; larguras por classe (`w-full max-w-3xl`).

## 7. Mensagens (TELA-51)

- Sucesso: `avisar.ok("Compra liberada.")`. Erro de ação: `avisar.erro("Não foi possível liberar a compra.", motivo)`.
- Validação que bloqueia (era `alert`): `await mensagem({ titulo: "Falta o fornecedor", mensagem: "Escolha um fornecedor antes de lançar." })`.
- Confirmação (era `window.confirm`): `if (!(await confirmar({ titulo: "Excluir item?", mensagem: "…não pode ser desfeito.", confirmar: "Excluir item" }))) return;` — `perigo: false` quando não é destrutivo.

## 8. Ao terminar uma tela

1. Nenhuma classe legada da tela continua referenciada → apagar as regras dela do `<style>`.
2. `npm test && npm run build` verdes na pasta `web/`.
3. A tela funciona em 375 px de largura sem barra horizontal na página (só a tabela rola).
