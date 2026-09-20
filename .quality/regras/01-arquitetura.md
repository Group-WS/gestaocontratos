# 01 · Arquitetura

> A arquitetura existe para que cada coisa tenha **um lugar só** — e para que a IA saiba, sem
> adivinhar, onde colocar e onde **não** mexer. A estrutura de pastas concreta de cada stack
> está no perfil ([webapp-vite-hono](perfis/webapp-vite-hono.md) · [nextjs](perfis/nextjs.md)).

## As camadas

```
┌──────────────────────────────────────────────────────────────────────┐
│ INTERFACE     telas, componentes de feature, rotas HTTP, server actions│  muda com frequência
├──────────────────────────────────────────────────────────────────────┤
│ FLUXOS        casos de uso da funcionalidade: validar entrada →       │  muda quando o fluxo
│               autorizar → chamar regras → persistir → responder       │  da funcionalidade muda
├──────────────────────────────────────────────────────────────────────┤
│ REGRAS DE     funções puras com as políticas do negócio (domain/)     │  PROTEGIDA — só muda com
│ NEGÓCIO       — sem framework, sem banco, sem rede                    │  pedido explícito (NEG-05)
├──────────────────────────────────────────────────────────────────────┤
│ INFRA         Supabase (clients, queries), e-mail, storage, APIs      │  muda com a tecnologia
│               externas, logger                                        │
└──────────────────────────────────────────────────────────────────────┘
```

### ARQ-01 · Direção das dependências `[REVISÃO]`

- **Interface** depende de fluxos e do design system.
- **Fluxos** dependem de regras de negócio e de infra.
- **Regras de negócio não dependem de nada** além da linguagem e de tipos compartilhados
  ([NEG-01](02-regras-de-negocio.md), verificada automaticamente).
- Infra nunca importa interface.

Nada de "atalho" que pule camada: tela que consulta o banco direto, rota que calcula regra de
negócio inline, componente de UI que conhece tabela.

### ARQ-02 · Funcionalidades em fatias verticais `[REVISÃO]`

Cada funcionalidade mora numa pasta própria (`features/<funcionalidade>/`) com seus
componentes, hooks, chamadas e testes. Uma funcionalidade **não importa arquivos internos de
outra**: o que é compartilhado sobe para `lib/`, para `domain/` ou para o design system.

### ARQ-03 · Validação na fronteira com schema `[REVISÃO]`

Tudo que vem de fora — corpo, parâmetros e query de HTTP, formulário, webhook, arquivo
importado, variável de ambiente — passa por um schema Zod **no servidor**, mesmo que o front já
tenha validado. O schema do contrato é **um só**, compartilhado entre front e servidor.

- Validação **estrutural** (tipo, formato, obrigatoriedade, tamanho) → schema do contrato.
- Validação **de negócio** (ex.: "data de término só pode ser anterior ao início em obra do
  tipo reforma") → função em `domain/`, que o schema pode chamar num `refine`.

### ARQ-04 · Contrato num lugar só `[REVISÃO]`

Tipos do banco são **gerados** (`supabase gen types --lang typescript`) e nunca editados à mão.
Tipos de entrada e saída saem dos schemas. Mudou o contrato, mudou o schema — o `typecheck`
aponta os dois lados.

### ARQ-05 · Configuração validada na inicialização `[REVISÃO]`

Variáveis de ambiente são lidas **num único módulo** (`env.ts`), validadas com Zod no boot. O app
não sobe com configuração faltando. `.env.example` lista todas as variáveis, sem valores
([SEG-21](03-seguranca-e-acesso.md)).

### ARQ-06 · Erros esperados são valores; inesperados são exceções `[REVISÃO]`

- **Esperados** (validação, não encontrado, sem permissão, conflito de unicidade): retornados como
  resultado tipado — `{ ok: false, error: { code, message, fieldErrors? } }` — e tratados na
  interface com a mensagem padrão ([06-padroes-de-tela](06-padroes-de-tela.md#feedback-e-mensagens)).
- **Inesperados**: lançados, registrados no log com contexto e um identificador de correlação, e
  mostrados ao usuário como erro genérico com esse identificador.
- O usuário **nunca** vê mensagem técnica: texto do Postgres, stack, SQL, nome de tabela
  ([SEG-33](03-seguranca-e-acesso.md)).

Mapeamento mínimo de erros do Postgres/PostgREST:

| Código | Situação | Mensagem ao usuário (exemplo) |
|---|---|---|
| `23505` | unique_violation | "Já existe um cliente com este CNPJ." |
| `23503` | foreign_key_violation | "Não é possível excluir: existem obras vinculadas a este cliente." |
| `23514` | check_violation | Mensagem da regra de negócio correspondente |
| `42501` | insufficient_privilege / RLS | "Você não tem permissão para esta ação." |
| `PGRST116` | nenhuma linha no `.single()` | "Registro não encontrado." |
| `57014` | statement_timeout | "A consulta demorou demais. Refine os filtros e tente de novo." |

### ARQ-07 · Dependência nova é decisão `[REVISÃO]`

Antes de adicionar pacote:

1. O design system ou uma dependência existente já resolve? Então não adicione.
2. Há manutenção ativa, licença compatível, sem vulnerabilidade alta ou crítica em aberto?
3. Quanto pesa no bundle do navegador (quando é código de front)?
4. Não duplica propósito: **uma** biblioteca de datas, **uma** de requisição, **uma** de estado,
   **uma** de formulário, **uma** de ícones (a do DS).

Dependência nova entra com justificativa no PR — e, nos repositórios que usam ADR, com ADR.

### ARQ-08 · Código gerado e código do DS não se editam `[REVISÃO]`

`database.types.ts`, clientes gerados e a cópia do design system (quando o vínculo é por cópia)
não são editados no projeto. Mudança no DS vai para o repositório do DS
([DS-02](05-design-system.md)).

### ARQ-09 · Idioma `[REVISÃO]`

- Código, identificadores e nomes de arquivo: **inglês**.
- Textos de interface, documentação e fichas de regra de negócio: **português do Brasil**.
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`…), seguindo a convenção do repositório.

### ARQ-10 · Log estruturado e sem dado sensível `[REVISÃO]`

Logs de servidor são estruturados (JSON), com nível, identificador de correlação e contexto
técnico. **Nunca** registram senha, token, chave, cookie, CPF/CNPJ completo, e-mail completo ou
corpo de requisição com dado pessoal. `console.log` não é logger ([TST-09](09-testes-e-qualidade.md)).
