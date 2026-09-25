# Referência da API

Todas as rotas do backend (`web/api`), como estão no código em 23/09/2026. São 96 rotas em 17
arquivos. Para o banco que elas tocam, ver `docs/referencia/banco.md`; para Monday, Sienge, Azure e
Storage, `docs/referencia/integracoes.md`.

## Arquitetura

### Onde roda

- **Produção (Vercel):** `web/vercel.json` reescreve `/api/(.*)` para `/api`, que é
  `web/api/index.js` — uma função serverless que só reexporta o app Express de
  `web/api/_lib/mondayApp.js`. A URL original chega intacta, então o roteamento interno continua
  vendo `/api/obras/...`. O `web/api/package.json` (`"type": "commonjs"`) existe porque o
  `web/package.json` é ES Module.
- **Desenvolvimento:** `monday-proxy/server.js` carrega `monday-proxy/.env` (e, se faltar, as
  variáveis públicas do Supabase de `web/.env`) e faz `listen` no **mesmo** `mondayApp.js`, na
  porta 3001; o Vite encaminha `/api` para lá. O servidor não recarrega sozinho quando o código
  muda.
- O nome `mondayApp.js` é histórico: hoje ele é o backend inteiro (Monday, leitura de PDF, Sienge e
  a montagem de todas as rotas de dados).

### Como o front chama

- `web/src/lib/api.js`: `apiFetch(caminho, opções)` põe `Authorization: Bearer <access_token>` da
  sessão do Supabase em todo pedido; `apiJson(caminho, { metodo, corpo })` lê o JSON e, quando o
  status não é 2xx, lança um `Error` com a frase do servidor (`error` nas rotas de dados, `erro`
  na portaria) e copia `status`, `code`, `correlationId` e `campos` para o erro.
- Cada assunto tem sua lib em `web/src/lib/` que fala com a sua rota: `pessoas.js`, `obras.js`,
  `dadosObra.js` (conteúdo, trava, resumos, gravação), `versoesObra.js`, `aditivos.js`,
  `apresentacao.js`, `catalogo.js`, `insumos.js`, `eap.js`, `eapApropriacao.js`, `arquivos.js`,
  `comentarios.js`, `importacoes.js`, `arquivoEventos.js`, `alocacaoPadrao.js`, `compradores.js`,
  `maoDeObraPropria.js`, `siengeObra.js`, `siengeSolicitacoes.js`, `preferencias.js`. As rotas do
  Monday, dos leitores de PDF e do Sienge ao vivo são chamadas direto de `web/src/App.jsx` com
  `apiFetch`.
- Desde 22/09/2026 o navegador não fala com as tabelas do Supabase: todo dado passa por estas
  rotas. A exceção registrada é o **arquivo** (Storage): o navegador sobe e baixa direto, por
  endereço assinado pela API (`web/src/lib/storage.js`).

### Portaria (autenticação e autorização)

A ordem de montagem em `web/api/_lib/mondayApp.js`:

1. `cors` com lista de origens (`ALLOWED_ORIGINS`, separada por vírgula; em desenvolvimento
   `localhost:5173` entra sozinho). Pedido sem `Origin` passa — quem barra é o login (`:42-60`).
2. `app.use(exigirLogin)` (`:66`) — toda rota nasce protegida.
3. `app.use(rotasDePessoas)` (`:77`) — **antes** do `exigirMembro`, de propósito: quem está na
   sala de espera precisa criar a própria linha.
4. `app.use(exigirMembro)` (`:79`) — daqui para baixo, só quem tem perfil e está ativo.
5. Leitor de JSON de 1 MB (`:95-96`), exceto nos caminhos com leitor próprio (gravação da obra,
   aditivo, apresentação, imagem de ambiente e PDF do Sienge).
6. Os routers de `_lib/rotas/` (`:119-137`) e as rotas de Monday, PDF e Sienge.
7. Tratador final de erro (`:1144-1153`): corpo grande → 413; JSON quebrado → 400; resto →
   mensagem padrão com código de correlação.

Os middlewares de `web/api/_lib/auth.js`:

| Middleware | O que exige | Recusa |
|---|---|---|
| `exigirLogin` (`:51-77`) | token Bearer que o **Supabase confirma** (`auth.getUser`). Cria `req.usuario = { id, email }` (e-mail em minúsculas) e `req.supabase`, o cliente que age **como o usuário** — o RLS do banco continua valendo em toda consulta. Sem `SUPABASE_URL`/`SUPABASE_ANON_KEY` no ambiente, recusa tudo. | 401 "Não autenticado." · 503 "Autenticação indisponível." |
| `exigirMembro` (`:127-130`) | linha em `pessoa` com perfil e `ativo` (lida uma vez por pedido, com o cliente do usuário; falha de leitura = nega) | 403 "Você não tem acesso a esta área." |
| `exigirPerfilDeEdicao` (`:133-137`) | perfil `master`, `admin`, `geral` ou `gc` | 403 |
| `exigirObra(deOnde)` (`:210`) | `podeAcessarObra`: `master`/`admin`/`geral`/`mehoo` veem todas; `gc`/`taylor` só onde são GC, Taylor Made ou Executivo, ou obra sem GC; outros perfis, nenhuma. Espelha `public.minhas_obras()`. | 404 "Obra não encontrada." (não confirma que existe) |
| `exigirEdicaoDeObra(deOnde)` (`:212`) | perfil que edita **e** `podeAcessarObra` | 404 "Obra não encontrada." |

