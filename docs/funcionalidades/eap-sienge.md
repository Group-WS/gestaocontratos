# EAP Sienge

**Módulo:** EAP Sienge (id `eap`, menu **Referência → EAP Sienge**, endereço `/eap`) · **Arquétipos de
tela:** configurações (cadastro de referência: importação com prévia, mapa verba → item, árvore) ·
**Onde fica:** menu lateral **EAP Sienge**. O mapa também é editável dentro da obra, no envio da
solicitação de compra ao Sienge (Compras de Produtos → etapa Sienge).

> Os números de linha citados são do commit `468c554` (branch `docs/documentacao-sistema`). As decisões
> de fundo estão no [ADR-002 — A EAP do Sienge como cadastro versionado](../ADR-002-eap-sienge.md).

## Objetivo

Toda solicitação de compra enviada ao Sienge precisa dizer **onde** o produto é apropriado no orçamento:
um item do orçamento (`costEstimationItemReference`, ex. `04.001.001.001`) e uma unidade construtiva. A
planilha da obra usa outra estrutura — a **EAP da casa**, as 35 verbas de `eap_grupo` ("20
Climatização / Exaustão"). Este módulo guarda a **EAP do Sienge** (árvore de 4 níveis importada do
Relatório de Orçamento) e o **mapa** que liga cada verba da casa a uma folha dela. É o mapa que faz a
solicitação sair sem ninguém digitar código (ADR-002, decisões 1 e 3).

Não confundir com a EAP da casa, lida pela mesma rota (`GET /api/eap/grupos`, `web/src/lib/eap.js`) e
usada na planilha, no depara e no Catálogo.

## Quem usa

| Perfil | O que pode | Onde é conferido |
|---|---|---|
| Admin master, Administrador, Geral, GC | ver, importar versão nova, tornar padrão, ligar/desligar verba (aqui e no envio da solicitação) | a rota só exige ser membro (`web/api/_lib/rotas/eap.js:80`); quem barra a escrita é o RLS "escrevo referencia" (`supabase/rls-perfis-complemento.sql:92-96`) |
| Admin master, Administrador | além do acima: ver o painel **"Quem mexeu"** e **excluir versão** (nunca a padrão) | `exigirAdministrador` (`web/api/_lib/auth.js`) e o RLS de `sienge_eap_evento` |
| Taylor Made | vê a tela e os botões; toda gravação é recusada pelo banco | RLS (a tela não esconde os botões) |
| Mehoo, Canal de compra | não veem o módulo | tela (`web/src/lib/pessoas.js:253`, `:262`) |

O GC edita um cadastro **global**: a EAP e o mapa valem para todas as obras (ver Riscos).

## Fluxo

1. **Abrir o módulo** (`EapSiengeView`, `web/src/App.jsx:20228`): lista as versões (mais nova primeiro) e
   abre a **padrão** — ou a mais recente, se nenhuma for padrão. Carrega os itens da árvore e o mapa
   dessa versão (`carregarEap`, `web/src/lib/eapApropriacao.js:39`).
2. **Importar orçamento** (`aoEscolher`, `App.jsx:20289`): Excel do "Relatório de Orçamento" da obra
   modelo, lido no navegador (`parseEapSienge`, `web/src/lib/eapSienge.js:58`). Do cabeçalho saem a
   unidade construtiva ("9 - EAP INICIAL - TKWS INTERIORES"), a obra, a versão do orçamento e a data base;
   das linhas, os códigos `nn`, `nn.nnn`, `nn.nnn.nnn`, `nn.nnn.nnn.nnn` com descrição e unidade. Só o
   nível 4 é **folha** (apropriável).
3. **Prévia obrigatória**: "Confira antes de gravar — nada foi gravado ainda", com unidade construtiva,
   versão, número de itens e de folhas, e avisos (sem unidade construtiva, nenhuma folha, código repetido,
   folha sem o grupo de nível 3). **Gravar como versão nova** só habilita com unidade construtiva e ao
   menos uma folha.
