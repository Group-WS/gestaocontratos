# Plano de Compras

**Módulo:** Obras (Planejamento) · **Arquétipos de tela:** listagem agrupada (verbas em blocos que abrem e fecham), formulário em diálogo (compra avulsa, liberação) · **Onde fica:** obra → Planejamento → aba **Plano de Compras** · rota `/obra/:codigo/plano`

## Objetivo

Mostrar, verba a verba, o que a obra vai comprar e contratar e com que dinheiro: cada item do
Executivo partido em **material** (vai para Compras de Produtos) e **mão de obra** (vai para
Contratos), com o prazo de compra de cada grupo. É também onde o time **libera o plano de
compras** da obra — o ato que congela as etapas anteriores — e onde se registra a **compra
avulsa** (o que a obra precisa e o executivo não tinha).

## Quem usa

| Perfil | O que pode | Onde é conferido |
|---|---|---|
| master, admin, geral | ver e, com a edição da obra habilitada, tudo desta tela | tela (`podeEditar = edicao.minha`); servidor exige perfil de edição e acesso à obra para gravar (`exigirEdicaoDeObra`, `web/api/_lib/rotas/obraDados.js:105` e `:129`); banco confere a trava e a versão (`salvar_obra`) |
| gc | o mesmo, nas obras em que é GC, Taylor Made ou Executivo (e nas sem GC) | idem; o recorte de obras vem de `minhas_obras()` no banco |
| taylor | só consulta, nas suas obras | tela (perfil sem `edita`); servidor recusa gravar |
| mehoo, canal | não abrem obra | tela (`podeAbrirObras`) |

**Liberar e reabrir o plano** não têm permissão própria: qualquer perfil com edição e a trava faz
os dois. Isso é diferente da liberação **item a item** (RN-001), que é só do administrador.

## Fluxo

1. A pessoa abre a aba. A tela monta a obra **com os itens de aditivo aprovado** dentro do grupo de
   cada um (derivado na hora, nunca gravado: `categoriasComAditivos`, `web/src/App.jsx:2527`).
2. Por padrão aparece **só o vendido** — linhas de proposta com quantidade e valor zerados ficam
   escondidas, e o chip diz quantas. A compra avulsa aparece sempre.
3. Filtros na barra:
   - busca por insumo, código ou fornecedor (abre as verbas sozinha; morre ao trocar de aba);
   - **alocação**: Todas · MAT · MO · MAT+MO, com a contagem de cada uma (as três somam o total);
   - **situação**: Todos · Liberado p/ compra · A liberar (estimativa) · Sem destino · Já comprado ·
     Falta comprar · Com alerta (`FILTERS`, `web/src/App.jsx:4090`; regra em `matchesFilter`,
     `:385`). Os filtros de situação só mostram itens com material — mão de obra não entra neles.
4. Cada verba mostra prazo de compra ("comprar até" + dias que faltam, calculado da data de entrega
   da obra), total de MAT e de MO, e as marcas de avulso e aditivo. Sem data de entrega na obra e
   com algum grupo com prazo, aparece um aviso único com o atalho "Definir no Dashboard".
5. Na linha do item, quem tem edição pode:
   - **corrigir a alocação** (etiqueta MAT/MO/MAT+MO). O valor troca de coluna, o total não muda. A
     correção grava no item **e** vira padrão da empresa para aquela descrição (PUT
     `/api/alocacao-padrao`). Se o item passa de MO para material e ainda não contava como
     liberado, entra já liberado com a marca "via alocação" (exceção da RN-001;
     `liberacaoAoRealocar`, `:11398`);
   - **separar MO**: cria logo abaixo, na mesma verba, a linha só de mão de obra; **juntar de
     volta** desfaz. Com itens a separar no grupo, aparece **Separar MO do grupo**;
   - **Aprovar p/ compra** (só em item com alerta de fora do escopo): pede confirmação e grava
     `statusEscopo: "aprovado"`; a tela não oferece desfazer.
