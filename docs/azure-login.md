# Login com a conta Microsoft (Azure)

## O que roda onde

O ID e o segredo do Azure vivem **só no painel do Supabase**. Nada disso
entra no código, no `.env` do frontend ou no chat: o bundle do site é
baixável por qualquer um.

O código só manda o navegador pro fluxo (`web/src/AuthGate.jsx`).

## Configuração, na ordem

### 1. No Azure — App registrations → o app

- **Overview** → anote o **Application (client) ID** e o **Directory (tenant) ID**
- **Authentication → Redirect URIs** → adicionar, como *Web*:
  `https://SEU-PROJETO.supabase.co/auth/v1/callback`
- **Certificates & secrets** → *New client secret* → copiar o **Value**
  (não o Secret ID). O Value só aparece uma vez, e **expira** —
  anote a data.

### 2. No Supabase — Authentication → Sign In / Providers → Azure

| Campo | Valor |
|---|---|
| Azure Client ID | o Application (client) ID |
| Azure Secret | o **Value** do client secret |
| **Azure Tenant URL** | `https://login.microsoftonline.com/SEU-TENANT-ID` |

O **Azure Tenant URL** é o campo que mais gente esquece, e é ele que
causa o erro mais comum (ver abaixo).

### 3. Ainda no Supabase — Authentication → URL Configuration

- **Site URL**: `https://gestaocontratos-smoky.vercel.app`
- **Redirect URLs**: a mesma, mais `http://localhost:5173` pra quem
  desenvolve

## Erros e o que cada um quer dizer

A tela de login lê o erro que o Azure devolve na URL e mostra a
instrução em português (`erroDaVolta`, testada em
`__testes__/azure-erro.test.mjs`). A tabela abaixo é a referência.

| Código | O que é | Conserto |
|---|---|---|
| **AADSTS50194** | O app é de um tenant só, mas o Supabase chamou `/common` | Preencher o **Azure Tenant URL** no Supabase (passo 2) |
| **AADSTS50011** | O endereço de retorno não bate | Conferir o Redirect URI no Azure (passo 1) |
| **AADSTS7000215** | Segredo recusado | Gerar outro secret e colar o **Value** |
| **access_denied** | Recusa no login | Cancelamento, ou falta consentimento do admin do diretório |

## Por que single-tenant, e não multi-tenant

O erro 50194 tem dois consertos possíveis: preencher o Tenant URL, ou
marcar o app como multi-tenant no Azure. **Preencher o Tenant URL é o
certo aqui.** Single-tenant significa que só o diretório da Group WS
consegue entrar — é a mesma trava que `dominioPermitido` faz no app,
mas um nível antes, na Microsoft. Marcar multi-tenant abriria a porta
pra qualquer conta Microsoft do mundo bater nela.

## Se o Azure cair

O login por e-mail e senha continua existindo, embaixo da linha, de
propósito: se o Azure estiver fora ou a conta de alguém ainda não
estiver no diretório, ninguém fica trancado do lado de fora do próprio
sistema.
