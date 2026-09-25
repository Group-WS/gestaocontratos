# ADR-008 — Cadastro de Insumos, do relatório do Sienge

Gestão de Obras TKWS · 23/09/2026 · **Decidido pelo dev, item a item · implementado na branch `feat/cadastro-de-insumos` · regras RN-086 a RN-089**

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

### Item 7 · O fluxo da tela

| Pergunta | Resposta |
|---|---|
| O caminho | Enviar o arquivo → a API valida o modelo e monta a prévia → o admin escolhe o caminho (apagar, ou manter e só incluir os novos) → confirma → a importação grava → resultado e registro no histórico. |
| O que a prévia lista, além dos números | **Os que vão sair** (no caminho apagar), **os conflitos** entre a edição à mão e o relatório, **as linhas deixadas de fora** (com o número da linha do Excel) e **os pares que só diferem por espaço**. |
| Relatório com muito menos códigos que o cadastro | **Só destacado na prévia**; a confirmação normal basta. |
| Falha no meio da gravação | **Fica o que entrou**, com **retry manual**: um aviso fixo no topo diz que a última importação não terminou, com o botão para continuar. |
| Ordem da gravação | **Gravar primeiro, apagar por último.** Se falhar no meio, o cadastro fica com registros a mais, nunca a menos. |
| Histórico de importações | **Lista na própria tela**: quem importou, quando, a tabela, a data do relatório, o caminho escolhido e os números. |

### Item 8 · Arquitetura e segurança

| Pergunta | Resposta |
|---|---|
| Onde a planilha é lida | **Na API.** O navegador sobe o xlsx direto para o Storage, por endereço assinado pela API — o mesmo padrão dos cadernos e contratos, fora do limite de 4,5 MB do corpo da função. A API lê o arquivo de lá, valida o modelo e monta a prévia. O "continuar" relê o mesmo arquivo. |
| O arquivo | **Guardado no Storage**, num balde próprio, junto do registro da importação. Ficam **os 12 últimos**; os mais antigos são apagados e o registro no histórico continua. |
| A tabela | **`insumo_cadastro`**, com id próprio e unicidade em (código, descrição). Cada registro guarda a origem (relatório ou tela), que é o que deixa a importação não encostar no que nasceu na tela. |
| Quem lê e escreve no banco | **O time lê, só o admin escreve** (`public.admin_do_time()`), como os outros cadastros da empresa — o que já deixa pronto para o Associar insumos ler no futuro. A tela continua só para quem administra (item 6). |
| O que vale sem escolha, pelo padrão | Dado só pela rota em `web/api/_lib/rotas/`; front por `apiJson`; RLS em toda tabela; teste de acesso negado no banco; E2E `@login` e `@acesso-negado`. |

### Item 9 · Regras de negócio

Quatro regras viram ficha, **já vigentes** (o dev decidiu cada uma nesta conversa). A condição
de cada uma mora em `web/src/regras`, com teste ao lado, e é chamada pela tela, pela rota e, onde
cabe, pelo banco.

| Regra | Onde vale |
|---|---|
| **Só o administrador mantém o cadastro de insumos** (criar, editar, apagar e importar) | Tela, rota e RLS |
| **Insumo com solicitação enviada ao Sienge não se apaga** | Apagar pela tela e caminho "apagar" da importação |
| **A importação só aceita o relatório da tabela ativa** (código e nome) | Validação do modelo, na API |
| **Insumo em "vb" não entra no cadastro** | Leitura do relatório, na API |

### Item 10 · A entrega

| Pergunta | Resposta |
|---|---|
| Quando a implementação começa | **Depois que o dev revisar esta ADR** e liberar. |
| Em partes ou tudo junto | **Tudo junto**: banco, regras, API e tela numa entrega só. |
| Onde se trabalha | **Worktree separada**, numa branch nova saindo da `develop`, sem encostar nas mudanças abertas de outras sessões. |
| O SQL | Vai como arquivo em `supabase/` (tabela, RLS, histórico e balde), para rodar em produção antes do deploy, como os outros. |
| Documento de funcionalidade | **Não**: esta ADR e as fichas das regras bastam. |

