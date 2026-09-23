# Compras de Produtos

**Módulo:** Obras (Planejamento) · **Arquétipos de tela:** listagem agrupada com funil de etapas e barra de seleção; formulário em diálogo (solicitação ao Sienge); relatórios para imprimir · **Onde fica:** obra → Planejamento → aba **Compras de Produtos** · rota `/obra/:codigo/compras`

## Objetivo

Para cada material **liberado para compra**, escolher por onde comprar (o canal), pedir orçamento,
marcar o que já foi solicitado e comprado, trocar produto quando preciso e — no canal Sienge —
associar o insumo do ERP e **criar a solicitação de compra direto no Sienge**, sem redigitar.

## Quem usa

| Perfil | O que pode | Onde é conferido |
|---|---|---|
| master, admin, geral, gc (nas suas obras) | com a edição da obra habilitada: canal, solicitado, comprado, insumo, troca, envio ao Sienge, observações | tela (`podeEditar`); gravação exige perfil de edição e acesso à obra (`exigirEdicaoDeObra`) e a trava no banco; o envio ao Sienge exige edição da obra (`web/api/_lib/mondayApp.js:805`) |
| taylor (nas suas obras) | consulta; pode escrever observação interna (a rota de observação só exige ver a obra) | tela; `web/api/_lib/rotas/comentarios.js:85` |
| mehoo, canal | não abrem obra — veem os itens do seu canal no painel (ver `painel-por-canal.md`) | tela |

