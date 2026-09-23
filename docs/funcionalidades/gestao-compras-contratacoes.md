# Gestão de compras e contratações

**Módulo:** Gestão de compras e contratações (id `a_contratar`) · **Arquétipos de tela:** dashboard (indicadores, listas por verba, tabela obra por obra), listagem (compradores, mão de obra própria), relatório em PDF · **Onde fica:** menu **Operação → Gestão de compras e contratações** · rota `/gestao`

## Objetivo

Olhar **todas as obras ao mesmo tempo**: quanto falta comprar de material e contratar de mão de
obra, por verba e por insumo, em que obra está cada pedaço, e quais obras têm compra atrasada.
A pergunta que muda o trabalho é "quanto tenho para contratar de pintura nas próximas semanas" —
saber o volume antes permite chegar no fornecedor com previsão em vez de pedido urgente.

Também guarda dois cadastros da empresa: o **comprador de cada grupo de compra** e a **equipe de
mão de obra própria** (com a calculadora que compara contratar com fazer com a equipe interna).

## Quem usa

| Perfil | O que pode | Onde é conferido |
|---|---|---|
| master, admin | ver o painel de todas as obras; editar compradores e mão de obra própria | tela (`podeEditarCompradores = souAdmin`); banco: só administrador escreve em `comprador_grupo` e `prestador_interno` (`supabase/compradores.sql:41`, `supabase/mao-de-obra-propria.sql:46`) |
| geral | ver o painel de todas as obras; cadastros só para consulta | tela e banco |
| gc, taylor | ver o painel **das suas obras** (GC, Taylor Made ou Executivo, e as sem GC) | tela (`obrasPermitidas`) e banco (`minhas_obras()`) |
| mehoo, canal | não veem o módulo | tela (`podeVerModulo`, `web/src/lib/pessoas.js`) |

O módulo só lê as obras; nada da obra é gravado daqui.

## Fluxo

1. Ao abrir o módulo, o app carrega de uma vez o resumo de todas as obras ativas que a pessoa
   enxerga (`POST /api/obras-resumos`, em lotes, a tabela vai se preenchendo) e os aditivos
   (`web/src/App.jsx:21721`). A obra aberta na tela entra com o que está na memória, inclusive o
   que ainda não foi gravado.
2. Abas no topo: **Painel** · **Compradores** · **Mão de obra própria** (`GcTelas`).
3. No **Painel**, filtros:
   - **Obras** (chips; vazio = todas);
   - **Mostrar**: Pendente · Comprado · Todos;
   - **Preciso resolver nas**: Tudo · 4 · 8 · 12 semanas (só com "Pendente"; o que já venceu entra
     sempre; obra sem data de entrega sai do recorte e aparece num aviso com o valor que ficou de fora);
   - **Fornecedor** e **Comprador** (recortam item a item; o comprador vem do grupo da EAP do item).
   Os filtros ativos aparecem como chips com "limpar".
4. Indicadores: **A comprar — material** e **A contratar — mão de obra**, com barra do que já foi feito.
5. Listas, cada uma com a linha que abre "de qual obra vem" e o botão de **PDF** da linha:
   - **Mão de obra a contratar, por verba** — com a **calculadora** da mão de obra própria (só em
     "Pendente");
   - **Material a comprar, por verba**;
   - **Material a comprar, por insumo** (Por categoria · Por produto, com busca; só em "Pendente").
6. **Obra por obra**: entrega (e dias que faltam), material comprado · falta (com a parte
   **estimada**, ainda não liberada, em cinza), mão de obra contratada · falta, e **prazos**
   (N atrasadas / perto do prazo, que abrem a lista). O atalho "N com compra atrasada" filtra a
   tabela. Clicar numa obra a abre.
7. **PDF**: gerado no navegador (`gerarRelatorioPdf`), baixado e mostrado por cima da tela; leva o
   recorte aplicado no subtítulo.
8. **Calculadora**: escolhe pessoas da equipe interna, dias e quantidade; soma diária × dias ×
   pessoas e compara com o valor a contratar da linha (ou de uma obra dela). É simulação: nada é
   gravado. Sem cadastro ativo, usa a tabela padrão do código (`PRESTADORES_PADRAO`).
9. **Compradores**: por grupo de compra (verba), escolher a pessoa (ou "sem comprador"); grava na
   hora. Só administrador.
10. **Mão de obra própria**: cadastro de nome, especialidade, função, diária e ativo. Só administrador.

## Telas

| Tela / bloco | Arquétipo | Rota ou aba | Componente em App.jsx |
|---|---|---|---|
| Gestão de compras e contratações (painel) | dashboard | `/gestao` | `GestaoComprasView` (`web/src/App.jsx:17375`) |
| Lista por verba / por insumo | lista com barras | — | `GcPorVerba` (`:16255`), `GcLinhaVerba` |
| Obra por obra | tabela | — | `GcLinhaObra` (`:16364`) |
| Abas do módulo | abas | — | `GcTelas` (`:16973`) |
| Compradores | listagem editável | aba Compradores | `CompradoresView` (`:16991`) |
| Mão de obra própria | listagem editável | aba Mão de obra própria | `MaoDeObraPropriaView` (`:17225`) |
| Calculadora | diálogo | — | `SimuladorEquipe` (`:17105`) |
| PDF da linha | relatório | — | `PdfSobreposto`, `web/src/lib/relatorioPdf.js` |

## Estados e mensagens

