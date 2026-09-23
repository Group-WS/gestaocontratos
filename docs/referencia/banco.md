# Referência do banco

O banco é um Postgres no Supabase. Não há migrations numeradas: a estrutura é um conjunto de
scripts avulsos em `supabase/*.sql`, aplicados à mão no SQL Editor, quase todos reaplicáveis — mas
**em ordem** (ver abaixo). O navegador não fala com o banco; a API fala, sempre com o cliente do
usuário logado, então o RLS vale em toda consulta (`docs/referencia/api.md`).

Situação em 23/09/2026, lida no código desta branch. O que está aplicado em produção não foi
conferido aqui; o `supabase/README.md` indica que os blocos 5 a 7 já rodaram (os blocos 6 e 7
se recusam a rodar sem o 5) — confirmar com a consulta de `pg_policies` do próprio README.

## Ordem de aplicação

Fonte: `supabase/README.md` (seções "Ordem de aplicação, num banco novo") e a lista executável de
`supabase/tests/rodar.sh`, que monta um banco limpo nessa ordem para os testes. O
`docs/CONFIGURAR-AMBIENTE.md` só cita os três scripts da EAP do Sienge (`sienge_eap.sql`,
`sienge_eap_seed.sql`, `sienge_solicitacao.sql`).

| Bloco | Scripts | Observação |
|---|---|---|
| 1. Estrutura | `schema.sql`, `equipe.sql` | |
| 2. Acesso, nesta ordem | `acessos.sql` → `perfis.sql` → `admin-master.sql` | `perfis.sql` lê a coluna `admin`; `admin-master.sql` lê `perfil` |
| 3. Domínio (ordem livre dentro do bloco) | `eap.sql`, `etapas.sql`, `prazos.sql`, `escopos.sql`, `aditivos.sql`, `aditivo-exclusao.sql`, `aditivo-aguardando.sql`, `alocacao.sql`, `apresentacao.sql`, `obra-versao.sql`, `obra-versao-liberado-carimbo.sql`, `obra-comentario.sql`, `arquivos.sql`, `arquivos-obra.sql`, `catalogo.sql`, `insumo-sienge.sql`, `sienge_obra.sql`, `sienge_eap.sql`, `sienge_solicitacao.sql`, `sienge_obra_status_manual.sql`, `compradores.sql`, `mao-de-obra-propria.sql`, `pessoa-canal.sql`, `ultimo-acesso.sql`, `foto-perfil.sql`, `equipe-da-obra.sql`, `taylor-made.sql`, `contrato-restrito.sql`, `patch-obra.sql`, `preferencia.sql`, `sienge-obra-coordenadas.sql` | `taylor-made.sql` depois de `equipe-da-obra.sql`; `sienge-obra-coordenadas.sql` depois de `sienge_obra.sql`, e os dados (`sienge-obra-coordenadas-dados.sql`, gerado por `web/scripts/geocodificar-obras.mjs`) depois dele |
| 4. Pelo app | cadastrar a equipe e dar perfil; alguém precisa ficar **Admin master** | sem master o bloco 5 se recusa a rodar |
| 5. Fechar o acesso, na mesma sessão | `pessoa-escrita-restrita.sql` → `rls-perfis.sql` → `rls-perfis-complemento.sql` | |
| 6. Reforço (21/09/2026) | `rls-reforco.sql` → `rn-001-liberacao-de-compra.sql` | rodar de novo **sempre** que o bloco 5 rodar |
| 7. Gravação protegida da obra (22/09) | `salvar-obra.sql`; depois do deploy do app, `salvar-obra-contrair.sql` | |
| 8. Gravação protegida de aditivo e apresentação (22/09) | `salvar-aditivo-apresentacao.sql` | |
| 9. Registros (23/09) | `obra-importacao.sql`, `obra-arquivo-evento.sql` | |
| (sem bloco ainda) | `rn-002-item-aprovado-no-executivo.sql` | gatilho da RN-002 em `obra_dados`, criado em 23/09/2026; o `supabase/README.md` e o `tests/rodar.sh` ainda não o incluem. Pelo que ele usa, cabe depois do bloco 6 (suposição) |

**Reaplicar um script dos blocos 3 a 5 desfaz parte do reforço** (recria funções e policies na
versão antiga). Rodou algum de novo? Rode o bloco 5 inteiro e depois o 6 (e o 7 e 8, que recriam
funções que o bloco 3 também define). Ver Riscos.

