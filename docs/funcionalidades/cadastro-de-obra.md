# Cadastro de obra (Vindas do Monday, Dar start e Nova obra)

**Módulo:** Vindas do Monday (`id: novas`) e a janela **Nova obra** · **Arquétipos de tela:** listagem (Vindas do Monday), formulário em janela (Nova obra) · **Onde fica:** painel de obras → **Vindas do Monday** (rota `/novas`); botão **Nova obra** no Início, no painel de obras e em Vindas do Monday

## Objetivo

Fazer a obra passar a existir no app. Há dois caminhos:

- **Dar start** numa obra que já existe no Monday (um board num dos workspaces dos squads). A obra
  é gravada no banco e, dali em diante, vive por conta própria: sumir do Monday não a apaga.
- **Nova obra**, para a obra que não está no Monday. Ela nasce ativa e vazia; cliente e valor
  vendido entram quando os documentos subirem.

Nos dois casos, a obra nasce **ativa**, entra na lista de obras e abre na Visão geral.

## Quem usa

| Perfil | O que pode | Onde é conferido |
|---|---|---|
| Admin master, Administrador, Geral, GC | Dar start e criar obra | tela: **Nova obra** só aparece para quem edita (`abrirNovaObra`, `web/src/App.jsx:22653`); servidor: `exigirPerfilDeEdicao` (`web/api/_lib/rotas/obras.js:124`); banco: policy `obra: criar` só confere o perfil (`supabase/rls-reforco.sql:161`) |
| Taylor Made | Vê Vindas do Monday e o botão **Dar start**, mas o servidor recusa (403) | servidor e banco; a tela **não** esconde o botão |
| Mehoo, Canal de compra | Não veem o módulo | tela (`podeVerModulo`) |

## Fluxo

### Dar start (obra do Monday)

1. O app lê os boards de cada workspace de squad (Sun, Moon, Comet) em `GET
   /api/monday/obras-execucao` (`web/api/_lib/mondayApp.js:207`). O servidor separa o código do
   nome pelo padrão `"2281 - Nome"` — três dígitos ou mais, um hífen e o nome
   (`web/api/_lib/mondayApp.js:214`). Boards "Subelementos de…" ficam de fora.
2. A tela converte cada board numa obra (`mondayObraParaApp`, `web/src/App.jsx:225`). Board sem
   código no nome recebe o **id do board** como código.
3. Obra do Monday **sem linha** na tabela `obra` (sem `situacao`) aparece em **Vindas do Monday**,
   agrupada por squad, com busca por nome, código ou squad (`NovasObrasView`,
   `web/src/App.jsx:20980`).
4. A pessoa clica **Dar start** no cartão (`web/src/App.jsx:21037`). O botão vira "Iniciando…".
5. `darStart` (`web/src/App.jsx:21918`) chama `iniciarObra` (`web/src/lib/obras.js:56`), que faz
   `POST /api/obras` com código, nome, squad, id do board, cliente, endereço, GC e valor vendido.
6. O servidor valida o corpo (`web/api/_lib/rotas/obras.js:61`), confere o perfil e **grava e só
   depois lê** a linha (`web/api/_lib/rotas/obras.js:134`–`155`): com `insert … select` a leitura
   de volta era barrada pela policy de leitura. A obra nasce com `situacao = 'ativa'` e
   `iniciada_em = now()`.
7. A tela registra a linha, troca para a obra e abre a Visão geral dela.

### Nova obra (obra fora do Monday)

1. **Nova obra** abre a janela (`NovaObraDialog`, `web/src/App.jsx:20874`) com: Nome da obra
   (obrigatório), Centro de custo (obrigatório, 4 dígitos), Endereço, Squad (Sun, Moon, Comet) e
   GC responsável (já vem com quem está cadastrando; pode ficar "— definir depois —").
2. Enquanto digita, a tela confere: o centro de custo precisa ter **exatamente 4 dígitos** (o
   campo só aceita números e corta em 4) e não pode repetir o de uma obra que a tela conhece
   (`web/src/App.jsx:20887`–`20888`; a lista vem de `web/src/App.jsx:25526`).
3. **Criar obra** chama `criarObraManual` (`web/src/App.jsx:22012`), que monta a obra no mesmo
   formato das do Monday (EAP vazia, `boardId` nulo, `manual: true`) e faz o mesmo `POST
   /api/obras`.
