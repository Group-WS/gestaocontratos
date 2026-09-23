# Vendido (Planilha e Contrato)

**Módulo:** Obras › Planejamento · **Arquétipos de tela:** listagem (itens por verba, colapsáveis) · **Onde fica:** obra › Planejamento › **Vendido Planilha** (`/obra/:codigo/vendido`). O Vendido Contrato não tem mais aba (ver abaixo).

> Linhas de código conferidas no commit `468c554` (branch `docs/documentacao-sistema`).

## Objetivo

Trazer para dentro da obra o que foi **vendido** ao cliente, lido do arquivo que a equipe comercial
produz. A Vendido Planilha é a base de três coisas que vêm depois:

- o **CMV** (teto de custo da obra), somado da coluna de custo desta planilha (ver `cmv.md`);
- o ponto de partida do **Executivo** ("Puxar do criativo") e a coluna "Vendido (criativo)" dele
  (ver `executivo.md`);
- a comparação **vendido × executivo** da Conf. Executivo — o que entrou, saiu ou mudou (ver
  `conf-executivo.md`).

## Quem usa

| Perfil | O que pode | Onde é conferido |
|---|---|---|
| master, admin, geral, gc (quem edita obra) | importar, substituir e remover a Vendido Planilha, com a edição da obra habilitada | tela (`podeEditar` = `edicao.minha`, `web/src/App.jsx:22255`); servidor: leitor de PDF exige perfil de edição (`exigirPerfilDeEdicao`, `web/api/_lib/auth.js`); gravação da obra exige edição da obra (`exigirEdicaoDeObra`) e trava + versão no banco (`supabase/salvar-obra.sql`); registro da importação exige perfil de edição no RLS (`supabase/obra-importacao.sql`) |
| mehoo, taylor e demais que enxergam a obra | só consultar a lista | tela em modo leitura; RLS de leitura (`minhas_obras()`) |

GC e Taylor Made só enxergam as obras em que respondem por um papel (GC, Taylor Made, Executivo) e as
sem GC (`podeAcessarObra`, `web/api/_lib/auth.js`).

## Fluxo

1. A pessoa abre a obra, vai em **Planejamento › Vendido Planilha** e clica em **Habilitar edição**
   (a trava da obra passa a ser dela — ver `gravacao-da-obra.md`).
2. Clica em **Importar Planilha (Excel ou PDF)** e escolhe o arquivo (`.xlsx .xlsm .xlsb .xls .csv .pdf`).
3. Por baixo, o arquivo é lido (`VendidoPlanilhaView.aoImportar`, `web/src/App.jsx:5760`):
   - **Excel/CSV**: lido no navegador por `lerPlanilhaExcel` (`web/src/App.jsx:4896`), que acha as
     colunas pelo **cabeçalho** (não pela posição) e evita a aba cujo nome contém "execut" — o mesmo
     `.xlsm` costuma trazer as duas planilhas.
   - **PDF**: o arquivo vai para `POST /api/executivo/parse` (o mesmo leitor denso do Executivo;
     `lerPlanilhaPDF`, `web/src/App.jsx:4612`). Do PDF saem só descrição, quantidade, unidade e
     valores — fornecedor, ambiente, especificação e a separação material/mão de obra não
     sobrevivem, e a tela avisa (`AvisoPDFPobre`).
   - Cada verba do documento é traduzida para a EAP da empresa **pelo nome do grupo**
     (`mapearVerbasPeloNome`), não pelo número.
   - Nada lido → erro "Não encontrei colunas de Descrição + Marca/Custo…" e nada muda.
4. Antes de aplicar, `confirmarImportacao` (`web/src/App.jsx:5157`) calcula o que o arquivo troca e o
   que fica (`resumoDaImportacao`, `web/src/lib/importacaoResumo.js`). Na primeira importação não
   pergunta nada; da segunda em diante mostra as verbas trocadas e as mantidas e pede
   **Importar**. Cancelar não é erro.
5. Aplicar (`importVendidoPlanilha`, `web/src/App.jsx:22889` → `aplicarItensNasVerbas`,
   `web/src/App.jsx:5373`): cada verba que veio no arquivo tem a lista `itensPlanilha`
   **substituída**; verba que não veio fica com a importação anterior (decisão de 23/09/2026:
   "manter e avisar"). Itens de grupo que não existe na EAP vão para grupos "fora do padrão" no
   **fim** da lista, em vez de serem descartados.
6. A mudança entra na fila de gravação da obra e é gravada inteira (`POST /api/obras/:codigo/gravar`).
7. Em paralelo, a importação é **registrada** (`registrarImportacaoDaObra`, `web/src/App.jsx:22055` →
   `POST /api/obras/:codigo/importacoes`): arquivo, tamanho, nº de itens, verbas trocadas e
   mantidas, autor (o e-mail do login, carimbado no servidor) e data. Se o registro falhar, a
   importação continua valendo e aparece o aviso "A importação foi aplicada, mas o registro dela não
   foi gravado."
