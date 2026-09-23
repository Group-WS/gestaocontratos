# Conf. Executivo (conferência, conclusão e liberação para compra)

**Módulo:** Obras › Planejamento · **Arquétipos de tela:** listagem (planilha por verba com decisões na linha) + indicadores que filtram · **Onde fica:** obra › Planejamento › **Conf. Executivo** (`/obra/:codigo/conferencia`; o endereço antigo `/obra/:codigo/cliente` cai aqui)

> Linhas de código conferidas no commit `468c554` (branch `docs/documentacao-sistema`). Decisões de
> origem: `docs/ADR-005-conferencia-unificada.md` (18/09/2026) e, para a gravação item a item,
> `docs/ADR-004-editar-por-tela.md` (fatia 2).
>
> **[RN-002](../regras-de-negocio/RN-002-item-aprovado-no-executivo.md) publicada** (commit `a4f5918`, [ADR-006](../ADR-006-executivo-trava-item-aprovado.md)):
> o item aprovado para compra aqui fica travado no Executivo — ninguém o edita, remove ou substitui,
> nem o administrador — e a planilha inteira não se troca enquanto houver item aprovado. Esta tela não
> muda: é aqui que o administrador desfaz a aprovação quando o item precisa ser mexido, e a linha
> destrava no Executivo. O gatilho no banco (`supabase/rn-002-item-aprovado-no-executivo.sql`) ainda
> falta rodar em produção.

## Objetivo

A tela única de decisão do planejamento (ADR-005): mostra a **planilha do executivo inteira**, por
verba, comparada com o vendido, e nela duas decisões de pessoas diferentes:

- o executivo diz que **concluiu** a linha (`concluidoExecutivo`);
- o administrador **aprova para compra** (`liberadoCompra`) — só ele (RN-001).

Antes de aprovar, o item com **alerta técnico** (medida, compatibilidade, gás, elevador…) ou que
**entrou no executivo sem ter sido vendido** precisa receber o "conferi". Só o que está aprovado
para compra aparece na tela de Compras.

## Quem usa

| Perfil | O que pode | Onde é conferido |
|---|---|---|
| master, admin, geral, gc, com a edição habilitada | concluir / desfazer o concluído (linha, verba ou seleção); marcar e desmarcar "conferi" nos itens ainda não liberados | tela (`podeEditar`); servidor: editar a obra; banco: trava + versão. O banco **não** confere quem conclui ou confere |
| master e admin (ativos), com a edição habilitada | **aprovar para compra** (linha, "Liberar N" da verba, "Conferi os alertas · liberar N"), **desfazer** a aprovação de item ainda não comprado | tela (`podeLiberar = migracaoPendente \|\| podeLiberarCompra(eu)`, `web/src/App.jsx:21600`) **e banco** (gatilho da RN-001, `supabase/rn-001-liberacao-de-compra.sql`) |
| quem enxerga a obra | ver a planilha, os cartões e o que entrou/saiu/mudou | tela em modo leitura; RLS de leitura |
| todos, enquanto a migração de perfis não rodou (`migracaoPendente`) | a tela mostra os botões de aprovar para qualquer pessoa | só tela; o que o banco faz nesse estado depende de `meu_perfil()` (suposição: recusa quem não é admin) |

## Fluxo

1. A aba abre só com o CMV liberado (`deparaAprovado`); obra que começou o Executivo sem CMV
   (`executivoLiberadoDireto`) vê "Aguardando a liberação do CMV" (`web/src/App.jsx:25798`). A esteira
   não tranca esta aba pela etapa anterior (`ETAPAS_SEM_TRAVA_DE_ORDEM`, `web/src/App.jsx:11163`:
   Executivo e Conf. são feitos juntos, pedido de 16/09/2026).
2. A tela recebe a obra **com os itens dos aditivos aprovados** dentro das verbas
   (`obraComAditivos`, `web/src/App.jsx:22143`; derivado, nunca gravado).
3. **Cruzamento** vendido × executivo (`cruzamentoExecutivo`, `web/src/App.jsx:7630` →
   `conferirExecutivoObra`, `:6700`): junta a Vendido Planilha e a Planilha Executivo inteiras (todas
   as verbas, inclusive as fora da EAP), **sem os itens removidos** no Executivo (decisão de
   23/09/2026), e casa os itens por descrição. Cada linha ganha um estado
   (`linhaConfExecutivo`, `:7582`): conferido, entrou/saiu (só num dos lados) ou conferência técnica.
   Diferença de número deixou de ser pendência (16/09/2026): vira "conferido" com o motivo escrito.