Scripts que não são de estrutura (operações pontuais): `trocar-email-luana.sql`,
`limpar-obras-teste.sql`, `limpar-apresentacao-caderno.sql`, `remove-verba-32.sql`,
`catalogo-duplicidades.sql`, `renumera-execucao-mao-de-obra.sql`, `sienge_eap_seed.sql`,
`sienge-obra-coordenadas-dados.sql`.

## As funções de acesso

Todas `security definer` com `search_path` vazio e `execute` só para `authenticated` (versão
vigente: `supabase/rls-reforco.sql:63-152`).

| Função | O que devolve | Definida em |
|---|---|---|
| `public.meu_perfil()` | o perfil da pessoa logada, **só se ativa** (senão nulo) | `rls-reforco.sql:65-71` (antes: `rls-perfis.sql:30`) |
| `public.sou_admin()` | perfil `admin` ou `master` | `rls-reforco.sql:73-76` |
| `public.sou_master()` | perfil `master` | `rls-reforco.sql:78-81` (também `pessoa-escrita-restrita.sql:38`) |
| `public.admin_do_time()` | pessoa ativa com perfil `admin` ou `master` (usada no contrato, compradores, prestadores, comentários, aditivo) | `rls-reforco.sql:109-117`; cópias em `admin-master.sql`, `compradores.sql`, `contrato-restrito.sql`, `mao-de-obra-propria.sql` (vigiadas por `web/src/__testes__/funcoes-de-acesso-iguais.test.mjs`) |
| `public.minhas_obras()` | códigos das obras que a pessoa enxerga: `master`, `admin`, `geral`, `mehoo` → todas; `gc` e `taylor` → onde o e-mail está em `gc`, `tailor_made` ou `responsavel_executivo`, ou `gc` vazio; outros → nenhuma | `rls-reforco.sql:87-107` (antes: `rls-perfis.sql:50`, `taylor-made.sql:57-78`) |
| `public.registrar_acesso()` | marca `pessoa.ultimo_acesso = now()` na linha de quem chamou | `rls-reforco.sql:119-125` (antes: `ultimo-acesso.sql:26`) |
| `public.definir_foto(caminho)` | grava `pessoa.foto` na linha de quem chamou; recusa caminho fora de `pessoas/` | `rls-reforco.sql:127-139` (antes: `foto-perfil.sql:39`) |

## Tabelas

Legenda das policies: **ler / inserir / alterar / apagar**. "Quem edita" = perfil `master`,
`admin`, `geral` ou `gc`. "Da minha obra" = `obra_codigo in (select public.minhas_obras())`.
"Com perfil" = `meu_perfil() is not null`. Anônimo não lê nenhuma tabela.

### `obra` — as obras que o time acompanha

Criada em `supabase/schema.sql:16-31`; `tailor_made` e `responsavel_executivo` em
`supabase/equipe-da-obra.sql`.

| Coluna | Para quê |
|---|---|
| `id` | identidade interna |
| `codigo` | **chave de negócio** (centro de custo, ex. "2519"); é o que liga todas as outras tabelas |
| `nome`, `squad`, `board_id`, `cliente`, `endereco`, `valor_vendido` | cadastro (do Monday ou manual); `board_id` nulo = obra criada à mão |
| `gc`, `tailor_made`, `responsavel_executivo` | e-mail de quem responde por cada papel |
| `situacao` | `ativa` (na barra lateral) ou `concluida` (Finalizadas, só leitura) |
| `iniciada_em`, `concluida_em`, `criado_em`, `atualizado_em` | datas; `atualizado_em` pelo gatilho `trg_obra_atualizado` (`schema.sql:119`) |

Policies (`rls-reforco.sql:155-165`): ler — da minha obra; inserir — quem edita; alterar — da minha
obra, e o resultado precisa ser de quem edita; **apagar — ninguém pelo app** (limpeza só no SQL
Editor). Testes: `tests/02-obra.sql`, `tests/09-reforco.sql`.

### `obra_dados` — o conteúdo de cada obra, em JSON

Uma linha por obra (`schema.sql:61-87`), sem chave estrangeira para `obra` (a linha pode existir
antes da obra ou depois de ela sair). Colunas acrescentadas por `etapas.sql`, `prazos.sql`,
`escopos.sql`, `arquivos.sql`/`arquivos-obra.sql` e `salvar-obra.sql` (`versao`). A estrutura do
JSON está na seção **O JSON da obra**, abaixo.

