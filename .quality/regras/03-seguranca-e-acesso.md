# 03 · Segurança e acesso

> Depois do login, o usuário acessa **só o que pode acessar** — e isso é garantido no servidor e
> no banco, não na tela. Esconder um botão é experiência; negar a requisição e filtrar a linha é
> segurança.

## Defesa em camadas

```
Requisição do usuário
   │
   ▼
1. Interface ─────── esconde menu/botão, redireciona para login ............ UX (não é segurança)
   │
   ▼
2. Servidor ──────── autentica (token verificado) + autoriza + valida ...... BARREIRA
   │                 (rota Hono · server action · route handler)
   ▼
3. Banco (RLS) ───── policy por operação, negar por padrão ................. ÚLTIMA LINHA
   │
   ▼
4. Testes ────────── pgTAP (policy nega) + E2E (acesso negado) ............. PROVA
```

Cada camada supõe que a anterior falhou. Um bug na camada 2 não pode vazar dado porque a
camada 3 nega; uma policy errada na camada 3 aparece na camada 4.

## Autenticação

### SEG-01 · Toda entrada de servidor exige usuário autenticado `[AUTO via VH-05, NX-05, NX-06]`

Toda rota de API, server action e route handler verifica o usuário antes de qualquer outra
coisa — exceto as declaradas públicas em `manifest.seguranca.rotasPublicas` (health check,
webhook assinado, página pública). A verificação concreta de cada stack está no perfil
([VH-05](perfis/webapp-vite-hono.md) · [NX-05](perfis/nextjs.md) · [NX-06](perfis/nextjs.md)).

### SEG-02 · O servidor verifica o token, nunca só lê `[AUTO]`

- Servidor valida a sessão com `supabase.auth.getClaims()` (verifica a assinatura do JWT) ou
  `supabase.auth.getUser()` (consulta o Auth).
- **Nunca** confiar em `getSession()` no servidor: ele lê o cookie ou o storage **sem verificar**.
- Nunca decodificar JWT "na mão" para decidir acesso.
- Operação sensível (trocar senha ou e-mail, ação financeira, ação administrativa) usa
  `getUser()`: o access token continua válido até expirar mesmo depois do logout, e `getUser()`
  consulta o estado atual da sessão.

### SEG-03 · Sessão e credenciais `[REVISÃO]`

- A sessão é gerenciada pela biblioteca oficial do Supabase para a stack (`@supabase/ssr` no
  Next.js, `supabase-js` no SPA). Sessão e credenciais **podem** ficar no navegador
  ([NAV-01](04-dados-no-navegador.md)).
- Logout encerra a sessão no Supabase (`signOut`) **e** limpa os dados locais
  ([NAV-06](04-dados-no-navegador.md)).
- `[RECOMENDADA]` Para "lembrar credenciais", prefira o gerenciador de senhas do navegador
  (`autocomplete="username"` e `autocomplete="current-password"`) a guardar senha, mesmo
  cifrada: a chave para decifrar precisa estar no mesmo navegador, então a cifra só protege
  contra leitura casual.

### SEG-04 · Configuração do Supabase Auth `[REVISÃO]`

Em todo projeto com usuários reais (conferido no go-live):

- confirmação de e-mail ligada; senha com mínimo de 8 caracteres; proteção contra senha vazada
  ligada quando o plano permitir;
- URLs de redirecionamento **sem curinga** em produção (`https://app.dominio.com.br/**` sim;
  `https://*.vercel.app/**` não);
- CAPTCHA (Turnstile ou hCaptcha) em cadastro e login públicos;
- expiração do JWT no padrão (1 h) ou menor para sistemas sensíveis (nunca abaixo de 5 min);
- MFA disponível para perfis administrativos `[RECOMENDADA]`;
- SMTP próprio configurado (o SMTP padrão do Supabase tem limite baixo e não serve para produção).

### SEG-05 · Redirecionamento só para caminho interno `[REVISÃO]`

Parâmetros como `next`, `redirectTo` e `returnUrl` só aceitam caminho relativo começando com
`/` e sem `//`. URL absoluta vinda de parâmetro é descartada (evita *open redirect* em fluxo de
login e recuperação de senha).

## Autorização

