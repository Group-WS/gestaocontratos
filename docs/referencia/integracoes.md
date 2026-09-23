# Referência das integrações

Com o que o sistema fala fora dele, onde mora cada credencial e o que acontece quando o outro lado
falha. Situação do código em 23/09/2026. Rotas citadas: `docs/referencia/api.md`; tabelas:
`docs/referencia/banco.md`.

## Resumo

| Integração | Direção | Quem chama | Credencial | Onde fica a credencial |
|---|---|---|---|---|
| Monday.com | lê (lista de obras por squad) | servidor | `MONDAY_API_TOKEN` | variável de ambiente da Vercel; em dev, `monday-proxy/.env` |
| Sienge — API pública | lê (orçamento, insumos, solicitação) e **escreve** (solicitação de compra) | servidor | `SIENGE_BASE_URL`, `SIENGE_SUBDOMAIN`, `SIENGE_USERNAME`, `SIENGE_PASSWORD` | idem (as mesmas do `agendadefretesws`) |
| Sienge — relatórios e PDF | entra por arquivo (Excel/PDF) subido pela pessoa | navegador (Excel) e servidor (PDF) | nenhuma | — |
| Sienge — lista de obras | entra por SQL gerado de uma exportação | pessoa, no SQL Editor | nenhuma | — |
| Microsoft (Azure) | login | navegador → Supabase Auth → Azure | ID, segredo e Tenant URL do app do Azure | painel do Supabase |
| Supabase (banco, Auth, Storage) | tudo | servidor (dados) e navegador (sessão e arquivo por endereço assinado) | URL e chave pública (`VITE_SUPABASE_*` no front; `SUPABASE_URL`/`SUPABASE_ANON_KEY` no servidor) | `web/.env` e variáveis da Vercel |
| Google Maps | mapa do Início (navegador) e geocodificação (script) | navegador; script local | `VITE_GOOGLE_MAPS_API_KEY` (pública, restrita por domínio); `GOOGLE_MAPS_GEOCODING_KEY` (só no terminal de quem roda o script) | `web/.env`; variável de ambiente na hora |

Regra que vale para todas: o que começa com `VITE_` vai para o navegador de qualquer visitante —
nenhuma senha ou token entra aí (`docs/CONFIGURAR-AMBIENTE.md`, `web/.env.example`). O servidor usa
a chave **pública** do Supabase e age como o usuário logado; a chave `service_role` não é usada em
lugar nenhum do app.

---

## Monday.com

**Para quê.** A lista de obras de cada squad (barra lateral e "Vindas do Monday"). Cada squad é um
workspace do Monday e cada board dentro dele é uma obra ("2281 - TKWS"). O Monday só **sugere**
obras: a obra passa a existir no app quando alguém clica "Dar start" (`POST /api/obras`), e daí em
diante não depende mais do Monday (`supabase/schema.sql:6-15`).

**Como.**
- Uma rota só: `GET /api/monday/obras-execucao?workspaceId=` (`web/api/_lib/mondayApp.js:207`),
  que pede `boards(workspace_ids, limit: 200) { id name }` à API GraphQL
  (`https://api.monday.com/v2`, `API-Version: 2024-10`, `:154-178`), tira os boards "Subelementos
  de…" e separa código e nome.
- Só aceita os três workspaces dos squads (`WORKSPACES_DOS_SQUADS`, `:194`): Squad Sun
  `13339794`, Squad Moon `14451479`, Squad Comet `13339790` — os mesmos de `SQUADS` em
  `web/src/App.jsx:201-205`; o teste `api-autorizacao.test.cjs` confere que as duas listas batem.
- Cache em memória de 60 s por consulta (vale enquanto a instância da função estiver quente).
- O token é lido de `process.env.MONDAY_API_TOKEN` a cada chamada; sem ele, a rota responde a
  mensagem padrão de erro (500).
- As rotas de "descoberta" (`/boards`, `/columns`, `/obras`, `/workspaces`, modo `?full=1`) foram
  removidas: liam a conta inteira do Monday com o token do servidor (`:180-189`).

