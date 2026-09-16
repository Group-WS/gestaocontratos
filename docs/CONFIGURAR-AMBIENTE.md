# Configurar o ambiente — passo a passo

Guia para rodar o Gestão de Contratos na sua máquina. Não precisa entender
o código: é copiar arquivo, colar valor e rodar dois comandos.

**Regra de ouro:** arquivo `.env` **nunca** vai para o Git. Os `.env.example`
são só modelos, sem senha nenhuma. Se você abrir um `.env` de verdade e ver
senhas, está certo — é ele que fica fora do Git.

---

## São DOIS arquivos, e isso importa

O projeto tem duas partes, e cada uma lê o seu próprio arquivo:

| Arquivo | Quem lê | O que vai dentro |
|---|---|---|
| `web/.env` | o site no navegador | só o Supabase, e só o que é público |
| `monday-proxy/.env` | o servidor (roda no seu PC, porta 3001) | tokens e senhas |

**Por que separado:** tudo que está em `web/.env` é entregue ao navegador
de quem abre o site. Senha ali é senha publicada. Por isso as credenciais
do Sienge e do Monday ficam **só** em `monday-proxy/.env`.

Regra prática: no `web/.env` só entra coisa que começa com `VITE_`.
Nenhuma senha começa com `VITE_`.

---

## Passo 1 — Criar os dois arquivos

No terminal, na pasta do projeto:

```bash
cp web/.env.example web/.env
cp monday-proxy/.env.example monday-proxy/.env
```

Agora abra os dois no editor. Você vai ver linhas assim:

```
SIENGE_USERNAME=<usuario-api-sienge>
```

Tudo que está entre `<` e `>` é para **trocar pelo valor de verdade**,
apagando os sinais junto:

```
SIENGE_USERNAME=api_gestao
```

Sem aspas, sem espaço antes ou depois do `=`.

---

## Passo 2 — Preencher `web/.env` (Supabase)

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxx
```

**Onde achar:** painel do Supabase → projeto do Gestão de Contratos →
*Project Settings* → *API*.

- `VITE_SUPABASE_URL` é o **Project URL**.
- `VITE_SUPABASE_ANON_KEY` é a chave **anon / publishable**.

⚠️ Existe outra chave na mesma tela, a **service_role**. Ela **não** entra
aqui, nem em lugar nenhum do frontend — dá acesso total ao banco.

---

## Passo 3 — Preencher `monday-proxy/.env` (Monday + Sienge)

```
MONDAY_API_TOKEN=cole_aqui_o_token
PORT=3001

SIENGE_BASE_URL=https://api.sienge.com.br
SIENGE_SUBDOMAIN=ws
SIENGE_USERNAME=<usuario-api-sienge>
SIENGE_PASSWORD=<senha-api-sienge>
```

**Monday:** peça o token a quem cuida da conta (é o mesmo usado hoje).

**Sienge:** peça as quatro ao responsável pela integração. Elas são as
**mesmas** do projeto `agendadefretesws` — se você tem aquele projeto
configurado, é copiar de lá.

Sobre cada uma:

- `SIENGE_BASE_URL` — deixe como está.
- `SIENGE_SUBDOMAIN` — é o pedaço da URL do Sienge da empresa. Se o
  endereço é `https://api.sienge.com.br/**ws**/public/api/v1`, o valor é `ws`.
- `SIENGE_USERNAME` / `SIENGE_PASSWORD` — é um usuário **do tipo API**,
  criado no Sienge. Não é o seu login pessoal.

---

## Passo 4 — Rodar

Precisa de **dois terminais abertos ao mesmo tempo**:

Terminal 1 (o servidor):
```bash
cd monday-proxy
npm install
npm start
```
Tem que aparecer `Proxy do Monday rodando em http://localhost:3001`.

Terminal 2 (o site):
```bash
cd web
npm install
npm run dev
```
Abra o endereço que ele mostrar (normalmente `http://localhost:5173`).

**Os dois precisam ficar rodando.** Se você fechar o terminal 1, o site
abre mas as integrações param de responder.

---

## Passo 5 — Conferir se funcionou

1. O site abriu e mostra a lista de obras → **Supabase ok**.
2. Abra uma obra → *Compras de Produtos* → funil **SG · Sienge** → selecione
   um item → o botão **Solicitar Compra no Sienge** aparece.

---

## Se der errado

| O que aparece | O que é | O que fazer |
|---|---|---|
| "O servidor do Confere não respondeu" | o terminal 1 não está rodando | volte ao Passo 4 |
| "As credenciais de acesso ao Sienge não estão configuradas" | falta algo no `monday-proxy/.env` | confira as 4 linhas `SIENGE_` |
| "O Sienge recusou as credenciais" | usuário ou senha errados | confirme com quem cuida da integração |
| Botão cinza com "habilite a edição" | normal | clique em **Habilitar edição** na obra |
| Botão cinza com "falta a EAP" | falta o SQL no banco | veja abaixo |
| "O servidor em execução não tem esta consulta" | o terminal 1 está com código antigo | pare com Ctrl+C e rode `npm start` de novo |

**Sempre que der mensagem estranha:** a primeira coisa a tentar é parar o
terminal 1 (Ctrl+C) e rodar `npm start` de novo. O servidor **não**
recarrega sozinho quando o código muda — diferente do site, que recarrega.

---

## Uma vez por banco: rodar os SQLs

Se o módulo **EAP Sienge** aparecer vazio, é porque o banco ainda não tem
as tabelas. No Supabase → *SQL Editor* → cole e rode, nesta ordem:

1. `supabase/sienge_eap.sql`
2. `supabase/sienge_eap_seed.sql`
3. `supabase/sienge_solicitacao.sql`

Pode rodar de novo sem medo — são feitos para isso.

Se depois reclamar de "coluna não encontrada", rode também:

```sql
notify pgrst, 'reload schema';
```

---

## O que nunca fazer

- Commitar um arquivo `.env`. Se acontecer, avise — a senha precisa ser trocada.
- Colar senha no `web/.env` ou criar variável `VITE_SIENGE_...`. Isso publica
  a senha para qualquer visitante do site.
- Mandar senha por chat ou e-mail.