4. **Lista de decisão** (`itensParaLiberar`, `web/src/App.jsx:11477`, com a mão de obra): para cada
   item da lista de trabalho `itens`, exceto trocados e removidos; a linha de título aparece como
   cabeçalho; a linha de mão de obra separada não aparece (o valor dela volta para o item pai). Cada
   linha traz:
   - `pendencia` (`pendenciaParaLiberar`, `:11393`): alerta **técnico** calculado da própria
     descrição (`alertaConferenciaTecnica`), ou **entrou** (a descrição está no conjunto dos que só
     existem no executivo);
   - `liberado` (`liberadoParaCompra`, `:11350`): tem carimbo `liberadoCompra` **ou** já anda na
     compra (canal, solicitado, comprado, avulso) **ou** é item de aditivo;
   - `pode` (`podeLiberarItem`, `:11427`): liberado, sem pendência, ou pendência já conferida
     (`alertaConferido`). Vale só o "conferi" dado aqui — a aprovação antiga de linha não conta
     (decisão de 17/09/2026).
5. **Cartões do alto** (cada um filtra a planilha): **Concluído executivo** (x/y), **Aprovado para
   compra** (x/y), **Falta conferir** (`precisaConferir`, `:7987`) e **Entrou, saiu ou mudou**
   (+entrou / −saiu / ~mudou; o "saiu" abre um painel próprio, porque o item não está na planilha).
   Chips: Todos · Falta concluir executivo · Falta aprovar p/ compra. Busca por insumo. A Visão geral
   da obra abre esta tela já filtrada em "Falta aprovar p/ compra".
6. **Planilha por verba** (`PlanilhaConferenciaView`, `web/src/App.jsx:8010`): código, produto (com
   especificação, fornecedor, ambiente e, quando há, a pendência com o botão **conferi**), quantidade,
   custo unitário, total (material + mão de obra), **Concluído executivo** e **Aprovado p/ compra**. A
   linha fica **laranja** enquanto a pendência não foi conferida.
7. **Conferir** (`conferirAlertaDoItem`, `web/src/App.jsx:23591`): grava `alertaConferido = { em, por }`
   no item, por patch. **Desmarcar** apaga. Só aparece enquanto o item não está liberado.
8. **Concluir executivo** (linha, verba "Concluir N" ou seleção "Concluir N", com confirmação):
   `concluirItensExecutivo` (`web/src/App.jsx:23506`) grava `concluidoExecutivo = { em, por }`, por
   patch. **desfazer** apaga. Item liberado conta como concluído mesmo sem carimbo (`estaConcluido`,
   `:8000`) — deduzido, sem inventar autor.
