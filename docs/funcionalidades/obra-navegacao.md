# Navegação da obra (grupos, esteira de etapas e modo de edição)

**Módulo:** Obras (a tela de uma obra) · **Arquétipos de tela:** detalhe (cabeçalho da obra) com navegação em abas · **Onde fica:** Obras (capacete) → escolher a obra; rota `/obra/:codigo` e `/obra/:codigo/<etapa>`

## Objetivo

Dizer, ao abrir uma obra, **onde ela está** e **o que vem depois**. A obra se divide em quatro
grupos; os dois do meio são esteiras de etapas, na ordem real do processo, com o que já foi
cumprido marcado. No cabeçalho, a pessoa decide se só consulta ou se edita — e só uma pessoa edita
a obra por vez.

## Quem usa

| Perfil | O que pode | Onde é conferido |
|---|---|---|
| Admin master, Administrador, Geral | Abrir todas as obras; habilitar edição; concluir e reabrir etapas | tela (`perfilPermiteEditar`, `web/src/App.jsx:22649`) e servidor (`exigirEdicaoDeObra` nas rotas de trava e gravação) |
| GC | O mesmo, só nas obras em que responde por um papel e nas obras sem GC | tela, servidor (`podeAcessarObra`, `web/api/_lib/auth.js:150`) e banco (RLS `minhas_obras()`) |
| Taylor Made | Abrir as mesmas obras que o GC, só em modo leitura | tela (`perfilEdita`) e servidor (`PERFIS_QUE_EDITAM`, `web/api/_lib/auth.js:86`) |
| Mehoo, Canal de compra | Não abrem obra | tela (`podeAbrirObras`) |

O botão **Habilitar edição** aparece para todos que abrem a obra; quem não edita por perfil clica e
nada acontece (`habilitarEdicao` sai na primeira linha, `web/src/App.jsx:22656`).

## Fluxo

1. A pessoa escolhe a obra na lista (ou chega por um alerta do Início, pelo mapa ou por um link
   `/obra/2450`). A obra abre no grupo **Visão geral**, sem etapa escolhida.
2. Por baixo, o app lê a obra do banco (`GET /api/obras/:codigo/conteudo`,
   `web/src/App.jsx:22285`) com a **versão** dela, e os aditivos da obra. Enquanto lê, a barra diz
   "Carregando…". Se não conseguir, a barra diz "Não consegui carregar esta obra. A edição fica
   fechada até ela carregar." e oferece **Tentar de novo**, sem recarregar a página.