| Coluna | Para quê |
|---|---|
| `obra_codigo` | chave |
| `categorias` | as verbas e os itens das quatro fontes (JSON) |
| `cadernos`, `arquivos`, `aprovacoes`, `escopos`, `etapas_concluidas` | anexos, depara aprovado à mão, escopos, etapas (JSON) |
| `depara_aprovado`, `executivo_liberado_direto`, `compras_liberadas` | marcos da obra |
| `cmv_liberado`, `cmv_liberado_em`, `cmv_liberado_por` | o teto de custo liberado |
| `cliente_assinou_em`, `cliente_assinatura_por`, `cliente_assinatura_arq`, `cliente_assinatura_obs` | a aprovação assinada pelo cliente |
| `compra_sem_assinatura_por`, `compra_sem_assinatura_em`, `compra_sem_assinatura_just` | compra liberada sem a assinatura do cliente, com justificativa |
| `data_entrega` | a data que comanda o prazo de compra |
| `editando_por`, `editando_desde` | a trava de edição (vence em 5 min sem gravação) |
| `versao` | sobe a cada mudança de **conteúdo** (gatilho); a gravação só vale com a versão lida |
| `atualizado_por`, `atualizado_em`, `criado_em` | carimbos |

Policies (`rls-reforco.sql:167-177`): ler — da minha obra; inserir — quem edita; alterar — da minha
obra e quem edita; apagar — ninguém pelo app.

Gatilhos (os `BEFORE` do mesmo evento rodam em ordem alfabética):

| Gatilho | Evento | O que faz | Definido em |
|---|---|---|---|
| `trg_obra_dados_atualizado` | before update | `atualizado_em = now()` | `schema.sql:123-126` |
| `trg_obra_dados_rn_001` | before insert/update | **RN-001**: recusa liberação de compra que não seja do administrador (ou via alocação, em nome próprio); restaurar versão pode devolver o carimbo | `rn-001-liberacao-de-compra.sql:116-118` |
| `trg_obra_dados_rn_002` | before update | **RN-002**: recusa editar, remover ou substituir no Executivo (`categorias[].itens`) um item travado — aprovado para compra, solicitado, comprado, com canal, avulso ou de aditivo —, para todos os perfis. Comparação por conteúdo dos campos da planilha | `rn-002-item-aprovado-no-executivo.sql:63-94` (novo, de 23/09/2026; ainda fora da ordem do `supabase/README.md` e do `tests/rodar.sh`, e sem teste pgTAP) |
| `trg_obra_dados_trava` | before update | recusa (`55006`) gravar conteúdo por cima da trava viva de outra pessoa; depois do "contrair", com trava viva só as funções gravam | `salvar-obra.sql:436-462`, substituída por `salvar-obra-contrair.sql:30-55` |
| `trg_obra_dados_versao` | before update | guarda a linha anterior em `obra_versao` (toda gravação inteira, toda queda de itens ou de liberados, e um marco por hora), com poda | `obra-versao.sql:198-201`, função `public.obra_dados_guarda_versao()` em `salvar-obra.sql:482-541` |
| `trg_obra_dados_versao_del` | before delete | guarda a linha que está sendo apagada | `obra-versao.sql:209-211` |
| `trg_obra_dados_versao_numero` | before update | sobe `versao` quando alguma coluna de conteúdo muda | `salvar-obra.sql:71-89` |

Funções de gravação (todas `security invoker`: o RLS e os gatilhos continuam valendo):

