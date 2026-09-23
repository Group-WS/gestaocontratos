# Aditivos e Apresentação de especificações

**Módulo:** Aditivos (id `aditivos`, menu **Operação → Aditivos**, endereço `/aditivos`) e o editor da
Apresentação de especificações (sem módulo próprio: abre por cima da tela, a partir do Catálogo ou da
obra) · **Arquétipos de tela:** listagem (lista de aditivos), formulário/detalhe (editor do aditivo e
editor da apresentação) · **Onde fica:** menu lateral **Aditivos**; a Apresentação pelo botão
**Apresentação de especificações** no Catálogo TKWS e nas abas **Executivo** e **Conf. Executivo** da obra.

> Os números de linha citados são do commit `468c554` (branch `docs/documentacao-sistema`).

## Objetivo

**Aditivo** é o documento de contrato que muda o escopo de uma obra depois de vendida: o que sai
(supressão), o que entra (adição) e o saldo entre os dois. O módulo monta o documento que vai para o
cliente (PDF), a planilha interna (Excel, com custo e margem), acompanha a decisão do cliente e, quando o
aditivo é **aprovado**, leva o dinheiro dele para o orçamento vigente, o teto do CMV, o Plano de Compras,
as Compras e o Dashboard.

**Apresentação de especificações** é o caderno que a casa mostra ao cliente: uma capa com os dados do
projeto e um slide por ambiente, com o render do ambiente e os produtos do Catálogo. Sai em PDF (vai para
Arquivos da obra) e em .pptx editável, em português ou inglês, com revisões numeradas (00, 01…).

Os dois documentos têm a mesma garantia de gravação: o que a pessoa monta chega ao banco — ou a tela diz
que não chegou e o que fazer — e duas pessoas no mesmo documento não se apagam em silêncio. É a mesma
garantia da [gravação da obra](gravacao-da-obra.md), com uma diferença: aqui **não há trava**. Os dois
editores gravam sozinhos, e a versão faz o conflito aparecer em segundos — na primeira gravação de quem
chegou depois, e não no fim do trabalho.

## Quem usa

| Perfil | Aditivos | Apresentação | Onde é conferido |
|---|---|---|---|
| Admin master, Administrador | vê, cria, edita, muda status e **exclui qualquer aditivo** das obras que enxerga | vê, cria revisão, edita, gera PDF/PPTX | tela (`souAdmin`, `App.jsx:21597`), API (`exigirEdicaoDeObra`), RLS (`rls-perfis.sql:124-139`, `rls-reforco.sql:194-230`) |
| Geral | vê, cria, edita, muda status; exclui só o que **ele criou** | igual ao administrador | idem |
| GC | o mesmo que Geral, **só nas obras dele** (e nas sem GC) | idem, só nas obras dele | API `podeAcessarObra` (`web/api/_lib/auth.js:150`) e RLS `minhas_obras()` |
| Taylor Made | o módulo aparece no menu, mas a lista vem **vazia**: a policy de leitura do aditivo só inclui master, admin, geral e gc (`rls-perfis.sql:124-126`) | abre e vê as revisões das obras dele; qualquer gravação é recusada pela API (`exigirEdicaoDeObra`) | RLS e API — a tela não esconde os botões |
| Mehoo, Canal de compra | não veem o módulo (`web/src/lib/pessoas.js:253`, `:262`) | não abrem obra nem o Catálogo | tela (`podeVerModulo`) e RLS |

Não existe papel que **aprove** aditivo: qualquer perfil que edita a obra muda o status (ver Riscos).

## Fluxo

### Aditivo

1. **Abrir o módulo.** A lista traz todos os aditivos que a pessoa enxerga, com o documento dentro
   (`GET /api/aditivos`, `web/api/_lib/rotas/aditivos.js:63`). O RLS recorta pelas obras e pelo perfil.
   O filtro de obras vazio quer dizer "todas".
