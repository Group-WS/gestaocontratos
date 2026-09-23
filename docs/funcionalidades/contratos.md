# Contratos (mão de obra) e Diário de Obra

**Módulo:** Obras (Execução) · **Arquétipos de tela:** listagem agrupada com esteira de etapas e barra de seleção; formulário em diálogo (solicitação avulsa); detalhe/documento (escopo de contratação); página de sistema (Diário, em construção) · **Onde fica:** obra → Execução → abas **Contratos** (`/obra/:codigo/contratos`) e **Diário de Obra** (`/obra/:codigo/diario`)

## Objetivo

**Contratos** acompanha cada serviço (a parcela de mão de obra dos itens do executivo) da
solicitação ao contrato e à medição, e monta o **escopo de contratação**: um documento com os
serviços escolhidos, o orçado (a soma da mão de obra deles) e o texto de um modelo, para comparar
com a proposta do fornecedor e imprimir.

**Diário de Obra** é o lugar reservado para o registro do dia a dia da obra; hoje só mostra
"em construção".

## Quem usa

| Perfil | O que pode | Onde é conferido |
|---|---|---|
| master, admin, geral, gc (nas suas obras) | com a edição da obra habilitada: avançar a etapa do contrato, criar solicitação avulsa, abrir, editar e apagar escopo | tela, parcialmente (ver riscos); a gravação exige perfil de edição e acesso à obra (`exigirEdicaoDeObra`) e a trava no banco |
| taylor (nas suas obras) | consulta | tela; servidor recusa gravar |
| mehoo, canal | não abrem obra | tela |

## Fluxo

1. A aba lista os **serviços**: todo item com parcela de mão de obra, ou classificado como só
   mão de obra (`servicosMO`, `web/src/App.jsx:15597`). Não depende de liberação para compra.
2. Topo: indicadores "Mão de obra no executivo", "Já em processo de contratação", "Ainda a
   contratar" e a **esteira**: Não solicitado → Solicitação → Aprovação → Contrato → Prev. medição
   → Medição / NF (`CONTRATO_PIPELINE`, `:15474`). Cada etapa mostra quantos serviços e quanto
   dinheiro; clicar filtra.
3. Serviços com o alerta de **fora do escopo** não aprovado ficam fora da lista e dos totais, num
   aviso vermelho "N serviços bloqueados — aguardando aprovação de escopo". A aprovação é feita no
   Plano de Compras ("Aprovar p/ compra").
4. Os serviços aparecem por verba. Em cada linha: descrição, custo do item, etapa atual, **Avançar
   etapa** (vai para a próxima; não há volta) e o valor de mão de obra. Na última etapa aparece
   "Concluído".
5. **Nova solicitação de contrato** (topo): diálogo com verba, descrição, quantidade, unidade e
   custo estimado. O serviço entra na verba com código `<verba>.avN`, `tipo: "servico"` e já na
   etapa "Solicitação".
6. **Abrir escopo**: a pessoa marca serviços (por linha ou por verba) e, com edição, clica
   **Abrir escopo** na barra de seleção. No formulário escolhe o **modelo** (sugerido quando todos
   os serviços são da mesma verba), fornecedor, início e fim. O escopo nasce com o orçado, a lista
   dos serviços e uma **cópia** do texto do modelo (itens, medições, garantia, cronograma,
   observações); modelo "parcelado" já vem com 4 parcelas sobre o orçado.
