# Banco de Preços

**Módulo:** Banco de Preços (id `precos`, menu **Referência → Banco de Preços**, endereço `/precos`) ·
**Arquétipos de tela:** listagem com busca e importação de arquivo · **Onde fica:** menu lateral
**Banco de Preços**.

> Os números de linha citados são do commit `468c554` (branch `docs/documentacao-sistema`).

## Objetivo

Guardar o **preço realmente pago** por insumo, vindo do relatório "Relação de Pedidos de Compra" do Sienge
— não preço de tabela. Ele serve de referência quando o time lança item à mão no Executivo e alimenta a
associação de insumos (Compras de Produtos e [Gerador de códigos Sienge](gerador-codigos-sienge.md)).

O mesmo módulo recebe o **cadastro de Insumos do Sienge** (relatório "Insumos", em Excel), que tem outro
papel: dizer **quais insumos estão ativos hoje e como o Sienge os chama** (tabela `insumo_sienge`),
pedido da Priscila em 17/09/2026 (`supabase/insumo-sienge.sql:5-7`).

**Cadastro de insumos em Configurações:** não existe no código hoje. Não há tela de Configurações nem
CRUD manual de insumo; a única entrada de insumos é a importação desta tela.

## Quem usa

| Perfil | O que pode | Onde é conferido |
|---|---|---|
| Admin master, Administrador, Geral, GC | consultar e importar (pedidos de compra e cadastro de insumos) | a rota só exige ser membro (`web/api/_lib/rotas/insumos.js:175`); quem barra a escrita é o RLS "escrevo referencia" (`supabase/rls-perfis.sql:145-151` para `insumo_preco`, `supabase/rls-perfis-complemento.sql:92-96` para `insumo_sienge`) |
| Taylor Made | consulta; o botão **Importar do Sienge** aparece, mas a gravação é recusada pelo banco | RLS (a tela não esconde o botão) |
| Mehoo, Canal de compra | não veem o módulo | tela (`web/src/lib/pessoas.js:253`, `:262`); o RLS deixa ler quem tem perfil |
| Limpar a base inteira | master, admin, geral, gc (nenhuma tela usa hoje) | `exigirPerfilDeEdicao` (`insumos.js:275`) + RLS |

## Fluxo

1. **Abrir o módulo.** A tela lista os 200 preços mais recentes (`listarPrecos`,
   `web/src/lib/insumos.js:26`) e o total de linhas da base (`contarPrecos`, `insumos.js:64`).
2. **Buscar** por código ou descrição; a consulta sai 350 ms depois de parar de digitar
   (`App.jsx:20563-20569`), e a API monta o filtro com o termo entre aspas (sem deixar o texto virar
   condição nova, `web/api/_lib/rotas/insumos.js:121`).
3. **Importar do Sienge** (`aoEscolher`, `App.jsx:20628`), arquivo `.pdf`, `.xlsx`, `.xlsm`, `.xlsb`,
   `.xls` ou `.csv`, lido **no navegador** (o relatório tem 19 MB e não passaria pelo limite da Vercel,
   `App.jsx:20028-20035`):
   - **Relatório de pedidos (PDF)** (`lerSiengePDF` → `parseSiengeTexto`, `App.jsx:20051`, `:20065`):
     acha as linhas "código - descrição", quantidade, unidade e preço; guarda, por código + descrição +
     unidade, **a compra mais recente**, com data e fornecedor. Linhas em **"vb"** (valor fechado) são
     descartadas e contadas.
   - **Relatório de pedidos (Excel/CSV)** (`lerSiengeExcel`, `App.jsx:20111`): acha o cabeçalho
     (colunas de insumo e de preço), aplica as mesmas regras (fora "vb", sem data não entra, mais recente
     ganha).
   - Grava em blocos de 500 linhas com **upsert** pela chave código + descrição + unidade: reimportar
     atualiza o preço em vez de duplicar (`salvarPrecos`, `insumos.js:79`; `POST /api/insumos/precos`).
     A tela mostra "Gravando N de M…".
4. **Importar o cadastro de Insumos** (Excel com a coluna **Ativo**, reconhecido por ela,
   `App.jsx:20136-20186`): linhas com Ativo = "N…" são **inativos** e ficam de fora; o cadastro ativo
   (código, nome atual, unidade, preço de tabela) é separado.
   - A tela confere o que já está na base (`chavesDaBase`, `insumos.js:129`) e pede confirmação com os
     números: quantos insumos ativos, quantos preços novos entram, quantos ficaram de fora (vb, inativos)
     (`somarCadastro`, `App.jsx:20578`).
   - Preço: **só acrescenta** as chaves que ainda não estão na base (`soOsNovos`, `insumos.js:113`) —
     nunca troca preço pago por preço de tabela (a maioria zerada).
   - Cadastro ativo: grava por upsert pelo código (`POST /api/insumos/sienge`) e **remove** da tabela os
     códigos que não vieram no relatório (`POST /api/insumos/sienge/remover`, em blocos de 150); relatório
     vazio não remove nada (`salvarCadastroSienge`, `insumos.js:225`).
