# Login e acessos

**Módulo:** transversal (entrada no app) e Equipe e acessos · **Arquétipos de tela:** autenticação (login), página de sistema (sala de espera), listagem com formulário (Equipe), detalhe (Equipe da obra, no Dashboard) · **Onde fica:** tela de login antes de tudo; menu → "Equipe e acessos" (id `equipe`, endereço `/equipe`); obra → Dashboard → cartão "Equipe da obra"; avatar no topo → foto de perfil

Decisões de origem: `docs/ADR-001-perfis-de-acesso.md` (perfis fechados, sala de espera, trava no
banco) e `docs/SPEC-acessos.md` (o comportamento em detalhe). Configuração do Azure:
`docs/azure-login.md`. Referência técnica das rotas e tabelas citadas aqui:
`docs/referencia/api.md` e `docs/referencia/banco.md`.

## Objetivo

Deixar entrar só quem é do time e mostrar a cada pessoa exatamente o que o perfil dela permite:
quais módulos, quais obras, e se ela pode alterar alguma coisa. Quem entra pela primeira vez não vê
nada da empresa até um responsável liberar. A tela de Equipe responde "quem vê o quê" numa lista.

## Quem usa

Todo mundo passa pelo login. Os perfis (um por pessoa — [RN-003](../regras-de-negocio/RN-003-perfil-unico.md)), e o que
cada um pode, conferido em três camadas:

| Perfil (id) | Módulos | Obras | Altera obra? | Equipe e acessos |
|---|---|---|---|---|
| Admin master (`master`) | todos | todas | sim | **sim** — só ele |
| Administrador (`admin`) | todos menos Equipe | todas | sim, inclusive contrato e compradores | não (só enquanto não houver master ativo, na tela) |
| Geral (`geral`) | todos menos Equipe | todas | sim | não |
| GC (`gc`) | todos menos Equipe | as que responde + as sem GC | sim, nas dele | não |
| Taylor Made (`taylor`) | todos menos Equipe | as que responde + as sem GC | **não** | não |
| Mehoo (`mehoo`) | só o painel Mehoo | todas, dentro do painel | não | não |
| Canal de compra (`canal`) | só o Painel por canal, preso ao canal da ficha | todas, dentro do painel (na tela) | não | não |
| sem perfil (pendente) | nenhum — sala de espera | nenhuma | não | não |
| desativado (`ativo = false`) | nenhum — "acesso suspenso" | nenhuma | não | não |

Onde cada coisa é conferida:

- **Tela** — `web/src/lib/pessoas.js`: `PERFIS` (`:214-264`), `temAcesso` (`:273`), `podeVerModulo`
  (`:285-290`), `podeEditar` (usado no App como `perfilEdita`, `:295`), `podeGerenciarPessoas`
  (`:301-306`), `ehAdministrador` (`:308`), `podeAbrirObras` (`:310`), `obrasPermitidas`
  (`:321-339`). Aplicadas em `web/src/App.jsx:21604-21674`.
- **Servidor** — `web/api/_lib/auth.js`: `exigirLogin` (`:51-77`), `exigirMembro` (`:127-130`),
  `exigirPerfilDeEdicao` (`:133-137`), `podeAcessarObra`/`exigirObra` (`:150-188`, `:210`),
  `podeEditarObra`/`exigirEdicaoDeObra` (`:195-199`, `:212`). Listas de perfis em `:86-90`.
- **Banco (RLS)** — `public.meu_perfil()`, `sou_admin()`, `sou_master()`, `admin_do_time()` e
  `minhas_obras()` (versão vigente em `supabase/rls-reforco.sql:65-117`), usadas pelas policies de
  cada tabela (`supabase/rls-perfis.sql`, `rls-perfis-complemento.sql`, `rls-reforco.sql`).

O servidor e o banco **não conhecem** o perfil Canal de compra, e o servidor não confere quem
gerencia a Equipe — ver Riscos.

## Fluxo

### Entrar

1. A pessoa abre o site. `AuthGate` (`web/src/AuthGate.jsx:52-112`) procura a sessão guardada e
   pergunta ao Supabase se ela ainda vale (`getUser`). Sessão com token podre (relógio adiantado,
   token expirado) é apagada e a tela de login aparece com o aviso "Sua sessão anterior estava
   inválida e foi limpa" (`:68-80`, `:244-251`).