7. **Escopo aberto**: valor do contrato (mostra quanto está acima ou abaixo do orçado), fornecedor,
   datas, parcelas e vencimentos, e o texto editável no próprio documento; **imprimir** abre a
   impressão do navegador; **apagar** pede confirmação ("Os serviços continuam na obra — some só o
   documento"). Na linha do serviço, uma lupa abre o escopo de que ele faz parte.
8. **Concluir etapa** (botão genérico da barra de etapas, para a aba Contratos) grava quem e quando
   em `etapasConcluidas` — não confere se os contratos estão fechados.
9. **Diário de Obra**: página com o aviso "Esta área ainda está em construção". Não grava nada.

## Telas

| Tela / bloco | Arquétipo | Rota ou aba | Componente em App.jsx |
|---|---|---|---|
| Contratos de mão de obra (KPIs, esteira, lista por verba, barra de seleção) | listagem agrupada | `/obra/:codigo/contratos` | `DashboardMO` (`web/src/App.jsx:16011`) |
| Linha do serviço | linha de lista | — | `ContratosRow` (`:15493`), `ContratoStatus` (`:311`) |
| Nova solicitação de contrato | formulário em diálogo | — | `NovaSolicitacaoForm` (`:15520`) |
| Novo escopo de contratação | formulário | — | `FormNovoEscopo` (`:15622`) |
| Escopo aberto (documento) | detalhe / documento para imprimir | — | `EscopoAberto` (`:15717`), `DocumentoEscopo` |
| Diário de Obra | página de sistema (vazio) | `/obra/:codigo/diario` | bloco `tab === "diario"` (`:25832`) |

## Estados e mensagens

| Estado | O que a tela mostra |
|---|---|
| Obra sem mão de obra no executivo | "Esta obra ainda não tem mão de obra no executivo" + a opção de criar solicitação avulsa |
| Etapa filtrada sem serviços | "Nada nesta etapa." |
| Serviço bloqueado | selo "Bloqueado — aguardando aprovação de escopo" e aviso vermelho com a contagem |
| Escopo sem modelo | "Escolha o modelo de escopo." |
| Modo leitura | no escopo, campos desabilitados e texto não editável; "Abrir escopo" não aparece. **Avançar etapa** e **Nova solicitação de contrato** continuam aparecendo (ver riscos) |
| Diário | "Esta área ainda está em construção. Em breve a equipe vai registrar aqui o dia a dia da obra." |

## Dados

No item (`categorias[].itens[]`, JSONB):

| Campo | Significado |
|---|---|
| `statusContrato` | `solicitacao`, `aprovacao`, `contrato_gerado`, `previsao_medicao`, `medicao_liberada`; vazio = não solicitado (`contratoEtapa`, `web/src/App.jsx:2060`) |
| `foraDeEscopo`, `statusEscopo` | bloqueio de escopo e sua aprovação |
| `tipo: "servico"`, `custo`, `qtdExecutivo`, `un` | na solicitação avulsa |

Na obra: `escopos` (coluna `escopos` de `obra_dados`), lista de `{ id, modelo, nome, banda, modo,
fornecedor, inicio, fim, orcado, servicos[{ catNum, catNome, codigo, desc, mo }], itens, medicoes,
parcelas, venc1, intervalo, garantia, crono, obs, criadoEm, criadoPor, valorContrato }`.
`etapasConcluidas.contratos` guarda a conclusão da aba.

O Diário não tem dado.

## APIs

| Método | Rota | Autorização no servidor | Arquivo:linha | O que faz |
|---|---|---|---|---|
| POST | `/api/obras/:codigo/gravar` | login, membro, perfil de edição e acesso à obra; banco confere trava e versão | `web/api/_lib/rotas/obraDados.js:105` | grava etapa do contrato, solicitação avulsa e escopos (nenhum desses campos vai por patch) |
| POST | `/api/obras/:codigo/patch` | idem | `web/api/_lib/rotas/obraDados.js:129` | conclusão da etapa (`etapas_concluidas`) |

## Integrações

Nenhuma. Os modelos de escopo moram no código (`MODELOS_ESCOPO`, `web/src/lib/escopos.js`).

## Regras de negócio usadas

- [RN-044](../regras-de-negocio/RN-044-material-para-compras-mo-para-contratos.md) — só a parcela de mão de obra chega aqui.
- [RN-049](../regras-de-negocio/RN-049-fora-do-escopo-bloqueado.md) — serviço fora do escopo não avança até ser aprovado.
- [RN-057](../regras-de-negocio/RN-057-mao-de-obra-contratada-desde-a-solicitacao.md) — a mão de obra conta como contratada a partir da solicitação.
- [RN-058](../regras-de-negocio/RN-058-escopo-copia-o-modelo.md) — o orçado é a soma da MO dos serviços e o texto do modelo é copiado.

## Riscos conhecidos

| Gravidade | Risco | Cenário | Onde no código |
|---|---|---|---|
| média | Botões sem trava de edição | "Avançar etapa" e "Nova solicitação de contrato" não conferem `podeEditar`: em modo leitura a tela muda, mas a gravação só roda com a trava — a mudança some no F5 | `web/src/App.jsx:15493`, `:16011` (uso de `NovaSolicitacaoForm`) |
| média | Etapa do contrato só anda para frente e sem autor | não há como voltar uma etapa marcada por engano; `statusContrato` não guarda quem nem quando | `web/src/App.jsx:15489`, `:15493` |
| média | "Contratada" conta a partir da solicitação | a Gestão e os KPIs somam como contratado o que só foi solicitado; quem lê "já contratada" pode entender contrato assinado | `web/src/App.jsx:2108`, `:16011` |
| baixa | Escopo guarda cópia dos serviços | se o item muda de valor depois, o orçado do escopo continua o antigo (é a intenção — retrato), mas nada avisa da diferença | `web/src/App.jsx:15622` |
| baixa | Formulário do escopo fora do DS | `FormNovoEscopo` ainda usa classes próprias (`form-solicitacao`, `form-row`) | `web/src/App.jsx:15622` |
| baixa | Diário de Obra vazio conta como etapa | a aba aparece na esteira de Execução sem funcionalidade | `web/src/App.jsx:11159`, `:25832` |

## Fora do escopo

- Aprovação de contrato, assinatura e medição fora do app (o app só registra a etapa).
- Compra do material: Compras de Produtos.
- Aprovar item fora do escopo: Plano de Compras.

## Código

- `web/src/App.jsx` — `DashboardMO`, `ContratosRow`, `ContratoStatus`, `NovaSolicitacaoForm`, `FormNovoEscopo`, `EscopoAberto`, `DocumentoEscopo`, `servicosMO`, `CONTRATO_PIPELINE`, `PROXIMA_ETAPA`, `contratoBloqueado`, `contratoEtapa`; no `App`: `updateItem`, `criarSolicitacaoContrato`, `criarEscopo`, `mudarEscopo`, `apagarEscopo`
- `web/src/lib/escopos.js` (modelos de escopo; teste `web/src/__testes__/escopos.test.mjs`)
- `web/api/_lib/rotas/obraDados.js`, `supabase/salvar-obra.sql`