| Estado | O que a tela mostra |
|---|---|
| Carregando | esqueletos no lugar dos indicadores e da tabela |
| Erro ao carregar | "Não conseguimos carregar os dados das obras. Tente novamente." |
| Nenhuma obra com planilha | "Nenhuma obra ativa tem planilha carregada ainda." |
| Filtros sem resultado | "Nenhum resultado para os filtros aplicados"; nas listas, "Nada a comprar/contratar dentro desse prazo." |
| Obra sem data com recorte de prazo | aviso "R$ X ficou fora do recorte por estar em obra sem data de entrega" |
| Tabela de compradores/prestadores não criada | "Falta rodar o supabase/compradores.sql…" (dá para ver, não para salvar) |
| Sem permissão para cadastros | seletores desabilitados |

## Dados

Só leitura das obras (`obra_dados`: `categorias`, `data_entrega`, `cadernos`, `compras_liberadas`,
`depara_aprovado`, `cmv_liberado`, `cliente_assinou_em`) e dos aditivos. Cálculos principais
(`resumoDaObra`, `web/src/App.jsx:2108`; `resumoGeral`, `:2222`):

| Número | Como sai |
|---|---|
| Material total / feito | soma do material dos itens; feito = `comprado` |
| Falta comprar real × estimativa | real = item liberado para compra; estimativa = o resto |
| Mão de obra total / feita | feita = `statusContrato` fora de "não solicitado" |
| Data de necessidade | material: data de entrega menos o prazo do grupo; mão de obra: a data de entrega |
| Atrasada / perto do prazo | data limite vencida com material pendente / 15 dias ou menos |

Cadastros: `comprador_grupo` (grupo pelo nome, e-mail e nome do comprador) e `prestador_interno`
(nome, especialidade, função, diária, ativo).

## APIs

| Método | Rota | Autorização no servidor | Arquivo:linha | O que faz |
|---|---|---|---|---|
| POST | `/api/obras-resumos` | login e membro; o banco (RLS) filtra as obras | `web/api/_lib/rotas/obraConteudo.js:270` | resumo de um lote de obras (comprimido) |
| GET | `/api/aditivos` (via `listarAditivos`, `web/src/lib/aditivos.js:64`) | login e membro; o banco (RLS) filtra as obras | `web/api/_lib/rotas/aditivos.js:63` | aditivos para somar nos totais |
| GET / PUT / DELETE | `/api/compradores`, `/api/compradores/:grupo` | login e membro; banco: só administrador escreve | `web/api/_lib/rotas/cadastros.js:120`, `:131`, `:144` | compradores por grupo |
| GET / PUT / DELETE | `/api/prestadores-internos`, `/:id` | login e membro; banco: só administrador escreve | `web/api/_lib/rotas/cadastros.js:171`, `:184`, `:215` | equipe interna |

## Integrações

Nenhuma. Os números vêm das obras já gravadas.

## Regras de negócio usadas

- [RN-044](../regras-de-negocio/RN-044-material-para-compras-mo-para-contratos.md) — material soma em "a comprar", mão de obra em "a contratar".
- [RN-043](../regras-de-negocio/RN-043-o-que-conta-como-liberado.md) — divide o que falta comprar em real (liberado) e estimativa.
- [RN-050](../regras-de-negocio/RN-050-prazo-de-compra-por-grupo.md) — a data de necessidade do material sai do prazo do grupo.
- [RN-059](../regras-de-negocio/RN-059-compra-atrasada-e-perto-do-prazo.md) — atrasada é prazo vencido com compra pendente; perto é 15 dias ou menos.
- [RN-057](../regras-de-negocio/RN-057-mao-de-obra-contratada-desde-a-solicitacao.md) — a mão de obra conta como contratada a partir da solicitação.
- [RN-015](../regras-de-negocio/RN-015-comprador-e-diaria-so-administrador.md) — um comprador por grupo, definido só pelo administrador.

## Riscos conhecidos

| Gravidade | Risco | Cenário | Onde no código |
|---|---|---|---|
| média | "Contratada" inclui o que só foi solicitado | o indicador e as barras tratam solicitação de contrato como contratado | `web/src/App.jsx:2108` |
| média | Carrega o conteúdo de todas as obras no navegador | com muitas obras ativas, o painel baixa os JSONB de todas (em lotes); pode ficar lento | `web/src/App.jsx:21721`; `web/src/lib/dadosObra.js` |
| baixa | Listas por insumo e por produto ignoram aditivos | "por verba" soma os itens de aditivo aprovado; "por insumo/produto" lê só a planilha — os totais não batem entre si quando há aditivo | `web/src/App.jsx:2304`, `:2342` |
| baixa | Horizonte não vale para as listas por insumo | o recorte de semanas não se aplica a elas (comentado no código) | `GestaoComprasView` |

## Fora do escopo

- Mudar qualquer item da obra (canal, compra, contrato): é feito dentro da obra.
- Prazo de contratação de mão de obra por serviço (não existe regra; usa a data de entrega).

## Código

- `web/src/App.jsx` — `GestaoComprasView`, `GcTelas`, `GcPorVerba`, `GcLinhaVerba`, `GcLinhaObra`, `CompradoresView`, `MaoDeObraPropriaView`, `SimuladorEquipe`, `resumoDaObra`, `resumoGeral`, `resumoPorInsumo`, `resumoPorProduto`, `relatorioDaVerba`, `relatorioDoInsumo`, `dataDeNecessidade`, `PRESTADORES_PADRAO`, `custoEquipeInterna`; no `App`: carregamento do painel e `obrasDoPainel`
- `web/src/lib/compradores.js`, `web/src/lib/relatorioPdf.js`, `web/src/lib/dadosObra.js` (`carregarResumoDeVarias`)
- `web/api/_lib/rotas/obraConteudo.js`, `web/api/_lib/rotas/cadastros.js`
- `supabase/compradores.sql`, `supabase/mao-de-obra-propria.sql`
- Testes: `web/src/__testes__/painel-geral.test.mjs`, `gestao-filtros.test.mjs`, `prazo-compra.test.mjs`
