# ADR-006 — Item aprovado para compra fica travado no Executivo

Gestão de Obras TKWS · 23/09/2026 · **Decidido pelo dev · regra RN-002**

---

## O pedido

> "Quando o usuário estiver na aba do Executivo e habilitar a aba para edição, ele apenas poderá:
> editar ou remover um item se ele ainda não tiver sido 'Aprovado para compra' na aba
> Conferência do executivo. Adicionar um novo item não precisa seguir a regra acima. E tudo que
> ele fizer deve refletir nas abas à frente."

## Como era

- Qualquer pessoa com a edição editava ou removia qualquer linha do Executivo. Editar valor ou
  descrição de um item aprovado **derrubava a aprovação** (`CAMPOS_QUE_DERRUBAM_APROVACAO`) e o
  item voltava para a fila da Conferência.
- Substituir ou limpar a planilha inteira com item aprovado era **só do administrador** (pedido
  de 19/09/2026).

## As decisões (23/09/2026)

| Pergunta | Resposta |
|---|---|
| O que trava a linha | **Aprovado ou já andando na compra**: a aprovação da Conferência, ou solicitado, comprado, com canal, avulso ou de aditivo. É o mesmo critério do filtro "liberado" que o app já tinha. |
| O administrador também fica travado | **Sim, todos.** Para mexer, o admin desfaz a aprovação na Conferência (o botão já existe) e a linha destrava. |
| O que fica bloqueado na linha | Editar as células, **remover** e **substituir** (⇆, que remove o item). O **+** (inserir abaixo) continua: é item novo. |
| Onde a trava vale | **Tela e servidor.** Gatilho no banco, como a RN-001: gravar pela API também é recusado. |
| Substituir/limpar a planilha, desfazer troca, restaurar versão | **Nada passa.** Se a operação muda ou tira um item travado, é recusada — inclusive para o administrador. Substituir a planilha passa a exigir desfazer as aprovações antes. |

## A solução

- **Regra (RN-002):** `web/src/regras/itemAprovadoNoExecutivo.js`, com teste ao lado.
  - `linhaDoExecutivoTravada` diz à tela se a linha está travada. A linha da planilha casa com o
    item da lista de trabalho pela descrição normalizada, a mesma chave que a edição do Executivo
    já usa para achar o produto.
  - `travadosAlterados` é a conta do servidor: cada item travado de antes precisa continuar
    existindo depois com os mesmos campos da planilha (descrição, especificação, fornecedor,
    ambiente, unidade, quantidades, custos e totais, removido). Os itens não têm identificador
    estável, então a conta é por conteúdo, como na RN-001. Tirar a aprovação não muda esses
    campos, por isso destrava sem ser recusado.
- **Tela (Executivo):** a linha travada fica só para consulta, sem remover nem substituir, com a
  etiqueta "aprovado p/ compra" e a explicação no título. O botão de substituir a planilha fica
  travado para todos enquanto houver item aprovado, dizendo o caminho: desfazer as aprovações.
- **Banco:** `supabase/rn-002-item-aprovado-no-executivo.sql`, gatilho `BEFORE UPDATE` em
  `obra_dados`, que roda antes do gatilho de versão. Recusa com `42501` e a mensagem
  "RN-002: …", que a API já repassa à pessoa (`erroDoBanco`).

## Refletir nas abas à frente

Não mudou: a edição e a inclusão no Executivo já gravam também na lista de trabalho da verba
(`itens`), que é o que a Conferência, as Compras e o Plano de compras leem. A trava só impede
mudar o que já foi aprovado.

## Consequências

- Com a trava valendo para todos, a regra antiga "editar derruba a aprovação" deixa de acontecer
  no Executivo: o item aprovado não se edita mais.
- Substituir a planilha com item comprado ou solicitado fica impossível até isso ser desfeito. É
  o efeito pedido ("nada passa").
- Desfazer troca de produto nas Compras é recusado quando as linhas da troca já têm canal ou já
  andaram.
- **Falta rodar em produção:** `supabase/rn-002-item-aprovado-no-executivo.sql`. Até lá, só a
  tela garante a regra.
