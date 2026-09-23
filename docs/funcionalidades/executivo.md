# Executivo (Planilha Executivo)

**Módulo:** Obras › Planejamento · **Arquétipos de tela:** listagem editável (planilha por verba) + indicadores de saldo · **Onde fica:** obra › Planejamento › **Executivo** (`/obra/:codigo/executivo`)

> Linhas de código conferidas no commit `468c554` (branch `docs/documentacao-sistema`).
>
> **[RN-002](../regras-de-negocio/RN-002-item-aprovado-no-executivo.md) publicada** (commit `a4f5918`, decisão em
> [ADR-006](../ADR-006-executivo-trava-item-aprovado.md), 23/09/2026): item aprovado para compra — ou já
> andando na compra (solicitado, comprado, com canal, avulso ou de aditivo) — não se edita, não se
> remove nem se substitui no Executivo, por ninguém, nem pelo administrador; para mexer, desfaz-se a
> aprovação na Conf. Executivo. Adicionar item novo continua livre. Com item aprovado, ninguém
> substitui nem limpa a planilha inteira. A regra está em `web/src/regras/itemAprovadoNoExecutivo.js`
> (com teste) e no gatilho `supabase/rn-002-item-aprovado-no-executivo.sql` — **que ainda falta rodar
> em produção**; até lá, só a tela garante. As linhas de código citadas abaixo são do commit `468c554`
> e podem ter andado.

## Objetivo

Montar a **planilha do executivo** da obra — o que de fato vai ser comprado e contratado, item a
item, com quantidade e custo — partindo do que foi vendido, e acompanhar quanto ela se afasta do
vendido e do CMV liberado. A planilha alimenta tudo o que vem depois: a Conf. Executivo, o Plano de
Compras, as Compras e os Contratos.

A mesma importação popula **duas listas** por verba:

- `itensPlanilhaExecutivo` — o documento como veio (é o que esta tela mostra e o que a Conf.
  Executivo compara com o vendido);
- `itens` — a lista de trabalho, onde moram aprovação, liberação, canal, compra, alocação e a
  separação material/mão de obra.

## Quem usa

| Perfil | O que pode | Onde é conferido |
|---|---|---|
| master, admin, geral, gc, com a edição habilitada | importar, puxar do criativo, editar células, inserir, substituir, remover (com justificativa) e trazer de volta itens; concluir a etapa | tela (`podeEditar` = `edicao.minha`); servidor: editar a obra (`exigirEdicaoDeObra`) e trava + versão no banco; leitor de PDF exige perfil de edição |
| ninguém, nem o administrador ([RN-002](../regras-de-negocio/RN-002-item-aprovado-no-executivo.md)) | editar, remover ou substituir linha aprovada para compra (ou já andando na compra); **substituir**, **recomeçar do criativo** ou **remover** a planilha enquanto houver item aprovado | tela (linha só para consulta, com a etiqueta "aprovado p/ compra"; `trocaTravada`) e banco (gatilho da RN-002, `supabase/rn-002-item-aprovado-no-executivo.sql`, ainda por rodar em produção) |
| quem enxerga a obra | consultar | tela em modo leitura; RLS de leitura |
| quem vê o módulo Catálogo | botão **Apresentação de especificações** | tela (`podeVerModulo(eu, "catalogo")`, `web/src/App.jsx:25736`) |

## Fluxo

1. A aba só abre com o CMV liberado (`deparaAprovado`) ou com "começar sem CMV"
   (`executivoLiberadoDireto`); senão aparece "Aguardando a liberação do CMV" (ver `cmv.md`).