| Função | O que faz | Definida em |
|---|---|---|
| `public.salvar_obra(p_codigo, p_versao, p_conteudo)` | grava a obra inteira só se a trava for de quem grava e a versão for a lida; recusa obra sem itens por cima de obra com itens (`vazia`); devolve `{ ok, versao }` ou `{ ok: false, motivo }` | `salvar-obra.sql:185-246` |
| `public.aplicar_patch_obra(p_codigo, p_patches, p_versao)` | aplica patches (campo de item conferido por código e descrição, mapa `comprasAditivo`, ou coluna de marca); com `p_versao`, mesma conferência da gravação inteira | `salvar-obra.sql:255-364` |
| `public.restaurar_versao_obra(p_codigo, p_versao_id)` | volta o conteúdo de uma versão do histórico (só as colunas de conteúdo); recusa se a versão é de outra obra ou se há trava viva de outra pessoa; recria a linha se ela foi apagada | `salvar-obra.sql:371-428` |
| `private.obra_dados_escrever(...)` | a escrita comum às três; marca `confere.gravacao` (`inteira`, `patch`, `restauracao`) para os gatilhos | `salvar-obra.sql:120-162` |
| `private.obra_conteudo_valido`, `private.obra_conta_itens`, `private.obra_dados_controle` | conferência de formato, contagem de itens, colunas que não são conteúdo | `salvar-obra.sql:61-107`, `:166-182` |
| `public.obra_conta_itens`, `public.obra_len_lista`, `public.obra_conta_liberados` | contagens usadas pelo histórico | `obra-versao.sql:65-115`, `obra-versao-liberado-carimbo.sql:46` |

Testes: `tests/02-obra.sql`, `tests/09-reforco.sql`, `tests/10-rn-001-liberacao.sql`,
`tests/12-salvar-obra.sql`.

### `obra_versao` — o histórico da obra

`obra-versao.sql:41-60`; coluna `marco` em `salvar-obra.sql:468-469`. Colunas: `id`, `obra_codigo`,
`conteudo` (a linha inteira de `obra_dados` antes da gravação), `n_itens`, `queda` (a gravação
perdeu itens ou liberações), `marco` (cópia de hora em hora), `atualizado_por`, `criado_em`. Poda:
ficam as 24 mais novas, os 24 marcos mais novos e toda queda dos últimos 30 dias. Sem chave
estrangeira, de propósito (a cópia sobrevive ao apagamento da obra).

Policies: ler — da minha obra (`rls-perfis-complemento.sql:61`); **escrever — ninguém**: só o
gatilho (`security definer`) grava (`rls-reforco.sql:180`). Testes: `tests/02-obra.sql`,
`tests/09-reforco.sql`, `tests/12-salvar-obra.sql`.

### `pessoa` — a equipe e o perfil de cada um

`equipe.sql:14-23`; colunas de `acessos.sql`, `perfis.sql`, `pessoa-canal.sql`,
`ultimo-acesso.sql`, `foto-perfil.sql`. Detalhe de cada coluna em
`docs/funcionalidades/login-e-acessos.md`. Chave: `email`. Perfis aceitos (`taylor-made.sql:23-25`):
`master`, `admin`, `geral`, `gc`, `mehoo`, `canal`, `taylor`, ou nulo (pendente).

Policies (`rls-perfis.sql:98-108`): ler — a própria linha, ou todas se `sou_admin()`; inserir —
só a própria linha **com perfil nulo** ("entro na fila") ou o master; alterar e apagar — só o master
("master escreve todas"). Ninguém altera a própria linha (é o que impede a autopromoção); a foto e o
último acesso passam pelas funções `definir_foto` e `registrar_acesso`. Testes:
`tests/01-pessoa.sql`, `tests/09-reforco.sql`.

### `aditivo` e `aditivo_versao`

`aditivo` (`aditivos.sql:11-27`): `id` (uuid), `obra_codigo`, `seq`, `numero` ("2405/3", único por
obra+seq), `descricao`, `status` (`rascunho`, `aguardando`, `aprovado`, `reprovado` —
`aditivo-aguardando.sql`), `dados` (o documento), `total_supressao`, `total_adicao`, carimbos,
`versao` (`salvar-aditivo-apresentacao.sql:55`). Índice `(obra_codigo, seq desc)`.

Policies: ler — da minha obra **e** quem edita (`rls-perfis.sql:124-126`; a Mehoo e a Taylor Made
não leem aditivo); inserir e alterar — da minha obra e quem edita (`rls-reforco.sql:195-204`);
apagar — da minha obra e (quem criou, ou `master`/`admin`) (`rls-perfis.sql:133-140`).

Gatilhos: `aditivo_autoria` (criado_por e atualizado_por saem do login, `rls-reforco.sql:210-230`),
`trg_aditivo_versao` (`private.conta_versao`, `salvar-aditivo-apresentacao.sql:65-84`),
`trg_aditivo_guarda_versao` (cópia em `aditivo_versao` a cada gravação inteira, de hora em hora nas
avulsas, e no apagamento; poda em 24 + apagamentos de 30 dias, `:388-442`).

