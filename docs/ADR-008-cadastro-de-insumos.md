# ADR-008 — Cadastro de Insumos, do relatório do Sienge

Gestão de Obras TKWS · 23/09/2026 · **Em decisão com o dev — itens 1 a 4 fechados**

---

## O pedido

> "Precisamos colocar para o admin em configurações, uma forma dele conseguir subir os insumos da
> forma correta, por meio de uma planilha (…) ela é gerada diretamente pelo Sienge."
>
> "Essa tela é uma nova tela, chama Cadastro de Insumos, que o objetivo é apenas cadastrar
> insumos. É um CRUD, que permite o upload de planilha."

## Como é hoje

- O cadastro de insumos ativos entra pelo **Banco de Preços**, no mesmo botão do relatório de
  pedidos. O leitor (`lerSiengeExcel`) exige uma coluna de preço e reconhece o cadastro pela coluna
  Ativo — e por isso **recusa o relatório atual do Sienge**: "Não encontrei as colunas de Insumo e
  Preço nessa planilha".
- Mesmo se lesse, erraria em dois pontos: toma a primeira linha de cada código como nome (neste
  layout a primeira linha é um detalhe) e corta a mãe no primeiro " / ", o que quebra os 22 nomes
  que têm " / " dentro.
- `insumo_sienge` guarda uma linha por código (chave = código) e é lida pelo Associar insumos das
  Compras e pelo Gerador de códigos.
- A escrita é liberada para qualquer pessoa do time (política "acesso time (autenticados)"), e não
  existe registro de quem importou o quê.
- Não existe módulo Configurações. Os cadastros da empresa (compradores, mão de obra própria) são
  abas da Gestão de compras, com escrita só do administrador garantida no banco por
  `public.admin_do_time()`.

## A planilha (relatório "Insumos" do Sienge, 09/2026)

- Uma aba, "Relatório". No topo, os filtros usados: Tabela "1 - TABELA WS BUILDING", BDI e
  Encargos sociais. O cabeçalho traz **Código**, **Descrição** (mesclada) e **Unidade**. No rodapé,
  a data e a hora da geração e "SIENGE / STARIAN".
- 14.388 linhas e 2.706 códigos. Cada código é um bloco contínuo: a **última linha é o nome puro** e
  as anteriores são "NOME / detalhe". Isso vale para 100% do arquivo. 22 nomes têm " / " dentro.
- Não tem coluna de preço nem coluna Ativo.
- Ruído que vem do próprio Sienge: 62 linhas literalmente repetidas (uma chega a ter 5 cópias),
  8 pares que só diferem por um espaço invisível e 568 linhas em "vb" (taxas, alvará, IPTU).

## As decisões (23/09/2026)

### Item 1 · O template

| Pergunta | Resposta |
|---|---|
| Qual layout é aceito | **Só o layout novo** (Código, Descrição, Unidade). O modelo é conferido em todo envio. |
| O que a validação confere | O **cabeçalho pelos nomes** das três colunas, a **linha "Tabela"** do topo e o **rodapé** com a data e "SIENGE". Sem exigir posição fixa de coluna: se o Sienge mudar o topo do relatório, a leitura continua. |
| Como sabemos que só vieram ativos | O arquivo não diz. **Confiamos no filtro do Sienge** e criamos um campo **Ativo (Sim/Não) no sistema**, editável pelo admin. Tudo entra como Sim, e cada importação devolve a Sim o que veio no relatório. |
| Tabela de preços | Existe **uma tabela ativa, configurada** (hoje "1 - TABELA WS BUILDING"). O arquivo precisa bater **código e nome**; se só o nome mudou, a prévia avisa e pede confirmação. O valor é guardado. |
| Data do relatório | **Guardada e mostrada** (vem do rodapé). |

### Item 2 · O registro