2. A pessoa habilita a edição da obra.
3. **Ponto de partida — duas formas:**
   - **Puxar do criativo** (quando há Vendido Planilha e a troca não está travada): copia
     `itensPlanilha` de cada verba para as duas listas, marca `origem: "criativo"` e guarda em
     `vendido` a quantidade e os custos de origem, para a coluna "Vendido (criativo)" e a diferença
     (`puxarDoCriativo`, `web/src/App.jsx:23015`). Com executivo já existente pede confirmação
     ("Tudo que já foi lançado ou editado no Executivo desta obra será trocado… Não dá para
     desfazer."). Não passa pelo registro de importação nem pela separação automática de mão de obra.
   - **Importar Planilha Executivo** (Excel ou PDF). Excel lido no navegador, preferindo a aba cujo
     nome contém "execut" (`lerPlanilhaExcel`, `web/src/App.jsx:4896`); PDF lido em
     `POST /api/executivo/parse` (`lerExecutivoPDF`, `web/src/App.jsx:4642`), que classifica cada
     linha: com custo de material é **produto** (vai para Compras/Sienge), sem é **serviço** (vai para
     Contratos).
4. Na importação, `confirmarImportacao` mostra verbas trocadas e mantidas e, quando a obra já tem
   aprovações, **o que se perde** (itens aprovados, concluídos, solicitações ao Sienge, compras,
   trocas, remoções — `resumoDoQueSePerde`, `web/src/App.jsx:9358`) com o botão "Trocar mesmo
   assim".
5. `importPlanilhaExecutivo` (`web/src/App.jsx:23243`) aplica:
   - nas verbas que vieram no arquivo, **troca** `itensPlanilhaExecutivo` e `itens` pela lista nova
     (tudo o que morava nos itens antigos daquela verba some);
   - cada item recebe `vendido` = o item do criativo que mais se parece com ele, pelo mesmo motor de
     similaridade do depara (`casarComCriativo`, `web/src/App.jsx:6590`), porque código não serve de
     chave entre os documentos;
   - `qtdExecutivo` e `qtdVendida` são preenchidos um pelo outro;
   - **separação automática de mão de obra**: nas verbas em que a empresa sempre compra o material e
     contrata a mão de obra — 05, 20, 24, 27 e 28, resolvidas pelo nome (iluminação, climatização,
     móveis soltos, louças e metais; `VERBAS_MO_CONTRATADA`, `web/src/App.jsx:1785`) — o item com as
     duas parcelas vira duas linhas **só em `itens`**: o original com o material e, logo abaixo, uma
     linha de serviço com a mão de obra (`separadoDe` aponta o pai;
     `separarMOnasVerbasDeContrato`, `web/src/App.jsx:1867`; `partirMaoDeObra`, `:1832`). A planilha
     mostrada continua como veio.
   - A importação é registrada como `planilha_executivo` (ver `vendido.md`).
6. **Editar uma célula** (descrição, código/especificação, fornecedor, ambiente, quantidade, unidade,
   custos e totais; Tab/Enter navegam) chama `editarItemExecutivo` (`web/src/App.jsx:22939`):
   - na planilha mostrada, altera a **posição** editada;
   - na lista de trabalho, altera **todo item cuja descrição normalizada é igual** à da linha
     editada (correção de 19/09/2026: antes a posição era aplicada às duas listas e, depois da
     primeira linha partida, gravava no produto vizinho). Na linha de mão de obra separada só entram os
     campos que identificam o produto (descrição, fornecedor, ambiente, especificação, unidade e os
     campos de remoção — `CAMPOS_DO_PRODUTO`, `web/src/App.jsx:11576`); dinheiro fica na linha dona;
   - custos e totais são recalculados (`recalcularCustos`);
   - item aprovado para compra (ou já andando na compra) não chega aqui: a linha fica só para
     consulta ([RN-002](../regras-de-negocio/RN-002-item-aprovado-no-executivo.md)). Nos demais itens, se o patch mexe em descrição, quantidade ou valor
     (`CAMPOS_QUE_DERRUBAM_APROVACAO`, `web/src/App.jsx:11377`), o item perde a aprovação do cliente e
     o "conferi" do alerta. Ambiente, fornecedor e código não derrubam.
7. **Inserir item** (+ na linha, ou "Adicionar item no fim desta verba"): abre a busca no Banco de
   Preços. Escolhido um insumo, o item nasce com o nome e o preço de referência do Sienge
   (`insumoSienge`, `precoRefData`), `manual: true`, abaixo da linha escolhida, com código de sufixo
   (3.5 → 3.5.1) (`adicionarItemExecutivo`, `web/src/App.jsx:23058`).
8. **Substituir** (⇄ na linha): mesma busca; o escolhido entra logo abaixo e o antigo fica marcado
   `excluido` com `substituidoPor`, os dois apontando um para o outro. Não pede justificativa.
9. **Remover** (× na linha): abre embaixo da linha o campo obrigatório de justificativa, mínimo de 5
   caracteres (`FormRemocao`, `web/src/App.jsx:7710`; era 10, baixou a pedido dela em 22/09/2026).
   Confirmado, `editarItemExecutivo` grava `excluido: true`, `excluidoMotivo`, `excluidoPor` (o usuário
   logado) e `excluidoEm` (ADR-005, fatia 3). A linha fica riscada, com o selo "removido", e sai dos
   totais. Desde 23/09/2026 o item removido **não entra** na Conf. Executivo (o par vendido dele
   aparece como "saiu"), e a justificativa gravada não é mostrada em nenhuma tela (ver Riscos).
   **Trazer de volta** (↺) limpa os três campos, sem pedir nada.
10. Os números de saldo aparecem em dois lugares:
    - no alto, o painel `SaldoExecutivo` (`web/src/App.jsx:9154`): CMV liberado, Executivo hoje,
      "Ainda cabe" / "Acima do CMV" contra o **CMV puro**, e a movimentação (retirado, acrescido,
      excluídos, novos);
    - no rodapé da planilha, o **fechamento**: CMV liberado, alterações do executivo, aditivos
      aprovados (quando há) e "Saldo final — ainda cabe / acima do CMV" contra o **teto com os
      aditivos** (`teto = CMV + saldo dos aditivos aprovados`). Sem CMV, avisa "O CMV desta obra
      ainda não foi liberado" com **Ir para o Depara**.
11. **Concluir etapa** grava `etapasConcluidas.executivo` (sem trava). A Conf. Executivo não depende
    disso para abrir.
12. **Apresentação de especificações** (`BotaoApresentacao`, `web/src/App.jsx:21309`) abre o editor da
    apresentação já com a obra escolhida; se a obra tem o PDF anexado, mostra também "PDF anexado".

## Telas

| Tela / bloco | Arquétipo | Rota ou aba | Componente em App.jsx |
|---|---|---|---|
| Planilha executivo por verba (busca, filtro vendido / não vendido, colunas "Vendido (criativo)" e "Diferença") | listagem editável | `/obra/:codigo/executivo` | `ExecutivoView` (`web/src/App.jsx:9387`) |
| Importar / Substituir / Remover / Reabrir etapas | ações da listagem | mesma | `ImportButton` (`web/src/App.jsx:5187`) |
| Aviso "Planilha do criativo" (Puxar / Recomeçar) | alerta com ação | mesma | `ExecutivoView` |
| Saldo contra o CMV | indicadores | mesma | `SaldoExecutivo` (`web/src/App.jsx:9154`) |
| Justificativa da remoção | formulário em linha | mesma | `FormRemocao` (`web/src/App.jsx:7710`) |
| Busca no Banco de Preços (inserir / substituir) | formulário em linha | mesma | `BuscaInsumo` |
| Bloqueio sem CMV | página de sistema | mesma | `FaseBloqueada` (`web/src/App.jsx:8641`) |
| Apresentação de especificações | ação do cabeçalho | mesma | `BotaoApresentacao` (`web/src/App.jsx:21309`) |

## Estados e mensagens

| Estado | O que a tela mostra |
|---|---|
| Sem CMV | "Aguardando a liberação do CMV" + **Ir para o Depara** |
| Sem executivo e com criativo | alerta "Comece pela planilha do criativo (N itens…)" + **Puxar do criativo** |
| Modo leitura / Plano liberado | células travadas; ImportButton com o motivo e **Reabrir etapas** (Plano liberado) |
| Obra com item aprovado (qualquer perfil) | substituir a planilha travado para todos, com o caminho: desfazer as aprovações na Conf. Executivo ([RN-002](../regras-de-negocio/RN-002-item-aprovado-no-executivo.md)) |
| Linha aprovada para compra | só consulta, sem remover nem substituir, com a etiqueta "aprovado p/ compra" ([RN-002](../regras-de-negocio/RN-002-item-aprovado-no-executivo.md)) |
| Substituir com perdas | diálogo "Substituir a Planilha Executivo?" com a lista do que se perde, "O que o arquivo novo trouxer entra zerado…", "O histórico de versões guarda o estado de agora…", botão "Trocar mesmo assim" |
| Recomeçar do criativo | "Puxar a planilha do criativo de novo? … Não dá para desfazer." |
| Remover item | campo obrigatório; dica "Mínimo de 5 caracteres (faltam N)"; depois "A justificativa aparece na Conf. Executivo." |
| Sem CMV liberado no painel | "CMV liberado —" / "ainda não liberado" (o painel continua mostrando a movimentação) |
| Leitura do arquivo | "Lendo…"; erro: "Não encontrei itens nesse arquivo…" |
| PDF | aviso de que fornecedor, ambiente, especificação e a separação material/mão de obra não vêm do PDF |

## Dados

| Onde | Campo | Significado |
|---|---|---|
| `categorias[].itensPlanilhaExecutivo[]` | `codigo`, `desc`, `especificacao`, `marca`, `ambiente`, `qtdVendida`, `qtdExecutivo`, `un`, `custoMaterial`, `custoMO`, `totalMaterial`, `totalMO`, `custo`, `custoUnitario`, `ehTitulo` | o documento do executivo como veio (e como foi editado na tela) |
| mesmo item | `vendido: { qtd, custo, custoUnitario, custoMaterial, custoMO }` | o que o criativo tinha, para comparar |
| mesmo item | `origem: "criativo"`, `manual`, `insumoSienge`, `precoRefData`, `alteradoExecutivo` | de onde veio a linha |
| mesmo item | `excluido`, `excluidoMotivo`, `excluidoPor`, `excluidoEm` | remoção com justificativa |
| mesmo item | `substitui`, `substituiDesc`, `substituidoPor`, `substituidoPorDesc` | par de substituição |
| `categorias[].itens[]` | os mesmos campos, mais `tipo` (produto/serviço), `contavel`, `sienge`, `moSeparada`, `separadoDe`, `liberadoCompra`, `aprovadoCliente`, `alertaConferido`, `concluidoExecutivo`, canal e compra | a lista de trabalho que alimenta Conf. Executivo, Plano, Compras e Contratos |
| `obra_dados.etapas_concluidas` | `executivo: { por, em }` | conclusão manual da etapa |
| `obra_importacao` | `documento = planilha_executivo` | registro da importação (ver `vendido.md`) |

## APIs

| Método | Rota | Autorização no servidor | Arquivo:linha | O que faz |
|---|---|---|---|---|
| POST | `/api/executivo/parse` | login, membro, perfil de edição; PDF conferido | `web/api/_lib/mondayApp.js:676` | lê o PDF "Composição de Custo" |
| POST | `/api/obras/:codigo/gravar` | login, membro, editar a obra; trava + versão; gatilho da RN-001 | `web/api/_lib/rotas/obraDados.js:105` | grava a obra inteira — é por onde passam importação, edição, inserção, remoção |
| POST | `/api/obras/:codigo/patch` | idem; aceita **qualquer campo** de um item endereçado por posição, conferindo código e descrição | `web/api/_lib/rotas/obraDados.js:129` | o app usa patch só para canal, compra, conclusão, liberação e carimbos (`CAMPOS_POR_PATCH`, `web/src/App.jsx:3146`) |
| POST | `/api/obras/:codigo/importacoes` | editar a obra; autor = login | `web/api/_lib/rotas/importacoes.js:77` | registra a importação |

## Integrações

- **Sienge (Banco de Preços)**: a busca de insumo usa o cadastro de insumos do Sienge guardado no
  banco; o item novo nasce com o código do insumo e o preço de referência.
- **Apresentação de especificações**: abre o editor do Catálogo com a obra.

## Regras de negócio usadas

- [RN-001](../regras-de-negocio/RN-001-liberacao-de-compra.md) — Só o administrador libera a compra
  (e desfaz a liberação, que destrava a linha no Executivo).
- [RN-002](../regras-de-negocio/RN-002-item-aprovado-no-executivo.md) — item aprovado para compra não se edita, não se remove nem se substitui no
  Executivo, e com item aprovado ninguém troca a planilha inteira (publicada, ADR-006).
- [RN-035](../regras-de-negocio/RN-035-executivo-exige-cmv-liberado.md) — a aba só abre com o CMV liberado (ou, em obra sem Vendido,
  sem teto).
- [RN-029](../regras-de-negocio/RN-029-importacao-troca-so-as-verbas-do-arquivo.md) — importar troca só as verbas que vieram no
  arquivo, com aviso e registro.
- [RN-044](../regras-de-negocio/RN-044-material-para-compras-mo-para-contratos.md) — linha com custo de material é produto (compra); sem, é
  serviço (contrato).
- [RN-036](../regras-de-negocio/RN-036-mao-de-obra-separada-por-verba.md) — nas verbas 05, 20, 24, 27 e 28 o item com
  material e mão de obra entra partido em duas linhas.
- [RN-037](../regras-de-negocio/RN-037-edicao-nas-duas-linhas-do-produto.md) — o que identifica o produto vale nas duas
  linhas do item partido; o dinheiro fica na linha dona.
- [RN-038](../regras-de-negocio/RN-038-remocao-exige-justificativa.md) — remover item do executivo exige justificativa
  (mínimo 5 caracteres), gravada com quem e quando.
- [RN-030](../regras-de-negocio/RN-030-grupo-fora-da-eap-vai-para-o-fim.md), [RN-031](../regras-de-negocio/RN-031-linha-de-titulo-nao-e-item.md).

## Riscos conhecidos

| Gravidade | Risco | Cenário | Onde no código |
|---|---|---|---|
| alta | Produto repetido na mesma verba recebe o mesmo patch | Dois itens com a mesma descrição em ambientes diferentes (ex.: o mesmo spot na Suíte 01 e na Suíte 02): editar a quantidade, o custo ou **remover** um deles altera todos na lista de trabalho — e a edição de valor derruba a liberação de todos. A planilha mostrada muda só a linha editada, então tela e compra divergem sem aviso | `editarItemExecutivo` (`web/src/App.jsx:22939`, casamento por `chaveDescricao` em `:22985-23001`) |
| alta | Substituir (e inserir) usa a posição da planilha na lista de trabalho | `adicionarItemExecutivo` aplica o índice de `itensPlanilhaExecutivo` também em `itens`. Nas verbas com mão de obra separada as posições divergem: a substituição marca como removido **outro** produto na lista de compra e insere o novo no lugar errado — o mesmo defeito corrigido na edição em 19/09/2026 | `adicionarItemExecutivo` (`web/src/App.jsx:23058`, `marcar`/`inserir`) |
| alta | Item removido continua em Compras se já estava liberado | `excluido` não está em `CAMPOS_QUE_DERRUBAM_APROVACAO`: o item removido mantém `liberadoCompra` (e canal/solicitado). A Conf. Executivo o esconde, mas a lista de Compras (`produtosMAT`) não filtra `excluido` e o mostra para comprar Desde a [RN-002](../regras-de-negocio/RN-002-item-aprovado-no-executivo.md), a tela não deixa remover item aprovado; o risco fica para itens removidos antes dela e para gravação pela API enquanto o gatilho não roda em produção. | `editarItemExecutivo` (`web/src/App.jsx:22939`), `produtosMAT` (`web/src/App.jsx:11583`) |
| média | Trava do item aprovado depende do gatilho em produção | A [RN-002](../regras-de-negocio/RN-002-item-aprovado-no-executivo.md) recusa no banco editar, remover ou substituir item aprovado, mas `supabase/rn-002-item-aprovado-no-executivo.sql` ainda não foi rodado em produção; até lá, pela API (`/gravar` ou `/patch`) dá para mudar item aprovado mantendo o carimbo | `supabase/rn-002-item-aprovado-no-executivo.sql`; `web/src/regras/itemAprovadoNoExecutivo.js` |
| média | Justificativa da remoção só existe na tela | A API aceita `excluido: true` sem motivo; `excluidoPor` vem da tela e o banco não confere. A **substituição** marca o antigo como removido sem pedir justificativa | `FormRemocao` (`web/src/App.jsx:7710`), `adicionarItemExecutivo` (`web/src/App.jsx:23058`) |
| média | A justificativa da remoção não aparece em lugar nenhum | O campo diz "A justificativa aparece na Conf. Executivo." (e o ADR-005 pede isso), mas desde 23/09/2026 o removido sai do cruzamento da Conf. Executivo e nenhuma tela lê `excluidoMotivo` | `FormRemocao` (`web/src/App.jsx:7710`), `conferirExecutivoObra` (`web/src/App.jsx:6700`), `itensParaLiberar` (`web/src/App.jsx:11477`) |
| baixa | Dois saldos na mesma tela | Com aditivo aprovado, o painel do alto compara com o CMV puro e o fechamento do rodapé com o CMV + aditivos: a mesma obra pode aparecer "Acima do CMV" em cima e "ainda cabe" embaixo | `SaldoExecutivo` (`web/src/App.jsx:9154`) recebe `cmvValor`; o fechamento usa `teto` (`ExecutivoView`, `web/src/App.jsx:9425`) |
| baixa | Puxar do criativo não separa a mão de obra nem registra a importação | Obra montada pelo criativo fica com material e mão de obra na mesma linha nas verbas de contrato até alguém separar no Plano; o histórico de importações não mostra a origem | `puxarDoCriativo` (`web/src/App.jsx:23015`) |

## Fora do escopo

- Aprovar, concluir e liberar para compra: `conf-executivo.md`.
- Liberação do CMV: `cmv.md`. Importação e registro: `vendido.md`.
- Alocação MAT/MO, separar/juntar mão de obra na mão e troca de produto: fichas do Plano de Compras e
  das Compras.
- Gravação protegida e trava por tela: `gravacao-da-obra.md` e ADR-004.

## Código

- `web/src/App.jsx` — `ExecutivoView`, `SaldoExecutivo`, `FormRemocao`, `resumoDoQueSePerde`,
  `frasesDoQueSePerde`, `importPlanilhaExecutivo`, `puxarDoCriativo`, `editarItemExecutivo`,
  `adicionarItemExecutivo`, `casarComCriativo`, `separarMOnasVerbasDeContrato`, `partirMaoDeObra`,
  `edicaoDerrubaAprovacao`, `CAMPOS_DO_PRODUTO`, `lerExecutivoPDF`, `lerPlanilhaExcel`,
  `BotaoApresentacao`
- `web/api/_lib/mondayApp.js` — `POST /api/executivo/parse`
- `web/api/_lib/rotas/obraDados.js`, `supabase/salvar-obra.sql` — gravação
- Testes: `web/src/__testes__/editar-executivo-casa-produto.test.mjs`, `substituir-executivo.test.mjs`,
  `remocao-justificada.test.mjs`, `inserir-linha.test.mjs`, `item-manual-executivo.test.mjs`,
  `plano-alocacao.test.mjs`