Funções: `public.criar_aditivo(p_obra, p_campos)` (número pelo banco, com trava por obra, `:217-256`)
e `public.salvar_aditivo(p_id, p_versao, p_campos)` (`:161-206`).

`aditivo_versao` (`:358-386`): cópias do aditivo; ler — da minha obra; escrever — só o gatilho.

Testes: `tests/04-aditivo.sql`, `tests/09-reforco.sql`, `tests/13-aditivo-apresentacao.sql`.

### `apresentacao`

`apresentacao.sql:7-35`: `id`, `obra_codigo`, `rev` (única por obra), `capa`, `slides`, `idioma`,
`arquivo`, `gerado_em`, carimbos, `versao`. Policies (`rls-perfis-complemento.sql:59-72`): ler — da
minha obra; escrever (todas as operações) — da minha obra e quem edita. Gatilhos:
`apresentacao_autoria` e `trg_apresentacao_versao` (`salvar-aditivo-apresentacao.sql:87-119`).
Funções: `criar_apresentacao(p_obra, p_rev, p_conteudo)` (`:309-346`) e
`salvar_apresentacao(p_id, p_versao, p_conteudo)` (`:259-304`). Testes: `tests/07-por-obra.sql`,
`tests/13-aditivo-apresentacao.sql`.

### `obra_comentario` — observações internas

`obra-comentario.sql:29-56`: `id`, `obra_codigo`, `verba_num`, `item_chave` (nulo = da verba),
`texto`, `autor`, `criado_em`. Policies: ler — com perfil, **de qualquer obra**
(`rls-reforco.sql:366-368`; a API corta por obra); inserir — em nome próprio e com perfil
(`:369-372`); apagar — o autor ou `admin_do_time()` (`obra-comentario.sql:77`); alterar — ninguém.
Testes: `tests/05-comentario.sql`, `tests/09-reforco.sql`.

### `obra_importacao` e `obra_arquivo_evento` — registros que só crescem

- `obra_importacao` (`obra-importacao.sql:28-58`): `obra_codigo` (FK para `obra.codigo`, cascata),
  `documento` (`vendido_contrato`, `vendido_planilha`, `planilha_executivo`), `arquivo_nome`,
  `arquivo_tamanho`, `n_itens`, `verbas_trocadas`, `verbas_mantidas`, `autor`, `criado_em`. Ler —
  da minha obra; inserir — quem edita, da minha obra, em nome próprio; alterar e apagar — ninguém.
  Teste: `tests/14-importacao.sql`.
- `obra_arquivo_evento` (`obra-arquivo-evento.sql:24-52`): `acao` (`anexou`, `trocou`, `removeu`),
  `tipo` (`criativo`, `especificacao`, `marcenaria`, `projeto`, `contrato`, `apresentacao`,
  `assinatura`, `avulso`), `titulo`, `arquivo_nome`, `arquivo_anterior`, `caminho`, `autor`. Mesmo
  desenho, e o tipo `contrato` só é lido e registrado por `admin_do_time()`. Teste:
  `tests/15-arquivo-evento.sql`.

### `preferencia`

`preferencia.sql:18-47`: `email`, `chave` (formato `^[a-z][a-z_.]{0,59}$`), `valor` (JSON até 4 KB),
`atualizado_em`; chave primária `(email, chave)`. Cada pessoa lê, grava, troca e apaga só as
próprias; anônimo sem acesso. Teste: `tests/11-preferencia.sql`.

### Tabelas de referência (não pertencem a obra nenhuma)

Todas com "leio referencia" (com perfil) e "escrevo referencia" (quem edita), criadas por
`rls-perfis.sql:145-152` (as três primeiras) e `rls-perfis-complemento.sql:80-98` (as demais).

