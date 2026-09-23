# Gerador de códigos Sienge

**Módulo:** Gerador de códigos Sienge (id `gerador`, menu **Referência → Gerador de códigos Sienge**,
endereço `/gerador`) · **Arquétipos de tela:** ferramenta de conferência (formulário de envio de
arquivo + listagem do resultado) · **Onde fica:** menu lateral **Gerador de códigos Sienge**.

> Os números de linha citados são do commit `468c554` (branch `docs/documentacao-sistema`).

## Objetivo

Ferramenta avulsa, **sem obra e sem gravar nada**, para quem cadastra produtos no Sienge. A pessoa sobe
uma lista qualquer de produtos (cotação de fornecedor, planilha de detalhes da obra, "Insumos Orçados" do
Sienge, recorte do executivo); a tela casa cada produto com os insumos que já existem no cadastro do
Sienge e diz:

- quais já existem (e qual variante/detalhe é a mesma coisa);
- quais precisam de um **detalhe novo** dentro de um insumo existente, com a descrição no padrão da casa
  pronta para copiar;
- e gera o **template de importação de detalhes** do Sienge (CSV) só com o que falta.

É a mesma associação da tela de Compras de Produtos da obra, mas solta. Nada é guardado: o arquivo é lido
na memória e some ao sair da tela — a verdade sobre quais insumos existem é o Sienge
(`web/src/App.jsx:11719-11729`).

## Quem usa

| Perfil | O que pode | Onde é conferido |
|---|---|---|
| Admin master, Administrador, Geral, GC | tudo: subir planilha ou PDF, associar, baixar conferência e template | tela (`podeVerModulo`); API |
| Taylor Made | subir **planilha** e usar a tela; **PDF é recusado** (a leitura do PDF passa pelo servidor, que exige perfil de edição) | `POST /api/sienge/texto` com `exigirPerfilDeEdicao` (`web/api/_lib/mondayApp.js:577`) |
| Mehoo, Canal de compra | não veem o módulo | tela (`web/src/lib/pessoas.js:253`, `:262`) |

A base consultada (preços e cadastro ativo) é lida por qualquer membro com perfil
(`web/api/_lib/rotas/insumos.js:175`, RLS "leio referencia").

## Fluxo

1. **Abrir a tela.** A base carrega sozinha: a base de preços inteira, página por página
   (`carregarTodosInsumos`, `web/src/lib/insumos.js:50`) e o cadastro de insumos ativos
   (`carregarCadastroSienge`, `insumos.js:200`) (`App.jsx:11781-11789`). As duas viram "mães"
   (insumo = código do Sienge) com as variantes (detalhes) de cada uma; se há cadastro ativo, **só o que
   está nele é oferecido, com o nome de hoje** (`agruparPorMae`, `web/src/lib/sienge.js:151`).
2. **Subir a lista** (`.xlsx`, `.xlsm`, `.xls`, `.csv` ou `.pdf`, `lerArquivo`, `App.jsx:11802`):
   - planilha: lida no navegador; as colunas são procuradas por vários nomes (Descrição, Insumo,
     Produto, Item…) e, sem cabeçalho, a tela procura sozinha a coluna das descrições
     (`lerListaDeProdutos`, `sienge.js:444`);
   - PDF: o servidor só extrai o texto (`textoDoPDF`, `App.jsx:419` → `POST /api/sienge/texto`); a tela
     tenta primeiro o formato "Insumos Orçados" do Sienge (`lerListaDeProdutosPDF`, `sienge.js:602`) e,
     se não for, lê como cotação de fornecedor (`lerCotacaoPDF`, `sienge.js:529`).
   Na leitura, as linhas **sem código auxiliar** (sem código nem modelo) ganham um número sorteado de 5
   dígitos, único no arquivo, marcado como sorteado (`sortearAuxiliares`, `sienge.js:719`). O modo de
   fornecedor vem do arquivo: dois ou mais fornecedores na coluna → "Vários fornecedores".
3. **Fornecedor.** "Mesmo fornecedor": digita-se uma vez e ele abre a descrição de todas as linhas;
   "Vários fornecedores": cada linha usa o da própria coluna. Um botão desfaz a troca entre as colunas
   fornecedor e ambiente, quando o palpite as trocou.