4. Deu certo: a janela fecha, a obra entra na lista e abre na Visão geral. Deu errado: a janela
   continua aberta com tudo o que foi digitado e mostra o erro.
5. Fechar com algo digitado pergunta antes: "Descartar alterações? O que foi digitado nesta obra
   nova se perde."
6. A partir do próximo carregamento, a obra que não está no Monday é remontada a partir da linha do
   banco (`faltandoNaTela`, `web/src/lib/obras.js:32`; `web/src/App.jsx:21554`).

### Depois do start: endereço, responsáveis e Sienge

- **Endereço:** a obra mostra o endereço gravado nela; se não houver (ou for "—"), usa o do
  espelho do Sienge com o mesmo código (`sienge_obra.endereco_completo`, `web/src/App.jsx:21788`),
  só na tela. O administrador pode corrigir à mão no topo da obra (`PATCH /api/obras/:codigo/endereco`);
  em branco, volta o do Sienge.
- **GC, Taylor Made e Executivo:** trocados no topo da obra ou no card "Equipe da obra", com a
  edição habilitada (`PATCH /api/obras/:codigo/papel`). Ver [dashboard.md](dashboard.md).
- **Vínculo com o Sienge:** não existe chave entre `obra` e `sienge_obra`. O app casa as duas pelo
  **código** (o centro de custo), para o endereço de reserva e para o pino do mapa
  (`mapaDeObras`, `web/src/App.jsx:21825`). Obra acompanhada que ainda não está no espelho entra na
  lista do mapa, sem pino.
- **Coordenadas:** o cadastro **não** geocodifica a obra nova. As coordenadas só existem no espelho
  do Sienge, carregadas por SQL (`supabase/sienge-obra-coordenadas-dados.sql`). O "Dar start"
  geocodificado está decidido, mas ainda não implementado.

## Telas

| Tela / bloco | Arquétipo | Rota ou aba | Componente |
|---|---|---|---|
| Vindas do Monday | listagem (cartões por squad) | `/novas` | `NovasObrasView` (`web/src/App.jsx:20980`), `ObraCard` (`web/src/App.jsx:20767`) |
| Nova obra | formulário em janela | abre sobre qualquer tela | `NovaObraDialog` (`web/src/App.jsx:20874`) |
| Entrada no painel de obras | navegação | painel ao lado do menu | `Sidebar` (`web/src/App.jsx:10819`) |

## Estados e mensagens

| Estado | Onde | O que a tela diz |
|---|---|---|
| Sem obras novas | Vindas do Monday | "Nenhuma obra nova do Monday — Todas já foram iniciadas. Obra que não está no Monday se cadastra à mão." (com **Nova obra**) |
| Busca sem resultado | Vindas do Monday | "Nenhuma obra encontrada." com **Limpar filtros** |
| Sem banco configurado | as duas | "Banco de dados não configurado neste ambiente — o start não vai gravar nada." / "…a obra não será gravada."; os botões ficam desabilitados |
| Iniciando | cartão | "Iniciando…" no botão |
| Criando | janela | "Criando…" no botão |
| Nome vazio | janela | "Informe o nome da obra." |
| Código inválido | janela | "Informe os 4 dígitos do centro de custo." |
| Código repetido | janela e servidor | "Já existe uma obra com o centro de custo NNNN." (na tela, antes de enviar; no servidor, pelo erro `23505` de chave única, traduzido em `web/src/lib/obras.js:77`) |
| Falha ao iniciar | aviso no topo | "Não foi possível iniciar "<obra>": <motivo>" |
| Falha ao criar | janela e topo | "Não foi possível criar "<obra>": <motivo>" — a janela mantém o que foi digitado |
| Sem permissão | aviso no topo | "Você não tem acesso a esta área." (403 do servidor) |

## Dados

Tabela `obra` (`supabase/schema.sql:16`, mais `supabase/equipe-da-obra.sql`):