2. **Escolher uma obra** no filtro (ou no próprio botão **Novo aditivo**, que pergunta a obra). Com uma obra
   escolhida, a tela carrega o Executivo dela (`carregarDadosObra`, `App.jsx:18674`) para a busca de
   itens de supressão, e mostra o número que o próximo aditivo terá.
3. **Novo aditivo.** A tela manda só a descrição e o documento vazio (`novoDocumento`,
   `web/src/lib/aditivoDoc.js:42`); o banco dá o número "obra/sequência" com trava por obra
   (`criar_aditivo`, `supabase/salvar-aditivo-apresentacao.sql:217`). O aditivo nasce **rascunho** e abre no editor.
4. **Editar.** O editor (`EditorAditivo`, `App.jsx:18118`) **relê o aditivo do banco por id** ao abrir
   (a lista pode estar aberta há meia hora). A pessoa preenche cabeçalho (cliente, nº da proposta, data),
   grupos de **Supressão** e de **Adição** (cada grupo tem verba da EAP — escolhida ou adivinhada pelo
   nome — e itens com descrição, ambiente, quantidade, unidade, valor de venda, custo interno,
   especificação de compra e alocação MAT/MO/AMBOS), condições de pagamento e observação interna.
   Na supressão dá para puxar o item direto do Executivo da obra (preenche descrição, valor unitário e
   alocação). A pré-visualização do documento atualiza ao lado.
5. **Gravação automática.** Cada alteração entra na **fila de gravação** do documento: sai 1,2 s depois da
   última alteração, uma por vez, sempre com o estado mais recente da tela (`filaDoAditivo`,
   `App.jsx:18148`). A tela manda os totais já calculados (`totaisDoDocumento`,
   `aditivoDoc.js:92`); `salvar_aditivo` só grava se a versão for a que a tela leu.
