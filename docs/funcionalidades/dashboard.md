# Visão geral (da obra e das obras)

**Módulo:** Obras → grupo **Visão geral** (painel de uma obra) e Início (painel de todas as obras) · **Arquétipos de tela:** dashboard · **Onde fica:** dentro da obra, primeiro grupo (rota `/obra/:codigo`); o painel de todas as obras é o Início (rota `/`)

Esta ficha cobre os dois painéis de visão geral:

- **Visão geral da obra** (`DashboardObra`, `web/src/App.jsx:1161`): o resumo de uma obra, a tela
  em que ela abre;
- **Visão geral das obras** (`DashboardPage`, `web/src/features/dashboard/DashboardPage.jsx:197`):
  o componente do Início. O fluxo do Início está em [inicio.md](inicio.md); aqui ficam as decisões
  do componente, registradas na entrega de 20/09/2026.

## Objetivo

Na obra: responder "como está esta obra e o que pede atenção nela?" sem abrir as etapas — números
de dinheiro e prazo, pendências, avanço por frente, quem responde por ela, a data de entrega e os
arquivos de cada fase. É também daqui que se conclui a obra.

## Quem usa

| Perfil | O que pode | Onde é conferido |
|---|---|---|
| Quem abre a obra (master, admin, geral, GC, Taylor Made) | Ver o painel | tela (`podeAbrirObras`) e servidor (`exigirObra` na leitura) |
| Quem está com a edição (master, admin, geral, GC) | Trocar GC, Taylor Made e Executivo; mudar a data de entrega; anexar e trocar cadernos e anexos | tela (`podeEditar = edicao.minha`, `web/src/App.jsx:25808`) e servidor (`exigirEdicaoDeObra`) |
| Administrador e Admin master | Ver e anexar o Contrato na Jornada; corrigir o endereço no topo | tela (`souAdmin`) e Storage (pasta `contrato`); o endereço, só na tela |
| Qualquer um que abre a obra | Ver **Concluir obra** | tela (sem conferência); o servidor recusa quem não edita — ver [obras-finalizadas.md](obras-finalizadas.md) |

## Fluxo (Visão geral da obra)

1. A obra abre neste grupo. O painel usa a obra como está na memória da aba (com os aditivos da
   obra) e recalcula tudo a cada mudança.
2. No alto, sete indicadores (`web/src/App.jsx:1278`): Avanço geral, Prazo previsto, Pendências,
   Orçamento vigente, Custo executivo, Material comprado, Mão de obra contratada.
3. **Pendências e alertas** (`web/src/App.jsx:1358`): primeiro, "N itens esperam aprovação para
   compra" com **Aprovar para compra**, que abre a Conf. Executivo já filtrada em "Falta aprovar p/
   compra"; depois a lista (compra vencida, cadernos atrasados na janela de 90 dias, executivo acima
   do orçamento vigente, verbas em estouro crítico — com "Ver quais são" —, itens com alerta,
   compras avulsas pendentes, sem data de entrega, aditivo aprovado sem Solicitação de contrato no
   Pipefy, sem GC). No pé, **Solicitar compra avulsa** abre o formulário do Pipefy e leva ao Plano
   de Compras; com avulsas já lançadas, o botão vira "Compras avulsas (N)".
4. **Progresso por frente**: Projetos (cadernos anexados: criativo, especificação, marcenaria,
   projeto), Suprimentos (% do material comprado) e Execução (% da mão de obra contratada).
5. **Equipe da obra**: GC responsável, Taylor Made e Executivo. Com a edição habilitada, cada um é
   escolhido numa lista da Equipe (ativos, e quem já está no papel) e gravado na hora pela API
   (`PATCH /api/obras/:codigo/papel`), fora da fila de gravação. Os mesmos três aparecem no topo
   da obra (`PessoaNoTopo`, `web/src/App.jsx:959`), que pede confirmação ao trocar alguém.
6. **Entrega prevista**: com a edição habilitada, a data só vale ao clicar **Salvar data** (campo
   de data que grava a cada tecla mandaria "0002-11-20"). Ela entra na obra e vai pela fila de
   gravação (`definirDataEntrega`, `web/src/App.jsx:23344`). É dela que saem todos os prazos de
   compra.