| Tabela | Para quê | Colunas principais | Criada em |
|---|---|---|---|
| `insumo_preco` | banco de preços: o que foi pago, do relatório de pedidos do Sienge | `codigo`, `descricao`, `unidade` (únicos juntos), `custo_unitario`, `data_ref`, `fornecedor` | `schema.sql:143-171` |
| `insumo_sienge` | cadastro de insumos **ativos** do Sienge (o nome de hoje) | `codigo` (PK), `descricao`, `unidade`, `preco_tabela`, `importado_em`, `importado_por` | `insumo-sienge.sql:39-50` |
| `eap_grupo` | a EAP da casa: os grupos (verbas) numerados "01", "02"… | `num` (PK), `nome`, `apelidos`, `analisar`, `motivo_na`, `ordem`, `ativo` | `eap.sql:21-31` |
| `alocacao_padrao` | decisão MAT/MO/AMBOS por descrição normalizada | `descricao_norm` (PK), `descricao`, `alocacao`, `por`, `em` | `alocacao.sql:15-21` |
| `catalogo_produto` | o catálogo TKWS | `verba` (FK `eap_grupo.num`), `subgrupo`, `descricao`, `tipo_item`, `descricao_criativo`, `descricao_en`, `codigo`, `fornecedor`, `preco_ref` (centavos), `imagem`, `unidade`, `ativo` | `catalogo.sql:26-72`, `:128-135` |
| `catalogo_fornecedor` | fornecedores do catálogo | `nome` (único), contato, telefone, e-mail, site, `ativo` | `catalogo.sql:13-24` |
| `sienge_obra` | espelho estático das obras do Sienge (todo centro de custo desde 2018), para o mapa do Início | `codigo` (PK), `nome`, `cidade`, `estado`, `endereco_completo`, `status_manual`, `lat`, `lng`, `geo_precisao` | `sienge_obra.sql:17-24`, `sienge_obra_status_manual.sql`, `sienge-obra-coordenadas.sql` |
| `sienge_eap_versao` | cada importação da EAP do Sienge (uma padrão por vez) | `nome`, `unidade_id`, `obra_modelo`, `versao_orcamento`, `data_base`, `padrao`, `importado_por` | `sienge_eap.sql:26-41` |
| `sienge_eap_item` | a árvore de uma versão (4 níveis; só a folha é apropriável) | `(versao_id, codigo)` PK, `descricao`, `nivel`, `unidade`, `folha` | `sienge_eap.sql:43-55` |
| `sienge_eap_mapa` | verba da casa → folha da EAP do Sienge, por versão | `(versao_id, verba_num)` PK, `codigo`, `definido_por`, `definido_em` | `sienge_eap.sql:64-72` |

Exceção em `sienge_obra`: além da policy, o app só tem `grant update (status_manual)` — nome,
cidade e endereço não são alteráveis pelo app (`rls-reforco.sql:383-384`). A carga é feita no SQL
Editor. Testes: `tests/03-referencia.sql`, `tests/06-referencia-completa.sql`,
`tests/09-reforco.sql` (`sienge_obra`).

### `sienge_solicitacao` — o rastro dos envios ao Sienge

`sienge_solicitacao.sql:25-86`: `obra_codigo`, `building_id`, `solicitacao_id` (número no Sienge),
`enviado_por`, `enviado_em`, `payload` (o que foi pedido), `resposta`, `ok`, `status`
(`enviando`, `concluido`, `parcial`, `falhou`, `abandonado`), `idempotency_key` (uuid da tentativa,
único), `assinatura` (do conteúdo), `atualizado_em`, `reconciliado_em`, `reconciliado_por`.
Policies (`rls-perfis-complemento.sql:61` e `rls-reforco.sql:182-192`): ler — da minha obra;
inserir e alterar — da minha obra e quem edita; **apagar — ninguém**. Testes:
`tests/07-por-obra.sql`, `tests/09-reforco.sql`.

### `comprador_grupo` e `prestador_interno` — cadastros do administrador

- `comprador_grupo` (`compradores.sql:11-17`): `grupo` (nome do grupo da EAP, PK),
  `comprador_email`, `comprador_nome`, carimbos.
- `prestador_interno` (`mao-de-obra-propria.sql:12-22`): `nome`, `especialidade`, `funcao`,
  `diaria` (≥ 0), `ativo`, carimbos; o script semeia seis funções se a tabela estiver vazia.

Nas duas: ler — com perfil (`rls-reforco.sql:374-380`); inserir, alterar e apagar —
`admin_do_time()` (`compradores.sql:41-50`, `mao-de-obra-propria.sql:46-55`). Testes:
`tests/08-so-admin-escreve.sql`, `tests/09-reforco.sql`.

### Storage

