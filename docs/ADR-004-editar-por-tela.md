# ADR-004 — Editar por tela: o que precisa mudar antes

Gestão de Obras TKWS · 17/09/2026 · **Proposta — nada foi mexido**

---

## Contexto

A Priscila pediu três vezes, com as próprias palavras:

> "hoje quem edita um item dentro da obra ta travando todas as telas. vamos
> criar uma regra que o usuário sempre que mudar de menu, ele desabilita a
> edicao automaticamente. e sempre habilita somente na tela que ele esta
> trabalhando"

> "a pessoa abre e esta travando edicao em todas as telas. lembra que pedi
> para travar somente a tela que ela esta?"

O que já foi entregue e está no ar:

- a edição é **liberada quando a pessoa troca de tela** (e grava antes de
  soltar);
- a edição **se desabilita sozinha após 5 minutos** sem alteração (era 30);
- trava vencida deixou de ser anunciada como viva.

O que **não** foi entregue: enquanto alguém está numa tela, a obra inteira
continua travada para os outros. Foi isso que ela viu com a Isadora.

## Por que isso não é um ajuste de tela

A trava é da OBRA porque o salvamento é da obra inteira.

`salvarDadosObra` (`web/src/lib/dadosObra.js`) faz um `upsert` da linha
inteira de `obra_dados` a cada 1,2 s depois da última alteração: a coluna
`categorias` (um JSONB com todas as verbas e todos os itens) mais umas vinte
colunas. Não existe "gravar só este campo".

São **44 funções** que alteram a obra na memória (`setObras` no `App.jsx`), e
quase todas mexem em `categorias`:

| Tela | O que escreve dentro de `categorias` |
|---|---|
| Executivo | descrição, quantidade, custo, especificação, exclusão de linha |
| Conf. Executivo | aprovação da linha, liberado para compra, alerta conferido, exceção sem cliente |
| Aprovação do Cliente | aprovado pelo cliente |
| Plano de Compras | alocação, separar/juntar mão de obra, compra avulsa, compra de aditivo |
| Compras de Produtos | canal, solicitado, comprado, troca de produto, vínculo com o Sienge |
| Contratos | escopos, solicitação de contrato |

Duas pessoas em telas diferentes da mesma obra gravariam, cada uma, o
documento inteiro. A última apagaria o trabalho da outra **em silêncio** — sem
erro, sem aviso, e sem jeito de descobrir depois. A trava por obra é o que
impede isso hoje.

## Caminhos possíveis

### A. Gravar só o que mudou (recomendado)

O salvamento deixa de mandar o documento inteiro e passa a mandar **a
mudança**: "na verba 27, item 3, comprado = true". O Postgres aplica com
`jsonb_set`, dentro de uma função no banco. Duas pessoas mexendo em campos
diferentes não se sobrescrevem, porque nenhuma das duas reescreve o resto.

A favor: a maioria dos caminhos de gravação **já tem essa forma** —
`updateItem(verba, item, patch)` é literalmente "aplique este patch". Dá para
migrar em fatias, mantendo o salvamento atual como reserva, e cada fatia é
conferível numa obra real.

Contra: é trabalho de banco mais 44 caminhos revisados um a um.

### B. Número de versão e regravar

Cada linha ganha uma versão; ao salvar, se a versão mudou, o app relê e
aplica de novo o que a pessoa fez. Só que "aplicar de novo o que a pessoa
fez" exige saber o que ela fez — ou seja, exige os mesmos patches do caminho
A, mais a peça da versão. Chega no mesmo lugar com uma engrenagem a mais.

### C. Tirar o estado de compra de dentro de `categorias`

Canal, solicitado e comprado sairiam do JSONB para uma tabela item a item.
Resolve de vez, melhora relatório e histórico, e é a mudança mais profunda:
migrar o dado de todas as obras. Fica como destino, não como próximo passo.

## Recomendação: caminho A, em três fatias

**Fatia 1 — o motor, sem mudança visível.** Criar a função no banco que
aplica patches e migrar os caminhos das **Compras** (canal, solicitado,
comprado, compra de aditivo). São os mais disputados e os mais simples, todos
já no formato patch. A trava continua por obra. Ganho imediato, mesmo antes
da fatia 3: acaba o risco de uma pessoa apagar o trabalho da outra nessas
ações.

**Fatia 2 — aprovações e liberações.** Conf. Executivo, Aprovação do Cliente,
e as marcas da obra (etapas concluídas, assinatura, CMV liberado).

**Fatia 3 — o Executivo e a trava por tela.** Migrar a edição célula a célula
e então ligar a trava por tela: uma coluna `editando_tela` em `obra_dados`, e
cada tela travando só a si mesma.

## O que continua exigindo a obra inteira travada

Três coisas não são edição de campo, e por isso seguem pedindo a obra livre:

1. **Importar planilha** (Vendido, Executivo, Contrato) — substitui a verba
   inteira.
2. **Troca de produto** — cria e remove linhas, mudando a lista.
3. **Separar / juntar mão de obra** — também cria e remove linhas.

A regra fica: essas ações pedem a obra sem ninguém editando; o resto passa a
conviver.

## O risco que precisa de solução na fatia 3

Hoje o patch endereça o item por **posição** (`catIdx`, `itemIdx`). Com duas
pessoas na mesma obra, uma inserção ou exclusão muda a posição das outras
linhas e o patch da outra pessoa cairia na linha errada — o mesmo defeito que
já apareceu na busca por insumo do Executivo.

Antes de ligar a trava por tela, cada item precisa de um **id estável**. O
código não serve: na obra 2450, 198 dos 269 itens não têm código. Então a
fatia 3 inclui gerar um id por item na primeira gravação e passar a endereçar
por ele.

## Como conferir cada fatia

Duas pessoas, duas telas, a mesma obra: uma marca comprado nas Compras, a
outra edita quantidade no Executivo, as duas salvam, e as duas alterações
sobrevivem ao F5. Hoje esse teste falha por definição — uma das duas perde o
trabalho.

## Decisão pendente dela

1. Seguir pelo caminho A, nas três fatias?
2. Ou parar na fatia 1 (ou 2), que já elimina o risco de sobrescrita nas
   ações mais disputadas, e manter a trava por obra com os 5 minutos?

## Atualização de 22/09/2026 — a gravação protegida

A análise de confiabilidade da gravação mudou uma premissa deste ADR: o
salvamento inteiro deixou de ser um UPSERT sem condição. Agora a função
`salvar_obra` (supabase/salvar-obra.sql) só grava com a trava de quem grava e
com a **versão** da obra que a tela leu — a coluna `obra_dados.versao`, que
sobe a cada mudança de conteúdo. O patch passou a conferir as duas coisas
também quando o app manda a versão (`aplicar_patch_obra(codigo, patches,
versao)`), e toda gravação do app vai pela API (`/api/obras/:codigo/...`).

O que isso significa para a fatia 3: com a versão conferida, duas pessoas na
mesma obra não se sobrescrevem mais em silêncio — a segunda gravação é
recusada e a tela avisa. Para as duas conviverem de verdade (trava por tela),
o patch terá de voltar a aceitar gravar **sem** exigir a versão da obra
inteira, conferindo o item pelo id estável descrito acima. A versão continua
valendo para a gravação inteira.