7. **Jornada da obra**: Contrato → Criativo → Executivo → Execução da Obra → Entrega
   (`jornadaDaObra`, `web/src/App.jsx:602`). **Ver arquivos das fases** abre os lugares de cada
   caderno — ver [obra-documentos.md](obra-documentos.md).
8. **Aditivos**: com aditivo aprovado, o saldo (adição menos supressão) e a lista; só com
   rascunhos ou "aguardando cliente", o aviso de que eles ainda não contam. Grupo aprovado sem
   verba da EAP gera aviso.
9. No cabeçalho, só neste grupo, **Concluir obra**.

### Como os números são calculados

| Indicador | Conta | Onde |
|---|---|---|
| Avanço geral | média simples de três percentuais: Projetos (cadernos anexados de 4), Suprimentos (% do material comprado), Execução (% da mão de obra contratada) | `web/src/App.jsx:1200` |
| Prazo previsto | dias até a data de entrega (ou "N dias atrás") | `web/src/App.jsx:1173` |
| Pendências | quantidade de itens da lista de pendências (o "itens esperam aprovação" não entra na conta) | `web/src/App.jsx:1241` |
| Orçamento vigente | valor vendido (o do cadastro ou a soma do vendido das verbas) + saldo dos aditivos **aprovados** | `web/src/App.jsx:1211` |
| Custo executivo | soma do executivo das verbas; se vier vazia, material + mão de obra | `web/src/App.jsx:1186` |
| Executivo acima do vendido | só quando existe orçamento vigente (> 0) e o custo passa dele | `web/src/App.jsx:1215` |
| Material comprado / Mão de obra contratada | `obraComprasStats` / `obraContratosStats`, com aditivos aprovados | `totals` em `web/src/App.jsx:22696` |

## Telas

| Tela / bloco | Arquétipo | Rota ou aba | Componente |
|---|---|---|---|
| Visão geral da obra | dashboard | `/obra/:codigo` (grupo Visão geral) | `DashboardObra` (`web/src/App.jsx:1161`) |
| Equipe da obra | dashboard (formulário embutido) | idem | `LinhaEquipe` (`web/src/App.jsx:936`), `PapelDaObra` (`web/src/App.jsx:524`) |
| Jornada da obra | dashboard (trilha + arquivos) | idem | `JornadaStepper` (`web/src/App.jsx:625`), `AnexosDaJornada` (`web/src/App.jsx:1026`) |
| Visão geral das obras | dashboard | `/` | `DashboardPage` (`web/src/features/dashboard/DashboardPage.jsx:197`) |

## Estados e mensagens

| Estado | O que a tela diz |
|---|---|
| Sem pendência | "Nada pedindo atenção nesta obra." |
| Itens esperando aprovação | "N itens esperam aprovação para compra" + **Aprovar para compra** |
| Sem data | indicador "sem data de entrega"; pendência "sem data de entrega — os prazos de compra não são calculados" |
| Sem contrato lançado | "sem valor de contrato lançado"; custo "sem contrato pra comparar" |
| Executivo não carregado | custo "—", "executivo ainda não carregado" |
| Sem GC | "sem GC — esta obra aparece para todo mundo" |
| Modo leitura | data de entrega desabilitada; equipe só mostra; Jornada sem **Anexar** |

## Dados

| Campo | Onde | Significado |
|---|---|---|
| `data_entrega` | `obra_dados` | a data de entrega prevista; base dos prazos de compra |
| `gc`, `tailor_made`, `responsavel_executivo` | `obra` | e-mails dos três responsáveis |
| `cadernos`, `arquivos` | `obra_dados` | arquivos da Jornada e avulsos |
| `valor_vendido` | `obra` (e soma de `categorias[].vendido`) | valor do contrato |
| aditivos | `aditivo` | só o aprovado muda o orçamento vigente |

## APIs