**`monday-proxy/`.** Não é mais um serviço à parte: `monday-proxy/server.js` só carrega o `.env`
e roda o mesmo `web/api/_lib/mondayApp.js` na porta 3001, para o Vite encaminhar `/api` em
desenvolvimento. O `monday-proxy/render.yaml` (Render, plano free, só `MONDAY_API_TOKEN`) e o
`monday-proxy/README.md` são da época em que ele era um servidor separado: o README ainda manda
usar rotas que não existem mais (`/api/monday/boards`, `/columns`, `/obras`) e fala em "revogar o
token colado no chat". Em produção, o backend é a função da Vercel (suposição: o serviço do Render
não está mais em uso — não há referência a ele no front).

**Falhas.** Monday fora do ar ou token inválido: a rota responde erro padrão com
`correlationId`, e a barra lateral fica sem as obras que só existem no Monday; as obras já
iniciadas continuam vindo do banco.

---

## Sienge

Há quatro caminhos diferentes, e só um deles é a API.

### 1. API pública — solicitação de compra (escreve no ERP)

Decisões: `docs/ADR-003-solicitacao-compra-sienge.md` (e `docs/ADR-002-eap-sienge.md` para a
apropriação).

**Cliente** — `web/api/_lib/sienge.js`, portado do `agendadefretesws`:
- Base `${SIENGE_BASE_URL}/${SIENGE_SUBDOMAIN}/public/api/v1` (padrão
  `https://api.sienge.com.br/ws/...`), autenticação Basic com `SIENGE_USERNAME`/`SIENGE_PASSWORD`
  (usuário **do tipo API** no Sienge).
- Timeout de 30 s; em 429, quatro novas tentativas com espera crescente (800 ms × tentativa) — a
  cota é compartilhada com o `agendadefretesws`.
- Erros viram `SIENGE_NOT_CONFIGURED` (503), `SIENGE_TIMEOUT` (504, com o aviso de conferir se a
  solicitação foi criada mesmo assim), `SIENGE_REDE` (502), `SIENGE_401` (credencial), `SIENGE_429`,
  sempre com `comoResolver`. Recusa de negócio não lança: volta `{ ok: false, erro }` com o
  `clientMessage` do Sienge, que sobe inteiro para a tela (`:83-93`).

**Endpoints do Sienge usados** (todos por `web/api/_lib/mondayApp.js`):

| Sienge | Para quê | Rota nossa |
|---|---|---|
| `GET /building-cost-estimations/{obra}/sheets?limit=50` | unidades construtivas (planilhas do orçamento) da obra — variam de obra para obra | `GET /api/sienge/obra/:buildingId/unidades` |
| `GET /building-cost-estimations/{obra}/resources?limit=200&offset=` | insumos do orçamento com detalhes e marcas (varredura inteira, cache de 30 min) | `GET /api/sienge/insumos/:buildingId` |
| `GET /building-cost-estimations/{obra}/sheets/{unidade}/items?limit=500` | referências de orçamento que existem na unidade — conferidas **antes** de criar o cabeçalho, porque solicitação vazia não pode ser apagada pela API (cache de 30 min) | dentro de `POST /api/sienge/solicitacao` |
| `GET /purchase-requests/{id}` | confere que o reenvio é da mesma obra; consulta se a solicitação existe e em que estado | `POST /api/sienge/solicitacao`, `GET /api/sienge/solicitacao/:id` |
| `POST /purchase-requests` | cria o cabeçalho (solicitante e criador `VALENTINA`, data de hoje em São Paulo) | `POST /api/sienge/solicitacao` |
| `POST /purchase-requests/{id}/items` | um item por chamada, em sequência — um item recusado não derruba os outros | `POST /api/sienge/solicitacao` |

A API do Sienge não devolve os itens de uma solicitação (`GET .../items` responde 405) nem tem
DELETE ou cancelamento: por isso as conferências antes de escrever.

**O rastro no nosso banco** — `sienge_solicitacao`, pelas rotas `/api/sienge-solicitacoes`
(`web/api/_lib/rotas/siengeBanco.js`) e pela lib `web/src/lib/siengeSolicitacoes.js`:

1. `abrirEnvio` (`:37`) grava o registro `enviando` **antes** do envio, com a chave de
   idempotência da tentativa (uuid, `siengeIdempotencia.js:34`) e a assinatura do conteúdo
   (`:20`). Chave repetida → 409 "Este envio já foi iniciado"; o envio não sai.
2. `POST /api/sienge/solicitacao` fala com o Sienge.
3. `fecharEnvio` (`:70`) grava a resposta e o status (`concluido`, `parcial`, `falhou`).
4. O que ficou em `enviando` (aba fechada, rede caindo na volta) aparece em
   `enviosPendentes` (`:79`); a tela pergunta ao Sienge (`GET /api/sienge/solicitacao/:id`) e
   `reconciliarEnvio` (`:98`) encerra o registro com o que o Sienge realmente tem.