Em modo leitura a tela avisa ("Modo leitura: para marcar solicitado, comprado, canal ou insumo,
habilite a edição da obra") e oferece **Habilitar edição** quando o perfil permite.

## Fluxo

1. A aba lista **só o material liberado para compra** (`produtosMAT`, `web/src/App.jsx:11603`):
   item com liberação (RN-001) ou que já tenha canal, solicitação, compra, seja avulso ou de
   aditivo aprovado. Mão de obra não entra; item sem valor mas liberado entra (decisão de
   17/09/2026). Itens de aditivo aprovado entram junto, e o que se marca neles grava em
   `comprasAditivo`.
2. Topo: quatro indicadores (material no executivo, já com canal, ainda sem canal, já comprado) e o
   **funil** de etapas: Tudo · Sem canal · Sienge · Mehoo · Automação · Cortinas e Persianas · GC
   · Estoque (`CANAIS_COMPRA`, `web/src/App.jsx:2047`), cada um com quantidade, valor e "N de M
   comprados".
3. Barra: busca, "com observação interna" (se houver), filtro por fornecedor, **Selecionar os N**,
   **Pedido de orçamento** (PDF só do fornecedor escolhido, com o que falta comprar; desabilitado
   com busca ligada).
4. A pessoa seleciona linhas (por item ou pela verba). A barra de seleção oferece:
   - **Definir canal** (ou tirar), com confirmação — grava `canalCompra` em cada item;
   - **Marcar/Desmarcar comprado** (só itens com canal; item do Sienge só se já solicitado);
   - na etapa Sienge: **Marcar/Desmarcar solicitado** (marcação manual, nada vai ao Sienge) e
     **Associar N** (aceita só a variante que casa inteira);
   - **PDF** e **Excel** do pedido; na etapa Sienge, **Resumo p/ cadastro** (Excel);
   - **Solicitar no Pipefy**: copia a lista e abre o formulário do Pipefy (nada é gravado);
   - na etapa Sienge: **Solicitar Compra no Sienge**.
5. Na linha: estado solicitado/comprado como botão, **trocar** (item não comprado, fora de
   aditivo) e, na etapa Sienge, a associação do insumo (mãe, variante, descritivo, códigos).
6. **Troca de produto**: formulário na própria linha, já preenchido com o produto atual; uma ou
   mais linhas novas (descrição, fornecedor, quantidade, unidade, custo unitário) e **quem
   aprovou** (pessoa ativa da equipe, obrigatória). O original fica riscado e não conta; as novas
   entram logo abaixo, herdando o canal. **desfazer** volta ao original se nenhuma nova foi comprada.
7. **Etapa Sienge**:
   1. Ao abrir, carrega a EAP Sienge padrão (versões, itens e mapa verba → folha) e os envios desta
      obra (pendentes e histórico).
   2. "Associar insumos" por verba casa cada produto com a base de insumos do Sienge (importada em
      Banco de Preços); a pessoa confirma mãe e variante na linha.
   3. Se houver envio **sem confirmação**, um aviso lista cada um com **conferir no Sienge**.
   4. **Solicitar Compra no Sienge** abre o modal (ver passo 8). O botão aparece mesmo sem a EAP,
      desabilitado e dizendo o que falta.
8. **Modal "Solicitar compra no Sienge"** (`ModalSolicitarSienge`, `web/src/App.jsx:14134`):
   1. Monta o pedido (`montarSolicitacaoSienge`, `web/src/lib/siengeSolicitacao.js:37`): o que
      não pode ir aparece com o motivo; iguais somam numa linha.
   2. Busca as unidades construtivas da obra no Sienge (a primeira vem escolhida) e o catálogo de
      detalhes dos insumos (detalhe casa só por descrição igual; senão fica em branco para escolher).
   3. Permite trocar a folha da EAP de uma verba — **grava no cadastro global** (`PUT /api/eap/mapa`)
      e remonta o pedido —, trocar o insumo e o detalhe de um item.
   4. Avisa se o **mesmo conteúdo** já foi enviado antes (pela assinatura do conteúdo), com opção
      de ver o que a solicitação anterior tem hoje no Sienge.
   5. **Enviar**: registra o envio (`POST /api/sienge-solicitacoes`, status `enviando`) **antes**;
      se o registro falhar, para e nada vai ao Sienge. Depois chama `POST /api/sienge/solicitacao`:
      o servidor confere a apropriação contra o orçamento da obra, cria o cabeçalho (solicitante
      VALENTINA) e manda um item por vez.
   6. Fecha o registro (`concluido` ou `parcial`; `falhou` só em 400 ou 503). Os itens aceitos ficam
      `solicitado` com `solicitacaoSienge { id, em, por }`; os recusados ficam pendentes com o erro
      do Sienge, e podem ser corrigidos (quantidade, observação) e **reenviados para a mesma
      solicitação**.
9. **Conferir no Sienge** (envio pendente): sem número, a pessoa diz se achou a solicitação no
   Sienge (e informa o número) ou se não existe (vira `abandonado`); com número, o app pergunta ao
   Sienge (`GET /api/sienge/solicitacao/:id`) e grava `abandonado` (não existe) ou `parcial`
   (existe; a API não lista os itens, então nunca vira `concluido` por aqui).
10. **Histórico**: bloco recolhido "N solicitações enviadas ao Sienge", com o que foi pedido em cada
    uma e o resultado item a item.
11. **Observações internas** por verba e por produto (tabela própria, fora da obra, sem precisar da
    trava).

## Telas

| Tela / bloco | Arquétipo | Rota ou aba | Componente em App.jsx |
|---|---|---|---|
| Compras de Produtos (KPIs, funil, lista por verba, barra de seleção) | listagem agrupada | `/obra/:codigo/compras` | `ComprasView` (`web/src/App.jsx:12657`) |
| Linha do produto | linha de tabela | — | `LinhaCompra` (`:15275`) |
| Troca de produto | formulário na linha | — | `FormTroca` (`:15084`) |
| Associação do insumo | células da linha | — | `AssociacaoSienge`, `situacaoNoSienge` (`:14936`) |
| Solicitar compra no Sienge | formulário em diálogo cheio | — | `ModalSolicitarSienge` (`:14134`) |
| Pedido de orçamento / pedido | relatório para imprimir | — | `PedidoOrcamento`, `PedidoCompra` |
| Conferência com o Sienge (PDF) | cartão | — | bloco `confronto` em `ComprasView` (`:12999`) — ver riscos |

## Estados e mensagens

| Estado | O que a tela mostra |
|---|---|
| Nenhum material liberado | "Esta obra ainda não tem material no executivo" (o texto não fala em liberação) |
| Etapa vazia / busca vazia | "Nada nesta etapa." / "Nada encontrado para "…" nesta etapa." |
| Modo leitura | aviso azul; botões desabilitados com "modo leitura: habilite a edição da obra para mudar"; se outra pessoa edita, o nome dela |
| Base de insumos vazia | "A base de insumos do Sienge está vazia — importe o relatório em Banco de Preços." |
| Sem EAP Sienge | botão "Solicitar Compra no Sienge · falta a EAP", com o caminho no título |
| Envio sem resposta | aviso amarelo "Um envio ao Sienge ficou sem confirmação" + conferir |
| Registro não gravou | "O envio foi INTERROMPIDO de propósito, e nada foi mandado" (ou orientação de rodar `supabase/sienge_solicitacao.sql`) |
| Criou no Sienge mas não registrou aqui | "NÃO envie de novo — no Sienge está tudo certo" |
| Recusa do Sienge | a mensagem do Sienge crua (`clientMessage`), por item |
| Comprado em lote parcial | "Nem tudo foi marcado como comprado — N itens do Sienge ainda não foram solicitados" |
| Pipefy | "Lista de N itens copiada" com o passo a passo, ou a lista para copiar à mão |

## Dados

No item (`categorias[].itens[]`, JSONB; para item de aditivo, em `categorias[].comprasAditivo[id]`):

| Campo | Significado |
|---|---|
| `canalCompra` | `sienge`, `mehoo`, `automacao`, `cortinas`, `gc`, `estoque` ou vazio |
| `solicitado`, `solicitadoEm` | solicitado no Sienge (manual ou pelo envio) |
| `solicitacaoSienge` `{ id, em, por }` | número da solicitação criada pelo app |
| `comprado`, `compradoEm` | comprado (sem autor gravado) |
| `maeSienge`, `detalheSienge`, `descritivoSienge`, `codigoDetalheSienge`, `codigoAuxSienge` | associação ao cadastro do Sienge |
| `troca` `{ em, por, aprovadoPor, motivo, novas }` | no original trocado |
| `trocaDe`, `trocaEm`, `trocaPor` | nas linhas novas da troca |

Tabelas: `sienge_solicitacao` (registro do envio: `obra_codigo`, `building_id`, `solicitacao_id`,
`enviado_por`, `enviado_em`, `payload`, `resposta`, `ok`, `status` = enviando/concluido/parcial/
falhou/abandonado, `idempotency_key`, `assinatura`, `reconciliado_por/em`); `sienge_eap_versao`,
`sienge_eap_item`, `sienge_eap_mapa` (ADR-002); `insumo_sienge` e `insumo_preco` (base de insumos);
`obra_comentario` (observações internas).

## APIs

| Método | Rota | Autorização no servidor | Arquivo:linha | O que faz |
|---|---|---|---|---|
| POST | `/api/obras/:codigo/patch` | perfil de edição + acesso à obra; banco confere trava e versão | `web/api/_lib/rotas/obraDados.js:129` | canal, solicitado, comprado (campos de patch) |
| POST | `/api/obras/:codigo/gravar` | idem | `web/api/_lib/rotas/obraDados.js:105` | troca de produto, associação do insumo |
| POST | `/api/sienge/solicitacao` | login, membro, edição da obra (`buildingId`) | `web/api/_lib/mondayApp.js:805` | confere formato e apropriação, cria a solicitação (ou reenvia para uma existente da mesma obra) e manda os itens um a um |
| GET | `/api/sienge/solicitacao/:id` | login, membro; devolve "não encontrada" se o usuário não vê a obra da solicitação | `web/api/_lib/mondayApp.js:1082` | o que o Sienge tem daquela solicitação (cabeçalho) |
| GET | `/api/sienge/insumos/:buildingId?ids=` | ver a obra | `web/api/_lib/mondayApp.js:1006` | detalhes dos insumos (cache de 30 min) |
| GET | `/api/sienge/obra/:buildingId/unidades` | ver a obra | `web/api/_lib/mondayApp.js:1045` | unidades construtivas da obra |
| POST | `/api/sienge-solicitacoes` | edição da obra; banco: editor na própria obra | `web/api/_lib/rotas/siengeBanco.js:169` | abre o registro (`enviando`); chave repetida → 409 |
| PUT | `/api/sienge-solicitacoes/:id` | edição da obra da linha | `web/api/_lib/rotas/siengeBanco.js:245` | fecha o registro com status, ok e resposta do corpo |
| PUT | `/api/sienge-solicitacoes/:id/reconciliar` | idem | `web/api/_lib/rotas/siengeBanco.js:266` | encerra pendente; grava quem conferiu (login) |
| GET | `/api/sienge-solicitacoes?obra=` · `/pendentes` · `/mesmo-conteudo` | ver a obra | `web/api/_lib/rotas/siengeBanco.js:291`, `:307`, `:322` | histórico, pendentes, envio anterior igual |
| GET/PUT | `/api/eap/versoes/:id`, `/api/eap/mapa` | login e membro; banco: escrita por quem edita | `web/api/_lib/rotas/eap.js:111`, `:245` | EAP e mapa verba → folha |
| GET | `/api/insumos/sienge`, `/api/insumos/precos/pagina` | login e membro | `web/api/_lib/rotas/insumos.js:294`, `:208` | base de insumos para associar |
| GET/POST/DELETE | `/api/obras/:codigo/comentarios`, `/api/comentarios/:id` | ver a obra | `web/api/_lib/rotas/comentarios.js:65`, `:85`, `:116` | observações internas |

## Integrações

- **Sienge** (API REST, credencial só no servidor — ADR-003, decisão 1): criação de solicitação,
  consulta de solicitação, catálogo de detalhes, unidades construtivas, itens do orçamento. Ver
  `docs/ADR-003-solicitacao-compra-sienge.md` e `docs/ADR-002-eap-sienge.md`.
- **Pipefy**: só abre o formulário e copia a lista; nada é enviado pelo app.

## Regras de negócio usadas

- RN-001 — Só o administrador libera a compra (é a liberação que põe o item nesta tela).
- [RN-043](../regras-de-negocio/RN-043-o-que-conta-como-liberado.md) — só item liberado aparece aqui; canal, solicitado, comprado, avulso e aditivo contam como liberado.
- [RN-044](../regras-de-negocio/RN-044-material-para-compras-mo-para-contratos.md) — só a parcela de material chega aqui.
- [RN-051](../regras-de-negocio/RN-051-sienge-comprado-depois-de-solicitado.md) — no Sienge, primeiro solicitado, depois comprado.
- [RN-052](../regras-de-negocio/RN-052-troca-de-produto-exige-aprovador.md) — troca exige quem aprovou; item comprado não troca.
- [RN-053](../regras-de-negocio/RN-053-item-elegivel-para-o-sienge.md) — o que precisa estar certo para o item ir ao Sienge.
- [RN-054](../regras-de-negocio/RN-054-solicitacao-soma-itens-iguais.md) — iguais somam numa linha.
- [RN-055](../regras-de-negocio/RN-055-solicitacao-registrada-antes-do-envio.md) — registro antes, conferência do pendente, só o aceito vira solicitado.
- [RN-056](../regras-de-negocio/RN-056-solicitante-sienge-fixo.md) — o solicitante no Sienge é sempre VALENTINA.

## Riscos conhecidos

| Gravidade | Risco | Cenário | Onde no código |
|---|---|---|---|
| alta | O servidor não confere liberação nem o registro prévio | `POST /api/sienge/solicitacao` recebe os itens do navegador e só valida formato e apropriação: quem edita a obra pode mandar ao Sienge item não liberado, já solicitado, ou sem passar por `sienge_solicitacao` | `web/api/_lib/mondayApp.js:805`; `web/api/_lib/validacao.js:96` |
| alta | Chamadas repetidas duplicam solicitação | a idempotência (chave e assinatura) mora no registro, que a tela abre antes; chamar a rota direto (ou repetir) cria outra solicitação, e a API do Sienge não apaga | `web/api/_lib/mondayApp.js:805`; ADR-003, decisão 8 |
| média | Fechamento aceita qualquer status do corpo | `PUT /api/sienge-solicitacoes/:id` aceita `status`, `ok` e `solicitacaoId` do navegador, sem máquina de estados: dá para rebaixar `concluido` para `abandonado` (a tela passa a convidar a reenviar) ou trocar o número, e essa rota não grava quem fez | `web/api/_lib/rotas/siengeBanco.js:65`, `:245` |
| média | Canal conta como liberado | a RN-001 no banco só vigia `liberadoCompra`; gravar `canalCompra` (ou `solicitado`/`comprado`) num item não liberado, por patch, faz ele contar como liberado e aparecer aqui. Tirar a liberação de um item com canal também não o tira das Compras | `web/src/App.jsx:11370`; `supabase/rn-001-liberacao-de-compra.sql` |
| média | Linha nova da troca pode sumir | a linha nova herda o canal do original; se o original estava "Sem canal" e liberado só pela RN-001, a linha nova não tem liberação nem canal e sai da lista (suposição a confirmar com um caso real) | `web/src/App.jsx:23625`, `:11370` |
| média | Trocar a folha da EAP no envio vale para todas as obras | quem edita qualquer obra muda o mapa global verba → folha (custo aceito no ADR-003, decisão 5) | `web/src/App.jsx:14380`; `web/api/_lib/rotas/eap.js:245` |
| baixa | Conferência por PDF sem entrada | o bloco "Conferência com o Sienge" e a coluna "Lançado Sienge" existem, mas nada na tela carrega o PDF (`setDoSienge` só limpa; `parsePedidoSienge` é importado e não usado) | `web/src/App.jsx:12999`; `web/src/lib/siengePedido.js` |
| baixa | ADR-003 e código divergem no detalhe | o ADR (decisão 9) fala em sugestão "parecida" com 70% das palavras; o código só casa descrição igual | `web/src/lib/siengeSolicitacao.js` (`acharDetalhe`) |
| baixa | Comprado sem autor | `compradoEm` é gravado sem quem marcou; o histórico mostra a data sem nome | `web/src/App.jsx:3040` |

## Fora do escopo

- Liberar o item para compra: Conferência do executivo (RN-001).
- Cadastro da EAP Sienge e do mapa (módulo EAP Sienge) e da base de insumos (Banco de Preços).
- O que acontece com a solicitação dentro do Sienge (cotação, pedido, entrega).

## Código

- `web/src/App.jsx` — `ComprasView`, `LinhaCompra`, `FormTroca`, `ModalSolicitarSienge`, `produtosMAT`, `liberadoParaCompra`, `estaSolicitado`, `podeMarcarComprado`, `situacaoNoSienge`, `CANAIS_COMPRA`; no `App`: `updateItem`, `atualizarCompraDeAditivo`, `trocarProduto`, `desfazerTroca`
- `web/src/lib/siengeSolicitacao.js` (montagem e elegibilidade), `web/src/lib/siengeSolicitacoes.js` (registro dos envios), `web/src/lib/sienge.js` (casamento com a base, unidade do Sienge, template), `web/src/lib/siengePedido.js` (leitura do pedido e conferência), `web/src/lib/eapSienge.js`, `web/src/lib/eapApropriacao.js`, `web/src/lib/insumos.js`
- `web/api/_lib/mondayApp.js` (rotas `/api/sienge/*`), `web/api/_lib/sienge.js` (cliente), `web/api/_lib/rotas/siengeBanco.js`, `web/api/_lib/rotas/eap.js`, `web/api/_lib/rotas/insumos.js`, `web/api/_lib/rotas/comentarios.js`
- `supabase/sienge_solicitacao.sql`, `supabase/sienge_eap.sql`, `supabase/rls-reforco.sql`, `supabase/rls-perfis-complemento.sql`
- Decisões: `docs/ADR-002-eap-sienge.md`, `docs/ADR-003-solicitacao-compra-sienge.md`
- Testes: `web/src/__testes__/sienge-solicitacao.test.mjs`, `sienge-idempotencia.test.mjs`, `conferir-envio-sienge.test.mjs`, `solicitado-comprado.test.mjs`, `troca-produto.test.mjs`, `compras-modo-leitura.test.mjs`, `patch-compras.test.mjs`, `aditivo-nas-compras.test.mjs`, `eap-sienge.test.mjs`, `sienge.test.mjs`, `sienge-pedido.test.mjs`