| Método | Rota | Autorização exigida no servidor | Arquivo:linha | O que faz |
|---|---|---|---|---|
| GET | `/api/obras/:codigo/conteudo` | login + membro + ver a obra | `web/api/_lib/rotas/obraConteudo.js:135` | a obra inteira |
| PATCH | `/api/obras/:codigo/papel` | login + membro + editar a obra | `web/api/_lib/rotas/obras.js:192` | troca GC, Taylor Made ou Executivo |
| PATCH | `/api/obras/:codigo/endereco` | login + membro + editar a obra | `web/api/_lib/rotas/obras.js:219` | endereço corrigido à mão |
| POST | `/api/obras/:codigo/gravar` e `/patch` | login + membro + editar a obra; banco confere trava e versão | `web/api/_lib/rotas/obraDados.js:105`, `:129` | grava a data de entrega e os arquivos, pela fila |
| POST | `/api/obras-resumos` | login + membro; RLS | `web/api/_lib/rotas/obraConteudo.js:270` | o resumo usado pelo Início |

## Integrações

- **Pipefy:** **Solicitar compra avulsa** e **Solicitar no Pipefy** abrem o formulário externo
  (`abrirPipefy`); nada volta do Pipefy para o app.

## Regras de negócio usadas

- [RN-061](../regras-de-negocio/RN-061-so-aditivo-aprovado-conta.md) — só o aditivo aprovado entra no orçamento vigente (contrato + saldo). O estouro do executivo só é apontado quando existe orçamento vigente (> 0).
- [RN-026](../regras-de-negocio/RN-026-avanco-geral-da-obra.md) — o avanço geral da obra é a média de Projetos, Suprimentos e Execução.
- [RN-028](../regras-de-negocio/RN-028-faixas-de-estouro-da-verba.md) — a verba entra em estouro crítico acima de 15% do vendido, sem vendido, ou fora do escopo.
- [RN-050](../regras-de-negocio/RN-050-prazo-de-compra-por-grupo.md) — a compra de cada grupo vence na data de entrega menos o prazo do grupo.
- [RN-059](../regras-de-negocio/RN-059-compra-atrasada-e-perto-do-prazo.md) — compra atrasada é prazo vencido com material ainda por comprar.
- [RN-025](../regras-de-negocio/RN-025-cadernos-criticos-90-dias.md) — a 90 dias da entrega, sem compras liberadas, passo pendente da esteira vira pendência crítica.
- [RN-010](../regras-de-negocio/RN-010-quem-ve-qual-obra.md) — obra sem GC aparece para todos os GCs.
- [RN-013](../regras-de-negocio/RN-013-responsaveis-da-obra.md) — os três responsáveis são escolhidos da equipe, guardados pelo e-mail, por quem edita a obra.
- [RN-019](../regras-de-negocio/RN-019-endereco-da-obra-so-administrador.md) — só o administrador corrige o endereço.
- [RN-014](../regras-de-negocio/RN-014-contrato-da-obra-so-administrador.md) — o contrato da obra só é visto e anexado pelo administrador.
- RN-001 — Só o administrador libera a compra (é a régua do "itens esperam aprovação para compra").

## Riscos conhecidos

| Gravidade | Risco | Cenário | Onde no código |
|---|---|---|---|
| média | O GC pode se tirar da própria obra | com a edição, o GC troca o campo GC para outra pessoa; o banco aceita (a policy de alteração só confere o perfil) e a obra some da tela dele | `web/src/App.jsx:21985`; `supabase/rls-reforco.sql:163`–`165` |
| média | Papéis gravam fora da fila e sem trava | a troca de GC/Taylor/Executivo vai direto para `obra`, sem versão; duas pessoas trocando ao mesmo tempo: vale a última, sem aviso | `web/api/_lib/rotas/obras.js:192` |
| baixa | Endereço "só administrador" apenas na tela | o servidor exige só a edição da obra; um GC consegue corrigir pela API | `web/src/App.jsx:25738`; `web/api/_lib/rotas/obras.js:219` |
| baixa | Dois "avanços" diferentes | a Visão geral da obra usa a média de três frentes; o Início e o mapa usam a proporção de passos da esteira | `web/src/App.jsx:1200`; `web/src/App.jsx:21868` |
| baixa | "Pendências" não conta os itens à espera de aprovação | o indicador pode dizer "nada pedindo atenção" com o alerta de aprovação aberto logo abaixo | `web/src/App.jsx:1278`–`1291` |

## Visão geral das obras — decisões do componente (entrega de 20/09/2026)

Dashboard implementado sobre `PageShell`, indicadores, cards, seletores, badges, barras de
progresso e tabela do `@group-ws/ws-ui`. A implementação foi autorizada pelo usuário como exceção
ao bloqueio de novas funcionalidades durante a adequação em 20/09/2026. O gate não foi modificado.