5. `envioComMesmoConteudo` (`:85`) avisa quando o mesmo conjunto de itens já foi enviado.

**Quem pode.** Criar solicitação e abrir/fechar o registro exigem editar a obra
(`exigirEdicaoDeObra`); consultar exige ver a obra. O número da solicitação que vem do navegador é
conferido contra a obra antes de qualquer escrita.

### 2. PDF do Sienge (solicitação de compra ou pedido) — conferência

`POST /api/sienge/texto` (`web/api/_lib/mondayApp.js:577`) só **extrai o texto** do PDF (aceita o
arquivo cru ou em base64, porque a Vercel já corrompeu corpo binário); quem interpreta é o front,
`web/src/lib/siengePedido.js`, para conferir se o que a planilha diz que foi comprado chegou mesmo
no Sienge.

### 3. Relatórios em Excel (entram por arquivo)

| Relatório | Onde é lido | Para onde vai |
|---|---|---|
| Relatório de pedidos de compra (banco de preços, ~19 MB) | **no navegador** (`web/src/App.jsx`, módulo Banco de Preços; a Vercel não aceita o arquivo) | `insumo_preco`, em blocos de 500 (`web/src/lib/insumos.js:79`) |
| Cadastro de insumos ativos | idem | `insumo_sienge` (`web/src/lib/insumos.js:225`); códigos que saíram do cadastro são removidos |
| Relatório de orçamento (EAP do Sienge) | `web/src/lib/eapSienge.js` | `sienge_eap_versao`, `sienge_eap_item` e herança do mapa (`web/src/lib/eapApropriacao.js:61`) — cada importação é uma versão nova (ADR-002) |

O casamento de item da obra com insumo do Sienge (exato, parecido, não achou) é feito no navegador,
com a base carregada em memória (`web/src/lib/sienge.js`).

### 4. Lista de obras do Sienge (`sienge_obra`) e as coordenadas do mapa

- `supabase/sienge_obra.sql` é uma **exportação manual** do Sienge (todo centro de custo desde
  2018, com cidade e UF) virada em `insert ... on conflict`; atualizar é reexportar e rodar de novo.
  Serve só ao mapa e ao painel "Onde estão as obras" do Início, e ao endereço de obra que não tem
  outro. O app só marca `status_manual` (ativa/finalizada) — `PUT /api/sienge-obras/:codigo/status`.
- `web/scripts/geocodificar-obras.mjs` lê as obras do próprio `sienge_obra.sql` (sem acesso ao
  banco), pergunta ao Google Geocoding o endereço de cada uma (e, se não achar ou achar fora da UF,
  a cidade, marcando `geo_precisao = 'cidade'`) e escreve `supabase/sienge-obra-coordenadas-dados.sql`
  com um `UPDATE` por obra, para revisar e rodar depois de `supabase/sienge-obra-coordenadas.sql`.
  Roda com `GOOGLE_MAPS_GEOCODING_KEY=... node web/scripts/geocodificar-obras.mjs`; guarda as
  respostas em `web/scripts/.geocodificacao-cache.json` (fora do git) para retomar. A chave não é
  a do app (aquela é restrita por domínio) e não é gravada em arquivo.

---

## Login com a conta Microsoft (Azure)

Documentação de configuração: `docs/azure-login.md`. Resumo:

- O navegador chama `supabase.auth.signInWithOAuth({ provider: "azure", scopes: "email openid
  profile", redirectTo: <origem atual> })` (`web/src/AuthGate.jsx:198-212`). O Supabase conversa
  com o Azure; o ID do app, o segredo e o **Tenant URL** (app de um único diretório) ficam só no
  painel do Supabase.
- Na volta, erro do Azure vem na URL e vira instrução (`erroDaVolta`, `web/src/AuthGate.jsx:126-173`;
  teste `web/src/__testes__/azure-erro.test.mjs`).
- O servidor não fala com o Azure: ele confere o token do Supabase a cada pedido
  (`web/api/_lib/auth.js:51-77`).
- O segredo do Azure **expira** (anotar a data, `docs/azure-login.md`). Sem ele, ninguém entra: a
  tela de login hoje só tem o botão da Microsoft, embora o `docs/azure-login.md` diga que o login
  por e-mail e senha continua disponível.
