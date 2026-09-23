# Início

**Módulo:** Início (`id: inicio`) · **Arquétipos de tela:** dashboard · **Onde fica:** primeiro item do menu (grupo "Operação"), a marca Group WS no alto do menu e a rota `/`

## Objetivo

Responder, em uma tela, "o que precisa de mim hoje?": quanto falta comprar, quais obras estão em
risco, o que vence nos próximos dias, quem entrega nos próximos 90 dias e onde ficam as obras. Cada
linha leva ao lugar onde o problema se resolve — a tela não resolve nada sozinha.

A lista de obras da barra lateral (com o filtro **Só as minhas**) e o botão **Nova obra** também
moram aqui, no painel ao lado do menu.

## Quem usa

| Perfil | O que vê | Onde é conferido |
|---|---|---|
| Admin master, Administrador, Geral | Todas as obras ativas | tela (`obrasPermitidas`, `web/src/lib/pessoas.js:321`) e banco (RLS `minhas_obras()`, `supabase/rls-reforco.sql:87`) |
| GC, Taylor Made | Só as obras em que responde por um dos três papéis (GC, Taylor Made, Executivo) **e as obras sem GC** | tela e banco (os mesmos dois lugares) |
| Mehoo, Canal de compra | Não veem o Início: entram direto no painel deles | tela (`podeVerModulo`, `web/src/lib/pessoas.js:285`; o Início não está no `modulos` desses perfis) |
| Quem edita (master, admin, geral, GC) | Botão **Nova obra** | tela (`abrirNovaObra`, `web/src/App.jsx:22653`) e servidor (`exigirPerfilDeEdicao` em `POST /api/obras`) |

O alerta "Liberar acesso para N pessoas" só aparece para quem cuida da Equipe (`nPendentes`,
calculado só quando `podeGerenciarPessoas` é verdadeiro).

## Fluxo

1. A pessoa entra no app. Enquanto a equipe (perfis) não carregou, a tela mostra "Carregando…" e
   nenhum módulo (`web/src/App.jsx:25585`) — sem isso a Mehoo via o Início piscar.
2. Por baixo, o app junta três cargas:
   - a lista de obras do **Monday**, squad por squad (`GET /api/monday/obras-execucao`, um pedido
     por workspace — `web/src/App.jsx:21507`); cada squad aparece assim que responde, com limite de
     25 s por squad;
   - o **registro das obras no banco** (`GET /api/obras`, `web/src/App.jsx:21539`): é ele que diz
     se a obra está ativa, concluída ou ainda não foi iniciada. Obra cadastrada à mão, que não está
     no Monday, é remontada a partir da linha do banco (`faltandoNaTela`, `web/src/lib/obras.js:32`);
   - o **espelho do Sienge** (`GET /api/sienge-obras`, `web/src/App.jsx:21411`), de onde saem os
     pinos do mapa e o endereço de quem não tem um.
3. Com as obras ativas conhecidas, o Início pede o **resumo de todas** de uma vez, em lotes de 12
   (`POST /api/obras-resumos`) e os aditivos (`web/src/App.jsx:21747`). A tabela vai se preenchendo
   lote a lote. A obra que está aberta nesta aba entra com o que está na memória, e não com o
   resumo do banco (`obrasDoPainel`, `web/src/App.jsx:21758`).
4. A tela monta, para cada obra, a esteira (`esteiraDaObra`), o resumo de compras
   (`resumoDaObra`) e os alertas (`web/src/App.jsx:19113`–`19142`), e entrega tudo ao componente
   `DashboardPage` (`web/src/features/dashboard/DashboardPage.jsx:197`).
5. A pessoa filtra (busca por código ou nome, Unidade, Squad, GC, Taylor Made) e ordena a tabela
   (maior risco, entrega mais próxima, nome, maior valor a comprar). Squad, Unidade e ordenação vão
   para o endereço (`?dash-squad=…`); busca e GC ficam só na memória da aba
   (`DashboardPage.jsx:220`) e sobrevivem a abrir uma obra e voltar.
6. Cada alerta tem um botão: **Abrir obra** (vai à Visão geral da obra, ou direto às Compras de
   Produtos quando o alerta é de compra vencida), **Abrir aditivos**, **Abrir equipe** ou **Abrir
   novas**.
7. No fim da página, o mapa **Onde estão as obras**: todas as obras do Sienge. Só as acompanhadas no
   app têm **Abrir obra** na ficha; o clique abre a obra sem recarregar a página
   (`MapaDasObras`, `DashboardPage.jsx:164`).
8. **Nova obra** (no cabeçalho do Início, no painel de obras e em Vindas do Monday) abre a mesma
   janela de cadastro — ver [cadastro-de-obra.md](cadastro-de-obra.md).

