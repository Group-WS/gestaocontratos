# Catálogo TKWS

**Módulo:** Catálogo TKWS (id `catalogo`, menu **Referência → Catálogo TKWS**, endereço `/catalogo`) ·
**Arquétipos de tela:** listagem (prateleiras de produtos, tabela de fornecedores), formulário (produto,
fornecedor, envio para a obra, importação) · **Onde fica:** menu lateral **Catálogo TKWS**; abas
**Produtos** e **Fornecedores**.

> Os números de linha citados são do commit `468c554` (branch `docs/documentacao-sistema`).

## Objetivo

Responder "qual peça a casa usa" — não "quanto custa". O catálogo guarda o que a TKWS especifica
(spots, louças, metais, móveis soltos, cortinas…) e os acabamentos (MDF, lacas, tecidos, pinturas), com
foto, descrição técnica, descrição curta para o cliente, código, fornecedor e preço de referência. Dele
saem duas coisas: as linhas que vão para o **Executivo** de uma obra, já na verba certa, e os produtos que
montam a [Apresentação de especificações](aditivo-e-apresentacao.md).

O grupo do catálogo **é a verba da EAP da casa** (ILUMINAÇÃO = 05, LOUÇAS E METAIS = 27, MÓVEIS SOLTOS
= 24, CORTINAS = 30…), e não uma taxonomia paralela (`web/src/lib/catalogoModelo.js:1-19`).

## Quem usa

| Perfil | O que pode | Onde é conferido |
|---|---|---|
| Admin master, Administrador, Geral, GC | ver, buscar, cadastrar/editar/tirar produto e fornecedor, importar planilha ou PPTX, enviar produtos para uma obra (só nas obras em que pode editar) | tela (`podeEditar={perfilPermiteEditar}`, `web/src/App.jsx:25576`, `:22605`); banco pelo RLS "escrevo referencia" (`supabase/rls-perfis-complemento.sql:92-96`); a gravação na obra passa por `exigirEdicaoDeObra` |
| Taylor Made | ver e buscar; abrir a Apresentação. Os botões de cadastro somem (`podeEditar` falso); "Enviar para uma obra" continua visível, mas a gravação na obra é recusada pelo servidor | tela e API |
| Mehoo, Canal de compra | não veem o módulo (`web/src/lib/pessoas.js:253`, `:262`) | tela (`podeVerModulo`); a API de leitura aceita qualquer membro (`rotas/catalogo.js:98`) e o RLS deixa ler quem tem perfil |

A rota de catálogo não confere perfil: só `exigirLogin` e `exigirMembro` (`web/api/_lib/rotas/catalogo.js:98`).
Quem recusa a escrita de quem não edita é o RLS.

## Fluxo

1. **Abrir o módulo.** Carrega produtos e fornecedores de uma vez (`web/src/Catalogo.jsx:80-87`,
   `GET /api/catalogo/produtos` e `/fornecedores`).
2. **Procurar.** Busca por texto (descrição, descrição do criativo, código, fornecedor, observações, sem
   acento), alternância **Produtos / Acabamentos**, filtro de fornecedor, de grupo (verba) e de subgrupo
   (`filtrarProdutos`, `catalogoModelo.js:285`). Produto desativado não aparece. O resultado vem em
   prateleiras: verba → subgrupo, com "sem subgrupo" por último (`porPrateleira`, `catalogoModelo.js:302`).
3. **Cadastrar ou editar produto** (**Novo produto** / lápis no cartão, `FormProduto`,
   `Catalogo.jsx:424`): grupo (verba) e descrição do executivo são obrigatórios; descrição do criativo,
   descrição em inglês, código, fornecedor, observações, preço (em reais, gravado em centavos) com a data
   do preço, unidade, foto e tipo (produto/acabamento). Enquanto digita, a tela avisa se já existe
   produto ativo com a mesma descrição (ignora acento, caixa, espaço e pontuação final;
   `duplicatasDe`, `catalogoModelo.js:274`). A foto sobe direto para o balde público `catalogo`, por
   endereço assinado pela API. Gravar com um fornecedor que ainda não tem cadastro cria o fornecedor
   (`Catalogo.jsx:111-132`).
4. **Tirar do catálogo** (lixeira no cartão): confirma "Isso não pode ser desfeito" e **apaga a linha**
   (`Catalogo.jsx:134`).
5. **Fornecedores** (aba): lista com contato, telefone, e-mail, site e quantos produtos usam cada um;
   cadastrar, editar e excluir (`Fornecedores`, `Catalogo.jsx:621`).