8. Um toast confirma: "“arquivo” importado — N itens (com custo)".
9. Para desfazer um arquivo errado: **Remover** (com confirmação) zera `itensPlanilha` em todas as
   verbas (`limparImportacao(["itensPlanilha"])`, `web/src/App.jsx:22874`). Não mexe nas outras etapas
   nem no CMV já liberado.
10. **Concluir etapa** (linha de estado abaixo do título) grava quem e quando em
    `etapasConcluidas.vendido_planilha`. Não tem trava.

### Vendido Contrato (sem aba)

A aba "Vendido Contrato" saiu da esteira: `vendido_contrato` não está em `ETAPAS_PLANEJAMENTO`
(`web/src/App.jsx:11123`), não tem endereço (`SLUG_ETAPA`, `web/src/App.jsx:10338`) e nenhum botão
leva a ela. O componente (`VendidoContratoView`, `web/src/App.jsx:5503`) e a rota de render
(`web/src/App.jsx:25791`) continuam no código, mas **não são alcançáveis pela tela**. O que ele fazia:
lia o PDF da proposta por `POST /api/vendido/parse` (valor por verba + itens sem valor), gravava
`categorias[].vendido` e `itensContrato`, e recalculava `valorVendido`. Obras que importaram o
contrato antes continuam com esses dados. O CMV não usa mais o contrato (ver `cmv.md`).

## Telas

| Tela / bloco | Arquétipo | Rota ou aba | Componente em App.jsx |
|---|---|---|---|
| Itens da planilha de venda (por verba, busca, filtro vendido / não vendido, total) | listagem | `/obra/:codigo/vendido` | `VendidoPlanilhaView` (`web/src/App.jsx:5730`) |
| Botões Importar / Remover / Reabrir etapas + dica | ações da listagem | mesma | `ImportButton` (`web/src/App.jsx:5187`) |
| Confirmação da importação | diálogo | mesma | `confirmarImportacao` (`web/src/App.jsx:5157`) |
| Estado da etapa (Concluir / Reabrir) | detalhe (linha de estado) | mesma | `EtapaDaAba` (`web/src/App.jsx:21229`) |
| Vendido Contrato | listagem | sem rota | `VendidoContratoView` (`web/src/App.jsx:5503`) — inalcançável |

## Estados e mensagens

| Estado | O que a tela mostra |
|---|---|
| Sem planilha | verbas da EAP vazias, contagem "não vendido"; total R$ 0,00 |
| Lendo | botão "Lendo…" desabilitado |
| Modo leitura | botões desabilitados + "Modo leitura — habilite a edição desta obra para importar ou remover." |
| Plano de Compras liberado (`comprasLiberadas`) | etapa congelada: "Plano de Compras já liberado — esta etapa está congelada…" + botão **Reabrir etapas** |
| Arquivo sem itens | toast de erro "Não consegui ler o arquivo." com o motivo |
| Confirmação (2ª importação em diante) | "Importar “arquivo”?" com verbas trocadas e mantidas |
| Remover | "Remover os itens do Vendido Planilha? … Não dá pra desfazer — depois é só subir o arquivo de novo." |
| Registro falhou | toast "A importação foi aplicada, mas o registro dela não foi gravado." |
| Grupo não vendido / item sem venda | selos "não vendido" e "N sem venda"; linha de título com "N/A — título, não entra na conferência" |

## Dados

| Onde | Campo | Significado |
|---|---|---|
| `obra_dados.categorias[]` | `itensPlanilha[]` | itens da Vendido Planilha: `codigo`, `desc`, `especificacao`, `marca` (fornecedor), `ambiente`, `qtdVendida`, `un`, `custoMaterial`, `custoMO`, `totalMaterial`, `totalMO`, `custo`, `custoUnitario`, `ehTitulo` |
| `obra_dados.categorias[]` | `foraDaEapPadrao`, `foraDeEscopoCategoria` | grupo que não casa com a EAP, acrescentado no fim |
| `obra_dados.categorias[]` | `itensContrato[]`, `vendido` | legado do Vendido Contrato (itens sem valor e valor por verba) |
| `obra_dados` | `valorVendido` (derivado de `vendido` por verba) | soma do contrato; sem contrato fica o valor do Monday |
| `obra_dados.etapas_concluidas` | `vendido_planilha: { por, em }` | conclusão manual da etapa |
| `obra_importacao` | `documento` (`vendido_planilha`, `vendido_contrato`, `planilha_executivo`), `arquivo_nome`, `arquivo_tamanho`, `n_itens`, `verbas_trocadas`, `verbas_mantidas`, `autor`, `criado_em` | rastro de cada importação; só cresce (sem update/delete) |

## APIs