4. **Gravar** (`confirmarImportacao`, `App.jsx:20306` → `importarEap`, `eapApropriacao.js:61`): cria a
   linha da versão (`POST /api/eap/versoes`), manda os itens em blocos de 500
   (`POST /api/eap/versoes/:id/itens`) e **herda o mapa** da versão que estava aberta para os códigos que
   continuam existindo (`POST /api/eap/versoes/:id/herdar`). As verbas cujo código sumiu voltam como
   órfãs e a tela lista "verba → código" para refazer. A versão anterior continua guardada.
   A versão nova **não vira padrão sozinha**: a tela passa a mostrá-la, com o botão **Tornar padrão**.
5. **Tornar padrão** (`tornarPadrao`, `App.jsx:20334`): desmarca a padrão atual e marca esta
   (`PUT /api/eap/versoes/:id/padrao`). É a padrão que a solicitação de compra usa.
6. **Ligar verbas** (tabela "Verbas da casa → item do orçamento do Sienge"): para cada verba da EAP da
   casa, escolher uma folha na lista (`ligar`, `App.jsx:20323` → `PUT /api/eap/mapa`); vazio desliga a
   verba. Sem ligação, a tela sugere uma folha por semelhança de nome, com empate indo para a folha
   **[MAT]** (`sugerirFolha`, `eapSienge.js:139`); a sugestão só vira ligação com o clique da pessoa.
   Se o banco recusar, a tela volta ao estado anterior e mostra o erro.
7. **Consultar a árvore** ("A EAP como o Sienge mostra"): nível 1 → nível 2 → folhas (o nível 3 fica no
   banco, mas não vira linha), com busca por código ou descrição e selo "mão de obra" nas folhas [MO]
   (`arvoreDaEap`, `App.jsx:20212`; `ehMaterial`, `eapSienge.js:42`).
