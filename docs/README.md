# Documentação do Gestão de Obras TKWS

Índice geral da documentação. Atualizado em 23/09/2026.

## Como está organizada

| Pasta ou arquivo | O que tem | Muda quando |
|---|---|---|
| `ADR-NNN-*.md` (raiz de `docs/`) | Decisões de arquitetura e de produto: o pedido, as alternativas, o que foi decidido e as consequências. | Nunca se reescreve; uma decisão nova vira outro ADR. |
| [`fluxos/`](fluxos/ciclo-da-obra.md) | Fluxos que atravessam várias telas (o ciclo da obra, do início à compra). | O caminho entre as telas muda. |
| [`funcionalidades/`](funcionalidades/README.md) | Uma ficha por tela ou funcionalidade: quem usa, passo a passo, estados, API, regras citadas e riscos conhecidos. | A tela muda. A ficha cita as regras, nunca as redefine. |
| [`regras-de-negocio/`](regras-de-negocio/README.md) | Catálogo `RN-NNN`: o que o negócio permite, calcula ou exige, com exemplos e onde está no código. | Só com pedido explícito do dev nomeando a regra; toda mudança ganha linha no Histórico. |
| [`referencia/`](referencia/api.md) | Referência técnica: API, banco e integrações. | A API, o banco ou uma integração muda. |
| Guias (raiz de `docs/`) | Passo a passo de ambiente, login, padrão de UI, acessos e adequação ao padrão de qualidade. | O procedimento muda. |

## Mapa do sistema

### Módulos do menu

| Módulo | Ficha |
|---|---|
| Início (painel de todas as obras, pendências e mapa) | [inicio.md](funcionalidades/inicio.md) |
| Obras → Vindas do Monday · Nova obra | [cadastro-de-obra.md](funcionalidades/cadastro-de-obra.md) |
| Obras → Finalizadas (concluir e reabrir obra) | [obras-finalizadas.md](funcionalidades/obras-finalizadas.md) |
| Gestão de compras e contratações (Painel, Compradores, Mão de obra própria) | [gestao-compras-contratacoes.md](funcionalidades/gestao-compras-contratacoes.md) |
| Aditivos (e a Apresentação de especificações) | [aditivo-e-apresentacao.md](funcionalidades/aditivo-e-apresentacao.md) |
| Mehoo · Painel por canal | [painel-por-canal.md](funcionalidades/painel-por-canal.md) |
| Catálogo TKWS | [catalogo.md](funcionalidades/catalogo.md) |
| Gerador de códigos Sienge | [gerador-codigos-sienge.md](funcionalidades/gerador-codigos-sienge.md) |
| Banco de Preços | [banco-de-precos.md](funcionalidades/banco-de-precos.md) |
| EAP Sienge | [eap-sienge.md](funcionalidades/eap-sienge.md) |
| Equipe e acessos (e o login, a sala de espera) | [login-e-acessos.md](funcionalidades/login-e-acessos.md) |

### Dentro da obra: grupos e abas

A navegação entre grupos, a esteira de etapas e o modo de edição estão em
[obra-navegacao.md](funcionalidades/obra-navegacao.md); a gravação, a trava e o histórico de
versões, em [gravacao-da-obra.md](funcionalidades/gravacao-da-obra.md).

| Grupo | Aba | Ficha |
|---|---|---|
| Visão geral | painel da obra, Concluir obra | [dashboard.md](funcionalidades/dashboard.md) |
| Planejamento | Vendido Planilha (e o Vendido Contrato) | [vendido.md](funcionalidades/vendido.md) |
| Planejamento | CMV | [cmv.md](funcionalidades/cmv.md) |
| Planejamento | Executivo | [executivo.md](funcionalidades/executivo.md) |
| Planejamento | Conf. Executivo | [conf-executivo.md](funcionalidades/conf-executivo.md) |
| Planejamento | Plano de Compras | [plano-de-compras.md](funcionalidades/plano-de-compras.md) |
| Planejamento | Compras de Produtos (e o envio ao Sienge) | [compras-de-produtos.md](funcionalidades/compras-de-produtos.md) |
| Execução | Contratos · Diário de Obra | [contratos.md](funcionalidades/contratos.md) |
| Documentos | cadernos, contrato, arquivos avulsos | [obra-documentos.md](funcionalidades/obra-documentos.md) |

### O ciclo inteiro

[Ciclo da obra, do início ao fim](fluxos/ciclo-da-obra.md): entrada da obra, montagem e edição,
aprovações e compra, com os riscos do fluxo.

## Decisões (ADRs)