| Campo | Vem de | Significado |
|---|---|---|
| `codigo` | nome do board (Monday) ou campo Centro de custo | chave da obra em todo o sistema; único (`unique`); prefixo dos aditivos ("2405/1") |
| `nome` | board ou campo Nome | obrigatório no banco (`not null`) |
| `squad` | workspace do Monday ou escolha na janela | Squad Sun, Moon ou Comet |
| `board_id` | Monday | board de origem; nulo na obra manual — é o que a distingue |
| `cliente` | hoje sempre "—" | o Monday não manda cliente, e a janela não pergunta |
| `endereco` | hoje "—" no Dar start; o digitado (ou "—") na Nova obra | endereço próprio da obra; o do Sienge vale só na tela |
| `gc` | nulo no Dar start; o escolhido na Nova obra | e-mail do GC responsável |
| `valor_vendido` | nulo | o Monday não manda o valor; entra depois pelos documentos |
| `situacao` | sempre `ativa` na criação | `ativa` ou `concluida` |
| `iniciada_em` | `now()` | quando a obra foi iniciada no app |
| `tailor_made`, `responsavel_executivo` | vazios na criação | os outros dois papéis da obra |

A linha de conteúdo (`obra_dados`) **não** é criada no start: ela nasce na primeira vez que alguém
habilita a edição, anexa um arquivo ou abre a Apresentação (`POST /api/obras/:codigo/conteudo` e
`POST /api/obras/:codigo/edicao` fazem o `upsert`).

## APIs

| Método | Rota | Autorização exigida no servidor | Arquivo:linha | O que faz |
|---|---|---|---|---|
| GET | `/api/monday/obras-execucao?workspaceId=` | login + membro; só os três workspaces dos squads | `web/api/_lib/mondayApp.js:207` | boards do workspace (id, código, nome), cache de 60 s |
| GET | `/api/obras` | login + membro; RLS `obra: ler` | `web/api/_lib/rotas/obras.js:102` | o registro das obras; sem as colunas novas, relê com o conjunto mínimo |
| POST | `/api/obras` | login + membro + perfil que edita (master, admin, geral, gc); RLS `obra: criar` (só perfil) | `web/api/_lib/rotas/obras.js:122` | grava a obra ativa e devolve a linha |
| PATCH | `/api/obras/:codigo/papel` | login + membro + edição da obra | `web/api/_lib/rotas/obras.js:192` | GC, Taylor Made ou Executivo |
| PATCH | `/api/obras/:codigo/endereco` | login + membro + edição da obra | `web/api/_lib/rotas/obras.js:219` | endereço corrigido à mão; vazio grava nulo |
| GET | `/api/sienge-obras` | login + membro | `web/api/_lib/rotas/siengeBanco.js:130` | espelho do Sienge (endereço e coordenadas) |

Validação do corpo do `POST /api/obras` (`web/api/_lib/rotas/obras.js:61`): código com 1 a 40
caracteres (letras, números, `.`, `_`, `-`), nome até 400, squad até 120, board até 40, cliente até
400, endereço até 500, GC até 200, valor vendido numérico. Nada além disso é aceito.

## Integrações

- **Monday:** só a lista de boards de três workspaces (`WORKSPACES_DOS_SQUADS`,
  `web/api/_lib/mondayApp.js:194`; `SQUADS`, `web/src/App.jsx:201` — um teste confere que as duas
  listas batem). Nenhuma coluna de item do Monday é lida. O token do Monday fica no servidor.
- **Sienge (espelho estático):** casamento por código, só para endereço e mapa.

## Regras de negócio usadas

- [RN-018](../regras-de-negocio/RN-018-codigo-da-obra.md) — o código da obra é o centro de custo, com 4 dígitos, e não se repete.
- [RN-011](../regras-de-negocio/RN-011-quem-edita-e-cria-obra.md) — só quem edita obra (master, admin, geral, GC) inicia ou cadastra obra.
- [RN-010](../regras-de-negocio/RN-010-quem-ve-qual-obra.md) — cada perfil vê as suas obras; a obra que nasce sem GC é vista por todos os GCs e Taylor Made.
- [RN-013](../regras-de-negocio/RN-013-responsaveis-da-obra.md) — GC, Taylor Made e Executivo são escolhidos da equipe e guardados pelo e-mail.
- [RN-019](../regras-de-negocio/RN-019-endereco-da-obra-so-administrador.md) — só o administrador corrige o endereço da obra.

## Riscos conhecidos

