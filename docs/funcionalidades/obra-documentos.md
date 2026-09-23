# Documentos da obra

**Módulo:** Obras → grupo **Documentos** · **Arquétipos de tela:** listagem (arquivos por fase) · **Onde fica:** dentro da obra, aba de grupo **Documentos** (rota `/obra/:codigo`; o grupo não tem endereço próprio)

## Objetivo

Ser o armário da obra: tudo o que foi anexado nela, num lugar só, separado pela fase de onde veio,
com **Ver** e **Baixar**. Antes dava para anexar e não dava para rever: o caderno subia numa aba e
sumia de vista.

Os documentos entram por três portas, e as três gravam no mesmo lugar:

- **Jornada da obra** (Visão geral → "Ver arquivos das fases"): Contrato, Projeto Criativo e os três
  cadernos do Executivo, cada um num lugar fixo, e anexos em "Outros";
- **Documentos**: anexo avulso, com nome e fase escolhidos;
- telas da esteira: a aprovação assinada pelo cliente (Conf. Executivo) e o PDF da Apresentação de
  especificações.

## Quem usa

| Perfil | O que pode | Onde é conferido |
|---|---|---|
| Admin master, Administrador | Ver, baixar, anexar e trocar tudo, **inclusive o Contrato** | tela (`souAdmin`, `arquivosDaObra`, `web/src/App.jsx:19622`) e banco (policies do balde `obra-arquivos` com `admin_do_time()` na pasta `contrato`, `supabase/rls-reforco.sql:238`–`282`) |
| Geral, GC | Ver, baixar, anexar e excluir avulsos; anexar e trocar os cadernos — menos o Contrato, que aparece como "acesso restrito ao administrador" | tela (anexar e excluir só com a edição habilitada — `podeEditar = edicao.minha`) e banco (GC só nas pastas das obras dele) |
| Taylor Made | Ver e baixar (menos o Contrato) | tela (nunca habilita a edição) e banco (leitura das obras dele) |
| Mehoo | Não abre a obra; baixa os cadernos do Executivo pelo painel dela | tela; banco (leitura de todas as pastas, menos `contrato`) |

## Fluxo

### Consultar

1. Na obra, a pessoa clica no grupo **Documentos**. A tela junta tudo o que a obra guarda
   (`arquivosDaObra`, `web/src/App.jsx:19622`): o Contrato (só para administrador), os quatro
   cadernos, a Apresentação de especificações (se existir), a aprovação assinada do cliente e os
   anexos avulsos.
2. Os arquivos aparecem em cartões por fase (`FASES_ARQUIVO`, `web/src/App.jsx:19584`): Contrato,
   Criativo, Executivo, Aprovação do Cliente e Outros. Cada linha mostra o nome (ou a descrição), o
   nome do arquivo, o tamanho, quem anexou e a data.
3. **Ver** abre o arquivo numa aba; **Baixar** salva. Os dois pedem ao servidor um endereço
   temporário, válido por uma hora (`POST /api/arquivos/link`,
   `web/api/_lib/rotas/arquivos.js:89`). O balde é privado: não existe endereço público.
4. Anexo antigo, de quando o app só guardava o nome, aparece como "arquivo não guardado — anexe de
   novo", sem botões.

### Anexar um avulso (Documentos ou "Outros" da Jornada)

1. Com a edição habilitada, a pessoa escreve um nome (opcional), escolhe a fase (Criativo,
   Executivo, Aprovação do Cliente ou Outros — Contrato não se escolhe aqui) e clica **Anexar
   arquivo**.
2. A tela confere o tipo (`.pdf .doc .docx .ppt .pptx .xls .xlsx .xlsm .csv .txt .png .jpg .jpeg
   .webp .zip`) e o tamanho (até 50 MB) antes de enviar (`anexarAvulso`, `web/src/App.jsx:19573`).
3. O servidor assina a subida (`POST /api/arquivos/envio`, `web/api/_lib/rotas/arquivos.js:77`) e
   **monta ele mesmo o caminho**: `<código da obra>/<chave>/<carimbo de tempo>-<nome>`. O navegador
   sobe o arquivo direto para o Storage pelo endereço assinado.
4. A lista de avulsos da obra (`obra_dados.arquivos`) ganha o item, e a mudança vai pela fila de
   gravação da obra (`trocarArquivosDaObra`, `web/src/App.jsx:23252`).
5. Um evento "anexou" é registrado no histórico de arquivos (`POST
   /api/obras/:codigo/arquivos-eventos`), com o autor tirado do login.

### Excluir um avulso

1. Com a edição habilitada, a lixeira da linha pede confirmação: "Excluir "<nome>"? Isso não pode
   ser desfeito."
2. O arquivo é **apagado do Storage na hora** (`excluirAvulso`, `web/src/App.jsx:19617`), a lista
   perde o item e a mudança vai pela fila de gravação. Um evento "removeu" é registrado.
3. Só avulsos se excluem. Cadernos, Contrato e a assinatura do cliente não têm lixeira aqui: têm
   dono na esteira.

### Anexar ou trocar um caderno (Jornada da obra)