8. **No envio da solicitação** (obra → Compras de Produtos → etapa Sienge): a tela carrega a versão
   padrão e o mapa (`App.jsx:12771-12792`). Item de verba sem ligação é **bloqueado** com o motivo "a
   verba N não está ligada a um item do orçamento — configure em EAP Sienge"
   (`montarSolicitacaoSienge`, `web/src/lib/siengeSolicitacao.js:71-72`). Na janela do envio, trocar a
   folha de uma verba **grava no cadastro** (`trocarFolha`, `App.jsx:14360`; aviso "Trocar aqui grava no
   cadastro (EAP Sienge)", `App.jsx:14716`). A unidade construtiva do envio vem da obra, não da versão da
   EAP (`App.jsx:14120-14124`).

## Telas

| Tela / bloco | Arquétipo | Rota ou aba | Componente |
|---|---|---|---|
| Cartão "Relatório de orçamento" (importar) | formulário de envio de arquivo | `/eap` | `EapSiengeView` (`App.jsx:20228`) |
| Prévia da importação | detalhe de confirmação | `/eap` | `EapSiengeView` |
| Verbas da casa → item do orçamento (seletor de versão, "Tornar padrão") | configurações (tabela editável) | `/eap` | `EapSiengeView` |
| A EAP como o Sienge mostra (árvore com busca) | detalhe (árvore) | `/eap` | `EapSiengeView`, `arvoreDaEap` |
| Quem mexeu (registro; só administrador) | configurações (tabela de leitura) | `/eap` | `RegistroDoEap` |
| Apropriação no orçamento, na janela do envio | formulário | obra, Compras de Produtos → Sienge | `ModalSolicitarSienge` (`App.jsx:14114`) |

## Estados e mensagens

- **Carregando:** três esqueletos de linha.
- **Vazio:** "Nenhuma EAP cadastrada ainda — importe o relatório de orçamento acima."
- **Selo** "N sem ligação" no título do mapa e "sem ligação" em cada verba sem folha; na lista, a opção
  vazia diz "— sem ligação (bloqueia o envio) —".
- **Prévia:** avisos em amarelo (unidade construtiva ausente, nenhuma folha, código repetido, folha sem
  grupo); "Unidade construtiva: não encontrada".
- **Importação concluída:** "EAP importada e o mapa das verbas foi herdado inteiro." ou "EAP importada. N
  verbas perderam a ligação porque o código não existe nesta versão: 20 → 04.001.001.001, … Refaça
  abaixo."
- **Registro:** "Nada registrado ainda — o registro começa no próximo gesto."; sem o SQL rodado, aviso
  amarelo "O registro ainda não existe no banco — falta rodar `supabase/sienge-eap-evento.sql`".
- **Excluir versão:** dois cliques ("Excluir versão" → "Confirmar exclusão"); a padrão não mostra o
  botão, e o servidor recusa com "Esta é a versão padrão — … Torne outra padrão antes de excluir."
- **Erros:** "A planilha não traz a unidade construtiva — sem ela não dá pra apropriar."; "A planilha não
  tem item apropriável (nível 4)."; recusas do banco em aviso vermelho.
- **Nas Compras:** "Nenhuma EAP do Sienge cadastrada — vá em EAP Sienge (menu lateral) e importe o
  relatório de orçamento…", "Carregando a EAP do Sienge…", "Não deu pra ler a EAP do Sienge: …"
  (`App.jsx:13946-13948`).

## Dados

Tabelas em `supabase/sienge_eap.sql`:

| Tabela | Campos | Significado |
|---|---|---|
| `sienge_eap_versao` | `id`, `nome`, `unidade_id`, `obra_modelo`, `versao_orcamento`, `data_base`, `padrao`, `importado_por` (do login), `importado_em` | uma importação; **uma só padrão** (índice único parcial, `sienge_eap.sql:40-41`) |
| `sienge_eap_item` | `versao_id`, `codigo`, `descricao`, `nivel` (1–4), `unidade`, `folha` | a árvore; chave `(versao_id, codigo)` |
| `sienge_eap_mapa` | `versao_id`, `verba_num`, `codigo`, `definido_por` (do login), `definido_em` | verba da casa → folha; chave `(versao_id, verba_num)`; FK composta impede apontar para código de outra versão (`sienge_eap.sql:64-73`) |

Registro em `supabase/sienge-eap-evento.sql` (23/09/2026):

| Tabela | Campos | Significado |
|---|---|---|
| `sienge_eap_evento` | `acao` (`importou`, `tornou_padrao`, `ligou`, `trocou`, `desligou`, `excluiu`), `versao_id`, `versao_nome`, `verba_num`, `codigo`, `codigo_anterior`, `obra_codigo`, `detalhe` (jsonb), `autor` (do login), `criado_em` | **quem mexeu**; só cresce (sem policy de update nem de delete); **só administrador lê** |

**Sem FK para a versão, de propósito:** o registro precisa sobreviver à exclusão da versão — é
justamente o caso em que ele é a única memória do que existia. Por isso a linha guarda também o
**nome** da versão, congelado, e a exclusão é gravada **antes** do `delete`.

**Seed:** `supabase/sienge_eap_seed.sql`, gerado por `web/scripts/gerar-seed-eap.mjs` com o mesmo parser
da tela, planta a versão "EAP INICIAL - TKWS INTERIORES" (unidade construtiva 9, 127 itens, 53 folhas)
como **padrão** e o mapa inicial; não roda de novo se a versão já existe. Três verbas ficaram de fora de
propósito (02, 13 e 29), por ambiguidade (ADR-002, decisão 5).

## APIs

| Método | Rota | Autorização exigida no servidor | Arquivo:linha | O que faz |
|---|---|---|---|---|
| GET | `/api/eap/grupos` | login + membro; RLS | `web/api/_lib/rotas/eap.js:89` | a EAP **da casa** (verbas ativas, com apelidos) |
| GET | `/api/eap/versoes` | login + membro; RLS | `eap.js:101` | versões, da mais nova para a mais velha |
| GET | `/api/eap/versoes/:id` | login + membro; RLS | `eap.js:111` | itens e mapa de uma versão |
| POST | `/api/eap/versoes` | login + membro; RLS "escrevo referencia" | `eap.js:134` | cria a linha da versão (`importado_por` do login) |
| POST | `/api/eap/versoes/:id/itens` | idem | `eap.js:155` | insere um bloco da árvore (até 500) |
| POST | `/api/eap/versoes/:id/herdar` | idem | `eap.js:185` | copia o mapa da versão indicada para as folhas que existem; devolve os órfãos |
| PUT | `/api/eap/versoes/:id/padrao` | idem | `eap.js:231` | desmarca a padrão atual e marca esta (dois comandos) |
| PUT | `/api/eap/mapa` | idem | `eap.js:323` | liga (upsert) ou desliga (delete) uma verba; `obraCodigo` opcional diz de onde veio o gesto |
| POST | `/api/eap/versoes/:id/registro` | idem | `eap.js:371` | fecha o registro da importação numa linha (itens, folhas, herdadas, órfãs) |
| DELETE | `/api/eap/versoes/:id` | login + membro + **administrador**; RLS | `eap.js:405` | exclui uma versão — **nunca a padrão** (409); registra antes de apagar |
| GET | `/api/eap/eventos` | login + membro + **administrador**; RLS | `eap.js:446` | o registro, do mais novo para o mais antigo (100) |

As linhas das rotas de padrão e do mapa mudaram com o registro: `PUT .../padrao` está em
`eap.js:303`.

### Quem mexeu (auditoria)

Até 23/09/2026 o módulo guardava só o **estado de hoje**: trocar a folha de uma verba apagava o autor
anterior, desligar a verba apagava a linha inteira, e **Tornar padrão** — que decide a EAP com que toda
solicitação de compra sai — não deixava carimbo nenhum.

Agora cada gesto vira uma linha em `sienge_eap_evento`, e o painel **"Quem mexeu"**, no fim da tela,
mostra as últimas. Três decisões:

- **Só administrador lê.** O GC edita o mapa e não vê o registro (o painel nem aparece para ele). A
  barreira de verdade é o RLS; a rota responde 403 em vez de lista vazia.
- **O gesto nunca cai por causa do registro.** A gravação principal já aconteceu; se registrar falhar,
  a resposta volta com `registro: "falhou"` e o servidor loga — não vira erro na cara de quem clicou.
- **A importação é uma linha só**, com os números (itens, apropriáveis, verbas herdadas e as órfãs
  nomeadas). Uma linha por verba herdada afogaria o painel.

O mesmo mapa é editado de dentro da obra (Compras de Produtos → etapa Sienge); de lá o evento leva o
`obra_codigo`, e o painel mostra "na obra 2195".

**Excluir versão** nasceu junto: não existia antes. Só administrador, nunca a padrão — é com ela que as
solicitações saem —, em dois cliques na própria linha (armar e confirmar). Os itens e o mapa vão junto
pelo `on delete cascade`; o registro fica.

## Integrações

- **Sienge**: a EAP entra por arquivo (Relatório de Orçamento em Excel); a apropriação sai na solicitação
  de compra enviada à API do Sienge (ADR-003). Esta tela não chama o Sienge.

## Regras de negócio usadas

- [RN-082](../regras-de-negocio/RN-082-eap-importacao-cria-versao.md) — Importar a EAP do Sienge cria uma versão nova e nada é sobrescrito; o mapa da versão anterior é herdado pelos códigos que continuam existindo.
- [RN-083](../regras-de-negocio/RN-083-eap-uma-versao-padrao.md) — Existe uma única versão padrão da EAP por vez, e é ela que a solicitação de compra usa.
- [RN-084](../regras-de-negocio/RN-084-eap-so-folha-apropria.md) — Só o item de nível 4 (folha) aceita apropriação, e a verba só aponta para folha da mesma versão.
- [RN-085](../regras-de-negocio/RN-085-eap-mapa-confirmado-pela-pessoa.md) — A ligação verba → folha é decisão de uma pessoa; a sugestão por nome (empate para [MAT]) nunca liga sozinha.
- [RN-053](../regras-de-negocio/RN-053-item-elegivel-para-o-sienge.md) — Item de verba sem folha ligada não é enviado ao Sienge; parar é melhor que apropriar errado.

## Riscos conhecidos

| Gravidade | Risco | Cenário | Onde no código |
|---|---|---|---|
| média | "Tornar padrão" em dois comandos, sem transação | O primeiro comando desmarca a padrão e o segundo falha: fica **nenhuma** padrão, e a solicitação de compra passa a usar em silêncio a versão mais recente (`versoes.find(padrao) \|\| versoes[0]`), que pode ser uma importação incompleta | `eap.js:231-242`; `App.jsx:12776-12777` |
| média | Importação em várias chamadas, sem transação | Versão criada, e a gravação dos itens ou a herança do mapa falha no meio: a versão fica na lista com árvore parcial e mapa vazio ou parcial, e pode ser escolhida como padrão | `importarEap` (`eapApropriacao.js:61-89`); `eap.js:134-221` |
| média | GC altera um cadastro global | Qualquer GC importa versão, troca a padrão ou religa verbas — inclusive pela janela de envio da obra dele — e a apropriação muda para todas as obras; só fica o `definido_por` da última ligação, sem histórico | `eap.js:245-260`; `trocarFolha` (`App.jsx:14360`); RLS `rls-perfis-complemento.sql:92-96` |
| baixa | Escrita autorizada só pelo RLS | As rotas de gravação exigem só ser membro; se a policy voltar a ser `using (true)` (o `sienge_eap.sql` ainda a cria, `:79-89`), Taylor Made passa a gravar. É preciso rodar `rls-perfis-complemento.sql` depois | `eap.js:80` |
| baixa | Versões nunca são apagadas | O cadastro acumula versões (custo aceito no ADR-002, decisão 2) | — |

## Fora do escopo

- Ler o orçamento da obra ao vivo pela API do Sienge (descartado no ADR-002).
- Derivar o código do Sienge pelo número da verba (descartado no ADR-002).
- O envio da solicitação em si, idempotência e log: ADR-003 e a tela de Compras de Produtos.
- A EAP da casa (`eap_grupo`): cadastrada por SQL (`supabase/eap.sql`), sem tela de edição.

## Código

- Tela: `web/src/App.jsx` (`EapSiengeView`, `arvoreDaEap`; uso nas Compras e em `ModalSolicitarSienge`).
- Modelo puro: `web/src/lib/eapSienge.js` (leitura do relatório, folhas, sugestão, [MAT]/[MO]).
- Dados: `web/src/lib/eapApropriacao.js`, `web/src/lib/eap.js` (EAP da casa), `web/api/_lib/rotas/eap.js`.
- Envio: `web/src/lib/siengeSolicitacao.js` (`montarSolicitacaoSienge`).
- Banco: `supabase/sienge_eap.sql`, `supabase/sienge_eap_seed.sql`, políticas em
  `supabase/rls-perfis-complemento.sql`; gerador do seed `web/scripts/gerar-seed-eap.mjs`.
- Decisão: `docs/ADR-002-eap-sienge.md`.
- Testes: `web/src/__testes__/eap-sienge.test.mjs`, `web/api/_lib/__testes__/eap-rotas.test.cjs`,
  `web/src/__testes__/sienge-solicitacao.test.mjs`, `supabase/tests/06-referencia-completa.sql`.