### Decisões tomadas na implementação (23/09/2026)

| Pergunta | Resposta |
|---|---|
| Uma solicitação com o código 406 bloqueia o quê | **Só o registro com o mesmo texto**: mesmo código (`productId`) e mesmo texto (`notes`) do item enviado. Os outros registros do código continuam apagáveis. |
| Quais solicitações contam como enviadas | **Só concluída e parcial.** Enviando, falhou e abandonada não contam. |
| Onde o admin configura a tabela ativa | **Num card na própria aba**, com código, nome e o próprio botão de salvar. |

## O que este arquivo produz com as regras acima

| | |
|---|---|
| Linhas no arquivo | 14.388 |
| Descartadas por "vb" | −568 (135 códigos) |
| Repetidas juntadas | −62 |
| Linhas com campo faltando | 0 |
| **Entram no cadastro** | **13.758 registros, em 2.571 códigos** |
| Avisos na prévia | 8 pares que só diferem por espaço |

## A solução

- **Regras (RN-086 a RN-089):** `web/src/regras/cadastroDeInsumos.js`, com teste ao lado.
- **Leitura e plano:** `web/src/lib/relatorioDeInsumos.js` — confere o modelo (cabeçalho pelos
  nomes, linha "Tabela", rodapé do Sienge), separa o que entra, o que fica de fora e por quê, e monta
  o plano contra o cadastro de hoje. O registro do Sienge é reconhecido pelo código e pela descrição
  com que chegou (`sienge_codigo`, `sienge_descricao`), mesmo depois de editado na tela.
- **Banco:** `supabase/insumo-cadastro.sql` — `insumo_cadastro`, `insumo_cadastro_historico`
  (gatilho), `insumo_cadastro_importacao`, `insumo_tabela_ativa`, o balde privado
  `insumo-importacao` e as funções `insumo_cadastro_gravar` e `insumo_cadastro_apagar` (cada bloco
  numa transação). O autor vem do login; a RN-087 também é garantida por gatilho.
- **API:** `web/api/_lib/rotas/insumoCadastro.js` — lista, CRUD, tabela ativa, envio assinado,
  prévia e gravação em rodadas de alguns segundos (a tela chama de novo até concluir; o "continuar"
  refaz o plano e reconhece o que já entrou).
- **Tela:** módulo **Configurações** (`web/src/features/configuracoes/`), no pé do trilho, só para
  quem administra; aba Cadastro de Insumos com a tabela ativa, a lista, o formulário, o histórico
  por insumo, a importação com prévia e a lista de importações. O Banco de Preços ganhou o aviso do
  caminho novo.
- **Testes:** regras (`web/src/regras/cadastroDeInsumos.test.mjs`), leitura e plano
  (`web/src/__testes__/cadastro-de-insumos.test.mjs`), rota
  (`web/api/_lib/__testes__/insumo-cadastro-rota.test.cjs`), banco
  (`supabase/tests/17-insumo-cadastro.sql`) e E2E (`e2e/configuracoes.spec.mjs`).

## Próximo passo

Rodar `supabase/insumo-cadastro.sql` em produção **antes** do deploy (sem ele, a aba avisa que falta
o SQL). Depois, importar o relatório de Insumos pela tela nova.

## Histórico

- 23/09/2026 — itens 1 a 4 decididos com o dev; ADR aberta para ser completada item a item.
- 23/09/2026 — itens 5 (CRUD) e 6 (lugar e acesso) decididos.
- 23/09/2026 — itens 7 (fluxo), 8 (arquitetura) e 9 (regras de negócio) decididos.
- 23/09/2026 — item 10 (entrega) decidido; ADR completa, aguardando a revisão do dev.
- 23/09/2026 — revisada pelo dev e implementada; três decisões da implementação registradas acima.