O servidor repete a regra do banco porque decide **antes** de falar com o Monday e o Sienge, que
não conhecem RLS; o banco continua sendo a última palavra.

### Validação

`web/api/_lib/validacao.js`: `zValidator(alvo, esquema)` confere `json`, `param` ou `query` com zod
antes de qualquer consulta; o valor validado fica em `req.valido.<alvo>`. Fora do formato → 400
"Os dados enviados não estão no formato esperado." com `campos: [...]` (sem eco do valor). Os
esquemas compartilhados moram em `esquemas` (`:235-240`); cada arquivo de rota tem os seus. PDF é
conferido por `validarPdf` (`:65-73`): tipo, tamanho (4 MB) e assinatura `%PDF-`.

### Erros

- `web/api/_lib/erroDoBanco.js` — erro do Postgres/PostgREST vira resposta:

  | Código | Status | Mensagem |
  |---|---|---|
  | `23505` | 409 | "Já existe um registro com estes dados." |
  | `23503` | 409 | "Não é possível concluir: existem registros vinculados." |
  | `23514` | 422 | "Os dados enviados não passaram na conferência do banco." |
  | `42501` | 403 | "Você não tem permissão para esta ação." |
  | `42P01`, `PGRST205` | 503 | "Uma tabela que esta tela usa ainda não existe no banco." |
  | `PGRST116` | 404 | "Registro não encontrado." |
  | `57014` | 504 | "A consulta demorou demais. Tente de novo." |
  | mensagem que começa com `RN-NNN:` | 403 | a própria mensagem (escrita para a pessoa — hoje RN-001 e RN-002, dos gatilhos de `obra_dados`) |
  | qualquer outro | 500 | mensagem padrão + `correlationId` (`publicError.js`) |

