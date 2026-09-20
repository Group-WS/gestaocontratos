# 06 · Padrões de tela

> **Mesma intenção, mesma tela.** A listagem de clientes e a listagem de obras são a mesma tela
> com dados diferentes. O cadastro de fornecedor e o cadastro de contrato são o mesmo formulário
> com campos diferentes. Nenhuma tela pode ser diferente de outra que tem a mesma ideia de
> estrutura — nem no layout, nem nos componentes, nem no comportamento, nem nas proporções.

A fonte da verdade **visual** é o design system (componentes, templates e as páginas de pattern
do `@group-ws/ws-ui` em `src/pages/patterns/`). Este arquivo fixa **qual template usar, a
anatomia e o comportamento**. Quando este arquivo e o DS divergirem na aparência, o DS vence;
quando divergirem no comportamento, abra uma issue — não escolha sozinho.

## Arquétipos

Toda tela do produto é um destes arquétipos. Classifique a tela **antes** de escrevê-la.

| Intenção do usuário | Arquétipo | Template do DS | Pattern de referência no DS |
|---|---|---|---|
| Entrar, recuperar senha, aceitar convite | Autenticação | `AuthShell` | `Auth.tsx` |
| Encontrar e gerenciar registros de uma entidade | Listagem (CRUD) | `CrudPage` | `CrmListagem.tsx`, `ProjectList.tsx` |
| Criar ou editar com poucos campos | Formulário curto | `FormDialog` | `Overlays.tsx` |
| Criar ou editar com muitos campos ou seções | Formulário longo | `FormPage` | `FormSectioned.tsx`, `FormConditional.tsx`, `FormUpload.tsx` |
| Criar algo em etapas dependentes | Assistente | `FormPage` + `WizardSteps` | `NewProjectWizard.tsx` |
| Ver tudo sobre um registro e agir sobre ele | Detalhe | `DetailPage` | `ProjectDetail.tsx`, `CRMOpportunityDetail.tsx` |
| Ajustar configurações de um módulo ou conta | Configurações | `SettingsPage` | `Settings.tsx` |
| Acompanhar indicadores | Dashboard | `PageShell` + `KpiHero`/`KpiMini` + charts | `Dashboard.tsx` |
| Organizar por etapa (arrastar) | Quadro | `PageShell` + `Kanban` | `CRMOpportunitiesKanban.tsx` |
| Erro, 404, 403, manutenção, sem conexão | Página de sistema | `SystemFrame` | `SystemPages.tsx` |

### TELA-01 · Toda página usa um template do DS `[AUTO]`

Todo arquivo de página (`designSystem.arquivosDePagina`) alcança, direto ou pelos componentes que
importa, um template listado em `designSystem.templatesDePagina`.

**Enquanto um template não existir na versão instalada do DS**, a tela é composta **exatamente**
com a anatomia deste arquivo, usando só componentes do DS, sobre o `PageShell`. Quando o DS
publicar o template, a tela migra para ele (e o manifesto passa a listá-lo).

### TELA-02 · Nada de arquétipo novo `[REVISÃO]`

Não existe "listagem simples" e "listagem rica", nem "formulário do módulo financeiro". Se a tela
não cabe em nenhum arquétipo, é lacuna do DS ([DS-12](05-design-system.md)): pare e pergunte.

## Shells

### TELA-03 · Um `AppShell` para toda a área autenticada `[REVISÃO]`

- Sidebar recolhível com a marca (`GroupWsLogo`), header com busca global, notificações
  (`NotificationBell`) e menu do usuário, e a área de conteúdo onde o template da página entra.
- Toda página autenticada renderiza dentro do mesmo `AppShell`. Nenhuma página cria sidebar,
  header ou rodapé próprios.
- Um único `<Toaster />` do `sonner` e um único provedor de tooltip, montados no shell.

### TELA-04 · `AuthShell` fora da área autenticada `[REVISÃO]`

Login, cadastro, recuperação e redefinição de senha, aceite de convite e verificação de e-mail
usam o `AuthShell` (tela dividida do pattern `Auth.tsx`), com erros específicos inline e em
português — "E-mail ou senha incorretos", não "Invalid login credentials".