| Método | Rota | Autorização no servidor | Arquivo:linha | O que faz |
|---|---|---|---|---|
| POST | `/api/executivo/parse` | login, membro, perfil de edição; PDF conferido (tipo, ≤ 4 MB, assinatura `%PDF-`, até 300 páginas) | `web/api/_lib/mondayApp.js:676` | lê o PDF (usado pela Vendido Planilha em PDF e pelo Executivo) |
| POST | `/api/vendido/parse` | idem | `web/api/_lib/mondayApp.js:515` | lê o PDF do Vendido Contrato (sem uso pela tela hoje) |
| GET | `/api/obras/:codigo/importacoes` | login, membro, enxergar a obra | `web/api/_lib/rotas/importacoes.js:59` | lista as 50 últimas importações da obra |
| POST | `/api/obras/:codigo/importacoes` | login, membro, editar a obra; autor = e-mail do login | `web/api/_lib/rotas/importacoes.js:77` | registra a importação |
| POST | `/api/obras/:codigo/gravar` | login, membro, editar a obra; banco confere trava e versão | `web/api/_lib/rotas/obraDados.js:105` | grava a obra inteira (é por onde a importação chega ao banco) |

## Integrações

Nenhuma externa. O Excel é lido no navegador (biblioteca `xlsx`); o PDF, no servidor (`pdf-parse`).

## Regras de negócio usadas

- [RN-029](../regras-de-negocio/RN-029-importacao-troca-so-as-verbas-do-arquivo.md) — importar um documento troca só as verbas que
  vieram no arquivo, avisa antes o que troca e o que fica, e registra arquivo, autor e data.
- [RN-030](../regras-de-negocio/RN-030-grupo-fora-da-eap-vai-para-o-fim.md) — o que não pertence a nenhum grupo da EAP é acrescentado
  no fim, nunca descartado.
- [RN-031](../regras-de-negocio/RN-031-linha-de-titulo-nao-e-item.md) — linha com quantidade e valor zerados é título ou
  item não vendido: aparece, mas não se confere nem se compra.
- [RN-034](../regras-de-negocio/RN-034-cmv-congelado.md) — reimportar a Vendido Planilha depois de liberar o CMV não
  muda o teto (detalhe em `cmv.md`).

## Riscos conhecidos

| Gravidade | Risco | Cenário | Onde no código |
|---|---|---|---|
| média | Remover (ou trocar) a Vendido Planilha depois do Executivo pronto faz todo item do Executivo virar "entrou sem ter sido vendido" | Sem `itensPlanilha`, o cruzamento marca cada linha do executivo como só-no-executivo; cada uma passa a pedir o "conferi" antes de liberar e trava a conclusão da Conf. Executivo. O botão Remover só pede confirmação | `linhaConfExecutivo` (`web/src/App.jsx:7582`), `pendenciaParaLiberar` (`web/src/App.jsx:11393`), `limparImportacao` (`web/src/App.jsx:22874`) |
| média | Dois números de CMV depois de reimportar | A aba CMV sempre recalcula da planilha atual (`ResumoCMV`); o Executivo usa o valor congelado. Reimportar faz as duas telas mostrarem números diferentes | `DeparaContratoPlanilhaView` (`web/src/App.jsx:7283`), `cmvDaObra` (`web/src/App.jsx:7226`) |
| baixa | Verba ausente do arquivo novo fica com dado antigo | Decisão consciente (23/09/2026); o aviso só aparece da 2ª importação em diante e depende de a pessoa ler | `aplicarItensNasVerbas` (`web/src/App.jsx:5373`) |
| baixa | Registro e gravação são independentes | O registro sai logo após aplicar na tela; se a gravação da obra for recusada depois (conflito de versão, trava), o registro fica dizendo que houve uma importação que não chegou ao banco. O contrário (gravou sem registro) só gera aviso | `registrarImportacaoDaObra` (`web/src/App.jsx:22055`) |
| baixa | Código morto do Vendido Contrato | Componente, handlers e leitor continuam no código sem caminho na tela; dados antigos (`itensContrato`, `vendido`) seguem nas obras e alimentam `valorVendido` | `web/src/App.jsx:5503`, `:22797`, `:25791` |

## Fora do escopo

- O cálculo e a liberação do CMV: `cmv.md`.
- Gravação, trava e versão da obra: `gravacao-da-obra.md` e ADR-004.
- A comparação vendido × executivo: `conf-executivo.md`.

## Código

- `web/src/App.jsx` — `VendidoPlanilhaView`, `VendidoContratoView`, `ImportButton`,
  `confirmarImportacao`, `aplicarItensNasVerbas`, `lerPlanilhaExcel`, `lerPlanilhaPDF`,
  `lerContratoPDF`, `importVendidoPlanilha`, `importVendidoContrato`, `limparImportacao`,
  `registrarImportacaoDaObra`
- `web/src/lib/importacoes.js`, `web/src/lib/importacaoResumo.js` — resumo e registro da importação
- `web/api/_lib/mondayApp.js` — `POST /api/vendido/parse`, `POST /api/executivo/parse`
- `web/api/_lib/rotas/importacoes.js` — registro das importações
- `supabase/obra-importacao.sql` — tabela `obra_importacao` e RLS
- Testes: `web/src/__testes__/importacao-resumo.test.mjs`, `remover-importacao.test.mjs`,
  `web/api/_lib/__testes__/parse-vendido.test.cjs`, `importacoes-rota.test.cjs`,
  `supabase/tests/14-importacao.sql`