6. **Compra avulsa** (topo, só com edição, também depois da liberação): diálogo com verba,
   descrição, quantidade, unidade, ambiente e alocação — sem valor. O item nasce em `cat.itens`
   com código `<verba>.avN`, marcado com quem pediu e quando, e já conta como liberado.
7. **Liberar compra** (topo, antes da liberação): abre o diálogo "Liberar plano de compras".
   - Sem itens no Executivo, o botão final fica desabilitado.
   - Se o custo do Executivo passa do CMV liberado, a tela exige **justificativa** (15 letras ou
     mais) e **Autorizado por** (texto livre, 3 letras ou mais).
   - Ao confirmar, a obra passa a `comprasLiberadas = true`; as etapas anteriores ficam
     congeladas e aparece o aviso verde "Plano de Compras liberado".
8. **Reabrir etapas** (topo, depois da liberação, só com edição): confirmação e
   `comprasLiberadas = false` vai por patch. Compras e contratações já feitas não são desfeitas.

## Telas

| Tela / bloco | Arquétipo | Rota ou aba | Componente em App.jsx |
|---|---|---|---|
| Plano de Compras (página, barra, avisos, KPIs, legenda) | listagem agrupada | `/obra/:codigo/plano` | `ComparativoView` (`web/src/App.jsx:4229`) |
| Grupo (verba) | bloco que abre e fecha com tabela | — | `GrupoPlano` (`:3865`) |
| Linha do item | linha de tabela | — | `LinhaPlano` (`:3583`) |
| Prazo de compra do grupo | célula | — | `PrazoCompra` (acima de `GrupoPlano`) |
| Compra avulsa | formulário em diálogo | — | `FormAvulsa` (`:3991`) |
| Liberar plano de compras | formulário em diálogo | — | `LiberacaoCompra` (`:4115`) |

## Estados e mensagens

| Estado | O que a tela mostra |
|---|---|
| Sem itens no Executivo | diálogo de liberação diz "Importe o Executivo desta obra antes de liberar"; sem KPIs |
| Plano não liberado | aviso azul "Ao liberar, as etapas anteriores são congeladas"; KPIs Material no plano, Mão de obra, Já comprado |
| Plano liberado | aviso verde "Plano de Compras liberado — as etapas anteriores estão congeladas"; KPIs somem |
| Acima do CMV | no diálogo: "O Executivo está R$ X acima do CMV liberado (R$ Y)" + campos obrigatórios |
| Sem data de entrega | aviso amarelo com "Definir no Dashboard" |
| Nenhum item com os filtros | "Nenhum item com esses filtros" / "Nenhum item com esse termo" + **Limpar filtros** |
| Modo leitura | botões de liberar/aprovar desabilitados com a dica "modo leitura: habilite a edição da obra para mudar"; avulsa, separar e reabrir não aparecem |
| Falha ao gravar o padrão de alocação | aviso "Alocação aplicada nesta obra, mas não virou padrão da empresa" |
| Cor da linha | aditivo, avulso, alerta, comprado (verde), não liberado (clarinho = estimativa), falta comprar (amarelo) |

## Dados

Na obra (`obra_dados`):

| Campo na tela | Coluna | Significado |
|---|---|---|
| `comprasLiberadas` | `compras_liberadas` | plano liberado; congela as etapas anteriores |
| `compraSemAssinaturaPor/Em/Just` | `compra_sem_assinatura_*` | exceção de liberar sem a assinatura do cliente — desligada desde 18/09/2026 (`semAssinatura = false`, `web/src/App.jsx:4137`), então hoje nunca é preenchida |
| `compraLiberadaEm`, `compraLiberadaPor`, `estouroAprovado` | **nenhuma** | montados em `liberarCompras` mas **não estão** na lista de campos gravados (`COLUNA_DO_CAMPO`, `web/src/lib/gravacaoObra.js:13`): somem ao recarregar |