4. **Associar, linha a linha** (`LinhaGerador`, `App.jsx:12133`): para cada produto a tela mostra as
   mães candidatas por semelhança de palavras (`acharMaes`, `sienge.js:205`) e as variantes da melhor,
   com as palavras que casaram e as que faltaram (`ordenarDetalhes`, `sienge.js:219`). A pessoa pode:
   - escolher a variante que já existe → a linha fica "associada" e **não** vai para o template;
   - trocar a mãe (sempre uma da base: não há texto livre);
   - deixar sem variante (= "cadastrar como detalhe novo") → vai para o template.
5. **Descrição do detalhe.** Gerada no padrão da casa — FORNECEDOR / DESCRIÇÃO / MODELO / COR /
   ESPECIFICAÇÃO / CÓDIGO, em caixa alta, pulando o que não existe e sem repetir fornecedor e marca
   (`descricaoSienge`, `sienge.js:253`). Editável; desfazer a edição volta ao texto gerado.
6. **Códigos do template.** O código auxiliar vem do arquivo (código, código Sienge ou modelo) ou do
   sorteio, e é editável; o código do detalhe fica em branco para a pessoa preencher (quem numera é o
   Sienge).
7. **Baixar.**
   - **Conferência (Excel)** (`baixarResultado`, `App.jsx:11924`): todas as linhas, com quantidade,
     unidade, mãe, variante escolhida, situação ("cadastrar", "associado", "escolher variante") e a
     descrição para cadastrar.
   - **Template Sienge para cadastro de detalhe (N)** (`baixarTemplate`, `App.jsx:11913`): CSV com
     `;`, sem BOM, com o cabeçalho exato do Sienge (`CABECALHO_TEMPLATE_SIENGE`, `sienge.js:658`), só com
     as linhas sem variante escolhida (`montarTemplateSienge`, `sienge.js:734`).

## Telas

| Tela / bloco | Arquétipo | Rota ou aba | Componente |
|---|---|---|---|
| Cabeçalho com ações (subir, conferência, template) e barra de fornecedor | página de ferramenta | `/gerador` | `GeradorSiengeView` (`App.jsx:11730`) |
| Números (já existem, precisam ser cadastrados, vão pra planilha) | indicadores | `/gerador` | `KpiMini` em `App.jsx:12063-12067` |
| Tabela produto × insumo no Sienge | listagem com escolha | `/gerador` | `LinhaGerador` (`App.jsx:12133`), `EscolhaSienge` |

## Estados e mensagens

- **Carregando a base:** "Carregando a base do Sienge…".
- **Base vazia:** "A base de insumos do Sienge está vazia — importe o relatório em Banco de Preços."
- **Falha na base:** "Não consegui ler a base de insumos: …".
- **Arquivo não reconhecido:** PDF: "Não reconheci este PDF — nem como 'Insumos Orçados' do Sienge, nem
  como cotação de fornecedor…"; planilha: "Não achei descrição de produto neste arquivo…". Tudo com o
  prefixo "Não consegui ler o arquivo:".
- **Template incompleto:** aviso "N linhas vão sair incompletas no template — o Sienge exige código do
  insumo, código do detalhe e código auxiliar, e o código do detalhe é ele quem numera"
  (`faltaNoTemplate`, `sienge.js:791`).
- **Código sorteado:** a linha indica que o auxiliar foi sorteado; editar o campo tira a marca.
- Sem arquivo, a tela mostra só o botão **Subir lista de produtos**.

## Dados

Nenhum dado é gravado. O que a tela lê:

| Origem | Campos | Para quê |
|---|---|---|
| `insumo_preco` (Banco de Preços) | `codigo`, `descricao`, `unidade`, `custo_unitario` | as variantes (detalhes) de cada código, com o nome da época da compra |
| `insumo_sienge` (cadastro ativo) | `codigo`, `descricao`, `unidade` | quais códigos continuam ativos e o nome de hoje |

O CSV gerado tem as colunas `Código auxiliar do insumo*; Descrição do insumo; Código do detalhe*;
Código auxiliar do detalhe*; Descrição do detalhe*; Produto fiscal` — preenchidas com código e nome da
mãe, código do detalhe (digitado), código auxiliar, descrição do detalhe e produto fiscal vazio.

## APIs