| Pergunta | Resposta |
|---|---|
| O que identifica um registro | **Código + Descrição**, com o texto **exatamente como veio**. O código se repete: o 406 está em 1.117 linhas. |
| Que texto fica gravado | O **original do Sienge**, espaços inclusive. |
| Linhas repetidas | **Juntadas, com aviso na prévia.** São 62 neste arquivo, pela comparação literal. |
| Onde o cadastro mora | **Tabela nova, independente** da `insumo_sienge`. Associar insumos e Gerador de códigos seguem como estão. |

### Item 3 · Limpeza e validação

| Pergunta | Resposta |
|---|---|
| Linha sem código, descrição ou unidade | **Importa o resto e lista** as deixadas de fora, com o número da linha do Excel. |
| Linhas em "vb" | **Ficam de fora** (568 linhas, 135 códigos). A prévia diz quantas foram descartadas. |
| Pares que só diferem por espaço | Entram como **dois registros**, e a prévia **avisa** (8 pares neste arquivo). |

### Item 4 · Reimportação

| Pergunta | Resposta |
|---|---|
| O que acontece com quem não veio no relatório novo | **O admin escolhe na prévia**, entre dois caminhos: **apagar** (apagado de vez) ou **manter e só incluir os novos** (o que já estava continua como está, Ativo = Sim). |
| Qual caminho vem marcado | **Nenhum.** Confirmar só liga depois da escolha. |
| Registro criado à mão na tela | **Intocado pela importação**, nos dois caminhos. |
| Campo editado na tela contra o valor novo do relatório | **A prévia lista os conflitos** e o admin decide caso a caso. |

### Item 5 · O CRUD

| Pergunta | Resposta |
|---|---|
| O que o admin faz à mão | **Criar** insumo novo, **editar** descrição, unidade e código, **apagar** registro, e ligar/desligar o Ativo. |
| Apagar | **Bloqueia se o insumo estiver em uso**, e a tela mostra onde. |
| O que conta como "em uso" | **Solicitação enviada ao Sienge** com aquele código. Produto de obra associado e preço na base de preços **não** contam. |
| Apagar na importação | A mesma conferência vale: no caminho "apagar", **quem está em uso não é apagado**, e a prévia lista quem ficou. |
| A lista | Paginada e buscada no banco (são 13.758 registros), com **busca por código e descrição**, **filtro por Ativo** e **filtro por unidade**. Sem exportar para Excel. |
| Rastro | **Histórico completo**: cada mudança vira uma linha, como o histórico da obra. |

### Item 6 · Onde fica e quem pode

| Pergunta | Resposta |
|---|---|
| Onde a tela fica | Um **módulo novo, "Configurações"**, no pé do trilho da barra lateral, ao lado de Equipe e acessos — que é onde mora o que é cadastro, e não trabalho do dia. Cadastro de Insumos é a primeira aba; outras configurações cabem depois. |
| Quem enxerga | **Só quem administra**, na mesma regra da Equipe e acessos: quem não administra não vê o item no menu nem alcança a rota. A escrita é garantida no banco por `public.admin_do_time()`, como nos outros cadastros da empresa. |
| A importação antiga do Banco de Preços | **Fica**, para o formato antigo, **com um aviso apontando o caminho novo**. |

## O que este arquivo produz com as regras acima

| | |
|---|---|
| Linhas no arquivo | 14.388 |
| Descartadas por "vb" | −568 (135 códigos) |
| Repetidas juntadas | −62 |
| Linhas com campo faltando | 0 |
| **Entram no cadastro** | **13.758 registros, em 2.571 códigos** |
| Avisos na prévia | 8 pares que só diferem por espaço |

## Em aberto

Itens 7 a 10, ainda em conversa com o dev: o fluxo de envio, prévia, confirmação e histórico;
arquitetura e segurança (rota, transação, RLS e testes); as fichas de regra de negócio; e o
encaixe no gate.

## Histórico

- 23/09/2026 — itens 1 a 4 decididos com o dev; ADR aberta para ser completada item a item.
- 23/09/2026 — itens 5 (CRUD) e 6 (lugar e acesso) decididos.