6. **Importar planilha** (`.xlsx`/`.xlsm` de padronização ou `.pptx` da biblioteca de materiais,
   `ImportarPlanilha`, `Catalogo.jsx:876`): tudo é lido **no navegador**, com o login de quem importa.
   - Planilha: cada título de grupo vira verba pelos apelidos da EAP (`verbaDoGrupo`,
     `web/src/lib/catalogoImport.js:101`); as fotos, que ficam ancoradas às linhas e não em células, são
     casadas pela âncora (`ancorasDeImagem`, `juntar`); o preço é lido em formato brasileiro ou inglês.
   - PPTX: a leitura sai da geometria do slide — foto e legenda logo abaixo —, com família e fornecedor
     tirados do título do slide e o tipo (peça ou acabamento) deduzido da descrição (`lerPptx`,
     `web/src/lib/catalogoPptx.js:166`; `tipoDoItem`, `:120`).
   - Antes de gravar, mostra o resumo (total, com foto, com preço, fornecedores, grupos que não viraram
     verba) e separa os **repetidos** (já no catálogo ou repetidos no próprio arquivo); "pular repetidos"
     vem ligado. Um fornecedor padrão pode ser digitado para as linhas sem fornecedor.
   - Grava um produto por vez (`gravar`, `Catalogo.jsx:972`): foto que não sobe não derruba o produto;
     produto recusado (ex.: mesmo código do mesmo fornecedor) entra na lista "ficaram de fora"; linha sem
     verba não entra. No fim, cadastra os fornecedores do arquivo.
7. **Enviar para uma obra** (selecionar cartões → barra de ações → **Enviar para uma obra**,
   `EnviarParaObra`, `Catalogo.jsx:759`): escolhe a obra e a quantidade de cada produto. Cada produto
   vira uma linha do **Executivo** (`itensPlanilhaExecutivo`) da verba dele (`produtoParaItem`,
   `catalogoModelo.js:217`). A gravação usa `alterarObra` — pega a trava, lê a obra atual e grava com a
   versão lida; com a obra em edição na mesma aba, entra pela fila da tela (ver
   [gravação da obra](gravacao-da-obra.md)). O Vendido não é tocado. A seleção aceita também
   **acabamentos**: a regra "só produto vai para a obra" existe no modelo (`podeIrParaObra`,
   `catalogoModelo.js:40`), mas nenhuma tela a aplica (ver Riscos).
8. **Apresentação de especificações**: o botão abre o editor com os produtos do catálogo
   (`Catalogo.jsx:169-171`, `:305-308`).

## Telas

| Tela / bloco | Arquétipo | Rota ou aba | Componente |
|---|---|---|---|
| Prateleiras de produtos (busca, filtros, cartões) | listagem | `/catalogo`, aba Produtos | `Catalogo` (`web/src/Catalogo.jsx:57`), `Cartao` (`:375`) |
| Formulário de produto | formulário (janela) | aba Produtos | `FormProduto` (`Catalogo.jsx:424`) |
| Fornecedores | listagem + formulário | aba Fornecedores | `Fornecedores` (`:621`), `FormFornecedor` (`:705`) |
| Enviar para a obra | formulário (janela) | aba Produtos, com seleção | `EnviarParaObra` (`:759`) |
| Importar planilha / PPTX | formulário (janela, com prévia) | aba Produtos | `ImportarPlanilha` (`:876`) |
| Casca da página | — | `/catalogo` | `PageShell` em `App.jsx:25573-25577` |

## Estados e mensagens

- **Carregando:** grade de esqueletos (`GradeSkeleton`).
- **Vazio:** "Nenhum produto cadastrado ainda" (com **Novo produto** para quem edita);
  com filtro: "Nenhum resultado para os filtros aplicados" e **Limpar filtros**; fornecedores:
  "Nenhum fornecedor cadastrado ainda".
- **Fila de trabalho:** aviso "N produtos ainda sem subgrupo — eles aparecem no fim de cada grupo".
- **Preço velho:** o cartão diz "de N meses atrás" quando o preço tem 6 meses ou mais
  (`precoVelho`, `catalogoModelo.js:202`); senão "atualizado".
- **Erro:** aviso "Não foi possível concluir a ação" com a mensagem traduzida (`mensagemDeErro`,
  `Catalogo.jsx:344`): código repetido do mesmo fornecedor vira frase; o resto vem da API sem detalhe
  técnico.