### A lista de obras e "Só as minhas"

O item **Obras** do menu (capacete) abre o painel com a lista das obras ativas (`Sidebar`,
`web/src/App.jsx:10599`). Nele:

- **Nova obra** (só para quem edita) e **Vindas do Monday**, com o número de obras esperando start;
- busca por nome, código ou cliente;
- **Por número** / **Por squad** (lembrado no banco, preferência `obras.modo`);
- **Só as minhas** (`web/src/App.jsx:10847`), lembrado no banco (preferência `obras.so_minhas`):
  mostra as obras em que a pessoa é GC, Taylor Made ou Executivo — **e as obras sem nenhum
  responsável**, de propósito (`web/src/App.jsx:10654`);
- cadeado na obra que outra pessoa está editando (consulta a cada 30 s, `GET /api/obras-travas`) e
  o número de alertas da obra (verbas em estouro crítico + itens com alerta, `obraAlertCount`);
- no pé, **Finalizadas** — ver [obras-finalizadas.md](obras-finalizadas.md).

Escolher uma obra abre a Visão geral dela e fecha a lista. Trocar de tela fecha a obra
(`web/src/App.jsx:21910`).

## Telas

| Tela / bloco | Arquétipo | Rota ou aba | Componente |
|---|---|---|---|
| Início (cabeçalho, filtros, indicadores) | dashboard | `/` | `InicioView` (`web/src/App.jsx:19094`) → `DashboardPage` (`web/src/features/dashboard/DashboardPage.jsx:197`) |
| Prioridades de hoje | dashboard (tabela) | `/` | `DashboardPage.jsx:325` |
| Próximas entregas (até 90 dias e vencidas) | dashboard (lista) | `/` | `DashboardPage.jsx:342` |
| Obras ativas (tabela com resumo ao passar o mouse) | dashboard (tabela) | `/` | `DashboardPage.jsx:377`, `ResumoDaObra` (`DashboardPage.jsx:75`) |
| Onde estão as obras (mapa) | dashboard | `/` | `MapaDasObras` (`DashboardPage.jsx:164`), `ObrasMap` do DS |
| Lista de obras / Só as minhas | navegação | painel ao lado do menu | `Sidebar` (`web/src/App.jsx:10599`) |

## Estados e mensagens

| Estado | O que a tela diz |
|---|---|
| Perfis carregando | "Carregando…" no lugar de qualquer tela |
| Obras carregando | esqueletos nos indicadores; "Carregando prioridades…", "Carregando entregas…" |
| Erro ao carregar os resumos | cartão vermelho "Não conseguimos carregar todos os dados das obras. Atualize para consultar os indicadores." com **Tentar novamente** (refaz só a carga do painel) |
| Erro do banco ou do Monday | aviso no topo ("Squads não carregados: …", "Não foi possível ler o Monday — confira se o proxy está no ar e tente recarregar a página."); **Tentar novamente** aqui recarrega a página inteira (`web/src/App.jsx:25595`) |
| Sem obras ativas | "Nenhuma obra ativa no momento." |
| Filtro sem resultado | "Nenhum resultado para os filtros aplicados." com **Limpar filtros** |
| Sem pendências | "Nenhuma pendência para as obras selecionadas." |
| Sem entregas na janela | "Nenhuma entrega prevista neste período." |
| Mapa sem dados | "Ainda sem obras no mapa — Falta importar as obras do Sienge (supabase/sienge_obra.sql)." |
| Obras sem coordenada | "N sem coordenada (na lista, fora do mapa)." e "N com o pino no centro da cidade." |
| Unidade (filial) | filtro desabilitado e a nota "Unidade: aguardando o vínculo das obras com as filiais." enquanto nenhuma obra tem filial |
| Perfis sem migração | aviso "Falta rodar supabase/perfis.sql…" no topo de todas as telas |

## Dados

O Início só **lê**. Nada é gravado por esta tela, exceto as preferências da lista de obras.

| Dado | Origem | Significado |
|---|---|---|
| `obra.situacao` | tabela `obra` | `ativa` entra no Início; `concluida` vai para Finalizadas; sem linha = "Vindas do Monday" |
| `obra.gc`, `tailor_made`, `responsavel_executivo` | tabela `obra` | os três papéis; decidem "Só as minhas" e quem vê a obra |
| `data_entrega`, `categorias`, `cadernos`, `compras_liberadas`, `depara_aprovado`, `cmv_liberado`, `cliente_assinou_em` | `obra_dados` (resumo) | base dos alertas, da esteira e dos valores a comprar |
| aditivos | `aditivo` | aditivo aprovado entra nos valores; aprovado sem Solicitação de contrato vira alerta |
| `sienge_obra` (`lat`, `lng`, `geo_precisao`, `endereco_completo`, `status_manual`) | espelho estático do Sienge | pinos do mapa, endereço de reserva, situação no mapa |
| `obra.filial` | não existe hoje | o filtro Unidade lê `o.filial`, que nenhuma fonte preenche |
| preferências `obras.so_minhas`, `obras.modo`, `obras.squads_fechados` | tabela `preferencia` | o que a lista de obras lembra de cada pessoa |