1. Na Visão geral, **Ver arquivos das fases** abre a Jornada (`AnexosDaJornada`,
   `web/src/App.jsx:1026`) com um lugar fixo para cada caderno (`CadernoSlot`,
   `web/src/App.jsx:9254`): Contrato (só administrador), Projeto Criativo, Caderno de
   Especificação, Caderno de Marcenaria e Caderno Completo do Projeto Executivo
   (`CADERNOS_EXECUTIVO`, `web/src/App.jsx:9227`).
2. **Anexar** (lugar vazio) ou **Trocar** (lugar ocupado) sobe o arquivo do mesmo jeito que o
   avulso, na pasta da chave do caderno.
3. Com as **compras liberadas**, os cadernos do projeto (Criativo e os três do Executivo) **não se
   trocam** — são a prova do que foi mandado ao fornecedor —, e a linha mostra o selo "compras
   liberadas". Lugar vazio **continua aceitando** anexo (decisão de 17/09/2026). O Contrato não
   congela.
4. Ao trocar, o caderno novo entra na obra (`importCaderno`, `web/src/App.jsx:23269`), um evento
   "trocou" é registrado e o arquivo **antigo é apagado** do Storage na mesma hora.

## Telas

| Tela / bloco | Arquétipo | Rota ou aba | Componente |
|---|---|---|---|
| Documentos (lista por fase + anexar) | listagem | grupo Documentos da obra | `ArquivosObraView` (`web/src/App.jsx:19721`), `ArquivoLinha` (`web/src/App.jsx:19657`) |
| Jornada da obra → arquivos das fases | detalhe (lista fixa) | Visão geral da obra | `AnexosDaJornada` (`web/src/App.jsx:1026`), `CadernoSlot` (`web/src/App.jsx:9254`), `AnexarAvulso` (`web/src/App.jsx:1125`) |
| Histórico de arquivos | detalhe (lista) | pé da página da obra | `HistoricoDaObra` (`web/src/App.jsx:3391`) |

## Estados e mensagens

| Estado | O que a tela diz |
|---|---|
| Sem arquivo nenhum | "Nenhum arquivo ainda — O que for anexado na Jornada da obra (Visão geral) e a aprovação assinada do cliente aparecem aqui sozinhos. Qualquer outro arquivo da obra pode ser anexado por este botão." |
| Contagem | "N arquivos nesta obra · M sem o arquivo guardado" |
| Enviando | "Enviando…" no botão |
| Tipo recusado | "Tipo não aceito. Vale: .pdf .doc …" |
| Grande demais | ""<arquivo>" tem N MB — o limite é 50 MB por arquivo." |
| Sem banco | "Sem banco configurado — o arquivo não teria onde ficar guardado." |
| Abrindo / baixando | "Abrindo…" / "Baixando…" |
| Arquivo antigo sem cópia | "arquivo não guardado — anexe de novo" |
| Contrato sem permissão | "anexado — acesso restrito ao administrador" / "acesso restrito ao administrador" |
| Caderno congelado | selo "compras liberadas" (dica: "As compras já foram liberadas: este arquivo é a prova do que foi mandado para o fornecedor e não pode ser trocado.") |
| Registro do histórico falhou | "O arquivo foi salvo, mas o registro dele no histórico não foi gravado." |
| Tabela de eventos ausente | 503 "O registro de arquivos ainda não foi criado no banco — falta rodar supabase/obra-arquivo-evento.sql." |

## Dados

| Onde | Campo | Significado |
|---|---|---|
| `obra_dados.cadernos` | mapa por chave (`contrato`, `criativo`, `especificacao`, `marcenaria`, `projeto`, `apresentacao`) | cada caderno: `{ nome, caminho, tamanhoKB, em, por }` |
| `obra_dados.arquivos` | lista | avulsos: `{ id, titulo, fase, nome, caminho, tamanhoKB, em, por }` |
| `obra_dados.cliente_assinatura_arq` | objeto | o documento assinado pelo cliente (fase "Aprovação do Cliente") |
| Storage `obra-arquivos` | `<obra>/<chave>/<carimbo>-<nome>` | o arquivo em si; privado |
| `obra_arquivo_evento` | `acao` (anexou, trocou, removeu), `tipo`, `titulo`, `arquivo_nome`, `arquivo_anterior`, `caminho`, `autor`, `criado_em` | histórico dos arquivos; só cresce (sem update nem delete — `supabase/obra-arquivo-evento.sql:76`) |

O `por` gravado junto de cada arquivo é o e-mail da tela; o `autor` do evento é o do login
(servidor).

## APIs