6. **Status.** Na lista (sem abrir o documento, `App.jsx:18620`) ou no editor (`App.jsx:18328`) a pessoa
   escolhe **Rascunho → Aguardando cliente → Aprovado / Reprovado**. Não há ordem obrigatória nem papel
   exigido. A partir de **Aprovado**, o aditivo passa a contar no dinheiro da obra (ver "Efeito do aditivo
   aprovado").
7. **Pipefy.** Aprovado sem a "Solicitação de contrato" no Pipefy vira pendência (na linha, no Dashboard
   da obra e no Início). O botão abre o formulário público do Pipefy com "Aditivo" marcado e o valor
   preenchido (`linkPipefy`, `aditivoDoc.js:388`); a pessoa marca "enviei", que grava `doc.pipefy`
   (`{ em, por }`). O app não envia nada sozinho (o formulário tem captcha e campos que o app não sabe).
8. **PDF do cliente:** impressão do navegador (`imprimir`, `App.jsx:18248`), com o título da aba trocado
   para o nome do arquivo ("2405-3 Aditivo - Obra").
   **Excel interno:** `planilhaDoAditivo` (`aditivoDoc.js:208`) monta duas folhas (itens com custo,
   margem, verba e o que entra no Plano de Compras; e resumo), baixadas por `baixarExcel`
   (`App.jsx:18265`).
9. **Sair do editor** grava o que falta antes; se a gravação não passar, a tela pergunta antes de
   descartar. Fechar ou recarregar a aba com trabalho por gravar faz o navegador perguntar.
10. **Excluir** (lista): o botão fica desabilitado, com a dica, para quem não é o criador nem
    administrador (`podeExcluirAditivo`, `App.jsx:3173`); confirma "não pode ser desfeito"; o banco
    decide de novo pela policy e guarda uma cópia do aditivo apagado em `aditivo_versao`.

### Apresentação de especificações

1. **Abrir**: no Catálogo (botão **Apresentação de especificações**, `web/src/Catalogo.jsx:169-171`) ou
   na obra, nas abas Executivo e Conf. Executivo, para quem vê o módulo Catálogo (`App.jsx:25736`). Da
   obra, ela já chega com a obra escolhida e os produtos do catálogo carregados (`abrirApresentacao`,
   `App.jsx:22164`).
2. **Escolher a obra.** A tela lista as revisões da obra (sem capa e slides) e **carrega do banco, por
   id, a mais recente**; se não houver nenhuma, começa uma nova (capa preenchida com squad, cliente,
   código, data e endereço da obra, e um slide vazio) (`Apresentacao.jsx:92-121`). Garante também que a
   obra tem linha de dados (`garantirObraDados`, `Apresentacao.jsx:115`).
3. **Montar**: páginas fixas (abertura, dados/capa, fechamento) e um slide por ambiente; em cada slide, o
   render do ambiente (subido pela API para o balde da obra) e os produtos do catálogo arrastados como
   blocos de imagem ou de lista. O idioma (PT/EN) só muda a saída.
4. **Gravação automática**: a mesma fila da obra, com a versão conferida (`Apresentacao.jsx:151`). A
   primeira gravação de uma obra sem apresentação **cria** a revisão (`criar_apresentacao`).
5. **Nova revisão**: cria a próxima (00 → 01 → 02, `proximaRev`, `apresentacaoModelo.js:335`) como
   **cópia** da aberta, depois de gravar a atual; a anterior continua guardada (`novaRevisao`,
   `Apresentacao.jsx:373`). Revisão repetida é recusada pelo banco com motivo.
6. **Gerar PDF** (`gerar`, `Apresentacao.jsx:274`): só com todo ambiente com nome e imagem
   (`conferir`, `apresentacaoModelo.js:315`). Grava tudo antes, monta o PDF no navegador
   (`gerarPdf`, `web/src/lib/apresentacaoPdf.js:107`), sobe para `obra-arquivos` (chave
   `apresentacao`), acrescenta o arquivo à lista de Arquivos da obra (fase "cliente") pela gravação
   protegida da obra (`guardarEmArquivosDaObra` → `alterarObra`, `Apresentacao.jsx:633`), marca a
   revisão como gerada (`arquivo`, `gerado_em`) e baixa o arquivo.
7. **Baixar .pptx** (`gerarPowerPoint`, `Apresentacao.jsx:328`): mesma conferência; gera o PowerPoint
   editável (`gerarPptx`, `web/src/lib/apresentacaoPptx.js:47`), guarda em Arquivos da obra como fase
   "outros" e **não** marca a revisão como gerada.
8. **Fechar** grava o que falta; se não der, pergunta antes de descartar.

## Telas

| Tela / bloco | Arquétipo | Rota ou aba | Componente |
|---|---|---|---|
| Lista de aditivos (filtro de obras, tabela com nº, obra, descrição, supressão, adição, saldo, status, ações) | listagem | `/aditivos` | `AditivosView` (`App.jsx:18638`), `LinhaAditivo` (`App.jsx:18561`) |
| Editor do aditivo (cabeçalho, supressão, adição, fechamento, pré-visualização) | formulário + detalhe | `/aditivos` (aditivo aberto) | `EditorAditivo` (`App.jsx:18118`), `GrupoAditivo` (`App.jsx:17900`), `DocumentoAditivo` (`App.jsx:17804`) |
| Aviso do Pipefy | aviso | lista e editor | `PipefyAditivo` (`App.jsx:18497`) |
| Editor da apresentação (tela cheia: barra de obra e idioma, páginas, palco do slide, abas Produtos/Capa/Revisões) | detalhe (editor) | sobreposto ao Catálogo ou à obra | `web/src/Apresentacao.jsx:63` |
| Botão da apresentação na obra | ação | abas Executivo / Conf. Executivo | `BotaoApresentacao` (`App.jsx:21309`) |

## Estados e mensagens

**Aditivos (lista):** carregando (esqueleto, "Carregando os aditivos"); vazio ("Nenhum aditivo ainda em
obra nenhuma." ou "Nenhum aditivo nesta seleção."); erro ao carregar/criar/excluir/gravar em aviso
vermelho ("Não consegui …"); excluir sem permissão: botão desabilitado e, se chamado, "O aditivo X só pode
ser excluído por quem o criou (…) ou por um administrador." — também devolvido pelo servidor (403,
`aditivos.js:128`); confirmação "Excluir o aditivo X? Isso não pode ser desfeito.".

**Editor do aditivo:** carregando; "Não consegui abrir este aditivo"; margem só aparece com algum custo
("parcial" quando falta custo em alguma linha) e o aviso "N linhas da adição entram no Plano de Compras
como 'a orçar' — falta o custo"; "Não consegui gerar o Excel" (a biblioteca vem por rede).

**Gravação (os dois editores)** — os mesmos estados da obra (`filaDeGravacao.js`), com os textos de
`web/src/lib/documentosDaObra.js:71`:

| Estado | O que a tela diz | Saída |
|---|---|---|
| pendente / salvando / salvo | "alterações por gravar…", "salvando…", "salvo" | — |
| erro (rede, servidor) | "não salvo — nova tentativa em N s" | tenta sozinha (2 s, 5 s… até 1 min) e **Tentar agora** |
| recusado | a mensagem do servidor | desfazer a alteração, ou **Tentar agora** |
| conflito (outra pessoa gravou) | quem alterou e quando, e que nada foi gravado por cima (409, `web/api/_lib/respostaDaFuncao.js:25`) | **Recarregar o aditivo / a apresentação**, sempre perguntando antes |
| SQL não rodado | "A gravação protegida destes documentos ainda não está no banco (falta rodar …)" (503) | a fila tenta de novo |

Nenhuma mensagem manda dar F5 antes de o dado estar gravado.

**Apresentação:** "Escolha a obra para começar"; "Gerar PDF" e "Baixar .pptx" desabilitados com a dica
"Todo ambiente precisa de nome e de imagem"; revisão repetida: "A revisão NN já existe nesta obra.";
tabela ausente: "Falta rodar supabase/apresentacao.sql"; PDF gerado com a obra em edição por outra pessoa:
"…mas Fulano está editando esta obra agora — não guardei em Arquivos da obra pra não gravar por cima";
obra sem linha de dados: "O PDF foi gerado, mas esta obra ainda não tem dados salvos…"; sucesso: "NOME.pdf
gerado e guardado em Arquivos da obra." e "Revisão NN criada. A MM continua guardada.".

## Dados

**Tabela `aditivo`** (`supabase/aditivos.sql`, `aditivo-aguardando.sql`, `salvar-aditivo-apresentacao.sql`):

| Campo | Significado |
|---|---|
| `obra_codigo`, `seq`, `numero` | obra (centro de custo), sequência dentro da obra e o número pronto ("2405/3"); `unique (obra_codigo, seq)` |
| `descricao` | do que se trata, em uma linha |
| `status` | `rascunho`, `aguardando`, `aprovado`, `reprovado` (check no banco) |
| `dados` (jsonb) | o documento inteiro: `cliente`, `proposta`, `data`, `cond`, `observacao` (interna), `pipefy` (`{ em, por }`), `supressao[]` e `adicao[]` — grupos `{ id, num, nome, verba, itens[] }`, itens `{ id, descricao, ambiente, qtd, unidade, valor, custo, espec, alocacao }` |
| `total_supressao`, `total_adicao` | totais calculados **na tela** e gravados como vieram |
| `criado_por`, `atualizado_por`, `criado_em`, `atualizado_em` | autoria carimbada pelo gatilho `aditivo_autoria` a partir do login (`rls-reforco.sql:210`) |
| `versao` | sobe sozinha a cada mudança de conteúdo (`conta_versao`) |

**Tabela `aditivo_versao`**: cópia da linha de antes a cada gravação inteira, de hora em hora nos UPDATE
avulsos e sempre no apagamento (`apagado = true`), com poda de 24 cópias por aditivo (apagamentos dos
últimos 30 dias ficam). Só leitura para a obra; ninguém escreve nela além do gatilho.

**Na obra**: o estado de compra das linhas de aditivo (canal, solicitado, comprado…) mora no mapa
`categorias[].comprasAditivo[<id do item>]` da verba, porque o item de aditivo não existe na planilha
(`atualizarCompraDeAditivo`, `App.jsx:22762`).

**Tabela `apresentacao`** (`supabase/apresentacao.sql`): `obra_codigo`, `rev` (única por obra),
`capa` (jsonb: squad, cliente, projeto, data, rev, local, título), `slides` (jsonb: ambiente, render
`{ imagem, x, y, w, h }`, blocos `{ produtoId, imagem, texto, textoEn, x, y, w, modo }`), `idioma`,
`arquivo` e `gerado_em` (o PDF que saiu), autoria pelo login (`apresentacao_autoria`) e `versao`.

## APIs

| Método | Rota | Autorização no servidor | Arquivo:linha | O que faz |
|---|---|---|---|---|
| GET | `/api/aditivos?obra=` | login + membro; recorte pelo RLS | `web/api/_lib/rotas/aditivos.js:63` | lista (todos ou de uma obra), com o documento |
| GET | `/api/obras/:codigo/aditivos/:id` | `exigirObra` | `aditivos.js:74` | um aditivo com a versão de agora |
| POST | `/api/obras/:codigo/aditivos` | `exigirEdicaoDeObra` | `aditivos.js:88` | cria (`criar_aditivo`) |
| POST | `/api/obras/:codigo/aditivos/:id/gravar` | `exigirEdicaoDeObra` | `aditivos.js:102` | grava com a versão lida (`salvar_aditivo`) |
| DELETE | `/api/obras/:codigo/aditivos/:id` | `exigirEdicaoDeObra` + policy de exclusão | `aditivos.js:121` | exclui (403 se o RLS recusou) |
| GET | `/api/obras/:codigo/apresentacoes` | `exigirObra` | `web/api/_lib/rotas/apresentacoes.js:80` | revisões da obra, sem capa e slides |
| GET | `/api/obras/:codigo/apresentacoes/:id` | `exigirObra` | `apresentacoes.js:91` | uma revisão inteira |
| POST | `/api/obras/:codigo/apresentacoes` | `exigirEdicaoDeObra` | `apresentacoes.js:103` | cria revisão (`criar_apresentacao`) |
| POST | `/api/obras/:codigo/apresentacoes/:id/gravar` | `exigirEdicaoDeObra` | `apresentacoes.js:118` | grava com a versão lida (`salvar_apresentacao`); também marca o PDF gerado |
| DELETE | `/api/obras/:codigo/apresentacoes/:id` | `exigirEdicaoDeObra` | `apresentacoes.js:133` | apaga uma revisão (a tela não usa hoje) |
| POST | `/api/obras/:codigo/ambientes` | `exigirEdicaoDeObra` | `apresentacoes.js:146` | sobe o render (JPEG/PNG/WebP, já reduzido) para `obra-arquivos/<obra>/ambientes/` |
| POST | `/api/obras/:codigo/ambientes/links` | `exigirObra` | `apresentacoes.js:169` | endereços para ver as imagens (assinados por 1 h; os antigos, do balde `catalogo`, públicos) |

Os corpos de aditivo e apresentação têm leitor próprio de até 4 MB (`LIMITE_DOCUMENTO_JSON`,
`web/api/_lib/validacao.js:185`); os campos são validados em `validacao.js:197-217` e de novo no banco
(`aditivo_campos_validos`, `apresentacao_campos_validos`).

## O que o banco decide

| Decisão | Onde |
|---|---|
| Só grava com a versão que a tela leu (`for update` na linha) | `salvar_aditivo`, `salvar_apresentacao` (`salvar-aditivo-apresentacao.sql:161`, `:259`) |
| O número do aditivo ("2405/3"), com trava por obra; número apagado não volta | `criar_aditivo` (`:217`) |
| Revisão repetida da apresentação | `criar_apresentacao` recusa com motivo (`:309`) |
| Quem criou e quem alterou | gatilhos de autoria: sai do login, nunca do corpo do pedido |
| Quem enxerga e quem escreve | RLS por obra e perfil (`rls-perfis.sql:119-139`, `rls-reforco.sql:194-205`, `rls-perfis-complemento.sql:56-73`) |
| Quem exclui aditivo | policy "aditivo: excluir (criador ou admin)" (`rls-perfis.sql:133`) |
| O histórico do aditivo | `aditivo_versao` (`:358-442`) |

## Efeito do aditivo aprovado no dinheiro da obra

Só o aditivo **aprovado** conta (`aditivoVale`, `App.jsx:2377`). Os aditivos chegam junto com a obra ao
abri-la (`App.jsx:22237`) e junto com o painel do Início (`App.jsx:21704`).

- **Por verba** (`aditivosPorVerba`, `App.jsx:2401`): cada grupo cai na verba escolhida no editor ou, sem
  escolha, na verba adivinhada pelo nome (`verbaDoGrupoAditivo`, `App.jsx:2387`). Adição e supressão ficam
  separadas; grupo aprovado sem verba aparece como "solto" (`aditivosSemVerba`, `App.jsx:2433`).
- **Itens no Plano de Compras e nas Compras** (`itensDeAditivo`, `App.jsx:2462`, e
  `categoriasComAditivos`, `App.jsx:2526`): só as linhas de **adição** viram item, dentro da verba do
  grupo, com código "AD 2405/3.1.2", pelo **custo** interno (não pelo preço de venda), repartido em
  material/mão de obra pela alocação (AMBOS divide ao meio); sem custo, entram "a orçar" (sem valor).
  Essas linhas são **derivadas** e nunca gravadas em `obra.categorias`; o estado de compra delas vem do
  mapa `comprasAditivo`, que nunca sobrescreve o que é do aditivo (descrição, custo, alocação…,
  `App.jsx:2544`). Usado no Plano de Compras (`ComparativoView`, `App.jsx:4236`), nas Compras
  (`ComprasView`, `App.jsx:12647`), nas estatísticas de compra e contratação (`obraComprasStats`,
  `obraContratosStats`, `App.jsx:350`, `:371`) e no resumo do Início (`resumoDaObra`, `App.jsx:2107`).
- **Resumo e saldo** (`resumoAditivos`, `App.jsx:2699`): o Dashboard da obra compara o custo com o
  **orçamento vigente** = vendido + saldo dos aprovados (`App.jsx:1210`) e lista a pendência do Pipefy
  (`App.jsx:1272`); o Executivo usa **teto = CMV + saldo** (`App.jsx:9425`).
- **Rascunho e Aguardando cliente** aparecem como "em aberto" no resumo, sem dinheiro.

## Integrações

- **Pipefy**: link para o formulário público "Solicitação de contrato" (`PIPEFY_FORM`,
  `aditivoDoc.js:383`), sem envio automático.
- **Storage**: imagens dos ambientes no balde privado `obra-arquivos/<codigo>/ambientes/` (antes no balde
  público `catalogo`, `ambientes/<obra>/`, que continuam abrindo); o navegador reduz a foto (lado maior de
  2000 px, JPEG) antes de mandar; PDF e PPTX da apresentação em `obra-arquivos` com a chave `apresentacao`.
- **Catálogo TKWS**: os blocos da apresentação saem dos produtos (foto, descrição do criativo, descrição
  em inglês) — ver [catalogo.md](catalogo.md).

## Regras de negócio usadas

- [RN-061](../regras-de-negocio/RN-061-so-aditivo-aprovado-conta.md) — Só o aditivo aprovado muda o dinheiro da obra (orçamento vigente, teto do CMV, Plano de Compras, Compras, Dashboard).
- [RN-060](../regras-de-negocio/RN-060-numero-do-aditivo.md) — O número do aditivo é centro de custo/sequência, dado pelo banco, e número de aditivo apagado não é reaproveitado.
- [RN-068](../regras-de-negocio/RN-068-exclusao-do-aditivo.md) — Só quem criou o aditivo, ou um administrador, pode excluí-lo; aditivo sem criador, só o administrador.
- [RN-064](../regras-de-negocio/RN-064-aditivo-entra-pelo-custo.md) — A linha de adição entra no Plano de Compras pelo custo interno; sem custo, entra "a orçar", sem valor.
- [RN-066](../regras-de-negocio/RN-066-supressao-nao-vira-compra.md) — A supressão reduz o valor da verba mas não vira linha de compra; grupo sem verba não entra no dinheiro e é avisado.
- [RN-065](../regras-de-negocio/RN-065-alocacao-do-item-de-aditivo.md) — O item de aditivo nasce material; a alocação escolhida decide a parcela de material e de mão de obra (AMBOS divide ao meio).
- [RN-062](../regras-de-negocio/RN-062-saldo-do-aditivo.md) — Totais somados em centavos com arredondamento por item; saldo = adição − supressão (positivo o cliente paga, negativo é crédito).
- [RN-063](../regras-de-negocio/RN-063-margem-do-aditivo.md) — A margem do aditivo é só da adição (venda − custo) e só existe quando há custo informado.
- [RN-067](../regras-de-negocio/RN-067-aditivo-aprovado-exige-pipefy.md) — Aditivo aprovado obriga abrir a Solicitação de contrato no Pipefy; fica pendente até alguém marcar que abriu.
- [RN-069](../regras-de-negocio/RN-069-revisao-da-apresentacao.md) — Cada revisão da apresentação é um documento próprio; a nova nasce como cópia e revisão repetida é recusada.
- [RN-070](../regras-de-negocio/RN-070-apresentacao-pronta-para-gerar.md) — A apresentação só sai (PDF ou PPTX) com todo ambiente com nome e imagem.

## Riscos conhecidos

| Gravidade | Risco | Cenário | Onde no código |
|---|---|---|---|
| alta | Status muda sem regra de transição e sem papel de aprovador | Qualquer perfil que edita a obra (GC incluído) marca "Aprovado" e o valor entra no orçamento, no CMV e no Plano de Compras; ou volta um aprovado para rascunho e os itens somem do Plano de Compras, inclusive os já comprados (o estado em `comprasAditivo` fica órfão) | `App.jsx:18620`, `App.jsx:18285`; `salvar_aditivo` aceita qualquer `status` (`salvar-aditivo-apresentacao.sql:195`); API `aditivos.js:102` só exige edição da obra |
| alta | Documento aprovado continua editável | Depois de aprovado (e enviado ao cliente), qualquer um altera itens, valores e custos, e o dinheiro das três telas muda sem novo aceite; o PDF já enviado deixa de bater com o banco | `EditorAditivo` sem modo leitura (`App.jsx:18118`); `salvar_aditivo` não olha o status |
| alta | Sem registro de quem aprovou e quando | Não há `aprovado_por`/`aprovado_em`; só `atualizado_por` (a última gravação, de qualquer campo) e as cópias de `aditivo_versao`, podadas em 24 | `supabase/aditivos.sql:11-40`, `salvar-aditivo-apresentacao.sql:422-432` |
| alta | O criador exclui aditivo aprovado | O GC que criou exclui o aditivo aprovado; o valor sai do orçamento, do CMV e do Plano de Compras sem reabrir nada e sem aviso nas telas da obra (fica só a cópia em `aditivo_versao`) | policy `rls-perfis.sql:133-139`; tela `App.jsx:3173`; rota `aditivos.js:121` |
| média | Totais gravados como a tela mandou | `total_supressao`/`total_adicao` vêm do navegador e o banco só confere o tipo; uma chamada direta à API grava totais que não batem com `dados` (as telas que somam por verba usam `dados`, o resumo do Dashboard usa os totais) | `aditivos.js:17-20`, `salvar-aditivo-apresentacao.sql:197-198`, `resumoAditivos` (`App.jsx:2699`) |
| média | Qualquer perfil de edição apaga uma revisão da apresentação | A rota de exclusão só exige edição da obra e o RLS "escrevo na minha obra" vale para `delete`; uma revisão já apresentada ao cliente (com PDF gerado) pode ser apagada sem histórico. A tela não oferece o botão, mas a rota está publicada | `apresentacoes.js:133`, `rls-perfis-complemento.sql:65-71` |
| média | Taylor Made vê o módulo, mas nunca vê aditivo | A policy de leitura exclui `taylor`: a lista vem vazia e o Dashboard das obras dela mostra o orçamento **sem** os aditivos aprovados, diferente do que o GC vê | `rls-perfis.sql:124-126` |
| média | Painel por canal / Mehoo ignoram itens de aditivo | Item de aditivo com canal Mehoo não aparece no painel do canal, porque ele lê `obra.categorias` sem os aditivos | `itensDoCanal` (`App.jsx:2632`) |
| baixa | Editores não escondem a edição de quem não edita | Taylor Made abre a apresentação e vê botões de gravar; a gravação volta recusada | `Apresentacao.jsx:63` (sem `podeEditar`) |
| baixa | Comentários desatualizados | `lib/aditivos.js:9` e `lib/apresentacao.js:16` citam a rota `documentosDaObra.js`, que foi dividida em `aditivos.js` e `apresentacoes.js` | — |

## Fora do escopo

- Trava de edição nestes dois documentos: a versão basta, porque a gravação é automática.
- Histórico da apresentação: as revisões (00, 01…) já fazem esse papel.
- Migrar as imagens antigas do balde do catálogo para o da obra: elas continuam abrindo de lá.
- Envio automático ao Pipefy.
- Assinatura do cliente no aditivo: o status é marcado à mão.

## Código

- Banco: `supabase/aditivos.sql`, `supabase/aditivo-aguardando.sql`, `supabase/aditivo-exclusao.sql`,
  `supabase/salvar-aditivo-apresentacao.sql` (versão, funções de gravação e criação, autoria da
  apresentação, `aditivo_versao`), `supabase/apresentacao.sql`, políticas em `supabase/rls-perfis.sql`,
  `supabase/rls-reforco.sql` e `supabase/rls-perfis-complemento.sql`.
- API: `web/api/_lib/rotas/aditivos.js`, `web/api/_lib/rotas/apresentacoes.js`,
  `web/api/_lib/respostaDaFuncao.js`, `web/api/_lib/validacao.js`.
- Tela: `web/src/lib/aditivoDoc.js` (modelo puro: totais, margem, planilha, Pipefy),
  `web/src/lib/aditivos.js` (API), `web/src/lib/documentosDaObra.js` (textos e resumo),
  `web/src/lib/apresentacao.js`, `apresentacaoModelo.js`, `apresentacaoIdioma.js`, `apresentacaoPdf.js`,
  `apresentacaoPptx.js`, `web/src/lib/imagem.js` (reduzir), `web/src/lib/imagensDaObra.js` (endereços),
  `web/src/lib/filaDeGravacao.js` (a fila, a mesma da obra), `web/src/App.jsx` (Aditivos e o efeito no
  orçamento), `web/src/Apresentacao.jsx`.
- Testes: `supabase/tests/04-aditivo.sql`, `supabase/tests/13-aditivo-apresentacao.sql`,
  `web/api/_lib/__testes__/documentos-da-obra.test.cjs`,
  `web/src/__testes__/documentos-protegidos.test.mjs`, `aditivos.test.mjs`, `aditivo-exclusao.test.mjs`,
  `aditivo-nas-compras.test.mjs`, `aditivo-orcamento.test.mjs`, `apresentacao.test.mjs`,
  `apresentacao-pptx.test.mjs` e, no navegador com duas sessões de verdade,
  `e2e/duas-sessoes-aditivo.spec.mjs`.
