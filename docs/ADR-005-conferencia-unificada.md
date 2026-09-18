# ADR-005 — A Conf. Executivo vira a tela única de decisão

Gestão de Obras TKWS · 18/09/2026 · **Decidido por ela; implementação em fatias**

---

## O pedido

> "vamos melhorar o conferencia executivo e juntar dentro a aprovação com o
> cliente. a ideia é trazer toda planilha do executivo (descricao, código/espec.,
> fornecedor, ambiente e quantidade, custo unit. e total), se o item tiver alguma
> conferencia técnica, pode aparecer a linha em laranja, o que ta conferido
> aparece normal.
>
> ai vamos colocar uma coluna chamada: concluído executivo, aprovado para compra
> (somente admin tem permissao para liberar).
>
> Sempre que for removido um item, precisa abrir o campo de observacao abaixo
> para justificativa. Essa observacao tem que aparecer na tela de conferencia
> executivo."

## As quatro decisões dela (18/09/2026)

| Pergunta | Resposta |
|---|---|
| "Concluído executivo" e "Aprovado para compra" | **Duas colunas** — são decisões de pessoas diferentes |
| A aba "Aprovação do Cliente" | **Some**; vira coluna aqui dentro |
| "Removido um item" | **Excluído da planilha do Executivo** |
| Os três cartões de cima | **Continuam**, acima da lista nova |

## A tela que resulta

**Em cima**, os cartões de hoje: Conferido · Entrou, saiu ou mudou ·
Conferência técnica · Liberar para compra. Eles respondem "o que mudou em
relação ao vendido", que é outra pergunta e continua valendo.

**Embaixo**, uma tabela só: **a planilha do executivo inteira**, por verba.

| Coluna | De onde vem |
|---|---|
| Produto | `desc` |
| Código / espec. | `codigo` + `especificacao` |
| Fornecedor | `marca` |
| Ambiente | `ambiente` |
| Qtd. | `qtdExecutivo ?? qtdVendida` + `un` |
| Custo unit. | `custoUnitario` |
| Total | `custo` |
| **Cliente** | `aprovadoCliente` — *vem da tela que será aposentada* |
| **Concluído executivo** | `concluidoExecutivo` — **campo novo** |
| **Aprovado para compra** | `liberadoCompra` — **só admin** |

**A cor da linha diz o estado da conferência**: laranja quando o item tem
alerta de conferência técnica pendente; normal quando está conferido. A linha
removida continua riscada, e agora mostra **a justificativa** embaixo.

## O que muda de regra, e por quê importa

1. **Liberar para compra passa a exigir administrador.** Hoje qualquer pessoa
   com a edição habilitada libera. É a mudança mais sensível deste ADR: ela
   tira poder de quem tem hoje. Os botões em massa por verba ("Liberar N",
   "Conferi os alertas · liberar N") passam a aparecer só para admin.
2. **Excluir item do Executivo passa a exigir justificativa.** Hoje é um
   clique que alterna `excluido`. Passa a abrir um campo obrigatório; sem
   texto, não exclui. Gravado com quem e quando, e mostrado aqui.
3. **"Concluído executivo" é campo novo** (`concluidoExecutivo: { em, por }`),
   igual aos outros carimbos. Entra no `CAMPOS_POR_PATCH` para gravar sozinho.
4. **A aba "Aprovação do Cliente" sai da esteira.** A assinatura total (a
   tela `AssinaturaClienteView`) passa a morar dentro da Conf. Executivo, no
   bloco que abre e fecha criado hoje de manhã.

## As fatias

**Fatia 1 — a tabela.** A planilha inteira com as sete colunas de informação,
a cor por estado da conferência e a justificativa da linha removida. Nenhuma
decisão muda de lugar ainda: a lista de liberação de hoje continua embaixo.
Dá para publicar e olhar sem risco.

**Fatia 2 — as três colunas de decisão.** Cliente, Concluído executivo e
Aprovado para compra, com os botões em massa por verba e a regra de admin. A
lista de liberação de hoje sai (vira coluna). Aqui é onde a regra de
permissão muda — precisa ser dito à equipe.

**Fatia 3 — a justificativa na exclusão** (na tela do Executivo) e a
aposentadoria da aba "Aprovação do Cliente", com a assinatura total mudando
de casa.

## O risco que eu não quero esconder

São **dez colunas**. A tela de hoje já teve problema de distribuição, e a
regra que corrigi de manhã (`table-layout: fixed`) ajuda mas não resolve
sozinha: dez colunas em 1.000 px dão 100 px cada, e "Cortina em voil off
white, prega macho de 12 cm…" não cabe em 100 px.

Então a tabela nasce com prioridade explícita: Produto ocupa o resto; as
colunas de decisão são estreitas e de ícone; **código, fornecedor e ambiente
moram dentro da célula do produto**, em linha de conferência pequena — o
mesmo desenho que ela aprovou na Aprovação do Cliente e no "Entrou, saiu ou
mudou". Se ficar apertado, o próximo a sair é "Custo unit.", que é derivável
do total e da quantidade.