- O corte "só `@groupws.com.br`" é, na prática, o app do Azure ser de um diretório só; a função
  `dominioPermitido` do front não é usada (ver `docs/funcionalidades/login-e-acessos.md`).

---

## Storage de arquivos (Supabase)

Dois baldes (`docs/referencia/banco.md`, seção Storage):

| Balde | Tipo | O que guarda | Como se sobe | Como se lê |
|---|---|---|---|---|
| `obra-arquivos` | privado, 50 MB por arquivo, tipos limitados | cadernos, contrato, assinatura do cliente, anexos avulsos, imagens dos ambientes da apresentação, PDF da apresentação | a API assina (`POST /api/arquivos/envio`, caminho `<obra>/<chave>/<carimbo>-<nome>` montado no servidor) e o navegador sobe direto pelo endereço assinado (`enviarAssinado`, `web/src/lib/storage.js`); imagem de ambiente sobe pela própria API (`POST /api/obras/:codigo/ambientes`, até 3 MB) | endereço assinado por 60 min (`POST /api/arquivos/link`, `/api/obras/:codigo/ambientes/links`) |
| `catalogo` | público (por link) | foto de produto, foto de perfil (`pessoas/<e-mail>/`), imagens antigas de ambiente (`ambientes/<obra>/`) | endereço assinado pela API (`/api/catalogo/foto/envio`, `/api/pessoas/foto/envio`) | URL pública montada no navegador (`urlPublica`, `web/src/lib/storage.js`) |

Por que o arquivo não passa pela API: a função da Vercel corta o corpo em 4,5 MB e o balde aceita
50 MB. Quem autoriza continua sendo a API (ela assina) e, por baixo, as policies de
`storage.objects` com o login da pessoa: ler é de quem vê a obra, gravar é de quem edita, e a pasta
`contrato` é só do Administrador e do Admin master. Trocar um arquivo sobe um caminho novo (com
carimbo) e apaga o antigo depois (`POST /api/arquivos/remover`), para não quebrar um download em
andamento. Erros do Storage viram frase em português dos dois lados (`erroDoStorage` no servidor,
`explicarStorage` no navegador).

---

## Riscos conhecidos

| Gravidade | Risco | Cenário | Onde |
|---|---|---|---|
| média | Login depende só do Azure: a tela não oferece outra forma de entrar. | O segredo do app no Azure expira ou o Azure cai: ninguém entra até alguém trocar o segredo no painel do Supabase. | `web/src/AuthGate.jsx:258-262`; `docs/azure-login.md` |
| média | Envio ao Sienge sem resposta deixa o registro em `enviando`; a garantia de não duplicar depende de a tela reconciliar antes de reenviar. | Timeout de 30 s com a solicitação criada do lado de lá. O servidor avisa ("confira antes… o pedido pode ter entrado"), e a tela oferece a conferência. | `web/api/_lib/sienge.js:125-132`; `web/src/lib/siengeSolicitacoes.js` |
| baixa | `monday-proxy/README.md` e `monday-proxy/render.yaml` descrevem um servidor separado e rotas que foram removidas. | Alguém segue o README para "descobrir IDs" e recebe 404; ou publica o proxy no Render sem as variáveis do Supabase e do Sienge, e ele recusa tudo (503). | `monday-proxy/README.md`, `monday-proxy/render.yaml` |
| baixa | Caches em memória (Monday 60 s; orçamento e insumos do Sienge 30 min) não são compartilhados entre instâncias da função. | Um detalhe de insumo cadastrado agora no Sienge pode levar até meia hora para aparecer; duas instâncias podem responder diferente no mesmo minuto. | `web/api/_lib/mondayApp.js:151`, `:783`, `:961` |
| baixa | A lista de obras do Sienge é estática. | Obra nova no Sienge não aparece no mapa até alguém reexportar, rodar o SQL e o script de coordenadas. | `supabase/sienge_obra.sql`, `web/scripts/geocodificar-obras.mjs` |
| baixa | Balde `catalogo` é público: foto de perfil e imagem antiga de ambiente abrem por link sem login. | Quem tiver o endereço (com carimbo de tempo, difícil de adivinhar) vê a foto. Decisão registrada em `web/src/lib/pessoas.js:425-437`; listar a pasta exige perfil. | `supabase/rls-reforco.sql:297-356` |