### Dados e ações

- Usa as obras ativas já autorizadas para o usuário e os resumos persistidos.
- Reutiliza `resumoGeral`, `resumoDaObra`, `ordemDeUrgencia`, `esteiraDaObra`,
  `passosCriticosAtrasados` e `pipefyPendente` existentes.
- Carrega os aditivos para que os valores aprovados participem dos totais.
- Preserva data de entrega e cadernos mesmo quando a obra não tem itens importados.
- Os mesmos filtros (busca, Unidade, Squad, GC e Taylor Made) recortam indicadores, alertas,
  entregas e obras. Alertas globais de novas obras e acessos continuam visíveis.
- Resolver uma compra abre Compras de Produtos da obra; demais pendências abrem a obra ou o módulo
  responsável. Ver detalhes e entregas abrem a visão da obra.
- A ordenação padrão preserva a ordem de urgência existente; também há nome, data de entrega e
  valor a comprar.
- Progresso é a proporção de etapas concluídas da esteira, sem ponderação. Não é medição física.
  Compras é o percentual financeiro calculado pelo resumo existente.
- A janela de entregas conserva o comportamento existente: até 90 dias e vencidas.
- Carregamento e erro não exibem totais parciais como definitivos. Há nova tentativa, estados
  vazios e limpeza de filtros.
- Filtros de squad/unidade e ordenação ficam na URL; busca, GC e Taylor Made ficam apenas em
  memória, preservados ao abrir e voltar de uma obra durante a mesma sessão
  (`DashboardPage.jsx:198`–`222`).

### Pendência de dados: filial

O usuário confirmou que Unidade significa filial da empresa. Nenhuma fonte inspecionada contém o
vínculo filial–obra. O filtro fica desabilitado e a ausência é informada enquanto as obras não
tiverem filial. Não foi inferida filial por cidade ou squad. É necessário informar a fonte ou o
vínculo para concluir essa integração; não há cadastro fictício no app.

### Validação feita na entrega

- `npm --prefix web test`: suíte de 84 arquivos (na data da entrega).
- `npm --prefix web run build`: inclui geração de utilitários Tailwind do dashboard, usando os
  tokens do pacote e sem adicionar outro reset global.
- `node e2e/dashboard-smoke.cjs`: Chromium, dados sintéticos; busca, unidade, squad, GC,
  ordenação, links de detalhes, ações de pendência, recorte de compras, carregamento, vazio, erro,
  captura dos temas e largura de celular.
- O teste visual usa o CSS do último build e salva capturas em pasta temporária. Requer as
  dependências de `web` e `e2e` e Chromium do Playwright instalados.
- Não foi realizado deploy nem teste com login de produção.

### Regras de negócio na entrega

Os cálculos existentes foram chamados, sem alteração de critérios financeiros, prazo de compras ou
regra de 90 dias. A classificação visual Crítica corresponde aos alertas que antes tinham tom
`ruim`; não foram inventados os limites de risco sugeridos pelas cores da imagem. (Na data da
entrega o catálogo RN ainda não tinha fichas; hoje há a RN-001 e as candidatas listadas acima.)

## Fora do escopo

- Medição física da obra e cronograma de execução (a Jornada não fecha "Execução" nem "Entrega"
  sozinha).
- Resolver pendência no próprio painel: cada botão leva à tela de resolver.
- Filial (ver acima).

## Código

- `web/src/App.jsx` — `DashboardObra` (`1161`), `AnexosDaJornada` (`1026`), `PessoaNoTopo` (`959`), `LinhaEquipe` (`936`), `jornadaDaObra` (`602`), `definirDataEntrega` (`23344`), `definirGCdaObra` (`21985`), `totals` (`22696`)
- `web/src/features/dashboard/DashboardPage.jsx`
- `web/src/lib/obras.js`, `web/src/lib/pessoas.js` (`PAPEIS_DA_OBRA`)
- Testes: `web/src/__testes__/visao-geral-falta-aprovar.test.mjs`, `aditivo-orcamento.test.mjs`, `estouro-critico.test.mjs`, `taylor-made.test.mjs`, `endereco-obra.test.mjs`, `e2e/dashboard-smoke.cjs`