### Os indicadores

| Indicador | Conta |
|---|---|
| Valor pendente de compra | soma do material ainda não comprado das obras filtradas (`resumoDaObra`, `web/src/App.jsx:2108`), com aditivos aprovados |
| Obras ativas | obras filtradas; "N com planilha carregada" = as que têm resumo |
| Entregas em até 90 dias | obras com entrega em até 90 dias, incluindo as vencidas |
| Pendências críticas | alertas marcados como críticos (compra vencida e cadernos atrasados) |
| Saúde | sem pendência crítica · com compra atrasada · sem data de entrega · sem GC |
| Cronograma (tabela) | dias até a entrega e uma régua dos 90 dias |
| Etapa atual (tabela) | a esteira do Início: Criativo, CMV liberado, Especificação, Marcenaria, Executivo, Em execução (compras liberadas) — `esteiraDaObra`, `web/src/App.jsx:19064` |
| Compras (tabela) | % do material já comprado |

### Os alertas ("Prioridades de hoje"), em ordem

| Faixa | Alerta | Crítico? | Ordem dentro da faixa |
|---|---|---|---|
| 0 | "Liberar a compra de <grupo>" — compra do grupo vencida | sim | maior valor primeiro |
| 1 | "Fechar o(s) caderno(s) de …" — entrega em até 90 dias sem compras liberadas e passos pendentes | sim | menos dias primeiro |
| 2 | "Liberar acesso para N pessoas" | não | — |
| 3 | "Abrir a Solicitação de contrato do aditivo N" · "Definir a data de entrega" (obra com itens e sem data) | não | — |
| 4 | "Atribuir o GC" · "Iniciar N obras que vieram do Monday" | não | — |
| 5 | "A compra de <grupo> vence em N dias" (até 15 dias) | "A vencer" | menos dias primeiro |

## APIs

| Método | Rota | Autorização exigida no servidor | Arquivo:linha | O que faz |
|---|---|---|---|---|
| GET | `/api/monday/obras-execucao?workspaceId=` | login + membro; `workspaceId` só dos três squads | `web/api/_lib/mondayApp.js:207` | boards do workspace (id, código, nome); cache de 60 s |
| GET | `/api/obras` | login + membro; linhas filtradas pelo RLS (`minhas_obras()`) | `web/api/_lib/rotas/obras.js:102` | o registro das obras acompanhadas |
| POST | `/api/obras-resumos` | login + membro; RLS de `obra_dados` | `web/api/_lib/rotas/obraConteudo.js:270` | resumo de até 100 obras por pedido (a tela manda 12), comprimido |
| GET | `/api/obras-travas` | login + membro; RLS | `web/api/_lib/rotas/obraConteudo.js:254` | quem está editando cada obra (só travas vivas) |
| GET | `/api/sienge-obras` | login + membro; RLS de leitura liberada ao time | `web/api/_lib/rotas/siengeBanco.js:130` | o espelho do Sienge, com coordenadas quando existem |
| GET | aditivos (`listarAditivos`) | ver ficha dos aditivos | `web/src/lib/aditivos.js` | aditivos de todas as obras |

## Integrações

- **Monday:** só a lista de boards por workspace (um workspace por squad: Sun, Moon, Comet). O
  código da obra sai do nome do board (`"2281 - TKWS"`). Nenhum outro campo do Monday chega ao app
  hoje. Ver [cadastro-de-obra.md](cadastro-de-obra.md).
- **Sienge (espelho estático):** a tabela `sienge_obra` é importada por SQL
  (`supabase/sienge_obra.sql`, `supabase/sienge-obra-coordenadas-dados.sql`); não é leitura ao vivo.
- **Google Maps:** o `ObrasMap` do DS usa `VITE_GOOGLE_MAPS_API_KEY`; sem a chave, cai no mapa do
  Brasil em SVG (`DashboardPage.jsx:163`).

## Regras de negócio usadas