3. O cabeçalho mostra o código e o nome, o endereço, a entrega (com selo "em N dias" / "N dias
   atrasada"), o GC, a Taylor Made e o Executivo, e à direita a barra de edição
   (`BarraEtapa`, `web/src/App.jsx:21104`) e, só na Visão geral, **Concluir obra**.
4. A pessoa escolhe um grupo (`GRUPOS_OBRA`, `web/src/App.jsx:11140`):

   | Grupo | O que tem |
   |---|---|
   | Visão geral | o painel da obra — ver [dashboard.md](dashboard.md) |
   | Planejamento | a esteira: Vendido Planilha → CMV → Executivo → Conf. Executivo → Plano de Compras → Compras de Produtos (`ETAPAS_PLANEJAMENTO`, `web/src/App.jsx:11149`) |
   | Execução | Contratos e Diário de Obra (`ETAPAS_EXECUCAO`, `web/src/App.jsx:11170`) |
   | Documentos | o armário da obra — ver [obra-documentos.md](obra-documentos.md) |

   Planejamento e Execução mostram quantas etapas estão concluídas ("3/6"). Sem etapa escolhida, a
   tela diz "Escolha uma etapa acima para começar."
5. Na fila de etapas, cada aba mostra:
   - ✓ quando a etapa está concluída (`etapaConcluida`, `web/src/App.jsx:11209`);
   - **cadeado** quando a etapa anterior não foi concluída, com a dica "Conclua "<anterior>"
     primeiro" (`web/src/App.jsx:11292`). O cadeado é **só aviso**: a aba sempre abre. Não ganham
     cadeado a Conf. Executivo (feita junto com o Executivo — `ETAPAS_SEM_TRAVA_DE_ORDEM`,
     `web/src/App.jsx:11189`), as etapas já concluídas, e — com pelo menos um item aprovado para
     compra — o Plano de Compras e as Compras de Produtos (`temCompraAprovada`,
     `web/src/App.jsx:11246`). A Execução não tem cadeado.
6. Dentro da aba, logo abaixo do título da tela, vem o **estado da etapa** (`EtapaDaAba`,
   `web/src/App.jsx:21274`):
   - "Etapa pendente" / "Etapa concluída por <nome> · <data e hora>";
   - nas etapas com botão próprio (`ETAPAS_COM_CONCLUSAO`: Vendido Planilha, Executivo, Conf.
     Executivo, Compras de Produtos e Contratos — `web/src/App.jsx:11197`): **Concluir etapa** e,
     depois, **Reabrir etapa**, sempre com confirmação;
   - no CMV e no Plano de Compras, que se concluem por um ato da própria tela (liberar o CMV,
     liberar o Plano de Compras), só a frase que diz qual é o ato;
   - no Diário de Obra: "Etapa contínua — Acompanha a obra inteira, não se conclui."
7. **Concluir etapa** (`concluirEtapa`, `web/src/App.jsx:23749`) grava `{ por, em }` em
   `etapas_concluidas` e vai pela fila de gravação. Só vale com a edição habilitada, e fica
   bloqueado quando:
   - as compras da obra já foram liberadas (`congelado`, `web/src/App.jsx:21284`);
   - na Conf. Executivo, ainda falta conferir algum produto da conferência técnica
     ("Falta conferir N produtos" — `bloqueioDaEtapa`, `web/src/App.jsx:11229`). A trava é
     conferida no botão e de novo dentro de `concluirEtapa`.
8. **Reabrir etapa** (`reabrirEtapa`, `web/src/App.jsx:23767`) apaga o registro de quem concluiu e
   quando; a etapa volta a pendente.
9. Algumas telas travam o conteúdo, não só o cadeado: o **Executivo** só abre com o CMV liberado
   (ou, em obra sem detalhe, com "começar sem o Depara"); a **Conf. Executivo** também exige o CMV
   liberado; senão aparece a tela de fase bloqueada com o atalho para o CMV
   (`web/src/App.jsx:25838`–`25846`).
10. As telas de operação (Vendido, Executivo, Conf. Executivo, Plano, Compras, Contratos) têm
    **tela cheia**: some a moldura e fica a tabela; sai com Esc, com o botão ou trocando de tela
    (`web/src/App.jsx:23786`).
11. O **histórico da obra** fecha a página em qualquer grupo (`HistoricoDaObra`,
    `web/src/App.jsx:3391`).

### Habilitar e finalizar a edição

1. A obra abre em **Modo leitura · só consulta**.
2. **Habilitar edição** (`habilitarEdicao`, `web/src/App.jsx:22655`) pede a trava ao servidor
   (`POST /api/obras/:codigo/edicao`). A trava só é tomada se estiver livre, vencida (5 minutos sem
   gravação) ou já for da pessoa — a condição vai dentro do `UPDATE`, e quem chega em segundo não
   pega. No mesmo pedido volta a obra **como está no banco agora**, e é essa que passa a ser
   editada. Obra sem a versão (o SQL da gravação protegida não rodou) devolve a trava e mantém a
   edição fechada.
3. Com a trava, a barra mostra "Você está editando esta obra", a situação da gravação e
   **Finalizar edição**. Cada alteração vai para a fila de gravação — ver
   [gravacao-da-obra.md](gravacao-da-obra.md).
4. Outra pessoa com a trava: a barra mostra "Em edição por outra pessoa — <nome> está editando
   desde <hora>". A trava alheia vence também na tela, depois de 5 minutos; aí o botão de
   habilitar volta, mas pegar a obra continua sendo um clique.
5. A edição **termina sozinha** quando a pessoa:
   - clica **Finalizar edição** (`web/src/App.jsx:22692`);
   - troca de aba, de grupo, de obra ou de módulo — a edição vale só na tela em que foi
     habilitada (`telaDeTrabalho`, `web/src/App.jsx:22517`; pedido de 17/09/2026, ADR-004);
   - fica 5 minutos sem alterar nada (`web/src/App.jsx:22566`);
   - cai num conflito de gravação.
   Em todos os casos a tela **grava o que falta e só depois devolve a trava**; se a gravação
   falhar, a trava fica com a tela até gravar (`web/src/App.jsx:22536`).
6. Fechar a aba sem nada por gravar devolve a trava (`pagehide`, `web/src/App.jsx:22629`); com algo
   por gravar, o navegador pergunta antes.

### Endereço da tela

Cada tela tem endereço próprio (`enderecoDaTela`, `web/src/App.jsx:10405`): `/obra/2450` é a Visão
geral; `/obra/2450/vendido`, `/cmv`, `/executivo`, `/conferencia`, `/plano`, `/compras`,
`/contratos`, `/diario` são as etapas (`SLUG_ETAPA`, `web/src/App.jsx:10364`). O endereço antigo
`/cliente` leva à Conf. Executivo. Documentos não tem endereço próprio (fica em `/obra/2450`). O
botão voltar do navegador funciona. Ao abrir por link, o app espera as três cargas (Monday, banco e
perfil) antes de decidir se a obra existe (`resolverRotaPendente`, `web/src/App.jsx:10448`); se não
achar, abre a lista de obras para a pessoa escolher.

## Telas

| Tela / bloco | Arquétipo | Rota ou aba | Componente |
|---|---|---|---|
| Cabeçalho da obra (breadcrumb, fatos, ações) | detalhe | `/obra/:codigo` | `PageShell` em `web/src/App.jsx:25725`–`25792` |
| Barra de edição | detalhe (ação) | cabeçalho | `BarraEtapa` (`web/src/App.jsx:21104`) |
| Grupos e esteira de etapas | navegação | cabeçalho (toolbar) | `TabBar` (`web/src/App.jsx:11251`) |
| Estado da etapa (Concluir / Reabrir) | detalhe (ação) | abaixo do título de cada aba | `EtapaDaAba` (`web/src/App.jsx:21274`), via `EtapaDaAbaContexto` |
| Tela cheia | detalhe | telas de operação | barra em `web/src/App.jsx:25699` |
| Histórico da obra | detalhe (lista) | pé da página | `HistoricoDaObra` (`web/src/App.jsx:3391`) |
| Diário de Obra | página de sistema (em construção) | `/obra/:codigo/diario` | `web/src/App.jsx:25851` |

## Estados e mensagens

| Estado | O que a tela diz |
|---|---|
| Carregando a obra | "Carregando…" na barra |
| Falhou ao carregar | "Não consegui carregar esta obra. A edição fica fechada até ela carregar." + **Tentar de novo** |
| Modo leitura | selo "Modo leitura · só consulta" + **Habilitar edição** (escondido enquanto há conflito de gravação em aberto) |
| Editando | selo "Você está editando esta obra" + situação da gravação + **Finalizar edição** |
| Outra pessoa editando | "Em edição por outra pessoa" · "<nome> está editando desde <hora>" (dica: "Libera sozinho após 5 min sem alteração") |
| Sem a gravação protegida no banco | "A gravação protegida ainda não está no banco (falta rodar supabase/salvar-obra.sql). A edição fica fechada até lá, para nada se perder." |
| Falha ao habilitar | "Não foi possível habilitar a edição: <motivo>" |
| Concluir etapa | confirmação "Concluir a etapa "<nome>"? Fica registrado no seu nome, com a data e a hora de agora, e a próxima etapa é liberada. Dá para reabrir depois." |
| Reabrir etapa | confirmação "Reabrir a etapa "<nome>"? O registro de quem concluiu e quando é apagado e a etapa volta a pendente." |
| Concluir bloqueado | botão desabilitado com a dica "Aprove as pendências para concluir" ou "Habilite a edição da obra para concluir" |
| Aba travada | cadeado e "Conclua "<anterior>" primeiro" (a aba abre mesmo assim) |
| Sem etapa escolhida | "Escolha uma etapa acima para começar." |
| Obra sem detalhe | selo "Sem detalhe de executivo" no cabeçalho |

## Dados

| Campo (em `obra_dados`) | Significado |
|---|---|
| `etapas_concluidas` | mapa `{ <etapa>: { por, em } }` das etapas concluídas pelo botão genérico |
| `depara_aprovado`, `cmv_liberado_por`, `cmv_liberado_em` | conclusão do CMV (ato próprio) |
| `compras_liberadas` | conclusão do Plano de Compras; congela as etapas e os cadernos |
| `cliente_assinou_em`, `cliente_assinatura_por` | assinatura do cliente (a antiga etapa "Aprovação do Cliente", hoje dentro da Conf. Executivo — ADR-005) |
| `executivo_liberado_direto` | obra sem detalhe que começou o Executivo sem o Depara |
| `editando_por`, `editando_desde` | a trava de edição; vence 5 minutos depois de `editando_desde` |
| `versao` | número que sobe a cada mudança de conteúdo; base da gravação protegida |

O `por` gravado em `etapas_concluidas` é o e-mail da tela (`usuario`), e não o do login no
servidor.

## APIs

| Método | Rota | Autorização exigida no servidor | Arquivo:linha | O que faz |
|---|---|---|---|---|
| GET | `/api/obras/:codigo/conteudo` | login + membro + ver a obra | `web/api/_lib/rotas/obraConteudo.js:135` | a obra inteira, comprimida, com a versão |
| POST | `/api/obras/:codigo/edicao` | login + membro + editar a obra | `web/api/_lib/rotas/obraConteudo.js:186` | pega a trava (se livre, vencida ou já da pessoa) e devolve a obra atual |
| DELETE | `/api/obras/:codigo/edicao` | login + membro + editar a obra | `web/api/_lib/rotas/obraConteudo.js:231` | devolve a trava, só se for de quem pede |
| GET | `/api/obras-travas` | login + membro; RLS | `web/api/_lib/rotas/obraConteudo.js:254` | cadeados da lista de obras |
| POST | `/api/obras/:codigo/patch` | login + membro + editar a obra; banco confere trava e versão | `web/api/_lib/rotas/obraDados.js:129` | grava a conclusão/reabertura de etapa (marca `etapas_concluidas`) |
| POST | `/api/obras/:codigo/gravar` | idem | `web/api/_lib/rotas/obraDados.js:105` | gravação inteira, quando a fila não consegue mandar só a mudança |

## Integrações

Nenhuma direta. Os atos de etapa que falam com o Sienge (solicitação de compra) estão nas fichas
das Compras.

## Regras de negócio usadas

- [RN-021](../regras-de-negocio/RN-021-uma-pessoa-edita-a-obra-por-vez.md) — só uma pessoa edita a obra por vez; a edição vale só na tela em que foi habilitada e vence em 5 minutos.
- [RN-023](../regras-de-negocio/RN-023-esteira-segue-a-ordem.md) — as etapas do Planejamento seguem uma ordem; a etapa só "abre" depois da anterior, salvo as exceções. Hoje é só aviso.
- [RN-024](../regras-de-negocio/RN-024-etapa-concluida-registra-quem-e-quando.md) — concluir uma etapa registra quem e quando; reabrir apaga o registro.
- [RN-041](../regras-de-negocio/RN-041-conf-executivo-conclui-sem-pendencia.md) — a Conf. Executivo só se conclui com a conferência técnica 100% aprovada.
- [RN-048](../regras-de-negocio/RN-048-plano-liberado-congela-etapas.md) — com o plano de compras liberado, os botões de concluir e reabrir etapa ficam travados (e os cadernos do projeto não se trocam).
- [RN-011](../regras-de-negocio/RN-011-quem-edita-e-cria-obra.md) — só master, admin, geral e GC habilitam a edição, cada um nas obras que vê.
- [RN-035](../regras-de-negocio/RN-035-executivo-exige-cmv-liberado.md) — o Executivo e a Conf. Executivo só abrem depois do CMV liberado (ou do começo sem Depara em obra sem detalhe).
- RN-001 — Só o administrador libera a compra (é o que faz `temCompraAprovada` tirar o cadeado das telas de compra).

## Riscos conhecidos

| Gravidade | Risco | Cenário | Onde no código |
|---|---|---|---|
| média | O cadeado das abas é só visual | a esteira "trava" o Plano de Compras até a Conf. Executivo ser concluída, mas a aba abre e a tela funciona; quem garante alguma coisa são as travas de dentro de cada tela | `web/src/App.jsx:11292`–`11301` |
| média | "Concluir etapa" de Executivo, Compras de Produtos e Contratos não é pré-requisito de nada | a conclusão só apaga o cadeado da aba seguinte, e a seguinte à do Executivo (Conf. Executivo) nem tem cadeado. A de Vendido Planilha só apaga o cadeado do CMV e marca "Contrato" na Jornada | `web/src/App.jsx:11189`, `web/src/App.jsx:602` |
| média | Reabrir etapa (e reabrir as compras) sem trilha | reabrir apaga `{ por, em }`; não fica registro de quem reabriu nem quando, a não ser comparando versões do histórico | `web/src/App.jsx:23767`, `web/src/App.jsx:23224` |
| média | Trava da Conf. Executivo e registro de quem concluiu só na tela | o banco aceita `etapas_concluidas` com qualquer `por` e sem a conferência técnica completa; uma gravação pela API burla as duas coisas | `web/src/App.jsx:23749`; `supabase/salvar-obra.sql:136` |
| média | Abrir por endereço uma obra fora da lista de ativas | o link procura a obra na lista inteira (inclusive concluídas e as ainda não iniciadas do Monday), e não só nas ativas; uma obra concluída aberta assim pode ter a edição habilitada, porque o servidor não confere a situação (suposição: não reproduzido — depende da ordem em que as cargas chegam) | `web/src/App.jsx:10448`, `web/src/App.jsx:22160` |
| baixa | **Habilitar edição** aparece para quem não edita | Taylor Made vê o botão e o clique não faz nada, sem mensagem | `web/src/App.jsx:21169`, `web/src/App.jsx:22656` |
| baixa | `ETAPAS_SEM_TRAVA_DE_ORDEM` ainda cita a etapa aposentada | `assinatura_cliente` saiu da esteira em 18/09/2026, mas continua na lista e em `etapaConcluida` | `web/src/App.jsx:11189`, `web/src/App.jsx:11211` |

## Fora do escopo

- Duas pessoas editando a mesma obra em telas diferentes (trava por tela): ADR-004, fatia 3.
- O conteúdo de cada etapa: fichas próprias (Vendido, CMV, Executivo, Conf. Executivo, Plano de
  Compras, Compras, Contratos).
- Diário de Obra: tela em construção.
- Concluir a obra inteira: [obras-finalizadas.md](obras-finalizadas.md).

## Código

- `web/src/App.jsx` — `GRUPOS_OBRA` e esteira (`11140`–`11321`), `BarraEtapa` (`21104`), `EtapaDaAba` (`21274`), `habilitarEdicao`/`finalizarEdicao` (`22655`/`22692`), efeitos da trava (`22512`–`22644`), `concluirEtapa`/`reabrirEtapa` (`23749`/`23767`), endereço da tela (`10364`–`10466`), render da obra (`25694`–`25882`)
- `web/src/lib/dadosObra.js` — `pegarEdicao`, `liberarEdicao`, `travaViva`, `MINUTOS_ATE_TRAVA_EXPIRAR`
- `web/api/_lib/rotas/obraConteudo.js`, `web/api/_lib/rotas/obraDados.js`, `web/api/_lib/auth.js`
- Testes: `web/src/__testes__/rotas.test.mjs`, `trava-conf-executivo.test.mjs`, `trava-vencida.test.mjs`, `gravacao-na-tela.test.mjs`, `e2e/duas-sessoes.spec.mjs`