| Balde | Público? | Para quê | Policies vigentes |
|---|---|---|---|
| `obra-arquivos` | não; 50 MB por arquivo; lista de tipos aceitos (PDF, Office, CSV, texto, imagens, zip) — `arquivos.sql:17-35` | cadernos, contrato, assinatura do cliente, anexos avulsos, imagens de ambiente; caminho `<obra>/<chave>/<arquivo>` | ler — `master`/`admin`/`geral`/`mehoo` ou a obra (1ª pasta) em `minhas_obras()`; gravar, trocar e apagar — `master`/`admin`/`geral`, ou GC na obra dele; pasta `contrato` só `admin_do_time()` (`rls-reforco.sql:238-282`) |
| `catalogo` | sim (leitura por link) | foto de produto, foto de perfil (`pessoas/<e-mail>/`), imagens antigas de ambiente (`ambientes/<obra>/`) | listar — com perfil; gravar/trocar/apagar — `pessoas/`: só a própria pasta; `ambientes/`: quem edita a obra; resto: quem edita (`rls-reforco.sql:297-356`) |

Teste: `tests/09-reforco.sql`.

## O JSON da obra (`obra_dados`)

O formato é do app; o banco confere só o tipo de cada coluna
(`private.obra_conteudo_valido`, `salvar-obra.sql:166-182`) e a API o mesmo
(`web/api/_lib/validacao.js:142-163`). Quem traduz a tela para as colunas é
`linhaParaGravar` (`web/src/lib/gravacaoObra.js:54-82`); a volta é `paraApp`
(`web/src/lib/dadosObra.js:297`).

### `categorias` — lista de verbas (grupos da EAP)

Cada elemento é uma verba. A lista segue a EAP da casa (`eap_grupo`), na ordem; verba salva que não
casa com nenhum grupo vai para o fim marcada `foraDaEapPadrao` (`normalizarCategorias`,
`web/src/App.jsx`).

| Campo da verba | Significado |
|---|---|
| `num`, `nome` | o grupo da EAP ("20", "Climatização / Exaustão") |
| `vendido`, `executivo` | totais da verba em cada fonte |
| `itensContrato` | itens do **Vendido Contrato** (PDF da proposta) |
| `itensPlanilha` | itens do **Vendido Planilha** (o criativo) |
| `itensPlanilhaExecutivo` | itens da **Planilha Executivo** como importada |
| `itens` | a lista de trabalho do Executivo: é nela que se confere, aloca, libera e compra. A importação da Planilha Executivo grava a mesma lista em `itens` e `itensPlanilhaExecutivo` (`importPlanilhaExecutivo`, `web/src/App.jsx`) |
| `comprasAditivo` | mapa `idDoItem → campos de compra` dos itens que entraram por aditivo (o item mora no aditivo, a compra mora aqui); o patch do banco escreve nele (`mapa: "comprasAditivo"`) |
| `foraDaEapPadrao`, `foraDeEscopoCategoria` | marcas de verba fora do padrão / fora do escopo |

Campos de item mais usados no código (lista observada, não um esquema fechado): `codigo`, `desc`,
`un`, `qtd`, `qtdVendida`, `qtdExecutivo`, `custo`, `custoMaterial`, `custoMO`, `custoTotal`,
`ambiente`, `especificacao`, `marca`, `modelo`, `fornecedor`, `canalCompra`, `comprado`,
`compradoEm`, `excluido`, `troca`/`trocaEm`/`trocaDe`, `aprovadoCliente`, `alertaConferido`,
`moSeparada`/`separadoDe`, `alocacaoManual`, `detalheSienge`, `maeSienge`, `solicitado`,
`concluidoExecutivo`, `ehTitulo`. Os dois carimbos da RN-001:

- `liberadoCompra` — `{ em, por }` (ou `{ em, por, viaAlocacao: true }` quando a liberação veio da
  alocação); antes era `true/false`, e o banco ainda conta os dois formatos
  (`obra-versao-liberado-carimbo.sql`).
- `liberadoSemCliente` — liberação sem a assinatura do cliente, só do administrador.

### Colunas de nível obra