2. Sem sessão, aparece a tela de login com um botão só: **Continuar com Microsoft**
   (`:198-212`, `:258-262`). O navegador vai para o Azure pelo Supabase (`signInWithOAuth`,
   provedor `azure`, escopos `email openid profile`) e volta para a própria origem. ID e segredo do
   Azure ficam no painel do Supabase, não no código (`docs/azure-login.md`).
3. Se o Azure recusar, ele volta com o erro na URL; `erroDaVolta` (`:126-173`) transforma os
   códigos conhecidos (AADSTS50194, 90002, 50011, 7000215, access_denied) em instrução e mostra os
   demais só com o código, sem o texto que veio na URL.
4. Com sessão válida, o App carrega a equipe (`web/src/App.jsx:21574-21596`):
   1. `GET /api/pessoas/banco-disponivel` — a coluna `perfil` existe? Se não, liga o modo
      **migração pendente** (ver Estados).
   2. `POST /api/pessoas/entrada` — garante a linha da pessoa em `pessoa`. Se não existir, nasce
      com perfil vazio, `entrou_em` agora e o nome tirado do e-mail
      ([RN-005](../regras-de-negocio/RN-005-primeiro-login-fica-pendente.md)). E-mail e nome saem do login no servidor, nunca do corpo.
   3. `GET /api/pessoas` — a lista que a pessoa pode ler (a própria linha; o Administrador e o
      Admin master leem todas).
5. `eu` = a linha da pessoa logada (`web/src/App.jsx:21604-21616`). Sem perfil, ou desativada, o
   app para na **sala de espera** (`:23797-23800`) e não monta menu, barra nem dado nenhum
   ([RN-006](../regras-de-negocio/RN-006-sem-perfil-nao-ve-nada.md), [RN-007](../regras-de-negocio/RN-007-pessoa-inativa-perde-acesso.md)).
6. Com perfil, o menu mostra só os módulos permitidos (`modulosVisiveis`, `:21635-21637`) e a
   barra lateral só as obras permitidas (`obrasAtivas`, `:21671-21674`,
   [RN-010](../regras-de-negocio/RN-010-quem-ve-qual-obra.md)). Se o módulo aberto não é permitido (por endereço salvo ou porque o
   perfil mudou), a tela volta para o primeiro permitido (`:21642-21645`). Mehoo e Canal de compra
   não têm lista de obras e caem direto no painel deles ([RN-012](../regras-de-negocio/RN-012-perfis-de-painel-so-consultam.md)).
7. Enquanto o app está aberto e visível, a pessoa marca o próprio último acesso a cada 2 minutos
   (`POST /api/acessos/registrar`, `:21651-21659`).

### Liberar quem está esperando (Admin master)

1. O Admin master vê a contagem de pendentes no menu (badge de "Equipe e acessos") e uma linha
   "Liberar acesso para N pessoas" em *Pedindo atenção*, no Início (`web/src/App.jsx:19156`).
2. Em **Equipe e acessos** (`EquipeView`, `web/src/App.jsx:19311`), o grupo **Aguardando
   liberação** vem primeiro; os demais são agrupados por cargo. A lista se recarrega ao entrar e a
   cada minuto (`:21662-21669`), com "online agora" para quem marcou acesso nos últimos 3 minutos
   (`web/src/lib/pessoas.js:392-411`).
3. Botão **acesso** na linha da pessoa abre `AcessoDaPessoa` (`web/src/App.jsx:19179`): escolhe um
   perfil (ou "Sem acesso"). Se for **Canal de compra**, escolhe qual canal. Se for **GC**, marca as
   obras em que ela é o GC — isto grava o campo `gc` de cada obra, o mesmo do Dashboard, e tira a
   obra de quem era o GC antes.
4. **Salvar acesso** → `PUT /api/pessoas` com o perfil (e `canal`). O servidor carimba
   `liberado_em` e `liberado_por` (e-mail de quem está logado) quando há perfil
   ([RN-016](../regras-de-negocio/RN-016-registro-em-nome-de-quem-esta-logado.md)). Para GC, em seguida, um
   `PATCH /api/obras/:codigo/papel` por obra que mudou (`web/src/App.jsx:21694-21707`).
5. A pessoa liberada clica **Já liberaram, recarregar** na sala de espera e o app abre com o
   perfil novo. Mudança de perfil de quem já está usando vale no próximo carregamento da tela; no
   servidor e no banco vale no pedido seguinte.