9. **Aprovar para compra** (só admin; linha, "Liberar N" da verba, ou "Conferi os alertas · liberar
   N" para os travados da verba, sempre com confirmação): `liberarItensParaCompra`
   (`web/src/App.jsx:23460`):
   - carimba `concluidoExecutivo` nos que ainda não tinham (aprovar conclui junto, regra de
     18/09/2026), sem reescrever quem já concluiu;
   - grava `liberadoCompra = { em, por }` item a item, por patch (`enfileirarEmVarios`, que manda
     código e descrição para o banco conferir que a posição ainda é o mesmo item);
   - o banco (gatilho `trg_obra_dados_rn_001`) recusa se quem grava não é admin/master ativo ou se o
     carimbo está em nome de outra pessoa; a recusa aparece como "recusado" na barra da obra (ver
     `gravacao-da-obra.md`).
   - **desfazer** (admin, item ainda não comprado) grava `liberadoCompra = null`.
10. **Concluir etapa**: só habilita com **Falta conferir = 0** (`bloqueioDaEtapa`,
    `web/src/App.jsx:11203`: "Falta conferir N produtos"); grava `etapasConcluidas.executivo_conferencia`.
    Divergência de número e "entrou ou saiu" não travam. Etapa já concluída continua concluída.
11. A esteira: **Plano de Compras** e **Compras de Produtos** perdem o cadeado assim que existe **um**
    item aprovado para compra (`temCompraAprovada`, `web/src/App.jsx:11220`, regra de 18/09/2026). O
    cadeado da esteira é só visual — a aba sempre abre.
12. **Apresentação de especificações** também fica no cabeçalho desta aba (ver `executivo.md`).

### O que saiu desta tela (a aprovação do cliente)

Em 18/09/2026 a aprovação do cliente saiu da tela e **deixou de barrar** a compra ("o cliente deixa
de barrar"): `pendenciaParaLiberar` não devolve mais pendência do tipo "cliente". O que ficou no
código, sem caminho na tela hoje:

- `registrarAssinaturaCliente` / `removerAssinaturaCliente` (`web/src/App.jsx:23659`, `:23680`) e
  `aprovarItensPeloCliente` (`:23557`) são passados para `ExecutivoConferenciaView`, que não os usa;
  `AssinaturaClienteView` (`:10933`) e `AprovacaoClienteItens` (`:7747`) não são desenhados em lugar
  nenhum.
- `liberarSemAprovacaoDoCliente` (`:23582`) e o formulário `FormExcecaoCliente` (`:7667`) só aparecem
  para pendência "cliente", que não existe mais.
- A lista lado a lado do depara com **Aprovar** linha e **Editar planilha** (`ConfRow`, `:6752`;
  `aprovarLinhaConferencia`, `:22860`; `editarLinhaDepara`) não é desenhada quando a tela tem a
  planilha de decisão — que é sempre o caso aqui (`ConferenciaGenerica`, `:6832`).
- Os carimbos antigos (`aprovadoCliente`, `liberadoSemCliente`, `clienteAssinouEm`, `aprovacoes`)
  continuam gravados nas obras que os têm, como histórico.

## Telas

| Tela / bloco | Arquétipo | Rota ou aba | Componente em App.jsx |
|---|---|---|---|
| Conferência do executivo (cartões, chips, busca) | listagem com indicadores | `/obra/:codigo/conferencia` | `ExecutivoConferenciaView` (`web/src/App.jsx:8459`) + `ConferenciaGenerica` (`:6832`) |
| Planilha de decisão por verba | listagem | mesma | `PlanilhaConferenciaView` (`:8010`) |
| Entrou, saiu ou mudou | painel de detalhe | mesma (cartão "−saiu") | `ResumoEntrouSaiu` / `resumoEntrouSaiu` (`:7372`) |
| Estado da etapa (Concluir / Reabrir, trava) | detalhe (linha de estado) | mesma | `EtapaDaAba` (`:21229`) |
| Bloqueio sem CMV | página de sistema | mesma | `FaseBloqueada` (`:8641`) |

## Estados e mensagens

| Estado | O que a tela mostra |
|---|---|
| Sem CMV liberado | "Aguardando a liberação do CMV" + **Ir para o Depara** |
| Sem planilhas | "Nada pra conferir ainda — Importe a Vendido Planilha e a Planilha Executivo…" / "Nada para liberar ainda" |
| Pendência | linha laranja, ícone de alerta com o texto da pendência, botão **conferi**; depois "conferido por …" |
| Quem não é admin, ou em modo leitura | coluna "Aprovado p/ compra" só com o selo "não aprovado" (sem botão) |
| Admin, com pendência sem conferir | botão de aprovar desabilitado: "Confira o alerta desta linha antes de liberar" |
| Modo leitura | "concluir" desabilitado com a dica do modo leitura; sem "conferi" |
| Liberado | selo "liberado" (título: data e quem; ou "Já estava no fluxo de compras" quando não há carimbo) |
| Confirmações | "Liberar para compra N itens da verba X?", "Conferir os alertas e liberar N itens…", "Concluir o executivo de N linhas?" (avisa as selecionadas fora da tela) |
| Concluir etapa travado | "Falta conferir N produtos" e dica "Aprove as pendências para concluir" |
| Recusa do banco (RN-001) | aviso de gravação "recusado" com a mensagem do servidor |

## Dados

| Onde | Campo | Significado |
|---|---|---|
| `categorias[].itens[]` | `concluidoExecutivo: { em, por }` | o executivo terminou a linha (ADR-005) |
| mesmo item | `liberadoCompra: { em, por, viaAlocacao? }` | aprovado para compra (RN-001); `viaAlocacao` quando veio da correção da alocação no Plano |
| mesmo item | `alertaConferido: { em, por }` | alguém olhou o alerta técnico / o item que entrou sem venda |
| mesmo item | `aprovadoCliente`, `liberadoSemCliente: { em, por, motivo, autorizadoPor }` | legado da aprovação do cliente (não decide mais nada) |
| `obra_dados` | `aprovacoes` (lista de chaves `exec:verba:codigo`) | aprovações de linha do depara (legado, sem autor) |
| `obra_dados` | `cliente_assinou_em`, `cliente_assinatura_por/_obs/_arq` | assinatura geral do cliente (legado nesta tela) |
| `obra_dados.etapas_concluidas` | `executivo_conferencia: { por, em }` | conclusão da etapa |

Os carimbos de item vão por **patch** (`CAMPOS_POR_PATCH`, `web/src/App.jsx:3146`): cada linha vira
`{ verba, item, campos, confCodigo, confDesc }`; o banco recusa o patch se a posição não tem mais
aquele código e descrição.

## APIs

| Método | Rota | Autorização no servidor | Arquivo:linha | O que faz |
|---|---|---|---|---|
| POST | `/api/obras/:codigo/patch` | login, membro, editar a obra; trava + versão; confere código e descrição do item; gatilho RN-001 | `web/api/_lib/rotas/obraDados.js:129` | grava conclusão, "conferi" e liberação item a item; e marcas da obra (etapas concluídas) |
| POST | `/api/obras/:codigo/gravar` | idem (obra inteira) | `web/api/_lib/rotas/obraDados.js:105` | gravação inteira, quando algo não cabe em patch |
| POST | `/api/obras/:codigo/versoes/:id/restaurar` | editar a obra | `web/api/_lib/rotas/obraDados.js:143` | restaurar versão (a RN-001 aceita carimbos que já existiram numa versão) |

## Regras de negócio usadas

- [RN-001](../regras-de-negocio/RN-001-liberacao-de-compra.md) — Só o administrador libera a compra.
- [RN-002](../regras-de-negocio/RN-002-item-aprovado-no-executivo.md) — o item aprovado aqui fica
  travado no Executivo até o administrador desfazer a aprovação (publicada, ADR-006).
- [RN-039](../regras-de-negocio/RN-039-alerta-tecnico-trava-liberacao.md) — item com alerta técnico ou que entrou sem ter sido vendido
  só é aprovado para compra depois de alguém marcar que conferiu.
- [RN-040](../regras-de-negocio/RN-040-aprovar-compra-conclui-executivo.md) — aprovar para compra conclui o executivo da linha; item
  aprovado conta como concluído.
- [RN-041](../regras-de-negocio/RN-041-conf-executivo-conclui-sem-pendencia.md) — a etapa só se conclui sem nenhum item
  esperando conferência.
- [RN-043](../regras-de-negocio/RN-043-o-que-conta-como-liberado.md) — item que já anda na compra (canal, solicitado,
  comprado, avulso) ou que veio de aditivo aprovado conta como liberado.
- [RN-042](../regras-de-negocio/RN-042-cliente-nao-barra-compra.md) — desde 18/09/2026 a aprovação do cliente não é pré-requisito da
  compra.
- [RN-023](../regras-de-negocio/RN-023-esteira-segue-a-ordem.md) — a esteira do planejamento avisa quando se pula etapa; a Conf.
  Executivo não tranca pela anterior, e Plano e Compras destrancam com um item aprovado.
- [RN-035](../regras-de-negocio/RN-035-executivo-exige-cmv-liberado.md) — a aba só abre com o CMV liberado.
- [RN-031](../regras-de-negocio/RN-031-linha-de-titulo-nao-e-item.md) — título não se confere nem se aprova.

## Riscos conhecidos

| Gravidade | Risco | Cenário | Onde no código |
|---|---|---|---|
| alta | Item entra em Compras sem o carimbo do admin | `liberadoParaCompra` conta como liberado o item com `canalCompra`, `solicitado`, `comprado` ou `avulso`. O gatilho da RN-001 só olha `liberadoCompra`/`liberadoSemCliente`: quem edita (GC) pode gravar `canalCompra` num item não liberado pela API (`/patch` aceita o campo) e ele aparece em Compras | `liberadoParaCompra` (`web/src/App.jsx:11350`), `supabase/rn-001-liberacao-de-compra.sql` |
| alta | Mover a liberação de um item para outro passa pelo banco | O gatilho compara carimbos **acrescentados** por conteúdo e contagem; uma gravação que tira o carimbo do item A e põe o mesmo carimbo no item B não acrescenta nada e é aceita, de qualquer pessoa que edita | `liberacoesAcrescentadas` (`web/src/regras/liberacaoDeCompra.js`), `private.rn001_confere_liberacao` |
| média | Restaurar versão recoloca liberação desfeita | Já registrado na RN-001 ("brecha conhecida da restauração") | `private.rn001_vezes_no_historico` |
| média | Conclusão, "conferi" e aprovação do cliente sem garantia de autor | `concluidoExecutivo`, `alertaConferido` e `aprovadoCliente` aceitam qualquer nome em `por` e qualquer pessoa que edita; o banco não confere nem exige o "conferi" antes da liberação (o admin pode gravar a liberação de item com alerta pela API) | `web/src/App.jsx:23506`, `:23591`; `podeLiberarItem` (`:11427`) só na tela |
| média | A única trava do "Concluir etapa" é só da tela | "Falta conferir = 0" é conferido na tela e em `concluirEtapa`; a marca `etapas_concluidas` é aceita pelo banco como vier. E a etapa concluída não volta a pendente se surgirem pendências novas | `bloqueioDaEtapa` (`web/src/App.jsx:11203`), `concluirEtapa` (`:23705`) |
| média | Esteira destrava com um item só | Um único item aprovado tira o cadeado do Plano e das Compras da obra inteira, com o resto ainda sem conferência (o cadeado é só aviso visual; a aba sempre abre) | `temCompraAprovada` (`web/src/App.jsx:11220`), `TabBar` (`:11225`) |
| média | Desfazer a aprovação não tira da compra o que já andou | "desfazer" apaga `liberadoCompra`, mas o item com canal ou solicitado continua liberado por `liberadoParaCompra`; `liberadoSemCliente` também não é apagado | `liberarItensParaCompra` (`web/src/App.jsx:23460`) |
| média | Obra que começou sem CMV não libera compra | Com `executivoLiberadoDireto` e sem `deparaAprovado`, a Conf. Executivo continua bloqueada: não há como concluir nem aprovar itens até alguém liberar um CMV | `web/src/App.jsx:25798` |
| baixa | Com a migração de perfis pendente, todos veem os botões de admin | `souAdmin` e `podeLiberar` viram verdadeiros para qualquer pessoa; quem decide é o banco | `web/src/App.jsx:21597-21600` |
| baixa | Código de aprovação do cliente e de aprovação de linha sem caminho na tela | Handlers e componentes continuam no código e as colunas/campos continuam aceitos pela API (`aprovacoes`, `aprovadoCliente`, `cliente_assinou_em`), sem autoria garantida | ver "O que saiu desta tela" |

## Fora do escopo

- Editar, inserir e remover itens: `executivo.md`. Liberação do CMV: `cmv.md`.
- A liberação do Plano de Compras, a alocação MAT/MO (e a liberação `viaAlocacao`) e as Compras:
  fichas do Plano de Compras e das Compras.
- Gravação, trava e versões: `gravacao-da-obra.md`.
- O enunciado e os exemplos da liberação: `docs/regras-de-negocio/RN-001-liberacao-de-compra.md`.

## Código

- `web/src/App.jsx` — `ExecutivoConferenciaView`, `PlanilhaConferenciaView`, `ConferenciaGenerica`,
  `cruzamentoExecutivo`, `conferirExecutivoObra`, `linhaConfExecutivo`, `pendenciasConfExecutivo`,
  `precisaConferir`, `estaConcluido`, `itensParaLiberar`, `pendenciaParaLiberar`, `podeLiberarItem`,
  `liberadoParaCompra`, `liberarItensParaCompra`, `concluirItensExecutivo`, `conferirAlertaDoItem`,
  `conferirAlertasEmVarios`, `bloqueioDaEtapa`, `temCompraAprovada`, `obraComAditivos`
- `web/src/regras/liberacaoDeCompra.js` (+ `liberacaoDeCompra.test.mjs`) — RN-001
- `supabase/rn-001-liberacao-de-compra.sql` (+ `supabase/tests/10-rn-001-liberacao.sql`) — garantia no banco
- `web/api/_lib/rotas/obraDados.js`, `supabase/salvar-obra.sql` — patch e gravação
- Testes: `web/src/__testes__/liberar-compra.test.mjs`, `trava-conf-executivo.test.mjs`,
  `conferencia-tecnica.test.mjs`, `entrou-saiu.test.mjs`, `visao-geral-falta-aprovar.test.mjs`,
  `alocacao-libera.test.mjs`, `patch-compras.test.mjs`