5. **Onde o preço é usado:** sugestões de preço ao lançar item no Executivo — até 6 compras com preço > 0
   que casam com as duas palavras mais longas da descrição, para a pessoa escolher, nunca preenchidas
   sozinhas (`sugerirPrecos`, `insumos.js:150`; `SugestoesPreco`, `App.jsx:8779`, usado em
   `App.jsx:9750`); busca de insumo para inserir linha no Plano de Compras; associação de insumos nas
   Compras (`App.jsx:13057`, `:13073`) e no Gerador.

## Telas

| Tela / bloco | Arquétipo | Rota ou aba | Componente |
|---|---|---|---|
| Cartão "Importar do Sienge" | formulário de envio de arquivo | `/precos` | `BancoPrecosView` (`App.jsx:20540`) |
| Tabela "Preços por insumo" (código, descrição, un., custo unit., data ref., fornecedor) | listagem com busca | `/precos` | `BancoPrecosView` |
| Casca da página | — | `/precos` | `PageShell` em `App.jsx:25621-25626` |

## Estados e mensagens

- **Carregando:** três esqueletos de linha.
- **Vazio:** "Nenhum preço cadastrado ainda — importe o relatório do Sienge acima."; com busca: "Nenhum
  insumo encontrado com esse termo."
- **Preço zero** (insumo do cadastro sem preço de tabela): a célula diz "sem preço".
- **Importando:** o botão mostra o passo ("Lendo o arquivo…", "Lendo página N de M…", "Gravando N de
  M…", "Conferindo o que já está na base…", "Cadastro: N de M…") e fica desabilitado.
- **Erros:** "Não encontrei preços nesse arquivo."; "Não encontrei as colunas de Insumo e Preço nessa
  planilha."; recusa do banco no cadastro: "O banco recusou a gravação do cadastro (código 42501): é
  'row-level security', falta a política do supabase/insumo-sienge.sql…" (`insumos.js:154-161`).
- **Sucesso:** "N insumos importados." (com "M linhas em 'vb' foram ignoradas…"); cadastro: "Cadastro de
  insumos ativos atualizado: N insumos." com quantos saíram do Sienge e quantos preços novos.
- **SQL não rodado:** "Os preços foram gravados, mas o cadastro de insumos ativos não. Falta rodar o
  supabase/insumo-sienge.sql…" — a leitura do cadastro volta vazia e a associação funciona como antes.
- **Confirmação** antes de gravar o cadastro: "Cadastro de insumos do Sienge — N insumos ativos" com o
  resumo; "Nenhum preço é apagado".

## Dados

**`insumo_preco`** (`supabase/schema.sql:143-171`): uma linha por **código + descrição + unidade**
(`unique`), com `custo_unitario` (preço pago), `data_ref` (data da compra), `fornecedor`,
`atualizado_em`. A descrição entra na chave porque no Sienge um código é "caixa" genérica ("DECORATIVOS
OBRAS" vai de R$ 15 a R$ 3.845).

**`insumo_sienge`** (`supabase/insumo-sienge.sql:39-48`): uma linha por `codigo` (chave) com
`descricao` (nome de hoje), `unidade`, `preco_tabela`, `importado_em`, `importado_por` (do login, na API).

## APIs

| Método | Rota | Autorização exigida no servidor | Arquivo:linha | O que faz |
|---|---|---|---|---|
| GET | `/api/insumos/precos?busca=&limite=` | login + membro; RLS | `web/api/_lib/rotas/insumos.js:179` | lista da tela (mais recentes primeiro) |
| GET | `/api/insumos/precos/pagina` | login + membro; RLS | `insumos.js:208` | uma página da base (mil por vez) |
| GET | `/api/insumos/precos/contagem` | login + membro; RLS | `insumos.js:220` | total de linhas |
| GET | `/api/insumos/precos/sugestoes` | login + membro; RLS | `insumos.js:236` | candidatos de preço para uma descrição |
| POST | `/api/insumos/precos` | login + membro; RLS "escrevo referencia" | `insumos.js:259` | grava um bloco (upsert pela chave) |
| DELETE | `/api/insumos/precos` | `exigirPerfilDeEdicao` + RLS | `insumos.js:275` | apaga a base inteira (sem tela hoje) |
| GET | `/api/insumos/sienge` | login + membro; RLS | `insumos.js:294` | uma página do cadastro ativo (vazio sem a tabela) |
| POST | `/api/insumos/sienge` | login + membro; RLS | `insumos.js:316` | grava um bloco do cadastro (upsert pelo código) |
| POST | `/api/insumos/sienge/remover` | login + membro; RLS | `insumos.js:341` | tira um bloco de códigos do cadastro |

## Integrações

- **Sienge**, por arquivo: relatório "Relação de Pedidos de Compra" (PDF ou Excel) e relatório "Insumos"
  (Excel). A tela não chama a API do Sienge.
- Leitura do PDF com `pdfjs-dist`, carregado só quando a tela usa (`extrairTextoPDF`, `App.jsx:20036`).

## Regras de negócio usadas

- [RN-076](../regras-de-negocio/RN-076-preco-de-referencia.md) — O preço de referência é o da compra mais recente de cada código + descrição + unidade; linha em "vb" (valor fechado) não vira preço.
- [RN-077](../regras-de-negocio/RN-077-cadastro-sienge-nao-sobrescreve-preco.md) — Importar o cadastro de insumos só acrescenta preços que faltam; nunca troca preço pago por preço de tabela.
- [RN-078](../regras-de-negocio/RN-078-so-insumo-ativo-e-oferecido.md) — Só insumo que está no cadastro ativo do Sienge é oferecido na associação, com o nome de hoje; o preço já pago não se apaga.

## Riscos conhecidos

| Gravidade | Risco | Cenário | Onde no código |
|---|---|---|---|
| média | Reimportar relatório antigo troca preço novo por velho | O upsert grava o que veio no arquivo, sem comparar `data_ref`: subir um relatório de pedidos mais antigo sobrescreve o preço e a data mais recentes da mesma chave | `insumos.js:259-268`; `salvarPrecos` (`web/src/lib/insumos.js:79`) |
| média | Cadastro parcial desativa insumos em massa | Se o relatório de Insumos vier filtrado (só uma família), todos os outros códigos saem de `insumo_sienge` e deixam de ser oferecidos na associação e no Gerador; só o arquivo vazio é barrado | `salvarCadastroSienge` (`web/src/lib/insumos.js:257-266`) |
| média | Apagar a base inteira está a um pedido de qualquer GC | `DELETE /api/insumos/precos` exige só perfil de edição e apaga as ~10 mil linhas sem volta; não há tela que chame, mas a rota está publicada | `insumos.js:270-279` |
| baixa | Escrita autorizada só pelo RLS | As rotas de gravação exigem só ser membro; se a policy de `insumo_preco`/`insumo_sienge` voltar a ser `using (true)` (os arquivos `schema.sql` e `insumo-sienge.sql` ainda criam essa policy aberta), Taylor Made passa a gravar. É preciso rodar `rls-perfis.sql` e `rls-perfis-complemento.sql` depois deles | `insumos.js:175`; `supabase/schema.sql:161-166`; `supabase/insumo-sienge.sql:56-61` |
| baixa | Importação em blocos sem transação | Uma falha no meio deixa parte do arquivo gravado; como é upsert, repetir resolve | `insumos.js:17-20` |

## Fora do escopo

- Preço de catálogo (referência digitada pela casa): ver [Catálogo TKWS](catalogo.md).
- Cadastro manual de insumos (CRUD em Configurações): não existe.
- Associação de insumo por item da obra e envio ao Sienge: tela de Compras de Produtos (ADR-003).

## Código

- Tela: `web/src/App.jsx` (`BancoPrecosView`, `lerSiengePDF`, `parseSiengeTexto`, `lerSiengeExcel`,
  `SugestoesPreco`).
- Dados: `web/src/lib/insumos.js`, `web/api/_lib/rotas/insumos.js`.
- Banco: `supabase/schema.sql` (`insumo_preco`), `supabase/insumo-sienge.sql`, políticas em
  `supabase/rls-perfis.sql` e `supabase/rls-perfis-complemento.sql`.
- Testes: `web/src/__testes__/banco-precos-cadastro.test.mjs`, `insumos-ativos.test.mjs`,
  `resumo-cadastro-sienge.test.mjs`, `supabase/tests/03-referencia.sql` e `06-referencia-completa.sql`
  (acesso negado ao anônimo: o 03 cobre `insumo_sienge`, o 06 cobre `insumo_preco`).