- [ADR-001](ADR-001-perfis-de-acesso.md) — perfis fechados, sala de espera e trava no banco (31/08/2026).
- [ADR-002](ADR-002-eap-sienge.md) — a EAP do Sienge como cadastro versionado (15/09/2026).
- [ADR-003](ADR-003-solicitacao-compra-sienge.md) — solicitação de compra, o primeiro consumo da API do Sienge (15/09/2026).
- [ADR-004](ADR-004-editar-por-tela.md) — editar por tela: o que precisa mudar antes (17/09/2026).
- [ADR-005](ADR-005-conferencia-unificada.md) — a Conf. Executivo vira a tela única de decisão (18/09/2026).
- [ADR-006](ADR-006-executivo-trava-item-aprovado.md) — item aprovado para compra fica travado no Executivo, regra RN-002 (23/09/2026).
- [ADR-007](ADR-007-id-da-linha-do-executivo.md) — a linha do Executivo tem identificador próprio e imutável (23/09/2026).

## Referência técnica

- [API](referencia/api.md) — rotas, quem pode chamar cada uma e o que conferem.
- [Banco](referencia/banco.md) — tabelas, funções, policies de RLS e scripts SQL.
- [Integrações](referencia/integracoes.md) — Monday, Sienge, login com a conta Microsoft (Azure) e Storage de arquivos.

## Guias

- [Configurar o ambiente](CONFIGURAR-AMBIENTE.md) — rodar o sistema na sua máquina, passo a passo.
- [Login com a conta Microsoft (Azure)](azure-login.md) — onde vivem o ID e o segredo do Azure e como trocar.
- [Padrão de UI](padrao-ui.md) — mapa do que o app tinha para o que o design system `@group-ws/ws-ui` oferece.
- [SPEC de acessos](SPEC-acessos.md) — perfis de acesso e entrada de novos usuários.
- [Adequação ao padrão de qualidade](adequacao-qualidade.md) — como o repositório chegou ao padrão Group WS 1.0.0.

## Riscos conhecidos

Cada ficha de funcionalidade e cada referência tem a sua seção **Riscos conhecidos**, com gravidade,
cenário e onde está no código; o fluxo tem os [riscos do ciclo](fluxos/ciclo-da-obra.md). Os de
gravidade **alta**, em 23/09/2026:

- Aditivo muda de status sem regra de transição e sem papel de aprovador — [aditivo-e-apresentacao](funcionalidades/aditivo-e-apresentacao.md).
- Aditivo aprovado continua editável, e o dinheiro das telas muda sem novo aceite — [aditivo-e-apresentacao](funcionalidades/aditivo-e-apresentacao.md).
- Aditivo sem registro de quem aprovou e quando — [aditivo-e-apresentacao](funcionalidades/aditivo-e-apresentacao.md).
- O criador exclui aditivo aprovado, e o valor sai do orçamento sem aviso — [aditivo-e-apresentacao](funcionalidades/aditivo-e-apresentacao.md).
- GC cria obra em nome de outro GC e a perde de vista — [cadastro-de-obra](funcionalidades/cadastro-de-obra.md).
- O servidor do envio ao Sienge não confere a liberação nem o registro prévio — [compras-de-produtos](funcionalidades/compras-de-produtos.md).
- Chamadas repetidas duplicam a solicitação no Sienge — [compras-de-produtos](funcionalidades/compras-de-produtos.md).
- Item entra em Compras sem o carimbo do administrador (canal, solicitado, comprado ou avulso) — [conf-executivo](funcionalidades/conf-executivo.md).
- Mover a liberação de um item para outro passa pelo banco — [conf-executivo](funcionalidades/conf-executivo.md).
- Conflito falso depois de uma resposta perdida na gravação — [gravacao-da-obra](funcionalidades/gravacao-da-obra.md).
- Produto repetido na mesma verba recebe o mesmo patch no Executivo — [executivo](funcionalidades/executivo.md).
- Substituir e inserir no Executivo usam a posição da planilha na lista de trabalho — [executivo](funcionalidades/executivo.md).
- Item removido continua em Compras se já estava liberado — [executivo](funcionalidades/executivo.md).
- Arquivo apagado do Storage antes de a obra gravar — [obra-documentos](funcionalidades/obra-documentos.md).
- O perfil Canal de compra só existe na tela: servidor e banco não lhe mostram obra nenhuma — [login-e-acessos](funcionalidades/login-e-acessos.md), [painel-por-canal](funcionalidades/painel-por-canal.md).
- Com migração pendente, a tela libera tudo e o servidor recusa — [login-e-acessos](funcionalidades/login-e-acessos.md).
- O Painel por canal não carrega os dados sozinho — [painel-por-canal](funcionalidades/painel-por-canal.md).
- Liberar e reabrir o plano de compras só são controlados na tela — [plano-de-compras](funcionalidades/plano-de-compras.md).
- A justificativa do estouro do CMV não é gravada — [plano-de-compras](funcionalidades/plano-de-compras.md).