- Ordem das pendências (comportamento da tela, sem ficha de regra) — as pendências do Início são ordenadas por faixa de risco, e a compra vencida pelo valor, não pelos dias.
- [RN-050](../regras-de-negocio/RN-050-prazo-de-compra-por-grupo.md) — a compra de cada grupo vence na data de entrega menos o prazo do grupo.
- [RN-059](../regras-de-negocio/RN-059-compra-atrasada-e-perto-do-prazo.md) — a compra está atrasada quando o prazo passou e ainda falta comprar; "a vencer" quando faltam 15 dias ou menos.
- [RN-025](../regras-de-negocio/RN-025-cadernos-criticos-90-dias.md) — a 90 dias da entrega, sem compras liberadas, todo passo pendente da esteira vira pendência crítica.
- [RN-010](../regras-de-negocio/RN-010-quem-ve-qual-obra.md) — cada perfil vê as suas obras; obra sem GC é vista por todos os GCs e Taylor Made (e passa pelo filtro "Só as minhas").
- [RN-027](../regras-de-negocio/RN-027-situacao-da-obra-no-mapa.md) — no mapa, a obra é finalizada pela marcação manual, pela situação no app, pelo nome "Entregue" ou pelo código até 1500.
- [RN-028](../regras-de-negocio/RN-028-faixas-de-estouro-da-verba.md) — o contador de alertas da lista de obras soma as verbas em estouro crítico.

## Riscos conhecidos

| Gravidade | Risco | Cenário | Onde no código |
|---|---|---|---|
| média | "Vindas do Monday" e o alerta "Iniciar N obras" contam, para o GC e a Taylor Made, obras que **já foram iniciadas** por outra pessoa | o registro (`GET /api/obras`) só traz as obras que o RLS mostra; obra de outro GC fica sem `situacao` na tela e é tratada como "não iniciada" | `obrasNovas`, `web/src/App.jsx:21783`; alerta em `web/src/App.jsx:19168` |
| média | Um lote de resumo que falha interrompe os seguintes | `carregarResumoDeVarias` pede os lotes em sequência e para no primeiro erro — o comentário diz que "um lote que falha não derruba os outros", mas derruba. As obras dos lotes seguintes aparecem na tabela sem planilha; os indicadores ficam escondidos atrás do aviso de erro | `web/src/lib/dadosObra.js:344`, `web/src/App.jsx:21747` |
| baixa | Filtro Unidade nunca liga | nenhuma fonte grava `filial` na obra; o filtro fica desabilitado | `web/src/App.jsx:19151` (`unit: o.filial`) |
| baixa | Código morto do painel de localização antigo | `PainelLocalizacao`, `dadosLocalizacao` e `alternarStatusLocalizacao` são montados e passados ao `InicioView`, que não os usa; o PUT de status do Sienge ficou sem tela | `web/src/App.jsx:18970`, `21818`, `21884` |
| baixa | Marcar a situação de uma obra do Sienge é aberto a qualquer membro | `PUT /api/sienge-obras/:codigo/status` só exige login + membro, e a policy de escrita é `using (true)` — a Mehoo poderia marcar | `web/api/_lib/rotas/siengeBanco.js:148`, `supabase/sienge_obra_status_manual.sql:19` |
| baixa | Dois números de "avanço" diferentes | o mapa e a tabela usam a proporção de passos da esteira; a Visão geral da obra usa a média de três frentes. O comentário do mapa diz que são a mesma conta | `web/src/App.jsx:21868` e `web/src/App.jsx:1200` |
| baixa | "Tentar novamente" recarrega a página quando o erro é do banco ou do Monday | recarregar leva junto o que outras obras ainda não gravaram (o navegador pergunta antes, se houver pendência) | `web/src/App.jsx:25595` |

## Fora do escopo

- Resolver pendência no próprio Início: cada botão leva à tela da obra ou ao módulo.
- Medição física da obra: o avanço é a proporção de passos da esteira.
- Filial: não há fonte do vínculo filial–obra (ver [dashboard.md](dashboard.md)).
- Leitura ao vivo do Sienge.

## Código

- `web/src/App.jsx` — `InicioView` (`19094`), `Sidebar` (`10599`), cargas do app (`21398`–`21904`), `mapaDeObras` (`21825`), `esteiraDaObra` (`19064`), `passosCriticosAtrasados` (`19085`), `resumoDaObra` (`2108`), `ordemDeUrgencia` (`2214`)
- `web/src/features/dashboard/DashboardPage.jsx`
- `web/src/lib/obras.js`, `web/src/lib/siengeObra.js`, `web/src/lib/dadosObra.js` (`carregarResumoDeVarias`, `listarTravas`), `web/src/lib/pessoas.js`, `web/src/lib/preferencias.js`
- `web/api/_lib/mondayApp.js`, `web/api/_lib/rotas/obras.js`, `web/api/_lib/rotas/obraConteudo.js`, `web/api/_lib/rotas/siengeBanco.js`
- Testes: `web/src/__testes__/inicio-redesenho.test.mjs`, `painel-inicio.test.mjs`, `marcos-inicio.test.mjs`, `barra-trilho-painel.test.mjs`, `e2e/dashboard-smoke.cjs`