| Coluna (banco) | Campo na tela | Formato | Significado |
|---|---|---|---|
| `cadernos` | `cadernos` | objeto `chave → { nome, caminho, … }`; chaves `contrato`, `criativo`, `especificacao`, `marcenaria`, `projeto`, `apresentacao` | os anexos fixos da obra (o contrato só o administrador vê) |
| `arquivos` | `arquivos` | lista de `{ id, titulo, fase, nome, caminho, … }` | anexos avulsos (Arquivos da obra); guardava `{}` em obra antiga |
| `aprovacoes` | `aprovacoes` | lista (na tela, um `Set`) de chaves de linha | linhas do depara aprovadas à mão |
| `escopos` | `escopos` | lista | escopos da obra (formato definido na tela de escopos — suposição) |
| `etapas_concluidas` | `etapasConcluidas` | objeto `idDaEtapa → { por, em }` | etapas da Jornada concluídas, com quem e quando |
| `depara_aprovado` | `deparaAprovado` | booleano | depara Contrato × Planilha concluído |
| `executivo_liberado_direto` | `executivoLiberadoDireto` | booleano | obra sem Vendido começou direto pelo Executivo (o depara continua "não concluído") |
| `compras_liberadas` | `comprasLiberadas` | booleano | compras liberadas na obra |
| `cmv_liberado`, `cmv_liberado_em`, `cmv_liberado_por` | `cmvLiberado`… | número, data, e-mail | o teto de custo liberado |
| `cliente_assinou_em`, `cliente_assinatura_por`, `cliente_assinatura_arq`, `cliente_assinatura_obs` | `clienteAssinouEm`… | data, e-mail, objeto do arquivo, texto | aprovação assinada pelo cliente |
| `compra_sem_assinatura_por`, `compra_sem_assinatura_em`, `compra_sem_assinatura_just` | `compraSemAssinaturaPor`… | e-mail, data, texto | compra liberada sem a assinatura, com justificativa |
| `data_entrega` | `dataEntrega` | data | comanda o prazo de compra de todos os grupos |

`editando_por`, `editando_desde`, `versao`, `atualizado_por` e `atualizado_em` são de controle: não
vão na gravação (quem grava é o login, no banco) e não sobem a versão.

## Riscos conhecidos

| Gravidade | Risco | Cenário | Onde |
|---|---|---|---|
| média | Reaplicar `patch-obra.sql` recria `aplicar_patch_obra(text, jsonb)` ao lado da de 3 argumentos. | A de 2 grava sem conferir versão (só a trava viva de outra pessoa barra), sem `search_path` fixo, e fica disponível a qualquer logado pelo PostgREST; chamada com 2 argumentos vira ambígua. O `salvar-obra.sql` apaga a de 2 — só se rodar de novo depois. | `patch-obra.sql:34`, `:176`; `salvar-obra.sql:253` |
| média | Reaplicar scripts do bloco 3 volta funções e policies à versão antiga: `admin_do_time()` com `search_path = public` (`compradores.sql`, `contrato-restrito.sql`, `mao-de-obra-propria.sql`, `admin-master.sql`), `registrar_acesso`/`definir_foto` idem, policies do Storage de `arquivos.sql`/`contrato-restrito.sql` (arquivos de todas as obras abertos a qualquer logado) e de `catalogo.sql` (leitura anônima), `obra-versao.sql` recria a leitura `using (true)` do histórico. | Alguém roda `arquivos.sql` para consertar o balde e reabre os arquivos de todas as obras até rodar os blocos 5 e 6 de novo. | `supabase/README.md` ("Reaplicar um script dos blocos 3 a 5…") |
| baixa | `perfis.sql` e `admin-master.sql` recriam a restrição de perfil sem `taylor` e `canal`. | Reaplicados com alguém nesses perfis, falham; sem ninguém, o banco volta a recusar os dois perfis. | `perfis.sql:12-14`, `admin-master.sql:16-18` |
| baixa | `obra_comentario` é lido por qualquer pessoa com perfil, de qualquer obra. | Um GC que chame o PostgREST direto lê as observações de obras que não enxerga (a API corta por obra). | `rls-reforco.sql:366-368` |
| baixa | `obra_dados`, `aditivo`, `apresentacao`, `obra_comentario` e `sienge_solicitacao` não têm chave estrangeira para `obra`. | Linha órfã quando uma obra sai da tabela `obra` (hoje só pelo SQL Editor). Nas duas primeiras é deliberado para o histórico. | scripts de cada tabela |
| baixa | `registrar_acesso` e `definir_foto` não têm teste pgTAP. | Uma regressão nelas (ex. gravar na linha de outra pessoa) não seria pega pelos testes de banco. | `supabase/tests/` |
| baixa | Os testes pgTAP não aplicam `sienge-obra-coordenadas.sql`. | Mudança nesse script não é exercitada no CI. | `supabase/tests/rodar.sh` |