- **Duplicidade no cadastro:** "Já existe um produto / N produtos com essa descrição".
- **Envio para a obra:** "Fulano está editando esta obra agora. Espere ela sair pra não gravar por cima.";
  "Nenhuma verba correspondente foi encontrada na planilha desta obra."; "Esta obra ainda não tem planilha
  carregada. Suba o Executivo dela primeiro."; sucesso: "N produtos foram para o Executivo de OBRA".
- **Importação:** "Não consegui ler o arquivo"; durante a gravação a janela não fecha por clique fora;
  resultado "N produtos entraram no catálogo. M ficaram de fora (motivo): …".
- **Confirmações:** "Tirar X do catálogo? Isso não pode ser desfeito.", "Excluir o fornecedor X?",
  "Remover a foto deste produto?".

## Dados

**`catalogo_produto`** (`supabase/catalogo.sql:26-60`, `:128-135`):

| Campo | Significado |
|---|---|
| `verba` | verba da EAP da casa (FK para `eap_grupo.num`), obrigatória |
| `subgrupo` | subgrupo dentro da verba (sugerido pela descrição, `subgrupoDe`) |
| `tipo_item` | `produto` (peça que se compra) ou `acabamento` (cor e material) |
| `descricao` | descrição técnica do executivo, obrigatória — a que basta para comprar e cadastrar no Sienge |
| `descricao_criativo`, `descricao_en` | descrição curta para o cliente e a versão em inglês (usadas na Apresentação) |
| `codigo`, `fornecedor` | código do fornecedor e nome do fornecedor (texto); `(fornecedor, codigo)` é único quando há código |
| `observacoes` | vira a especificação da linha no Executivo |
| `preco_ref`, `preco_em` | preço de referência em **centavos inteiros** e a data desse preço |
| `imagem` | caminho da foto no balde `catalogo` |
| `unidade`, `ativo` | unidade (padrão `un`) e se aparece no catálogo |
| `criado_por`, `criado_em`, `atualizado_em` | autoria (do login, na API) e carimbos |

**`catalogo_fornecedor`**: `nome` (único), `contato`, `telefone`, `email`, `site`, `observacoes`, `ativo`,
`criado_por`.

**Na obra:** cada produto enviado vira um item do Executivo com `codigo`, `desc` (a descrição técnica),
`marca` (fornecedor), `especificacao` (observações), `qtdVendida`, `un`, `tipo: "produto"`,
`custoMaterial`/`totalMaterial`/`custoUnitario`/`custo` a partir do preço de referência (nulos sem preço)
e `doCatalogo` (o id do produto de origem).

## APIs

| Método | Rota | Autorização exigida no servidor | Arquivo:linha | O que faz |
|---|---|---|---|---|
| GET | `/api/catalogo/produtos` | login + membro; RLS "leio referencia" | `web/api/_lib/rotas/catalogo.js:102` | todos os produtos |
| PUT | `/api/catalogo/produtos` | login + membro; RLS "escrevo referencia" (master, admin, geral, gc) | `catalogo.js:111` | grava um (update com id, insert sem; `criado_por` do login) |
| DELETE | `/api/catalogo/produtos/:id` | idem | `catalogo.js:125` | apaga o produto |
| GET | `/api/catalogo/fornecedores` | login + membro | `catalogo.js:141` | todos os fornecedores |
| PUT | `/api/catalogo/fornecedores` | login + membro; RLS | `catalogo.js:150` | grava um (update com id; sem id, **upsert pelo nome**) |
| DELETE | `/api/catalogo/fornecedores/:id` | login + membro; RLS | `catalogo.js:166` | apaga o fornecedor |
| POST | `/api/catalogo/foto/envio` | login + membro; policies do balde `catalogo` (`rls-reforco.sql:301-314`) | `catalogo.js:183` | assina a subida da foto (recusa caminho que escape da pasta) |
| — | gravação na obra (`alterarObra`) | `exigirEdicaoDeObra` | `web/api/_lib/rotas/obraDados.js:108-145` | ver [gravação da obra](gravacao-da-obra.md) |

## Integrações

- **Storage:** balde `catalogo`, **público** de propósito (a foto aparece dezenas de vezes na tela e não
  carrega segredo, `supabase/catalogo.sql:98-104`); escrever nele exige perfil de edição
  (`rls-reforco.sql:301-350`).
- **EAP da casa:** as verbas e os apelidos vêm de `eap_grupo` (`lib/eap.js`), usados no filtro e na
  importação.
- **Apresentação de especificações:** consome foto, descrição do criativo e descrição em inglês.

## Regras de negócio usadas