- `web/api/_lib/publicError.js` — resposta padrão ("Não foi possível concluir a operação. Tente
  novamente em instantes.") com `correlationId`; o log leva só o tipo do erro, nunca a mensagem de
  terceiros.
- `web/api/_lib/respostaDaFuncao.js` — as funções de gravação protegida do banco não lançam erro
  quando recusam: devolvem `{ ok: false, motivo }`. `responderDaFuncao` traduz: `versao` → 409
  (com `versao`, `atualizadoPor`, `atualizadoEm`), `rev_existe` → 409, `sem_linha` → 404,
  `sem_obra` → 400, `sem_usuario` → 401, outro → 400. `erroDaFuncao`: função inexistente
  (`PGRST202`/`42883`) → 503 dizendo qual SQL falta. A gravação da obra tem a sua versão em
  `rotas/obraDados.js:49-98` (acrescenta `trava`, `vazia`, `outra_obra` e o erro `55006` do
  gatilho da trava → 409).
- `web/api/_lib/storage.js` — `erroDoStorage`: balde inexistente → 503 com o SQL a rodar;
  "not found" → 404; RLS → 403; resto → 500.
- Erros do Sienge (`SIENGE_*`) sobem com `error`, `comoResolver` e `code` (`mondayApp.js:711-719`).

### Compressão e limites

| O quê | Limite | Onde |
|---|---|---|
| JSON geral | 1 MB | `mondayApp.js:95` |
| Gravação da obra | `{ versao, gzip }` — o conteúdo vai em gzip + base64; até 4 MB de base64 e 48 MB depois de descomprimir | `validacao.js:121-134`, `rotas/obraDados.js:29-42` |
| Leitura da obra | `/conteudo`, `/edicao` (POST) e `/obras-resumos` respondem `{ gzip: "<base64>" }`; o navegador descomprime com `fflate` (`web/src/lib/dadosObra.js`) | `rotas/obraConteudo.js:119` |
| Aditivo, apresentação e imagem de ambiente | JSON de até 4 MB; imagem até 3 MB (base64) | `validacao.js:185-229` |
| PDF (Vendido, Executivo, Sienge) | 4 MB, 300 páginas; o do Sienge também aceita `{ pdfBase64 }` | `validacao.js:45-50`, `mondayApp.js:511-600` |
| Lote de obras no painel | até 100 códigos por pedido (a tela manda de 12 em 12) | `rotas/obraConteudo.js:126` |
| Blocos de insumos | 1000 linhas por pedido; 500 códigos na remoção | `rotas/insumos.js:40-42` |
| Itens da EAP por bloco | 500 | `rotas/eap.js:64` |
| Corpo da função na Vercel | 4,5 MB (por isso arquivo vai direto ao Storage) | `web/src/lib/storage.js` |

Caches em memória (valem enquanto a mesma instância da função estiver quente): consultas ao Monday,
60 s (`mondayApp.js:151`); referências do orçamento do Sienge e catálogo de insumos por obra, 30 min
(`mondayApp.js:783`, `:961`).

### Convenções das rotas de dados

"valida → autoriza → fala com o banco com o cliente do usuário → responde, com o erro traduzido".
Nunca `select('*')`: cada arquivo lista as colunas. Autoria (`autor`, `criado_por`,
`enviado_por`, `importado_por`…) sai de `req.usuario.email`, nunca do corpo. Tabela ou coluna que
ainda não existe (SQL não rodado) vira resposta própria (`semTabela`, `faltaTabela`, 503 com o nome
do SQL), e não erro genérico.

---

## Rotas

Legenda de autorização: **L** = `exigirLogin`; **M** = `exigirMembro`; **PE** =
`exigirPerfilDeEdicao`; **O** = `exigirObra`; **EO** = `exigirEdicaoDeObra`. "RLS" indica que o
corte de quem pode é só do banco. Os caminhos de arquivo abaixo são relativos a `web/api/_lib/`.

### `mondayApp.js` — Monday, leitura de PDF e Sienge ao vivo

| Método | Rota | Auth | Validação | O que faz | Banco / externo | Arquivo:linha |
|---|---|---|---|---|---|---|
| GET | `/api/monday/obras-execucao?workspaceId=` | L M | `queryObrasExecucao` (só os 3 workspaces dos squads) | lista os boards do workspace (cada board = obra), tira "Subelementos de…", separa código e nome | Monday GraphQL `boards` | `mondayApp.js:207` |
| POST | `/api/vendido/parse` | L M PE | `validarPdf` (corpo cru) | lê o PDF da proposta (Vendido) e devolve verbas, itens e diagnóstico da leitura | — | `mondayApp.js:515` |
| POST | `/api/sienge/texto` | L M PE | `pdfDoCorpo` (cru ou `pdfEmBase64`) + `validarPdf` | extrai o texto cru do PDF do Sienge; quem interpreta é o front (`lib/siengePedido.js`) | — | `mondayApp.js:577` |
| POST | `/api/executivo/parse` | L M PE | `validarPdf` | lê o PDF "Composição de Custo" do Executivo | — | `mondayApp.js:676` |
| POST | `/api/sienge/solicitacao` | L M EO (obra = `buildingId`) | `solicitacaoDeCompra` + `problemaNoPedido` | cria (ou completa, com `solicitacaoId`) uma solicitação de compra: confere o reenvio é da mesma obra, confere a apropriação contra o orçamento, cria o cabeçalho (solicitante VALENTINA) e manda item a item | Sienge `purchase-requests`, `building-cost-estimations/.../sheets/.../items` | `mondayApp.js:805` |
| GET | `/api/sienge/insumos/:buildingId?ids=` | L M O | `paramObra`, `queryInsumos` | detalhes e marcas dos insumos do orçamento da obra | Sienge `building-cost-estimations/{id}/resources` | `mondayApp.js:1006` |
| GET | `/api/sienge/obra/:buildingId/unidades` | L M O | `paramObra` | as unidades construtivas (planilhas do orçamento) da obra | Sienge `building-cost-estimations/{id}/sheets` | `mondayApp.js:1045` |
| GET | `/api/sienge/solicitacao/:id` | L M + confere a obra da resposta (`podeAcessarObra`) | `paramSolicitacao` | se a solicitação existe no Sienge e em que estado (só o cabeçalho) | Sienge `purchase-requests/{id}` | `mondayApp.js:1082` |

Sem credencial do Sienge, as quatro rotas do Sienge respondem 503 com "A integração com o Sienge
não está configurada neste ambiente." (`mondayApp.js:702-705`).

### `rotas/pessoas.js` — equipe, entrada e foto

Montado antes do `exigirMembro`; cada rota só exige login e o corte é do RLS de `pessoa`.

| Método | Rota | Auth | Validação | O que faz | Banco | Arquivo:linha |
|---|---|---|---|---|---|---|
| GET | `/api/pessoas` | L (RLS) | — | as linhas de `pessoa` que o usuário lê, com as colunas que existirem (degrada coluna a coluna se algum SQL não rodou) | `pessoa` | `rotas/pessoas.js:192` |
| PUT | `/api/pessoas` | L (RLS: só master grava) | `corpoDaPessoa` | upsert por e-mail; só grava os campos que vieram; `criado_por` e `liberado_por` saem do login | `pessoa` | `rotas/pessoas.js:202` |
| DELETE | `/api/pessoas/:email` | L (RLS) | `paramEmail` | exclui a pessoa | `pessoa` | `rotas/pessoas.js:247` |
| POST | `/api/pessoas/entrada` | L | `semCorpo` | devolve a linha de quem chamou ou a cria com perfil nulo (fila de espera) | `pessoa` (policy "entro na fila") | `rotas/pessoas.js:265` |
| GET | `/api/pessoas/banco-disponivel` | L | — | `{ feita }`: a coluna `perfil` existe? | `pessoa` | `rotas/pessoas.js:303` |
| POST | `/api/acessos/registrar` | L | `semCorpo` | marca o último acesso de quem chamou; sem o SQL, `ok: false` | `registrar_acesso()` | `rotas/pessoas.js:314` |
| POST | `/api/pessoas/foto/envio` | L | `semCorpo` | assina a subida da foto em `catalogo/pessoas/<e-mail do login>/<carimbo>.jpg` | Storage `catalogo` | `rotas/pessoas.js:337` |
| PUT | `/api/pessoas/foto` | L | `corpoDaFoto` | grava o caminho da foto na própria linha | `definir_foto(caminho)` | `rotas/pessoas.js:358` |

### `rotas/preferencias.js`

| Método | Rota | Auth | Validação | O que faz | Banco | Arquivo:linha |
|---|---|---|---|---|---|---|
| GET | `/api/preferencias` | L M | — | `{ chave: valor }` das preferências de quem chamou (só chaves que ainda existem) | `preferencia` | `rotas/preferencias.js:37` |
| PUT | `/api/preferencias/:chave` | L M | `paramChave` (lista fechada) + formato por chave | grava uma preferência | `preferencia` | `rotas/preferencias.js:47` |

### `rotas/obras.js` — ciclo de vida da obra

| Método | Rota | Auth | Validação | O que faz | Banco | Arquivo:linha |
|---|---|---|---|---|---|---|
| GET | `/api/obras` | L M (RLS) | — | as obras iniciadas que o usuário enxerga; sem as colunas de Equipe da obra, relê sem elas | `obra` | `rotas/obras.js:102` |
| POST | `/api/obras` | L M PE | `obraNova` | "Dar start": insere a obra ativa e depois a relê (insert e leitura separados) | `obra` | `rotas/obras.js:122` |
| PATCH | `/api/obras/:codigo/situacao` | L M EO | `paramCodigoObra`, `corpoSituacao` | conclui (vai para Finalizadas) ou reabre | `obra` | `rotas/obras.js:162` |
| PATCH | `/api/obras/:codigo/papel` | L M EO | `corpoPapel` (`gc`, `tailor_made`, `responsavel_executivo`) | define quem responde pelo papel (e-mail) | `obra` | `rotas/obras.js:192` |
| PATCH | `/api/obras/:codigo/endereco` | L M EO | `corpoEndereco` | endereço corrigido à mão (vazio = volta ao do Sienge) | `obra` | `rotas/obras.js:219` |

### `rotas/obraConteudo.js` — ler a obra, trava de edição e histórico

| Método | Rota | Auth | Validação | O que faz | Banco | Arquivo:linha |
|---|---|---|---|---|---|---|
| GET | `/api/obras/:codigo/conteudo` | L M O | `paramCodigo` | a linha de `obra_dados`, comprimida (retry sem as colunas novas) | `obra_dados` | `rotas/obraConteudo.js:135` |
| POST | `/api/obras/:codigo/conteudo` | L M EO | `paramCodigo` | só garante que a linha existe (upsert que ignora duplicado) | `obra_dados` | `rotas/obraConteudo.js:155` |
| POST | `/api/obras/:codigo/edicao` | L M EO | `paramCodigo` | pega a trava se livre, própria ou vencida (5 min) — condição dentro do `UPDATE`; devolve a obra do instante da trava, ou `{ ok: false, por, desde }` | `obra_dados` | `rotas/obraConteudo.js:186` |
| DELETE | `/api/obras/:codigo/edicao` | L M EO | `paramCodigo` | solta a trava, só se for de quem chamou | `obra_dados` | `rotas/obraConteudo.js:231` |
| GET | `/api/obras-travas` | L M (RLS) | — | travas vivas (cadeados da barra lateral) | `obra_dados` | `rotas/obraConteudo.js:254` |
| POST | `/api/obras-resumos` | L M (RLS) | `corpoDosResumos` | colunas do painel de um lote de obras, comprimidas | `obra_dados` | `rotas/obraConteudo.js:270` |
| GET | `/api/obras/:codigo/versoes` | L M O | `paramCodigo` | lista do histórico (sem o conteúdo); sem tabela, `semTabela` | `obra_versao` | `rotas/obraConteudo.js:296` |

### `rotas/obraDados.js` — gravar a obra

Detalhes do fluxo em `docs/funcionalidades/gravacao-da-obra.md`.

| Método | Rota | Auth | Validação | O que faz | Banco | Arquivo:linha |
|---|---|---|---|---|---|---|
| POST | `/api/obras/:codigo/gravar` | L M EO | `paramCodigoObra`, `gravacaoDaObra`, e depois de descomprimir `conteudoDaObra` | gravação inteira com trava e versão conferidas | `salvar_obra(p_codigo, p_versao, p_conteudo)` | `rotas/obraDados.js:105` |
| POST | `/api/obras/:codigo/patch` | L M EO | `patchesDaObra` | aplica patches (campo de item, mapa `comprasAditivo` ou coluna de marca) | `aplicar_patch_obra(p_codigo, p_patches, p_versao)` | `rotas/obraDados.js:129` |
| POST | `/api/obras/:codigo/versoes/:id/restaurar` | L M EO | `paramVersaoGuardada` | restaura uma versão do histórico | `restaurar_versao_obra(p_codigo, p_versao_id)` | `rotas/obraDados.js:143` |

### `rotas/aditivos.js`

| Método | Rota | Auth | Validação | O que faz | Banco | Arquivo:linha |
|---|---|---|---|---|---|---|
| GET | `/api/aditivos?obra=` | L M (RLS) | `queryDaObra` | aditivos que o usuário enxerga (com o documento), até 2000 | `aditivo` | `rotas/aditivos.js:63` |
| GET | `/api/obras/:codigo/aditivos/:id` | L M O | `paramDocumentoDaObra` | um aditivo com documento e versão | `aditivo` | `rotas/aditivos.js:74` |
| POST | `/api/obras/:codigo/aditivos` | L M EO | `aditivoNovo` | cria; número "obra/seq" sai do banco | `criar_aditivo(p_obra, p_campos)` | `rotas/aditivos.js:88` |
| POST | `/api/obras/:codigo/aditivos/:id/gravar` | L M EO | `gravacaoDoAditivo` | grava com a versão lida | `salvar_aditivo(p_id, p_versao, p_campos)` | `rotas/aditivos.js:102` |
| DELETE | `/api/obras/:codigo/aditivos/:id` | L M EO (+ RLS: criador ou admin) | `paramDocumentoDaObra` | exclui; zero linhas = 403 "Só quem criou o aditivo, ou um administrador, pode excluí-lo." | `aditivo` | `rotas/aditivos.js:121` |

### `rotas/apresentacoes.js`

| Método | Rota | Auth | Validação | O que faz | Banco | Arquivo:linha |
|---|---|---|---|---|---|---|
| GET | `/api/obras/:codigo/apresentacoes` | L M O | `paramCodigoObra` | revisões da obra (sem capa e slides) | `apresentacao` | `rotas/apresentacoes.js:80` |
| GET | `/api/obras/:codigo/apresentacoes/:id` | L M O | `paramDocumentoDaObra` | uma revisão inteira | `apresentacao` | `rotas/apresentacoes.js:91` |
| POST | `/api/obras/:codigo/apresentacoes` | L M EO | `apresentacaoNova` | cria a revisão (repetida → 409 `rev_existe`) | `criar_apresentacao(p_obra, p_rev, p_conteudo)` | `rotas/apresentacoes.js:103` |
| POST | `/api/obras/:codigo/apresentacoes/:id/gravar` | L M EO | `gravacaoDaApresentacao` | grava com a versão lida | `salvar_apresentacao(p_id, p_versao, p_conteudo)` | `rotas/apresentacoes.js:118` |
| DELETE | `/api/obras/:codigo/apresentacoes/:id` | L M EO | `paramDocumentoDaObra` | apaga a revisão; zero linhas = 404 | `apresentacao` | `rotas/apresentacoes.js:133` |
| POST | `/api/obras/:codigo/ambientes` | L M EO | `imagemDoAmbiente` | sobe a imagem do ambiente em `obra-arquivos/<obra>/ambientes/<carimbo>.<ext>` | Storage `obra-arquivos` | `rotas/apresentacoes.js:146` |
| POST | `/api/obras/:codigo/ambientes/links` | L M O | `caminhosDeImagem` | endereços para ver as imagens (assinados por 60 min; as antigas do balde `catalogo`, públicas); caminho de outra obra é ignorado | Storage | `rotas/apresentacoes.js:169` |

### `rotas/catalogo.js`

| Método | Rota | Auth | Validação | O que faz | Banco | Arquivo:linha |
|---|---|---|---|---|---|---|
| GET | `/api/catalogo/produtos` | L M (RLS) | — | produtos do catálogo | `catalogo_produto` | `rotas/catalogo.js:102` |
| PUT | `/api/catalogo/produtos` | L M (RLS: quem edita) | `produtoParaGravar` | update com `id`, insert sem (`criado_por` do login) | `catalogo_produto` | `rotas/catalogo.js:111` |
| DELETE | `/api/catalogo/produtos/:id` | L M (RLS) | `paramId` | tira do catálogo | `catalogo_produto` | `rotas/catalogo.js:125` |
| GET | `/api/catalogo/fornecedores` | L M (RLS) | — | fornecedores | `catalogo_fornecedor` | `rotas/catalogo.js:141` |
| PUT | `/api/catalogo/fornecedores` | L M (RLS) | `fornecedorParaGravar` | update com `id`, upsert por nome sem | `catalogo_fornecedor` | `rotas/catalogo.js:150` |
| DELETE | `/api/catalogo/fornecedores/:id` | L M (RLS) | `paramId` | tira do cadastro | `catalogo_fornecedor` | `rotas/catalogo.js:166` |
| POST | `/api/catalogo/foto/envio` | L M (RLS do Storage) | `fotoParaEnviar` | assina a subida da foto do produto (caminho vem do front, conferido por `caminhoSeguro`) | Storage `catalogo` | `rotas/catalogo.js:183` |

### `rotas/insumos.js` — banco de preços e cadastro de insumos do Sienge

| Método | Rota | Auth | Validação | O que faz | Banco | Arquivo:linha |
|---|---|---|---|---|---|---|
| GET | `/api/insumos/precos?busca=&limite=` | L M (RLS) | `queryLista` | busca por código ou descrição (termo entre aspas no filtro do PostgREST) | `insumo_preco` | `rotas/insumos.js:179` |
| GET | `/api/insumos/precos/pagina?de=&passo=&campos=` | L M (RLS) | `queryPagina` | uma página da base inteira | `insumo_preco` | `rotas/insumos.js:208` |
| GET | `/api/insumos/precos/contagem` | L M (RLS) | — | total de linhas | `insumo_preco` | `rotas/insumos.js:220` |
| GET | `/api/insumos/precos/sugestoes?palavra=&limite=` | L M (RLS) | `querySugestoes` | candidatos de preço para uma descrição (custo > 0) | `insumo_preco` | `rotas/insumos.js:236` |
| POST | `/api/insumos/precos` | L M (RLS: quem edita) | `corpoDePrecos` | upsert de um bloco (chave código+descrição+unidade) | `insumo_preco` | `rotas/insumos.js:259` |
| DELETE | `/api/insumos/precos` | L M PE | — | **apaga a base inteira** | `insumo_preco` | `rotas/insumos.js:275` |
| GET | `/api/insumos/sienge?de=&passo=` | L M (RLS) | `queryPaginaDoCadastro` | uma página do cadastro de insumos ativos; sem tabela, `[]` | `insumo_sienge` | `rotas/insumos.js:294` |
| POST | `/api/insumos/sienge` | L M (RLS) | `corpoDoCadastro` | upsert de um bloco do cadastro (`importado_por` do login) | `insumo_sienge` | `rotas/insumos.js:316` |
| POST | `/api/insumos/sienge/remover` | L M (RLS) | `corpoDeRemocao` | tira um bloco de códigos do cadastro | `insumo_sienge` | `rotas/insumos.js:341` |

### `rotas/eap.js` — EAP da casa e EAP do Sienge

| Método | Rota | Auth | Validação | O que faz | Banco | Arquivo:linha |
|---|---|---|---|---|---|---|
| GET | `/api/eap/grupos` | L M (RLS) | — | grupos ativos da EAP da casa, na ordem | `eap_grupo` | `rotas/eap.js:89` |
| GET | `/api/eap/versoes` | L M (RLS) | — | versões importadas da EAP do Sienge | `sienge_eap_versao` | `rotas/eap.js:101` |
| GET | `/api/eap/versoes/:id` | L M (RLS) | `paramVersao` | itens da árvore e mapa verba→folha de uma versão | `sienge_eap_item`, `sienge_eap_mapa` | `rotas/eap.js:111` |
| POST | `/api/eap/versoes` | L M (RLS: quem edita) | `corpoDaVersao` | cria a linha da versão (`importado_por` do login) | `sienge_eap_versao` | `rotas/eap.js:134` |
| POST | `/api/eap/versoes/:id/itens` | L M (RLS) | `corpoDosItens` | insere um bloco da árvore | `sienge_eap_item` | `rotas/eap.js:155` |
| POST | `/api/eap/versoes/:id/herdar` | L M (RLS) | `corpoDaHeranca` | copia o mapa da versão anterior para as folhas que continuam existindo; devolve os órfãos | `sienge_eap_mapa` | `rotas/eap.js:185` |
| PUT | `/api/eap/versoes/:id/padrao` | L M (RLS) | `paramVersao` | desmarca a padrão atual e marca esta | `sienge_eap_versao` | `rotas/eap.js:231` |
| PUT | `/api/eap/mapa` | L M (RLS) | `corpoDoMapa` | liga (ou desliga, `codigo` nulo) uma verba a uma folha | `sienge_eap_mapa` | `rotas/eap.js:245` |

### `rotas/arquivos.js` — Storage da obra

| Método | Rota | Auth | Validação | O que faz | Banco | Arquivo:linha |
|---|---|---|---|---|---|---|
| POST | `/api/arquivos/envio` | L M (RLS do Storage: quem edita a obra; contrato só admin) | `corpoDoEnvio` | assina a subida em `<obra>/<chave>/<carimbo>-<nome>` (sem sobrescrever) | Storage `obra-arquivos` | `rotas/arquivos.js:77` |
| POST | `/api/arquivos/link` | L M (RLS do Storage: quem vê a obra) | `corpoDoLink` | endereço assinado por 60 min, para ver ou baixar | Storage `obra-arquivos` | `rotas/arquivos.js:89` |
| POST | `/api/arquivos/remover` | L M (RLS do Storage) | `corpoDaRemocao` | apaga o arquivo trocado | Storage `obra-arquivos` | `rotas/arquivos.js:106` |

### `rotas/comentarios.js` — observações internas

| Método | Rota | Auth | Validação | O que faz | Banco | Arquivo:linha |
|---|---|---|---|---|---|---|
| GET | `/api/obras/:codigo/comentarios` | L M O | `paramObra` | observações da obra; sem tabela, `semTabela` | `obra_comentario` | `rotas/comentarios.js:65` |
| POST | `/api/obras/:codigo/comentarios` | L M O (qualquer perfil que vê a obra) | `corpoNovo` | grava a observação em nome de quem está logado | `obra_comentario` | `rotas/comentarios.js:85` |
| DELETE | `/api/comentarios/:id` | L M (RLS: autor ou admin) | `paramId` | apaga; responde 204 | `obra_comentario` | `rotas/comentarios.js:116` |

### `rotas/importacoes.js` — registro das importações

| Método | Rota | Auth | Validação | O que faz | Banco | Arquivo:linha |
|---|---|---|---|---|---|---|
| GET | `/api/obras/:codigo/importacoes` | L M O | `paramObra` | últimas 50 importações da obra | `obra_importacao` | `rotas/importacoes.js:59` |
| POST | `/api/obras/:codigo/importacoes` | L M EO | `corpoNovo` | registra uma importação (Vendido Contrato, Vendido Planilha, Planilha Executivo) | `obra_importacao` | `rotas/importacoes.js:77` |

### `rotas/arquivoEventos.js` — registro dos arquivos da obra

| Método | Rota | Auth | Validação | O que faz | Banco | Arquivo:linha |
|---|---|---|---|---|---|---|
| GET | `/api/obras/:codigo/arquivos-eventos` | L M O (RLS: contrato só admin) | `paramObra` | últimos 200 eventos (anexou, trocou, removeu) | `obra_arquivo_evento` | `rotas/arquivoEventos.js:47` |
| POST | `/api/obras/:codigo/arquivos-eventos` | L M EO (RLS: contrato só admin) | `corpoNovo` | registra um evento | `obra_arquivo_evento` | `rotas/arquivoEventos.js:65` |
| GET | `/api/obras/:codigo/itens-aprovados/log` | L M O (RLS: quem vê a obra) | `paramObra`, `consulta` (`idLinha`) | últimas 200 mudanças em item aprovado (RN-002) | `obra_item_aprovado_log` | `rotas/itemAprovadoLog.js:31` |

### `rotas/cadastros.js` — alocação padrão, compradores, mão de obra própria

| Método | Rota | Auth | Validação | O que faz | Banco | Arquivo:linha |
|---|---|---|---|---|---|---|
| GET | `/api/alocacao-padrao` | L M (RLS) | — | decisões de alocação (MAT, MO, AMBOS) por descrição | `alocacao_padrao` | `rotas/cadastros.js:68` |
| PUT | `/api/alocacao-padrao` | L M (RLS: quem edita) | `corpoDaAlocacao` (chave já normalizada) | grava a decisão | `alocacao_padrao` | `rotas/cadastros.js:76` |
| DELETE | `/api/alocacao-padrao/:chave` | L M (RLS) | `paramChaveDaAlocacao` | tira a decisão | `alocacao_padrao` | `rotas/cadastros.js:95` |
| GET | `/api/compradores` | L M (RLS) | — | comprador de cada grupo; sem tabela, `faltaTabela` | `comprador_grupo` | `rotas/cadastros.js:120` |
| PUT | `/api/compradores` | L M (RLS: admin) | `corpoDoComprador` | define o comprador do grupo | `comprador_grupo` | `rotas/cadastros.js:131` |
| DELETE | `/api/compradores/:grupo` | L M (RLS: admin) | `paramGrupo` | grupo fica sem comprador | `comprador_grupo` | `rotas/cadastros.js:144` |
| GET | `/api/prestadores-internos` | L M (RLS) | — | equipe interna e diárias | `prestador_interno` | `rotas/cadastros.js:171` |
| PUT | `/api/prestadores-internos` | L M (RLS: admin) | `corpoDoPrestador` | cria (sem `id`) ou altera | `prestador_interno` | `rotas/cadastros.js:184` |
| DELETE | `/api/prestadores-internos/:id` | L M (RLS: admin) | `paramIdDoPrestador` | tira da equipe interna | `prestador_interno` | `rotas/cadastros.js:215` |

### `rotas/siengeBanco.js` — espelho das obras do Sienge e rastro dos envios

| Método | Rota | Auth | Validação | O que faz | Banco | Arquivo:linha |
|---|---|---|---|---|---|---|
| GET | `/api/sienge-obras` | L M (RLS) | — | o espelho estático das obras do Sienge, com coordenadas (sem elas se a coluna faltar) | `sienge_obra` | `rotas/siengeBanco.js:130` |
| PUT | `/api/sienge-obras/:codigo/status` | L M (RLS + grant só de `status_manual`) | `paramCodigoObra`, `corpoDoStatusManual` | marcação manual ativa/finalizada (nulo volta ao automático) | `sienge_obra` | `rotas/siengeBanco.js:148` |
| POST | `/api/sienge-solicitacoes` | L M EO (obra do corpo) | `corpoDaAbertura` | abre o registro `enviando` **antes** do envio; chave repetida → 409 "Este envio já foi iniciado" | `sienge_solicitacao` | `rotas/siengeBanco.js:169` |
| PUT | `/api/sienge-solicitacoes/:id` | L M + `exigirEdicaoDoEnvio` (obra lida da linha) | `paramSolicitacao`, `corpoDoFechamento` | fecha o registro com a resposta do Sienge | `sienge_solicitacao` | `rotas/siengeBanco.js:245` |
| PUT | `/api/sienge-solicitacoes/:id/reconciliar` | L M + `exigirEdicaoDoEnvio` | idem | encerra um pendente depois de conferir no Sienge (`reconciliado_por` do login) | `sienge_solicitacao` | `rotas/siengeBanco.js:266` |
| GET | `/api/sienge-solicitacoes?obra=&limite=` | L M O | `queryDoHistorico` | histórico de envios da obra (com payload e resposta) | `sienge_solicitacao` | `rotas/siengeBanco.js:291` |
| GET | `/api/sienge-solicitacoes/pendentes?obra=` | L M O | `queryDaObra` | envios que ficaram em `enviando` | `sienge_solicitacao` | `rotas/siengeBanco.js:307` |
| GET | `/api/sienge-solicitacoes/mesmo-conteudo?obra=&assinatura=` | L M O | `queryDoMesmoConteudo` | o envio anterior com o mesmo conteúdo, ou `null` | `sienge_solicitacao` | `rotas/siengeBanco.js:322` |

---

## Riscos conhecidos

| Gravidade | Risco | Cenário | Onde |
|---|---|---|---|
| média | Rotas de escrita de **referência** (EAP, insumos, catálogo, alocação, compradores, prestadores, status do Sienge) e as de **pessoa** não conferem perfil no servidor; o corte é só do RLS. No `INSERT` o banco recusa (403), mas no `UPDATE`/`DELETE` a recusa é "zero linhas afetadas" — e a rota responde **sucesso**. | A Mehoo chama `PUT /api/eap/versoes/:id/padrao` ou `POST /api/insumos/sienge/remover`: nada muda e a resposta é 200 (`{ padrao: true }`, `{ removidos: N }`). Um não-admin em `DELETE /api/compradores/:grupo` ou um não-master em `DELETE /api/pessoas/:email` recebe `{ ok: true }` sem nada ter sido apagado. | `rotas/eap.js:231-260`, `rotas/insumos.js:259-348`, `rotas/catalogo.js:111-173`, `rotas/cadastros.js`, `rotas/siengeBanco.js:148-160`, `rotas/pessoas.js:247-251` |
| média | O e-mail de quem pega a trava é interpolado no filtro `.or()` do PostgREST sem aspas. | Vírgula, ponto ou parênteses no e-mail (o e-mail vem do login, não do corpo) mudariam o filtro e podem fazer a trava ser tomada ou recusada errado. Hoje os e-mails do time não têm esses caracteres. A busca de insumos já protege o termo com aspas (`valorDoFiltro`, `rotas/insumos.js:121-123`). | `rotas/obraConteudo.js:205` |
| média | Erros `23505` (duplicado) e `23503` (vínculo) viram 409 **sem `motivo`**; o front trata todo 409 sem motivo como conflito de versão. | Uma corrida na criação da revisão da apresentação (a conferência de "revisão já existe" e o `INSERT` não são atômicos) ou uma violação de chave numa gravação aparece como "a obra/documento mudou no banco", e a tela oferece recarregar. O `55006` do gatilho da trava vira 409 `trava` sem `por` nem `desde`. | `erroDoBanco.js:16-18`; `web/src/lib/gravacaoObra.js:120-133`; `rotas/obraDados.js:94-96`; `supabase/salvar-aditivo-apresentacao.sql:331-343` |
| média | Reaplicar `supabase/patch-obra.sql` recria `aplicar_patch_obra(text, jsonb)` — a versão antiga, sem conferir versão, sem `search_path` fixo — **ao lado** da de 3 argumentos. | A API sempre manda os três parâmetros e continua na função nova (suposição sobre a escolha do PostgREST por nome de parâmetro). Mas a função velha fica disponível a qualquer logado que chame o PostgREST direto, gravando com a regra antiga (só a trava viva de outra pessoa barra); e uma chamada com dois argumentos passa a ser ambígua. | `supabase/patch-obra.sql:34`, `:176`; `supabase/salvar-obra.sql:253-255` |
| baixa | `PATCH /api/obras/:codigo/endereco`: a tela só mostra o botão ao Administrador e ao Admin master, mas o servidor aceita qualquer perfil que edita a obra. | Um GC corrige o endereço da obra dele pela API. | `rotas/obras.js:216-235` |
| baixa | `DELETE /api/insumos/precos` apaga a base inteira de preços com o perfil de edição (GC incluso), sem confirmação no servidor. | Uma chamada apaga ~10 mil linhas de preço pago; a volta é reimportar o relatório. | `rotas/insumos.js:275-279` |
| baixa | `salvar_aditivo` e `salvar_apresentacao` recebem só o `id`; a rota confere a obra do caminho, mas não que o documento é dessa obra. | Quem edita duas obras grava o aditivo da obra B chamando a rota da obra A. O RLS continua limitando às obras que a pessoa edita, então não há ganho de acesso. | `rotas/aditivos.js:102-115`, `rotas/apresentacoes.js:118-131` |
| baixa | `POST /api/arquivos/remover` não passa pelo `caminhoSeguro` (as outras duas passam). | Quem depende é o RLS do Storage, que confere a obra e o contrato. | `rotas/arquivos.js:106-112` |
| baixa | Rotas de EAP que recebem só o `id` da versão (`itens`, `herdar`, `padrao`) não conferem se a versão existe antes de agir. | Id inexistente: `itens` falha na chave estrangeira (409 genérico); `padrao` desmarca a versão padrão atual e não marca nenhuma. | `rotas/eap.js:155-242` |
| baixa | O aviso de migração pendente do rastro do Sienge devolve a mensagem crua do PostgREST à tela (exceção deliberada, para nomear a coluna que falta). | Expõe nome de coluna e tabela. | `rotas/siengeBanco.js:113-116` |
| baixa | Comentários de `web/src/lib/aditivos.js:9` e `web/src/lib/apresentacao.js:16` citam `rotas/documentosDaObra.js`, que não existe (as rotas são `aditivos.js` e `apresentacoes.js`). | Quem procura o arquivo não o acha. | idem |

## Testes

`web/api/_lib/__testes__/`: `rotas-exigem-login.test.cjs` (toda rota exige login),
`montagem-das-rotas.test.cjs` (ordem de montagem), `api-autorizacao.test.cjs` (perfil, obra, número
da solicitação, workspaces do Monday), `gravacao-obra.test.cjs`, `documentos-da-obra.test.cjs`,
`obras-rota.test.cjs`, `eap-rotas.test.cjs`, `importacoes-rota.test.cjs`,
`arquivo-eventos-rota.test.cjs`, `parse-vendido.test.cjs`, `public-errors.test.cjs`. Rodam com
`npm test` em `web/` (`web/scripts/testes.mjs`).