### TELA-05 · Navegação consistente `[REVISÃO]`

- Item de menu: ícone `lucide-react` + rótulo curto (substantivo no plural para listagens:
  "Clientes", "Obras").
- Breadcrumb no `PageShell` reflete a hierarquia real (Módulo › Entidade › Registro).
- Rótulo do menu, título da página e último item do breadcrumb usam o mesmo termo.
- Voltar do detalhe para a listagem preserva busca, filtros, ordenação e página
  ([TELA-15](#tela-15--estado-da-listagem-na-url-revisão)).

## Listagem (CRUD)

### TELA-10 · Anatomia fixa `[REVISÃO]`

De cima para baixo, **sempre**:

```
PageShell
├─ breadcrumb · título (plural) · descrição de 1 linha · ações (1 primária: "Novo cliente")
├─ toolbar (linha única, sticky) ─────────── TELA-11
├─ ActiveFilters (só com filtro ativo) ──── contagem · chips removíveis · "Limpar tudo"
├─ EditorialTable ───────────────────────── TELA-12
├─ PaginationFooter ─────────────────────── TELA-13
├─ BulkActionBar (só com seleção)
├─ ConfirmDialog (excluir/inativar)
└─ FormDialog ou navegação para FormPage (criar/editar) ── TELA-20
```

- **No máximo uma ação primária** no cabeçalho. Ações secundárias (importar, exportar,
  configurar) vão num `DropdownMenu` "Mais ações" ao lado.
- KPIs no topo (`KpiHero`, `KpiMini`) só quando a tela tem indicador que muda a decisão do usuário; quando
  existem, ficam entre o cabeçalho e a toolbar.

### TELA-11 · Toolbar em linha única `[REVISÃO]`

- Todos os controles numa **única linha**, na régua compacta do DS (altura e fonte da toolbar do
  template); em tela estreita, a linha rola na horizontal — **nunca quebra**.
- Ordem fixa: **busca** → **visões** (`SavedViewChips`: Todos · Ativos · Inativos ou o segmento
  da entidade) → **filtros** (chips de seleção) → **alternância de visualização** (só ícone, com
  `aria-label`).
- Busca com debounce de 300 ms, placeholder dizendo por onde busca ("Buscar por nome, CNPJ ou
  e-mail…"), mínimo de 2 caracteres para ir ao servidor.
- Filtros aplicam na hora (sem botão "Pesquisar").
- Mais de 4 filtros: os menos usados vão para um `Sheet` "Mais filtros", e os aplicados aparecem
  em `ActiveFilters`.

### TELA-12 · Tabela editorial `[REVISÃO]`

- Primeira coluna com `EditorialNameCell`: nome em destaque + rótulo secundário (código,
  documento). Não crie coluna "Código" separada.
- Status sempre como `Badge` **com texto**, variante semântica do DS.
- Colunas ricas: vínculos e regras resumidos em badges com tooltip, em vez de muitas colunas
  estreitas.
- Ações da linha: editar e excluir reveladas no hover; demais ações num menu da linha.
- **Clique na linha** abre o detalhe; se a entidade não tem detalhe, abre a edição.
- Seleção em massa só quando existe ao menos uma ação **aplicável a todos** os selecionados.
- Ordenação padrão explícita e visível no cabeçalho (mais recentes primeiro, ou alfabética).
- Nunca `<table>` ou lista feita à mão ([DS-07](05-design-system.md)).

### TELA-13 · Paginação `[REVISÃO]`

- `PaginationFooter`: "1–20 de 1.234", itens por página (20 · 50 · 100) e anterior/próxima.
- **Paginação no servidor** sempre que a entidade pode passar de 200 registros. Paginação no
  cliente só para cadastros pequenos e estáveis (lookups).
- Exportar respeita busca e filtros aplicados.

### TELA-14 · Estados da listagem `[REVISÃO]`

| Estado | O que mostrar |
|---|---|
| Carregando | Skeleton com a forma da tabela (cabeçalho + linhas) |
| Vazio, sem cadastro | `EmptyState`: "Nenhum cliente cadastrado ainda" + ação primária "Novo cliente" |
| Vazio, com busca ou filtro | `EmptyState`: "Nenhum resultado para os filtros aplicados" + "Limpar filtros" |
| Erro | `SystemFrame` ou `Alert` da seção: "Não conseguimos carregar os clientes" + "Tentar novamente" |
| Sem permissão | Mensagem padrão de acesso negado ([TELA-51](#tela-51--catálogo-de-mensagens-revisão)) |

"Sem cadastro" e "sem resultado" são estados **diferentes**, com textos e ações diferentes.

### TELA-15 · Estado da listagem na URL `[REVISÃO]`

Busca, filtros, visão, ordenação e página vivem na query string. Recarregar, compartilhar o link
ou voltar do detalhe mostra a mesma listagem. Filtro que é dado pessoal (CPF, e-mail) não vai para
a URL ([NAV-07](04-dados-no-navegador.md)).

### TELA-16 · Formatação de dados `[REVISÃO]`

Ver [TELA-80](#tela-80--formatação-pt-br-revisão). Números e valores alinhados à direita; valor
ausente como "—"; texto longo truncado com tooltip do conteúdo completo.

## Formulário

### TELA-20 · Qual formato usar `[REVISÃO]`

| Situação | Formato |
|---|---|
| Até 8 campos, uma seção, sem upload | `FormDialog` aberto a partir da listagem ou do detalhe |
| Mais de 8 campos, ou várias seções, ou upload, ou campos condicionais | `FormPage` em rota própria (`/clientes/novo`, `/clientes/:id/editar`) |
| 15 campos ou mais | `FormPage` com índice lateral de seções (pattern `FormSectioned`) |
| Etapas que dependem das respostas anteriores | `FormPage` + `WizardSteps`, com revisão final (pattern `FormReview`) |

Criar e editar a mesma entidade usam **o mesmo** formulário.

### TELA-21 · Anatomia do formulário `[REVISÃO]`

```
PageShell (FormPage) · título "Novo cliente" | "Editar · Construtora Alfa"
├─ Alert de erro geral (só quando há erro que não é de campo)
├─ Seção (Card): título + descrição curta
│   └─ grade de campos: 2 colunas no desktop, 1 no mobile; campo largo ocupa a linha
├─ Seção …
└─ Barra de ações fixa no rodapé: à direita, "Cancelar" (secundário) e "Salvar" (primário)
```

No `FormDialog`, a mesma ordem: campos em uma coluna, rodapé do dialog com "Cancelar" e a ação
primária à direita.

### TELA-22 · Campos `[REVISÃO]`

- Rótulo **acima** do campo, sempre visível (placeholder não substitui rótulo).
- Obrigatório marcado no rótulo (prop `required` do `Label`); não se marca "(opcional)".
- Texto de ajuda abaixo do campo quando o formato não é óbvio.
- Componente por tipo de dado:

| Dado | Componente |
|---|---|
| Texto curto · longo | `Input` · `Textarea` |
| Número · percentual · moeda | `NumberInput` · `MoneyInput` |
| Data · hora | `DateField` · `TimeField` |
| CPF · CNPJ (inclusive alfanumérico) · CEP | `CPFInput` · `CNPJInput` · `CEPInput` |
| Telefone | `PhoneInput` |
| Escolha única com até 5 opções | `RadioGroup` ou `CheckCards` |
| Escolha única com mais opções | `Select` / `SelectField` (com busca acima de 10 opções) |
| Escolha múltipla | Checkboxes ou `TagInput` |
| Liga/desliga com efeito imediato | `Switch` |
| Arquivo | `FileInput` |

### TELA-23 · Validação e erros `[REVISÃO]`

- O **mesmo schema** Zod valida no front e no servidor ([ARQ-03](01-arquitetura.md)).
- Valida o campo ao sair dele (blur) e o formulário inteiro ao enviar.
- Mensagem abaixo do campo (`FormMessage`), específica e acionável: "Informe um CNPJ válido",
  não "Campo inválido".
- Ao enviar com erro: foco no primeiro campo inválido.
- Erro devolvido pelo servidor para um campo (ex.: CNPJ duplicado) aparece **no campo**; erro
  geral aparece no `Alert` do topo.

### TELA-24 · Envio `[REVISÃO]`

- Botão primário mostra carregamento e fica desabilitado durante o envio (sem duplo envio).
- Sucesso: toast ("Cliente criado.") e navegação definida para o arquétipo — criação vai para o
  detalhe (ou volta à listagem, se não há detalhe); edição volta para onde o usuário estava.
- Falha: o formulário mantém tudo o que foi digitado.

### TELA-25 · Sair sem salvar `[REVISÃO]`

Com alterações não salvas, sair (cancelar, fechar o dialog, navegar) pede confirmação:
"Descartar alterações?" com "Continuar editando" e "Descartar".

## Detalhe, configurações e dashboard

### TELA-30 · Detalhe `[REVISÃO]`

```
PageShell (DetailPage)
├─ DetailHero: nome · status (Badge) · metadados-chave · ações (1 primária + menu)
├─ Tabs: "Visão geral" primeiro; demais abas por assunto (Obras, Contratos, Documentos, Histórico)
└─ Conteúdo da aba: seções em Card; listas internas seguem a anatomia da listagem, sem PageShell
```

Ações destrutivas ficam no menu, nunca como botão primário, e passam por `ConfirmDialog`.

### TELA-31 · Configurações `[REVISÃO]`

`SettingsPage`: índice das seções à esquerda, conteúdo à direita; cada seção é um `Card` com seu
próprio "Salvar". Alternância com efeito imediato (`Switch`) salva sozinha e confirma com toast.

### TELA-32 · Dashboard `[REVISÃO]`

Faixa de `KpiHero`/`KpiMini` no topo → gráficos do DS → tabelas de apoio. Filtro de período na toolbar do
`PageShell`, na mesma régua da listagem. Todo indicador tem rótulo, período e unidade visíveis.

## Contêineres e overlays

### TELA-40 · Contêiner é `Card` `[REVISÃO]`

Agrupar conteúdo é `Card`. **Não** se aninha `Card` dentro de `Card`: a subdivisão interna é
por espaço e `Separator`. Espaçamento entre seções e margens da página são do template
([DS-15](05-design-system.md)).

### TELA-41 · Qual overlay para cada situação `[REVISÃO]`

| Situação | Componente |
|---|---|
| Tarefa curta e focada (formulário curto, escolha) | `Dialog` / `FormDialog` |
| Conteúdo lateral sem perder o contexto (filtros avançados, detalhe rápido) | `Sheet` |
| Ação destrutiva ou irreversível | `ConfirmDialog` variante `danger` |
| Exclusão irreversível de entidade crítica ou em massa | `ConfirmDialog` com confirmação digitando o nome (`confirmarDigitando`) |
| Informação que exige leitura antes de seguir | `MessageDialog` |
| Opções contextuais pequenas | `Popover` / `DropdownMenu` |
| Dica de um elemento | `Tooltip` |

### TELA-42 · Um overlay por vez `[REVISÃO]`

Não se empilham dialogs. A única exceção é `ConfirmDialog` sobre um dialog aberto (ex.: descartar
alterações). `Esc` fecha; o foco volta para o elemento que abriu.

## Feedback e mensagens

### TELA-50 · Canal certo para cada retorno `[REVISÃO]`

| Situação | Canal |
|---|---|
| Ação concluída (salvou, excluiu, enviou) | Toast de sucesso |
| Ação falhou fora de um formulário | Toast de erro, com o que fazer |
| Erro de campo | Mensagem inline no campo |
| Erro geral de formulário | `Alert` no topo do formulário |
| Seção da tela não carregou | `Alert` na seção com "Tentar novamente" |
| Página inteira não carregou | `SystemFrame` |
| Aviso persistente do sistema (manutenção, plano, instabilidade) | `Banner` |
| Tarefa em segundo plano terminou | `NotificationBell` |
| Confirmação antes de agir | `ConfirmDialog` |

O toast não é usado para erro de validação nem para informação que o usuário precisa guardar.

### TELA-51 · Catálogo de mensagens `[REVISÃO]`

Tom: direto, em segunda pessoa implícita, sem culpar o usuário, sem jargão técnico, sem
exclamação.

| Situação | Molde | Exemplo |
|---|---|---|
| Sucesso | `<Entidade> <particípio>.` | "Cliente criado." · "3 obras excluídas." |
| Erro de ação | `Não foi possível <verbo> <o/a entidade>. <Motivo, se conhecido>. Tente novamente.` | "Não foi possível excluir o cliente. Existem obras vinculadas a ele." |
| Erro de carregamento | `Não conseguimos carregar <as entidades>` + "Tentar novamente" | "Não conseguimos carregar as obras" |
| Vazio, sem cadastro | `Nenhum<a> <entidade> cadastrad<o/a> ainda` + ação | "Nenhuma obra cadastrada ainda" |
| Vazio, com filtro | `Nenhum resultado para os filtros aplicados` + "Limpar filtros" | — |
| Confirmar exclusão | Título `Excluir <entidade>?` · texto `<Nome> será excluíd<o/a> permanentemente. Essa ação não pode ser desfeita.` · botão `Excluir <entidade>` | "Excluir cliente?" |
| Descartar alterações | Título `Descartar alterações?` · botões "Continuar editando" e "Descartar" | — |
| Sem permissão | `Você não tem acesso a esta área.` + `Fale com o administrador da sua organização.` | — |
| Erro inesperado | `Algo deu errado do nosso lado. Tente novamente em instantes.` + `Código: <id>` | — |

### TELA-52 · Botões `[REVISÃO]`

- Rótulo com verbo no infinitivo + objeto: "Salvar alterações", "Novo cliente", "Exportar
  planilha". Nunca "OK", "Sim", "Enviar" solto.
- **Um** botão primário por área (cabeçalho, rodapé de formulário, rodapé de dialog).
- Ação destrutiva usa a variante de perigo do DS e o nome da ação ("Excluir cliente").
- Ordem nos rodapés: secundário à esquerda do primário, ambos alinhados à direita.

## Estados e carregamento

### TELA-60 · Estados obrigatórios `[REVISÃO]`

Toda tela ou seção que carrega dados trata: **carregando**, **vazio**, **vazio com filtro**
(quando há filtro), **erro com nova tentativa** e **sem permissão**. Tela que só funciona no
"caminho feliz" não está pronta.

### TELA-61 · Carregamento sem salto `[REVISÃO]`

- Skeleton com a forma do conteúdo final (o layout não pula quando os dados chegam).
- Spinner só em ação pontual (botão enviando) ou área pequena.
- Atualização otimista só para ação reversível e de baixo risco (marcar como lida, favoritar).

### TELA-62 · Páginas de sistema `[REVISÃO]`

404, 403, 500, manutenção e sem conexão usam `SystemFrame`, com a mensagem do catálogo e uma ação
de saída ("Voltar ao início", "Tentar novamente").

## Responsividade e formatação

### TELA-70 · Responsividade pelos templates `[REVISÃO]`

Breakpoints e comportamento mobile vêm do DS. Em telas estreitas: listagem troca a tabela pela
visão em cards do template, formulário vai para uma coluna com ações fixas no rodapé, e a toolbar
rola na horizontal. Nenhuma tela esconde dado no mobile sem oferecer caminho para vê-lo.

### TELA-80 · Formatação pt-BR `[REVISÃO]`

Sempre pelos formatadores do DS (`formatCurrency`, `formatNumber`, `formatPercent`,
`calendar-date`) ou de um módulo único do projeto — nunca formatação improvisada na tela.

| Dado | Formato |
|---|---|
| Data | `17/09/2026` |
| Data e hora | `17/09/2026 14:32` (exibida em `America/Sao_Paulo`; gravada como `timestamptz`) |
| Moeda | `R$ 1.234,56` |
| Número | `1.234,5` |
| Percentual | `12,5%` |
| CPF · CNPJ | `123.456.789-09` · `12.ABC.345/01DE-35` (CNPJ alfanumérico vigente desde jul/2026) |
| Telefone | `(11) 91234-5678` |
| CEP | `01310-100` |
| Vazio | `—` |