- [RN-071](../regras-de-negocio/RN-071-catalogo-grupo-e-verba.md) — Todo produto do catálogo pertence a uma verba da EAP da casa, e é nela que ele entra na obra.
- [RN-072](../regras-de-negocio/RN-072-catalogo-so-produto-vai-para-obra.md) — Só produto vai para o Executivo da obra; acabamento (cor e material) não vira linha de custo. (Declarada no modelo, não aplicada hoje.)
- [RN-073](../regras-de-negocio/RN-073-catalogo-produto-unico.md) — O mesmo código do mesmo fornecedor não entra duas vezes no catálogo.
- [RN-074](../regras-de-negocio/RN-074-catalogo-preco-com-data.md) — Preço de referência é guardado em centavos com a data; preço com 6 meses ou mais é mostrado como velho.
- [RN-075](../regras-de-negocio/RN-075-catalogo-envio-para-o-executivo.md) — Produto enviado a uma obra entra no Executivo, na verba dele, como material não comprado, sem tocar no Vendido.

## Riscos conhecidos

| Gravidade | Risco | Cenário | Onde no código |
|---|---|---|---|
| média | Qualquer perfil de edição apaga produto e fornecedor de todo mundo | O catálogo é referência da casa inteira, mas um GC pode apagar (sem lixeira, sem histórico) um produto ou fornecedor que outras obras usam; a rota só exige ser membro | `rotas/catalogo.js:125`, `:166`; RLS `rls-perfis-complemento.sql:92-96`; tela `Catalogo.jsx:134` |
| média | Acabamento vai para o Executivo | A pessoa seleciona um acabamento (MDF, tecido) junto com produtos e envia: ele vira linha de material no Executivo, com custo se tiver preço. `podeIrParaObra` é importado e nunca chamado | `Catalogo.jsx:20`, `Cartao` (`:375-389`), `EnviarParaObra` (`:772-800`); `catalogoModelo.js:40` |
| média | "Tirar do catálogo" apaga em vez de desativar | Existe a coluna `ativo` (e a limpeza de duplicados desativa, `supabase/catalogo-duplicidades.sql`), mas o botão faz `delete`; o produto some de vez | `Catalogo.jsx:134`, `catalogo.js:125` |
| baixa | Importação grava um produto por pedido, sem transação | Uma queda no meio deixa parte do lote gravada; repetir a importação com "pular repetidos" evita duplicar só pela descrição | `Catalogo.jsx:972-1016` |
| baixa | Upsert de fornecedor pelo nome sobrescreve contato | A importação manda só o nome (`salvarFornecedor({ nome })`), e o upsert grava `contato`, `telefone` etc. como nulos no fornecedor que já existe (o `salvar` do produto evita isso conferindo antes; a importação não confere) (suposição: depende de o PostgREST gravar as colunas nulas enviadas) | `Catalogo.jsx:1014-1016`, `catalogo.js:157-160` |
| baixa | "Enviar para uma obra" aparece para quem não edita | Taylor Made seleciona e envia; o servidor recusa a gravação e a tela mostra o erro | `Catalogo.jsx:311-316` |
| baixa | Foto de produto é pública | Quem tiver o endereço vê a foto sem login (decisão registrada no SQL) | `supabase/catalogo.sql:98-109` |

## Fora do escopo

- Preço pago de verdade: é o [Banco de Preços](banco-de-precos.md) (Sienge), não o catálogo.
- Cadastro do insumo no Sienge: ver [Gerador de códigos Sienge](gerador-codigos-sienge.md).
- Montar a apresentação: ver [Aditivos e Apresentação](aditivo-e-apresentacao.md).

## Código

- Banco: `supabase/catalogo.sql`, `supabase/catalogo-duplicidades.sql` (limpeza manual de repetidos),
  políticas em `supabase/rls-perfis-complemento.sql` e `supabase/rls-reforco.sql` (balde).
- API: `web/api/_lib/rotas/catalogo.js`, `web/api/_lib/storage.js`.
- Tela: `web/src/Catalogo.jsx`, `web/src/lib/catalogo.js` (API e foto), `web/src/lib/catalogoModelo.js`
  (modelo puro: tipos, subgrupos, descrições, dinheiro, duplicidade, busca, item da obra),
  `web/src/lib/catalogoImport.js` (planilha), `web/src/lib/catalogoPptx.js` (biblioteca em PPTX),
  `web/src/lib/dadosObra.js` (`alterarObra`).
- Testes: `web/src/__testes__/catalogo.test.mjs`, `catalogo-import.test.mjs`, `catalogo-pptx.test.mjs`,
  `supabase/tests/06-referencia-completa.sql` (acesso negado ao anônimo nas tabelas de referência, catálogo incluído).