> **Modelo de autorização: PENDENTE.** A Group WS ainda não definiu o modelo padrão (papéis fixos,
> funções configuráveis, catálogo de funcionalidades, escopo por dono do registro). Até a decisão,
> valem as regras universais abaixo, que servem para qualquer modelo. A lista do que precisa ser
> decidido está em [Decisões pendentes](#decisões-pendentes-do-modelo-de-autorização).

### SEG-10 · Negar por padrão `[REVISÃO]`

Sem regra explícita que permita, o acesso é negado — na API e no banco. Tabela nova nasce com RLS
e **sem** policy permissiva; a policy entra junto com o caso de uso que precisa dela.

### SEG-11 · Autorização no servidor em toda leitura e escrita `[REVISÃO]`

Toda leitura e escrita confere se **este usuário** pode fazer **esta operação** **neste
registro**. Ocultar item de menu, desabilitar botão ou proteger rota no front é UX, nunca a
barreira.

### SEG-12 · RLS em toda tabela exposta `[AUTO via SQL-10]`

Ver [SQL-10](07-supabase-e-sql.md). O RLS é a última linha de defesa e vale mesmo quando a API
já filtra.

### SEG-13 · Dono e organização vêm do servidor `[REVISÃO]`

`user_id`, `organization_id` e campos equivalentes **nunca** vêm do corpo da requisição. O
servidor deriva do usuário autenticado; o banco confere com `with check` na policy.

### SEG-14 · Acesso por ID confere pertencimento `[REVISÃO]`

`GET /obras/:id`, `update … eq('id', id)` e afins só funcionam para registros que o usuário pode
ver (RLS mais filtro explícito). Um ID válido de outra organização devolve "não encontrado", não
"proibido": não confirme que o registro existe.

### SEG-15 · Cliente administrativo sob controle `[AUTO]`

O client com chave secreta (`sb_secret_…` ou a legada `service_role`) ignora o RLS. Ele:

- só existe em código de servidor, num módulo dedicado;
- só é usado depois de uma checagem de autorização explícita no próprio fluxo;
- cada uso carrega escape com motivo (`gate-allow SEG-15: job noturno de consolidação, sem usuário`).

### SEG-16 · `user_metadata` não decide acesso `[AUTO via SQL-13]`

`raw_user_meta_data` e `user_metadata` são editáveis pelo próprio usuário. Papel, organização e
permissão vêm de tabelas próprias (com RLS) ou de `app_metadata`. Ver [SQL-13](07-supabase-e-sql.md).

### Decisões pendentes do modelo de autorização

Quando o modelo for definido, esta seção vira regra. O que precisa ser decidido:

1. **Tenancy:** todo projeto é multi-organização (dados isolados por `organization_id`) ou há
   projetos de organização única?
2. **Granularidade:** papéis fixos (`admin`, `gestor`, `operador`) ou catálogo de funcionalidades
   (`crm.leads`) liberadas por funções configuráveis?
3. **Escopo por registro:** existe "vê só o que é seu" × "vê tudo"? Por funcionalidade?
4. **Onde fica a fonte da verdade:** tabelas no banco consultadas pelo RLS, claims no JWT (Custom
   Access Token Hook) ou os dois (JWT para UX, banco para a decisão)?
5. **Revogação:** retirar um acesso precisa valer na hora ou pode esperar a expiração do token?
6. **Administração:** quem concede acesso, por qual tela, com qual trilha de auditoria?

Referência interna de modelo em produção: `tkws-os/docs/20-PERMISSIONAMENTO.md` e
`tkws-os/docs/19-HARNESS-NOVA-TELA.md` (funcionalidades + funções + escopo Membro/Gestor).

## Segredos

### SEG-20 · Nenhuma chave secreta no front `[AUTO]`

Chave secreta do Supabase, service role, token de API de terceiro e segredo de webhook não
aparecem em código de front nem em variável pública (`VITE_*`, `NEXT_PUBLIC_*`). O front conhece
só a URL do projeto e a **publishable key** (`sb_publishable_…`).

### SEG-21 · Nenhum `.env` versionado `[AUTO]`

Arquivos `.env`, `.env.local`, `.env.production` etc. não são versionados. `.env.example` é
versionado, lista todas as variáveis e não tem valores.

### SEG-22 · Nenhum segredo literal no repositório `[AUTO]`

Nenhum arquivo versionado contém chave secreta do Supabase, JWT de service role, chave privada,
token do GitHub (`ghp_`, `github_pat_`), chave de API de produção ou senha. Segredo que chegou ao
histórico do git é considerado **vazado**: rotacione a chave, não basta apagar o arquivo.

### SEG-23 · Segredos de produção só na plataforma `[REVISÃO]`

Segredos de produção e de preview ficam nas variáveis de ambiente da Vercel marcadas como
**Sensitive** e nos secrets do GitHub Actions. Nunca em canal de chat, issue, README ou
comentário. Ambiente de preview nunca aponta para o banco de produção.

## Entrada e saída

### SEG-30 · Toda entrada validada no servidor `[REVISÃO]`

Ver [ARQ-03](01-arquitetura.md). Isso vale para parâmetro de rota, query string, corpo, cabeçalho
usado em decisão, arquivo enviado e payload de webhook.

### SEG-31 · Sem HTML não confiável `[AUTO]`

`dangerouslySetInnerHTML` é proibido. Conteúdo rico (Markdown) é renderizado pelo componente do
design system, que sanitiza.

### SEG-32 · Sem execução dinâmica de código `[AUTO]`

`eval(...)` e `new Function(...)` são proibidos.

### SEG-33 · Erro para o usuário sem detalhe técnico `[AUTO]`

Resposta de API, retorno de server action e tela de erro **não** repassam `error.message` do
banco ou de exceção. O detalhe vai para o log; o usuário recebe a mensagem padrão e um código
([ARQ-06](01-arquitetura.md)).

### SEG-34 · Upload seguro `[REVISÃO]`

Tipo e tamanho validados no servidor **e** nas configurações do bucket (`allowed_mime_types`,
`file_size_limit`). Buckets privados por padrão, com policy em `storage.objects`. Download por URL
assinada de expiração curta. Nome do arquivo gerado pelo servidor, nunca o nome original como
caminho.

### SEG-35 · Cabeçalhos de segurança `[REVISÃO]`

Toda resposta HTML leva `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restritiva e proteção
contra *framing* (`frame-ancestors 'none'` ou `X-Frame-Options: DENY`). `Content-Security-Policy`
é `[RECOMENDADA]` e obrigatória em sistemas com dado financeiro ou de saúde. Onde configurar: no
perfil.

### SEG-36 · CORS explícito `[AUTO]`

Origens permitidas vêm de configuração por ambiente. Nunca `*` com credenciais.

### SEG-37 · Limite de tentativas `[REVISÃO]`

Login, cadastro, recuperação de senha, envio de código e endpoints caros (exportação, relatório,
IA) têm limite por IP e por usuário. Na Vercel: regras de Firewall ou `@vercel/firewall`
(`checkRateLimit`).

## Dependências e plataforma

### SEG-40 · Dependências sem vulnerabilidade alta ou crítica `[REVISÃO]`

- Lockfile versionado; instalação no CI com `--frozen-lockfile`.
- `pnpm audit --prod --audit-level high` limpo no CI.
- Dependabot ou Renovate ligado para atualizações de segurança.
- Advisory **crítico** de Next.js, React, Supabase ou Hono: atualização em até **72 horas**.
  Histórico recente mostra por quê: `CVE-2025-29927` (bypass de middleware no Next.js),
  `CVE-2025-55182` / `CVE-2025-66478` ("React2Shell", execução remota em React Server
  Components) e `GHSA-2xp9-vwfh-vxw4` (execução remota via imagem AVIF no Next.js, corrigida no
  16.3.3).

### SEG-41 · Versões mínimas de framework `[AUTO]`

O gate reprova versões com vulnerabilidade crítica conhecida. A tabela mora em
`.quality/checks/versoes-minimas.json` e é atualizada a cada versão do padrão.

## Privacidade (LGPD)

### SEG-50 · Minimização `[REVISÃO]`

Coletar só o dado pessoal necessário para a finalidade. Dado pessoal sensível (saúde, biometria,
origem racial, religião, opinião política, vida sexual) exige decisão registrada antes de existir
no schema.

### SEG-51 · Dado pessoal fora de log e de URL `[REVISÃO]`

CPF, e-mail, telefone e endereço não vão para log sem máscara nem para query string de URL.

### SEG-52 · Direitos do titular `[REVISÃO]`

Todo projeto com dado pessoal sabe responder, com procedimento escrito: como exportar os dados de
uma pessoa, como corrigir e como excluir ou anonimizar — inclusive em backups e logs, dentro da
retenção definida.

### SEG-53 · Região dos dados `[RECOMENDADA]`

Projeto com dado de brasileiros usa Supabase em `sa-east-1` (São Paulo) e funções da Vercel em
`gru1`, na mesma região do banco — o que também reduz latência ([PERF-09](08-performance.md)).
