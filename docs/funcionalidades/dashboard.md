# Visão geral das obras

Dashboard inicial implementado sobre `PageShell`, indicadores, cards, seletores,
badges, barras de progresso e tabela do `@group-ws/ws-ui`.

A implementação foi autorizada pelo usuário como exceção ao bloqueio de novas
funcionalidades durante a adequação em 20/09/2026. O gate não foi modificado.

## Dados e ações

- Usa as obras ativas já autorizadas para o usuário e os resumos persistidos.
- Reutiliza `resumoGeral`, `resumoDaObra`, `ordemDeUrgencia`,
  `esteiraDaObra`, `passosCriticosAtrasados` e `pipefyPendente` existentes.
- Carrega os aditivos para que os valores aprovados participem dos totais.
- Preserva data de entrega e cadernos mesmo quando a obra não tem itens importados.
- Os mesmos filtros de squad, GC e busca recortam indicadores, alertas, entregas
  e obras. Alertas globais de novas obras e acessos continuam visíveis.
- Resolver uma compra abre Compras de Produtos da obra; demais pendências abrem
  a obra ou o módulo responsável. Ver detalhes e entregas abrem a visão da obra.
- A ordenação padrão preserva a ordem de urgência existente; também há nome,
  data de entrega e valor a comprar.
- Progresso é a proporção de etapas concluídas, sem ponderação. Não é medição
  física. Compras é o percentual financeiro calculado pelo resumo existente.
- A janela de entregas conserva o comportamento existente: até 90 dias e vencidas.
- Carregamento e erro não exibem totais parciais como definitivos. Há nova tentativa,
  estados vazios e limpeza de filtros.
- Filtros de squad/unidade e ordenação ficam na URL; busca e GC ficam apenas em
  memória, preservados ao abrir e voltar de uma obra durante a mesma sessão.

## Pendência de dados: filial

O usuário confirmou que Unidade significa filial da empresa. Nenhuma fonte
inspecionada contém o vínculo filial–obra. O filtro fica desabilitado e a ausência
é informada enquanto as obras não tiverem filial. Não foi inferida filial por
cidade ou squad. É necessário informar a fonte ou o vínculo para concluir essa
integração; não há cadastro fictício no app.

## Validação

- `npm --prefix web test`: suíte de 84 arquivos.
- `npm --prefix web run build`: inclui geração de utilitários Tailwind do dashboard,
  usando os tokens do pacote e sem adicionar outro reset global.
- `node e2e/dashboard-smoke.cjs`: Chromium, dados sintéticos; busca, unidade,
  squad, GC, ordenação, links de detalhes, ações de pendência, recorte de compras,
  carregamento, vazio, erro, captura dos temas e largura de celular.
- O teste visual usa o CSS do último build e salva capturas em pasta temporária.
  Requer as dependências de `web` e `e2e` e Chromium do Playwright instalados.
- Não foi realizado deploy nem teste com login de produção.

## Regras de negócio

O catálogo RN ainda não contém fichas. Os cálculos existentes foram chamados,
sem alteração de critérios financeiros, prazo de compras ou regra de 90 dias.
A classificação visual Crítica corresponde aos alertas que antes tinham tom
`ruim`; não foram inventados os limites de risco sugeridos pelas cores da imagem.