| Gravidade | Risco | Cenário | Onde no código |
|---|---|---|---|
| alta | GC cria obra em nome de outro GC e a perde de vista | a policy de criação só confere o perfil, não o campo `gc`. Um GC escolhe outro GC na janela, cria, e não enxerga mais a obra: o servidor devolve uma linha montada à mão e a tela a descarta na próxima leitura, porque ela não passa em "as minhas obras" | `supabase/rls-reforco.sql:161`; `web/api/_lib/rotas/obras.js:154`–`155`; `web/src/App.jsx:21690` |
| média | "4 dígitos" só na tela | o servidor aceita código de 1 a 40 caracteres; qualquer chamada direta à API grava código fora do padrão | `web/src/App.jsx:20887`; `web/api/_lib/validacao.js:126` |
| média | Board do Monday sem "NNNN - " no nome vira obra com código = id do board | o código longo do Monday passa a ser a chave da obra, o prefixo dos aditivos e o nome das pastas de arquivo; board com 3 dígitos também passa | `web/api/_lib/mondayApp.js:214`–`217`; `web/src/App.jsx:229` |
| média | GC e Taylor Made veem em "Vindas do Monday" obras já iniciadas por outros | o registro só traz as obras que o RLS mostra; a de outro GC fica sem situação e parece não iniciada. Dar start nela devolve "Já existe uma obra com o centro de custo…" | `web/src/App.jsx:21783` |
| média | Obra criada à mão com código que existe no Monday fica sem board para sempre | se o Monday não carregou (squad fora do ar), a checagem de repetido da janela não conhece o código; a obra nasce com `board_id` nulo e nenhuma rotina liga depois | `web/src/App.jsx:25526`, `web/src/App.jsx:22012` |
| baixa | Checagem de repetido só nas obras visíveis | a janela só conhece as obras que a pessoa vê; o repetido de outra pessoa só aparece como erro do servidor, depois do clique | `web/src/App.jsx:25526` |
| baixa | Dois "Dar start" ao mesmo tempo | a segunda pessoa recebe "Já existe uma obra com o centro de custo…" e a obra não aparece na tela dela até recarregar | `web/src/App.jsx:21918` |
| baixa | "—" gravado como dado | o Dar start grava `cliente = "—"` e `endereco = "—"`; a Nova obra grava `cliente = "—"` e, sem endereço, `"—"`. Quem lê o banco vê um traço no lugar de vazio | `web/src/App.jsx:236`–`237`, `web/src/App.jsx:22018` |
| baixa | Dar start não traz GC nem valor vendido | a rota do Monday só devolve id, código e nome; `gc`, `cliente`, `valorVendido` do cartão são sempre vazios. A obra nasce sem GC e aparece para todos os GCs | `web/api/_lib/mondayApp.js:227`; `web/src/App.jsx:225` |
| baixa | Sem vínculo com o Sienge nem coordenada na criação | a obra nova só ganha pino quando o espelho do Sienge for reimportado com ela | `web/src/App.jsx:21825` |
| baixa | Botões que o servidor recusa | Taylor Made vê **Dar start**; com `migracaoPendente` (perfis.sql não rodou) a tela mostra tudo a todos, mas o servidor recusa qualquer pedido de quem não tem perfil | `web/src/App.jsx:21037`, `web/src/App.jsx:22649`; `web/api/_lib/auth.js:117` |

## Fora do escopo

- Apagar obra: não há rota nem policy de exclusão em `obra`; limpeza de teste é por SQL
  (`supabase/limpar-obras-teste.sql`).
- Ler itens, cliente, valor ou GC do Monday.
- Criar ou atualizar a obra no Sienge.
- Concluir e reabrir: ver [obras-finalizadas.md](obras-finalizadas.md).

## Código

- `web/src/App.jsx` — `NovaObraDialog` (`20874`), `NovasObrasView` (`20980`), `darStart` (`21918`), `criarObraManual` (`22012`), `mondayObraParaApp` (`225`), `fetchSquadObras` (`249`), carga das obras (`21507`–`21564`)
- `web/src/lib/obras.js` — `iniciarObra`, `faltandoNaTela`, `definirGC`, `definirEndereco`
- `web/api/_lib/rotas/obras.js`, `web/api/_lib/mondayApp.js`, `web/api/_lib/auth.js`, `web/api/_lib/validacao.js`
- `supabase/schema.sql`, `supabase/rls-reforco.sql`, `supabase/equipe-da-obra.sql`, `supabase/sienge_obra.sql`
- Testes: `web/src/__testes__/obra-manual.test.mjs`, `web/api/_lib/__testes__/obras-rota.test.cjs`, `api-autorizacao.test.cjs`, `supabase/tests/02-obra.sql`