| Método | Rota | Autorização exigida no servidor | Arquivo:linha | O que faz |
|---|---|---|---|---|
| POST | `/api/arquivos/envio` | login + membro; o Storage confere a pasta (GC só nas obras dele; `contrato` só administrador; Mehoo e Taylor não gravam) | `web/api/_lib/rotas/arquivos.js:77` | assina a subida e devolve o caminho montado pelo servidor |
| POST | `/api/arquivos/link` | login + membro; o Storage confere a leitura | `web/api/_lib/rotas/arquivos.js:89` | endereço temporário (1 hora) para ver ou baixar |
| POST | `/api/arquivos/remover` | login + membro; o Storage confere a exclusão | `web/api/_lib/rotas/arquivos.js:106` | apaga um arquivo do balde |
| GET | `/api/obras/:codigo/arquivos-eventos` | login + membro + ver a obra | `web/api/_lib/rotas/arquivoEventos.js:47` | últimos 200 eventos da obra |
| POST | `/api/obras/:codigo/arquivos-eventos` | login + membro + editar a obra; RLS de registro | `web/api/_lib/rotas/arquivoEventos.js:65` | registra um evento; autor = login |
| POST | `/api/obras/:codigo/gravar` / `/patch` | login + membro + editar a obra; banco confere trava e versão | `web/api/_lib/rotas/obraDados.js:105` | grava `cadernos` e `arquivos` junto com a obra |

## Integrações

- **Supabase Storage**, balde privado `obra-arquivos`. O arquivo não passa pela função da Vercel
  (que corta em 4,5 MB): a rota assina e o navegador sobe direto (`web/src/lib/storage.js`).

## Regras de negócio usadas

- [RN-014](../regras-de-negocio/RN-014-contrato-da-obra-so-administrador.md) — o contrato da obra só é visto, anexado e trocado pelo administrador.
- [RN-048](../regras-de-negocio/RN-048-plano-liberado-congela-etapas.md) — com o plano de compras liberado, os cadernos do projeto não se trocam. Detalhe desta tela: o lugar **vazio** continua aceitando anexo (decisão de 17/09/2026, `web/src/App.jsx:9327`–`9338`).
- [RN-021](../regras-de-negocio/RN-021-uma-pessoa-edita-a-obra-por-vez.md) — anexar e excluir exigem a edição habilitada, porque a lista de arquivos grava com a obra.

## Riscos conhecidos

| Gravidade | Risco | Cenário | Onde no código |
|---|---|---|---|
| alta | Arquivo apagado antes de a obra gravar | excluir um avulso e trocar um caderno apagam o arquivo do Storage **na hora**, mas a lista da obra só grava depois, pela fila. Se a gravação cair em conflito e a pessoa recarregar a obra, a obra volta a apontar para um arquivo que já não existe | `web/src/App.jsx:19617`–`19620`, `web/src/App.jsx:23281` |
| média | Evento no histórico sem a mudança gravada | o evento "anexou/trocou/removeu" é registrado no clique; se a gravação da obra não passar, o histórico diz que aconteceu o que a obra não tem | `web/src/App.jsx:23252`–`23267`, `web/src/App.jsx:23269` |
| média | Congelamento dos cadernos só na tela | o servidor e o Storage não sabem das compras liberadas: uma chamada direta troca o caderno congelado | `web/src/App.jsx:9338`; `web/api/_lib/rotas/arquivos.js:77` |
| média | Excluir do Storage não confere a obra nem a trava | `POST /api/arquivos/remover` só exige ser membro; o Storage deixa master, admin e geral apagarem qualquer arquivo do balde (e o GC, os das obras dele), com ou sem a edição da obra | `web/api/_lib/rotas/arquivos.js:106`; `supabase/rls-reforco.sql:274` |
| baixa | Arquivo órfão | subir e desistir (gravação recusada, aba fechada) deixa o arquivo no balde sem ninguém apontando para ele; não há faxina | `web/src/App.jsx:19604` |
| baixa | Comentário desatualizado | `AnexosDaJornada` diz que a Jornada é "o único lugar onde se anexam", mas Documentos também anexa avulsos | `web/src/App.jsx:1024` |

## Fora do escopo

- Ler o conteúdo dos cadernos: são só arquivos; nada é extraído deles.
- Versões de um mesmo caderno: trocar apaga o anterior (o evento guarda o nome do anterior).
- Pastas por ambiente e as imagens da Apresentação: ver
  [aditivo-e-apresentacao.md](aditivo-e-apresentacao.md).

## Código

- `web/src/App.jsx` — `ArquivosObraView` (`19721`), `ArquivoLinha` (`19657`), `arquivosDaObra` (`19622`), `anexarAvulso`/`excluirAvulso` (`19604`/`19617`), `AnexosDaJornada` (`1026`), `CadernoSlot` (`9254`), `trocarArquivosDaObra` (`23252`), `importCaderno` (`23269`), `registrarArquivoDaObra` (`22124`)
- `web/src/lib/arquivos.js`, `web/src/lib/storage.js`, `web/src/lib/arquivoEventos.js`
- `web/api/_lib/rotas/arquivos.js`, `web/api/_lib/rotas/arquivoEventos.js`, `web/api/_lib/storage.js`
- `supabase/arquivos-obra.sql`, `supabase/contrato-restrito.sql`, `supabase/obra-arquivo-evento.sql`, `supabase/rls-reforco.sql`
- Testes: `web/src/__testes__/arquivos-obra.test.mjs`, `arquivos.test.mjs`, `documentos-protegidos.test.mjs`, `web/api/_lib/__testes__/arquivo-eventos-rota.test.cjs`, `documentos-da-obra.test.cjs`, `supabase/tests/15-arquivo-evento.sql`