No item (`categorias[].itens[]`, JSONB):

| Campo | Significado |
|---|---|
| `alocacaoManual` | correção de alocação nesta obra (`MAT`, `MO`, `AMBOS`) |
| `moSeparada` `{ valor, codigo }` / `separadoDe` `{ codigo, verba, desc }` | as duas pontas de uma separação de mão de obra |
| `statusEscopo: "aprovado"` | item fora do escopo aprovado para seguir |
| `avulso`, `avulsoPor`, `avulsoEm`, `compraDecidida`, `liberado`, `alocacao`, `custo: null` | compra avulsa |
| `liberadoCompra` `{ em, por, viaAlocacao }` | liberação do item (RN-001); só é escrita aqui via alocação |

Tabela da empresa: `alocacao_padrao` (`descricao_norm`, `descricao`, `alocacao`, `por`, `em`).

Compra de item de aditivo: `categorias[].comprasAditivo[<id do item>]` (o item do aditivo não mora
na planilha).

## APIs

| Método | Rota | Autorização no servidor | Arquivo:linha | O que faz |
|---|---|---|---|---|
| POST | `/api/obras/:codigo/gravar` | login, membro, perfil de edição e acesso à obra; banco confere trava e versão | `web/api/_lib/rotas/obraDados.js:105` | grava a obra inteira (liberação, avulsa, separação, alocação) |
| POST | `/api/obras/:codigo/patch` | idem | `web/api/_lib/rotas/obraDados.js:129` | grava só campos da lista de patch (`compras_liberadas` ao reabrir; `liberadoCompra` via alocação; compra de aditivo) |
| GET | `/api/alocacao-padrao` | login e membro | `web/api/_lib/rotas/cadastros.js:68` | lê os padrões da empresa |
| PUT | `/api/alocacao-padrao` | login e membro; banco só aceita master, admin, geral, gc | `web/api/_lib/rotas/cadastros.js:76` | grava o padrão; o autor sai do login |
| DELETE | `/api/alocacao-padrao/:chave` | idem | `web/api/_lib/rotas/cadastros.js:95` | tira o padrão daquela descrição |

## Integrações

Nenhuma direta. Os aditivos aprovados entram pelo módulo Aditivos.

## Regras de negócio usadas

- RN-001 — Só o administrador libera a compra (a exceção da alocação acontece nesta tela; os
  filtros "Liberado p/ compra" e "A liberar" leem a liberação).
- [RN-047](../regras-de-negocio/RN-047-acima-do-cmv-exige-justificativa.md) — liberar o plano acima do CMV exige justificativa e o nome de quem autorizou.
- [RN-048](../regras-de-negocio/RN-048-plano-liberado-congela-etapas.md) — liberado o plano, as etapas anteriores param de aceitar alteração até reabrir.
- [RN-044](../regras-de-negocio/RN-044-material-para-compras-mo-para-contratos.md) — material vai para Compras, mão de obra para Contratos; corrigir a alocação não muda o total.
- [RN-036](../regras-de-negocio/RN-036-mao-de-obra-separada-por-verba.md) — nas verbas 05, 20, 24, 27 e 28 a mão de obra vira linha própria.
- [RN-045](../regras-de-negocio/RN-045-alocacao-corrigida-vira-padrao.md) — corrigir a alocação vale para toda obra com a mesma descrição.
- [RN-046](../regras-de-negocio/RN-046-compra-avulsa-sem-valor.md) — a compra avulsa entra sem valor e não mexe no CMV.
- [RN-050](../regras-de-negocio/RN-050-prazo-de-compra-por-grupo.md) — antecedência de compra por grupo, contada da entrega.
- [RN-043](../regras-de-negocio/RN-043-o-que-conta-como-liberado.md) — além da liberação, canal, solicitado, comprado, avulso e aditivo contam como liberado.
- [RN-049](../regras-de-negocio/RN-049-fora-do-escopo-bloqueado.md) — item fora do escopo vendido só segue depois de aprovado.