| Método | Rota | Autorização exigida no servidor | Arquivo:linha | O que faz |
|---|---|---|---|---|
| GET | `/api/insumos/precos/pagina?campos=custo` | login + membro; RLS | `web/api/_lib/rotas/insumos.js:208` | uma página da base de preços |
| GET | `/api/insumos/sienge` | login + membro; RLS | `insumos.js:294` | uma página do cadastro ativo (vazio se a tabela não existe) |
| POST | `/api/sienge/texto` | `exigirPerfilDeEdicao`; PDF validado | `web/api/_lib/mondayApp.js:577` | extrai o texto do PDF (cru; se chegar corrompido, a tela reenvia em base64) |

## Integrações

- **Sienge**, indiretamente: a base vem dos relatórios importados no [Banco de Preços](banco-de-precos.md);
  o resultado é um arquivo para importar no Sienge à mão. A tela não chama a API do Sienge.

## Regras de negócio usadas

- [RN-078](../regras-de-negocio/RN-078-so-insumo-ativo-e-oferecido.md) — Só insumo que está no cadastro ativo do Sienge é oferecido na associação, com o nome de hoje; o preço já pago não se apaga.
- [RN-079](../regras-de-negocio/RN-079-detalhe-so-em-insumo-existente.md) — Detalhe novo só se cadastra dentro de um insumo que já existe no Sienge; o que já existe não vai para o template.
- [RN-080](../regras-de-negocio/RN-080-descricao-do-detalhe-sienge.md) — A descrição do detalhe segue o padrão FORNECEDOR / DESCRIÇÃO / MODELO / COR / ESPECIFICAÇÃO / CÓDIGO, em caixa alta, sem partes vazias nem repetidas.
- [RN-081](../regras-de-negocio/RN-081-codigo-auxiliar-unico.md) — Todo detalhe leva código auxiliar, único no arquivo; sem código de origem, recebe um número sorteado identificado como sorteado.

## Riscos conhecidos

| Gravidade | Risco | Cenário | Onde no código |
|---|---|---|---|
| média | O template do Gerador não tira detalhes repetidos | O mesmo produto em dois ambientes sai duas vezes no CSV, com auxiliares diferentes, e o Sienge aceita calado; nas Compras o template passa por `limparTemplate`, aqui não | `baixarTemplate` (`App.jsx:11913`) usa `montarTemplateSienge` direto; `limparTemplate` (`sienge.js:755`) só nas Compras (`App.jsx:14984`) |
| baixa | Número sorteado muda a cada leitura | Subir o mesmo arquivo de novo sorteia outros auxiliares; se a pessoa importar os dois CSVs, o mesmo detalhe entra duas vezes com códigos diferentes (nas Compras o código é estável, `auxiliarEstavel`) | `sortearAuxiliares` (`sienge.js:719`) |
| baixa | Base de preços incompleta casa errado | Se a paginação falhar no meio, a tela casa contra uma base cortada e manda cadastrar o que já existe (a leitura pagina de mil em mil justamente para evitar o corte do PostgREST) | `insumos.js:50` |
| baixa | Taylor Made não lê PDF, e a mensagem não explica | A tela oferece `.pdf`, mas o servidor recusa por perfil com `{ erro: "Você não tem acesso a esta área." }`; a tela lê o campo `error` e mostra só "Não consegui ler o arquivo: HTTP 403" | `mondayApp.js:577-579`, `web/api/_lib/auth.js:133-137`, `textoDoPDF` (`App.jsx:419-427`) |

## Fora do escopo

- Gravar a lista ou o resultado (de propósito: a verdade é o Sienge).
- Cadastrar no Sienge pela API: o CSV é importado à mão no Sienge.
- Associação com a obra e envio da solicitação de compra: tela de Compras de Produtos (ADR-003).

## Código

- Tela: `web/src/App.jsx` (`GeradorSiengeView`, `LinhaGerador`, `EscolhaSienge`, `textoDoPDF`).
- Modelo puro: `web/src/lib/sienge.js` (agrupamento por mãe, busca, descrição, leitores de planilha e
  PDF, códigos auxiliares, template).
- Dados: `web/src/lib/insumos.js`, `web/api/_lib/rotas/insumos.js`, `web/api/_lib/mondayApp.js`
  (`/api/sienge/texto`).
- Testes: `web/src/__testes__/sienge.test.mjs`, `template-sienge.test.mjs`, `sienge-colunas.test.mjs`,
  `compras-template-sienge.test.mjs`, `insumos-ativos.test.mjs`, `resumo-cadastro-sienge.test.mjs`.