### Manter a equipe (Admin master)

- **Adicionar/editar**: e-mail (chave, não muda na edição), nome (se vazio, sai do e-mail) e cargo
  (sugestões mais os cargos já usados) → `PUT /api/pessoas`. Só os campos que vieram são gravados;
  `criado_por` sai do login.
- **Desativar/reativar** → `PUT /api/pessoas` com `ativo`. Quem sai da empresa é desativado, não
  apagado.
- **Excluir** → confirmação → `DELETE /api/pessoas/:email`. A tela recusa se a pessoa for GC de
  alguma obra.
- A tela não deixa tirar o perfil, desativar nem excluir **o último** que cuida da Equipe
  ([RN-009](../regras-de-negocio/RN-009-sempre-um-gestor-da-equipe.md)) — só a tela confere isso.

### Responsáveis da obra (quem edita a obra)

No Dashboard da obra, cartão **Equipe da obra** (`web/src/App.jsx:1468-1476`): GC responsável,
Taylor Made e Executivo, escolhidos da lista da equipe e guardados pelo e-mail
([RN-013](../regras-de-negocio/RN-013-responsaveis-da-obra.md)). Editável com a edição da obra habilitada. Cada troca é um
`PATCH /api/obras/:codigo/papel`. Responder por qualquer dos três papéis faz a obra aparecer para
GC e Taylor Made ([RN-010](../regras-de-negocio/RN-010-quem-ve-qual-obra.md)). Obra sem GC aparece para todos os GCs ("sem GC — esta
obra aparece para todo mundo").

### Foto de perfil (cada pessoa, a sua)

Avatar no topo → `MenuPerfil` (`web/src/App.jsx:10004`) → escolhe a imagem → recorta
(`RecortadorFoto`, `:743`) → o navegador reduz para 256×256 JPEG (`web/src/lib/pessoas.js:452-490`)
→ `POST /api/pessoas/foto/envio` assina a subida em `catalogo/pessoas/<e-mail>/<carimbo>.jpg` → o
navegador sobe direto no Storage → `PUT /api/pessoas/foto` grava o caminho na própria linha pela
função `definir_foto` (`web/src/App.jsx:21928-21934`). "Remover" grava vazio e volta às iniciais.

### Sair

**Sair** (`web/src/App.jsx:21940-21964`): tenta gravar o que falta da obra (até 8 s); se não der,
pergunta "Descartar alterações?". Depois encerra a sessão local, limpa o que o app guardou no
navegador e as preferências em memória, e recarrega.

## Telas

| Tela / bloco | Arquétipo | Rota ou aba | Componente |
|---|---|---|---|
| Login | autenticação | qualquer endereço sem sessão | `LoginScreen` em `web/src/AuthGate.jsx:175` |
| Sala de espera / acesso suspenso | página de sistema | qualquer endereço, sem perfil ou inativo | `SalaDeEspera` em `web/src/App.jsx:18850` |
| Equipe e acessos | listagem + formulário | módulo `equipe`, `/equipe` | `EquipeView` em `web/src/App.jsx:19311`, montada em `:25604` |
| Acesso de uma pessoa | formulário (dentro da linha) | idem | `AcessoDaPessoa` em `web/src/App.jsx:19179` |
| Resumo do acesso na linha | — | idem | `resumoAcesso` em `web/src/App.jsx:19553` |
| Equipe da obra | detalhe (cartão) | obra → Dashboard | `DashboardObra`, `web/src/App.jsx:1458-1478` |
| Menu do avatar e foto | menu + recorte | topo | `MenuPerfil` (`:10004`), `RecortadorFoto` (`:743`) |

## Estados e mensagens

| Situação | O que a pessoa vê | Onde |
|---|---|---|
| Verificando a sessão | "Carregando…" | `web/src/AuthGate.jsx:105-107` |
| Publicado sem as variáveis do Supabase | "Este ambiente está sem configuração de acesso…" — ninguém entra | `web/src/AuthGate.jsx:95-102`, `web/src/lib/supabase.js` |
| Sessão guardada inválida | login com aviso "Sua sessão anterior estava inválida e foi limpa…" | `AuthGate.jsx:244-251` |
| Erro do Azure na volta | instrução em português ou "Não conseguimos concluir a entrada pela Microsoft… (código AADSTSxxxx)" | `AuthGate.jsx:126-173` |
| Provedor Azure desligado no Supabase | "O login da Microsoft ainda não foi ligado no Supabase." | `AuthGate.jsx:205-210` |
| Sem perfil | "Seu acesso está em análise" + "Você entrou com <e-mail>…" + **Já liberaram, recarregar** e **Sair** | `SalaDeEspera` |
| Desativado | "Seu acesso está suspenso" + "Fale com a coordenação para reativar." + **Sair** | `SalaDeEspera` |
| Carregando a equipe | esqueleto na área de conteúdo; a sala de espera só decide depois de carregar | `web/src/App.jsx:25566` e `:23797` |
| Falha ao carregar a equipe | "Não consegui carregar a equipe: …" — e, sem a própria linha, a pessoa cai na sala de espera | `web/src/App.jsx:21592` |
| Migração pendente (coluna `perfil` não existe) | faixa de aviso; **todo o controle da tela fica desligado** (todos os módulos, todas as obras, botões de administrador); na Equipe, "A parte de perfis ainda não está ligada. Falta rodar supabase/perfis.sql…" e o botão **acesso** some | `web/src/App.jsx:21622-21674`, `:19400-19409` |
| Sem `ultimo-acesso.sql` | "Último acesso e 'online agora' ainda não estão ligados…" | `web/src/App.jsx:19411-19420` |
| Sem `admin-master.sql` e perfil master escolhido | "O banco ainda não conhece o perfil Admin master: falta rodar supabase/admin-master.sql…" (422) | `web/api/_lib/rotas/pessoas.js:240-242` |
| Sem `perfis.sql` ao dar perfil | "Falta rodar supabase/perfis.sql no Supabase…" (503) | `web/api/_lib/rotas/pessoas.js:232-237` |
| Sem `foto-perfil.sql` | "Falta rodar supabase/foto-perfil.sql…" | `web/api/_lib/rotas/pessoas.js:363-368` |
| Último gestor da Equipe | "<nome> é o único admin master. Dê esse perfil a outra pessoa antes de tirar este…" e **Salvar acesso** desabilitado; ao desativar/excluir, "<nome> é quem cuida da Equipe e dos acessos…" | `web/src/App.jsx:19200-19201`, `:19291-19301`, `:19350-19367` |
| Excluir GC de obras | "<nome> é GC de N obras. Troque o GC dessas obras antes de excluir, ou marque como inativo." | `web/src/App.jsx:19368-19370` |
| Excluir | confirmação "Excluir <nome> da equipe?" | `web/src/App.jsx:19372` |
| Equipe vazia | "Ninguém cadastrado ainda" (o texto de apoio está desatualizado — ver Riscos) | `web/src/App.jsx:19480-19490` |
| API recusou por perfil | "Você não tem acesso a esta área." (403) ou "Obra não encontrada." (404, para não confirmar que a obra existe) | `web/api/_lib/auth.js:92`, `:205` |

## Dados

Tabela `pessoa` (detalhes em `docs/referencia/banco.md`):

| Coluna | Significado |
|---|---|
| `email` | chave; é o que liga login, pessoa e obras (`supabase/equipe.sql:15`) |
| `nome`, `cargo` | o que a tela mostra; nome sai do e-mail quando vazio |
| `ativo` | `false` = desativada: não entra, mas continua ligada às obras |
| `perfil` | `master`, `admin`, `geral`, `gc`, `taylor`, `mehoo`, `canal` ou nulo (pendente) — `supabase/taylor-made.sql:23-25` |
| `entrou_em` | primeiro login (ordena a fila) |
| `liberado_em`, `liberado_por` | quando e quem deu o perfil (carimbados pelo servidor) |
| `canal` | qual canal de compra a pessoa acompanha (só vale com perfil `canal`) — `supabase/pessoa-canal.sql` |
| `ultimo_acesso` | última marcação de "estou usando" — `supabase/ultimo-acesso.sql` |
| `foto` | caminho da foto dentro do balde `catalogo` (nunca a URL) — `supabase/foto-perfil.sql` |
| `admin`, `modulos`, `obras_regra`, `obras` | legado do modelo anterior (`supabase/acessos.sql`); ainda gravados quando vêm, não decidem nada |
| `criado_em`, `criado_por` | cadastro; `criado_por` sai do login |

Tabela `obra`: `gc`, `tailor_made`, `responsavel_executivo` — e-mail de quem responde por cada
papel (`supabase/schema.sql:24`, `supabase/equipe-da-obra.sql`).

Tabela `preferencia` (`supabase/preferencia.sql`): o que a tela lembra de cada pessoa, por
`email` + `chave`. Chaves aceitas hoje (`web/api/_lib/rotas/preferencias.js:24-29`):
`obras.so_minhas`, `obras.modo`, `obras.squads_fechados`, `equipe.grupos_fechados`. O navegador
guarda só uma cópia de cache (`web/src/lib/preferencias.js`); a de verdade é a do banco e segue a
pessoa entre computadores.

## APIs

| Método | Rota | Autorização no servidor | Arquivo:linha | O que faz |
|---|---|---|---|---|
| GET | `/api/pessoas/banco-disponivel` | login | `web/api/_lib/rotas/pessoas.js:303` | diz se a coluna `perfil` existe |
| POST | `/api/pessoas/entrada` | login | `web/api/_lib/rotas/pessoas.js:265` | cria a linha pendente no primeiro login (ou devolve a existente) |
| GET | `/api/pessoas` | login (quem lê o quê: RLS) | `web/api/_lib/rotas/pessoas.js:192` | a equipe que a pessoa pode ler |
| PUT | `/api/pessoas` | login (quem grava: RLS, só master) | `web/api/_lib/rotas/pessoas.js:202` | cria ou altera uma pessoa (upsert por e-mail) |
| DELETE | `/api/pessoas/:email` | login (RLS, só master) | `web/api/_lib/rotas/pessoas.js:247` | exclui |
| POST | `/api/acessos/registrar` | login | `web/api/_lib/rotas/pessoas.js:314` | marca o último acesso de quem chamou |
| POST | `/api/pessoas/foto/envio` | login | `web/api/_lib/rotas/pessoas.js:337` | assina a subida da própria foto |
| PUT | `/api/pessoas/foto` | login | `web/api/_lib/rotas/pessoas.js:358` | grava o caminho da própria foto (`definir_foto`) |
| PATCH | `/api/obras/:codigo/papel` | login + membro + edição da obra | `web/api/_lib/rotas/obras.js:192` | GC, Taylor Made ou Executivo da obra |
| GET | `/api/preferencias` | login + membro | `web/api/_lib/rotas/preferencias.js:37` | as preferências de quem chamou |
| PUT | `/api/preferencias/:chave` | login + membro | `web/api/_lib/rotas/preferencias.js:47` | grava uma preferência |

As rotas de pessoa são montadas **antes** do `exigirMembro` global (`web/api/_lib/mondayApp.js:66-79`)
de propósito: quem está na sala de espera ainda não é do time e precisa criar a própria linha.

## Integrações

- **Azure (Microsoft Entra) via Supabase Auth** — login OAuth; app de um único diretório; ID,
  segredo e Tenant URL só no painel do Supabase (`docs/azure-login.md`). Ver
  `docs/referencia/integracoes.md`.
- **Supabase Storage** — balde público `catalogo`, pasta `pessoas/<e-mail>/` para as fotos.

## Regras de negócio usadas

- RN-001 — Só o administrador libera a compra (o perfil decide quem pode: `master` e `admin`,
  `web/src/regras/liberacaoDeCompra.js`; a tela usa `podeLiberarCompra` em `web/src/App.jsx:21625`).
- Regras encontradas que ainda não têm ficha:
  - [RN-003](../regras-de-negocio/RN-003-perfil-unico.md) — cada pessoa tem um perfil, e só um; o acesso sai inteiro dele.
  - [RN-006](../regras-de-negocio/RN-006-sem-perfil-nao-ve-nada.md) — sem perfil, sala de espera: nenhum dado da empresa.
  - [RN-005](../regras-de-negocio/RN-005-primeiro-login-fica-pendente.md) — o primeiro login cria a pessoa como pendente; ninguém se libera sozinho.
  - [RN-004](../regras-de-negocio/RN-004-so-dominio-da-empresa-entra.md) — só contas `@groupws.com.br` entram.
  - [RN-007](../regras-de-negocio/RN-007-pessoa-inativa-perde-acesso.md) — quem sai é desativado, não apagado, e perde o acesso.
  - [RN-010](../regras-de-negocio/RN-010-quem-ve-qual-obra.md) — todas para master/admin/geral/Mehoo; para GC e Taylor, as que responde e as sem GC.
  - [RN-011](../regras-de-negocio/RN-011-quem-edita-e-cria-obra.md) — só master, admin, geral e GC alteram obra, nas que enxergam.
  - [RN-008](../regras-de-negocio/RN-008-so-master-gerencia-equipe.md) — só o Admin master cuida da Equipe (o Administrador, enquanto não há master).
  - [RN-009](../regras-de-negocio/RN-009-sempre-um-gestor-da-equipe.md) — o último que cuida da Equipe não perde o perfil, nem é desativado ou excluído.
  - [RN-012](../regras-de-negocio/RN-012-perfis-de-painel-so-consultam.md) — Mehoo e Canal de compra veem só o painel deles e não alteram nada.
  - [RN-014](../regras-de-negocio/RN-014-contrato-da-obra-so-administrador.md) — o contrato da obra é só do Administrador e do Admin master.
  - [RN-015](../regras-de-negocio/RN-015-comprador-e-diaria-so-administrador.md) — comprador de cada grupo e diárias da mão de obra própria só o Administrador altera.
  - [RN-013](../regras-de-negocio/RN-013-responsaveis-da-obra.md) — GC, Taylor Made e Executivo são escolhidos da equipe por quem edita a obra.
  - [RN-016](../regras-de-negocio/RN-016-registro-em-nome-de-quem-esta-logado.md) — toda assinatura de registro sai do login, nunca da tela.
  - [RN-017](../regras-de-negocio/RN-017-observacao-da-obra.md) — quem vê a obra comenta; só o autor ou um administrador apaga.

## Riscos conhecidos

| Gravidade | Risco | Cenário | Onde no código |
|---|---|---|---|
| alta | O perfil **Canal de compra** existe só na tela. Servidor e banco não o conhecem: para eles a pessoa não vê obra nenhuma. | Pessoa com perfil `canal` entra: `GET /api/obras` volta vazio (RLS), `exigirObra` responde 404 e o painel dela fica sem obras. Além disso, o carregamento dos dados do painel só roda nos módulos `inicio`, `a_contratar` e `mehoo`, não em `painel_canal`. | `web/src/lib/pessoas.js:255-263`; `web/api/_lib/auth.js:86-90`; `supabase/rls-reforco.sql:87-107`; `web/src/App.jsx:21721` |
| alta | Com **migração pendente** a tela libera tudo (todos os módulos e obras, botões de administrador, liberar compra), mas o servidor recusa. | Coluna `perfil` ausente: `exigirMembro` lê `perfil, ativo`, recebe erro e nega — toda rota de dados responde 403 enquanto a tela oferece as ações. | `web/src/App.jsx:21622-21674`, `:22630`; `web/api/_lib/auth.js:101-115` |
| média | "Nunca zero gestores" só existe na tela. | O Admin master chama `PUT /api/pessoas` tirando o próprio perfil (ou `DELETE`) sendo o último: o banco aceita e ninguém mais libera acesso sem SQL. | `web/src/lib/pessoas.js:376-381`; `web/api/_lib/rotas/pessoas.js:202-251`; `supabase/rls-perfis.sql:102-103` |
| média | Geral e GC só leem a **própria linha** de `pessoa` (RLS). Os seletores de responsáveis da obra e de GC da obra nova listam só a própria pessoa, e os nomes dos outros caem para o nome tirado do e-mail; avatares dos outros não aparecem. | Um Geral quer escolher o GC de uma obra no Dashboard e só encontra a si mesmo na lista. | `supabase/rls-perfis.sql:98-101` (teste `supabase/tests/01-pessoa.sql:43`); `web/src/App.jsx:1468-1476`, `:20953` |
| média | O corte de domínio (`@groupws.com.br`) não é aplicado no código. | Qualquer conta que o Supabase autenticar (o Azure é de um diretório só; outros provedores dependem da configuração do Supabase — suposição) cria uma linha pendente e aparece na fila. | `web/src/lib/pessoas.js:345-347` (não usada); `web/api/_lib/rotas/pessoas.js:265-289` |
| baixa | Excluir pessoa sem ser master responde sucesso sem excluir. | A RLS filtra o `DELETE` para zero linhas e a rota devolve `{ ok: true }`; a tela tira a pessoa da lista até recarregar. Hoje só quem abre a Equipe chama, então o caso real é o Administrador sem master. | `web/api/_lib/rotas/pessoas.js:247-251`; `web/src/App.jsx:21709-21712` |
| baixa | "Administrador cuida da Equipe enquanto não há master" vale só na tela; o banco só deixa o master gravar `pessoa`. | Sem master ativo, o Administrador vê a Equipe, mas toda gravação é recusada. | `web/src/lib/pessoas.js:301-306`; `supabase/rls-perfis.sql:102-103` |
| baixa | Mudança de perfil de quem está com a tela aberta só vale no próximo carregamento da tela; servidor e banco já aplicam no pedido seguinte. | Perfil trocado de GC para Taylor com a obra aberta: a tela ainda oferece editar e as gravações passam a ser recusadas. | `web/src/App.jsx:21574-21596` |
| baixa | O papel da obra aceita qualquer texto como e-mail (até 200 caracteres), sem conferir formato nem se a pessoa existe. | E-mail digitado errado (por chamada direta à API) deixa a obra "com GC" que não é ninguém — ela some da vista de todos os GCs. | `web/api/_lib/rotas/obras.js:73-76` |
| baixa | Texto da Equipe vazia diz "Enquanto ninguém estiver cadastrado, todo mundo vê tudo", o oposto do ADR-001. | Na prática ninguém sem perfil chega à Equipe; o texto só confunde quem lê. | `web/src/App.jsx:19488-19489` |
| baixa | `docs/azure-login.md` diz que o login por e-mail e senha continua "embaixo da linha"; a tela de login hoje só tem o botão da Microsoft. | Azure fora do ar: ninguém entra pela tela. | `web/src/AuthGate.jsx:258-262` |
| baixa | Reaplicar `supabase/perfis.sql` ou `supabase/admin-master.sql` recria a trava de perfil **sem** `taylor` e `canal`. | Com alguém nesses perfis, o script falha na restrição; sem ninguém, o banco volta a recusar esses perfis até rodar `taylor-made.sql` de novo. | `supabase/perfis.sql:12-14`, `supabase/admin-master.sql:16-18`, `supabase/taylor-made.sql:23-25` |

## Fora do escopo

- A trava de edição da obra (quem está editando agora): `docs/funcionalidades/gravacao-da-obra.md`.
- O conteúdo dos painéis Mehoo e Painel por canal.
- As observações internas da obra (tela de Compras de Produtos); aqui só a regra de quem escreve e
  apaga, porque vale para todos os perfis.
- E-mail de aviso ao administrador, perfis além dos atuais, permissão por ação, convite com prazo e
  log de mudança de perfil (SPEC-acessos §7).

## Código

- `web/src/AuthGate.jsx` — login e verificação da sessão
- `web/src/lib/supabase.js` — cliente e "ambiente sem configuração"
- `web/src/lib/pessoas.js` — perfis e funções de acesso (quem vê o quê), equipe, foto
- `web/src/lib/preferencias.js` — `usePreferencia`
- `web/src/lib/api.js` — token do login em todo pedido
- `web/src/App.jsx` — `SalaDeEspera`, `AcessoDaPessoa`, `EquipeView`, `resumoAcesso`, aplicação do acesso (`eu`, `modulosVisiveis`, `obrasAtivas`)
- `web/api/_lib/auth.js` — portaria do servidor
- `web/api/_lib/rotas/pessoas.js`, `web/api/_lib/rotas/preferencias.js`, `web/api/_lib/rotas/obras.js`
- `supabase/equipe.sql`, `acessos.sql`, `perfis.sql`, `admin-master.sql`, `pessoa-canal.sql`, `taylor-made.sql`, `ultimo-acesso.sql`, `foto-perfil.sql`, `pessoa-escrita-restrita.sql`, `rls-perfis.sql`, `rls-perfis-complemento.sql`, `rls-reforco.sql`, `preferencia.sql`
- Testes: `web/src/__testes__/acessos.test.mjs`, `canal-da-pessoa.test.mjs`, `foto-perfil.test.mjs`, `azure-erro.test.mjs`, `funcoes-de-acesso-iguais.test.mjs`; `web/api/_lib/__testes__/api-autorizacao.test.cjs`, `rotas-exigem-login.test.cjs`; `supabase/tests/01-pessoa.sql`, `02-obra.sql`, `09-reforco.sql`, `11-preferencia.sql`