## Riscos conhecidos

| Gravidade | Risco | Cenário | Onde no código |
|---|---|---|---|
| alta | Liberar e reabrir o plano só são controlados na tela | qualquer perfil com edição (inclusive o GC) libera ou reabre; pela API, `compras_liberadas` é aceita de qualquer editor da obra, e nenhum gatilho confere quem | `web/src/App.jsx:23169`, `:23205`; `supabase/patch-obra.sql:152`; `supabase/salvar-obra.sql:139` |
| alta | A justificativa do estouro do CMV não é gravada | a tela exige justificativa e "Autorizado por", mas `estouroAprovado`, `compraLiberadaEm` e `compraLiberadaPor` não estão em `COLUNA_DO_CAMPO`: somem no recarregar; o evento "liberou_compras" do histórico só existe até o F5 | `web/src/App.jsx:23169`, `:3046`; `web/src/lib/gravacaoObra.js:13` |
| média | "Autorizado por" é texto livre | o nome de quem autorizou não é conferido contra a equipe | `web/src/App.jsx:4115` |
| média | Reabrir não deixa trilha | reabrir só grava `compras_liberadas = false`, sem quem nem quando; o histórico da obra guarda a versão, mas não um evento | `web/src/App.jsx:23205` |
| média | O congelamento é só da tela | com o plano liberado, o banco continua aceitando gravação do Executivo e do Vendido por quem edita | leitura de `obra.comprasLiberadas` nas telas; `supabase/salvar-obra.sql` |
| média | Compra avulsa conta como liberada sem RN-001 | o GC cria uma avulsa de material e ela vai direto para Compras (é a intenção do desenho, mas contorna a regra de "só o administrador libera") | `web/src/App.jsx:3991`, `:11370` |
| baixa | Exceção "sem assinatura" desligada, mas o código e as colunas seguem | `semAssinatura = false` fixo; comentários em outros pontos ainda falam do "portão da assinatura" | `web/src/App.jsx:4137`, `:11178` |
| baixa | Aprovar item fora do escopo não tem volta nem controle de perfil | qualquer editor aprova; a tela não desfaz | `GrupoPlano`, `web/src/App.jsx:3865` |

## Fora do escopo

- A liberação item a item e a aprovação do cliente: Conferência do executivo (RN-001).
- A escolha de canal, a solicitação e a compra: Compras de Produtos.
- A contratação da mão de obra: Contratos.
- Como a gravação chega ao banco (trava, versão, conflito): `gravacao-da-obra.md`.

## Código

- `web/src/App.jsx` — `ComparativoView`, `GrupoPlano`, `LinhaPlano`, `FormAvulsa`, `LiberacaoCompra`, `matchesFilter`, `alocacaoDoItem`, `parcelasDoItem`, `partirMaoDeObra`, `separarMOnasVerbasDeContrato`, `prazoDoGrupo`, `liberadoParaCompra`, `liberacaoAoRealocar`; no `App`: `liberarCompras`, `reabrirCompras`, `criarCompraAvulsa`, `separarMaoDeObra`, `separarMOdoGrupo`, `juntarMaoDeObra`, `definirAlocacao`, `atualizarCompraDeAditivo`
- `web/src/lib/alocacaoPadrao.js`, `web/src/lib/gravacaoObra.js`
- `web/api/_lib/rotas/cadastros.js`, `web/api/_lib/rotas/obraDados.js`
- `supabase/alocacao.sql`, `supabase/rls-perfis.sql`, `supabase/salvar-obra.sql`, `supabase/patch-obra.sql`
- Testes: `web/src/__testes__/plano-compras.test.mjs`, `plano-alocacao.test.mjs`, `alocacao-libera.test.mjs`, `alocacao-padrao.test.mjs`, `liberar-compra.test.mjs`, `prazo-compra.test.mjs`
