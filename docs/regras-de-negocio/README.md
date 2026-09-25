# Regras de negócio

Catálogo das regras de negócio deste projeto — o que o negócio **permite, calcula ou exige**,
independentemente de tela ou tecnologia. Cada regra tem uma ficha `RN-NNN-titulo-curto.md`, e o
código da regra (na camada de regras) cita o ID.

**Regras são protegidas.** Agentes de IA não as alteram sem pedido explícito do dev; mudar uma
regra exige atualizar a ficha no mesmo commit, com uma linha nova em Histórico.
Padrão completo: `.quality/regras/02-regras-de-negocio.md`.

## Como criar uma regra

1. Confira o último número abaixo.
2. Copie `_template.md` para `RN-NNN-titulo-curto.md` e preencha. Regra nova nasce `proposta`.
3. Implemente a função pura e o teste com os exemplos da ficha.
4. Adicione a linha no índice. A ficha passa a `vigente` quando o dev confirmar o enunciado.

## Índice

As regras RN-003 a RN-085 nasceram como **proposta** em 23/09/2026, a partir da documentação do
sistema (`docs/funcionalidades/`): cada ficha diz onde a regra está hoje no código e o que falta para
ela ir para a camada de regras (`web/src/regras`), com teste. Estão agrupadas por contexto: acessos
(RN-003 a RN-017) · cadastro e ciclo da obra (RN-018 a RN-028) · vendido e CMV (RN-029 a RN-035) ·
Executivo e Conf. Executivo (RN-036 a RN-043) · plano de compras (RN-044 a RN-050) · compras e
Sienge (RN-051 a RN-056) · contratos e painéis (RN-057 a RN-059) · aditivos e apresentação (RN-060
a RN-070) · catálogo, preços e EAP (RN-071 a RN-085).

| ID | Regra | Status | Contexto |
|---|---|---|---|
| [RN-001](RN-001-liberacao-de-compra.md) | Só o administrador libera a compra | proposta | Conferência do Executivo · Plano de compras |
| [RN-002](RN-002-item-aprovado-no-executivo.md) | Item aprovado para compra não se edita nem se remove no Executivo | vigente | Executivo · Conferência do Executivo |
| [RN-003](RN-003-perfil-unico.md) | Cada pessoa tem um perfil de acesso, e só um | proposta | Equipe e acessos |
| [RN-004](RN-004-so-dominio-da-empresa-entra.md) | Só conta do domínio da empresa entra no sistema | proposta | Login |
| [RN-005](RN-005-primeiro-login-fica-pendente.md) | O primeiro login entra na fila, sem perfil | proposta | Login e sala de espera |
| [RN-006](RN-006-sem-perfil-nao-ve-nada.md) | Quem não tem perfil não vê nenhum dado | proposta | Login e sala de espera |
| [RN-007](RN-007-pessoa-inativa-perde-acesso.md) | Quem sai é desativado, não apagado, e perde o acesso | proposta | Equipe e acessos |
| [RN-008](RN-008-so-master-gerencia-equipe.md) | Só o Admin master cuida da Equipe | proposta | Equipe e acessos |
| [RN-009](RN-009-sempre-um-gestor-da-equipe.md) | A Equipe nunca fica sem quem cuide dela | proposta | Equipe e acessos |
| [RN-010](RN-010-quem-ve-qual-obra.md) | Quem vê qual obra | proposta | Acessos · todas as telas de obra |
| [RN-011](RN-011-quem-edita-e-cria-obra.md) | Só Admin master, Administrador, Geral e GC alteram e criam obra | proposta | Acessos · todas as telas de obra · Cadastro de obra |
| [RN-012](RN-012-perfis-de-painel-so-consultam.md) | Mehoo e Canal de compra só veem o próprio painel | proposta | Acessos · Mehoo · Painel por canal |
| [RN-013](RN-013-responsaveis-da-obra.md) | Os responsáveis da obra saem da lista da equipe | proposta | Acessos · Dashboard da obra · Equipe e acessos |
| [RN-014](RN-014-contrato-da-obra-so-administrador.md) | O contrato da obra é só do administrador | proposta | Acessos · Arquivos da obra |
| [RN-015](RN-015-comprador-e-diaria-so-administrador.md) | Comprador do grupo e diária da mão de obra são do administrador | proposta | Acessos · Gestão de compras · Mão de obra própria |
| [RN-016](RN-016-registro-em-nome-de-quem-esta-logado.md) | Todo registro assinado leva quem está logado | proposta | Acessos (transversal) |
| [RN-017](RN-017-observacao-da-obra.md) | Quem vê a obra comenta; só o autor ou o administrador apaga | proposta | Acessos · Compras de Produtos (observações) |
| [RN-018](RN-018-codigo-da-obra.md) | O código da obra tem quatro dígitos e não se repete | proposta | Cadastro de obra |
| [RN-019](RN-019-endereco-da-obra-so-administrador.md) | Só o administrador corrige o endereço da obra | proposta | Cadastro de obra · Cabeçalho da obra |
| [RN-020](RN-020-obra-concluida-so-leitura.md) | Obra concluída fica só para consulta | proposta | Obras finalizadas |
| [RN-021](RN-021-uma-pessoa-edita-a-obra-por-vez.md) | Uma pessoa edita a obra por vez | proposta | Gravação da obra · telas de edição |
| [RN-022](RN-022-restaurar-versao-so-admin-master.md) | Só o Admin master restaura versão da obra | proposta | Histórico da obra |
| [RN-023](RN-023-esteira-segue-a-ordem.md) | A esteira do planejamento segue a ordem | proposta | Navegação da obra (esteira) |
| [RN-024](RN-024-etapa-concluida-registra-quem-e-quando.md) | Concluir etapa registra quem e quando | proposta | Navegação da obra (esteira) |
| [RN-025](RN-025-cadernos-criticos-90-dias.md) | Passo pendente a 90 dias da entrega é crítico | proposta | Início · Visão geral da obra |
| [RN-026](RN-026-avanco-geral-da-obra.md) | Avanço geral da obra é a média de três frentes | proposta | Visão geral da obra |
| [RN-027](RN-027-situacao-da-obra-no-mapa.md) | Situação da obra no mapa | proposta | Início (mapa) |
| [RN-028](RN-028-faixas-de-estouro-da-verba.md) | Faixas de estouro da verba | proposta | Visão geral da obra · lista de obras |
| [RN-029](RN-029-importacao-troca-so-as-verbas-do-arquivo.md) | Importar troca só as verbas que vieram no arquivo | proposta | Vendido Planilha · Executivo |
| [RN-030](RN-030-grupo-fora-da-eap-vai-para-o-fim.md) | Grupo fora da EAP vai para o fim e conta no CMV | proposta | Vendido · CMV · Executivo |
| [RN-031](RN-031-linha-de-titulo-nao-e-item.md) | Linha sem quantidade e sem valor não é item | proposta | Vendido · Executivo · Conf. Executivo |
| [RN-032](RN-032-cmv-soma-o-custo-do-vendido.md) | O CMV é o custo da Vendido Planilha | proposta | CMV |
| [RN-033](RN-033-cmv-so-libera-com-valor.md) | Só se libera CMV maior que zero | proposta | CMV |
| [RN-034](RN-034-cmv-congelado.md) | O CMV liberado é um teto fixo | proposta | CMV |
| [RN-035](RN-035-executivo-exige-cmv-liberado.md) | O Executivo só abre com o CMV liberado | proposta | CMV · Executivo · Conf. Executivo |
| [RN-036](RN-036-mao-de-obra-separada-por-verba.md) | Nas verbas de instalação contratada, material e mão de obra se separam | proposta | Executivo · Plano de Compras |
| [RN-037](RN-037-edicao-nas-duas-linhas-do-produto.md) | Editar item partido vale para o produto nas duas linhas | proposta | Executivo |
| [RN-038](RN-038-remocao-exige-justificativa.md) | Remover item do Executivo exige justificativa | proposta | Executivo |
| [RN-039](RN-039-alerta-tecnico-trava-liberacao.md) | Item com alerta técnico só se aprova depois do "conferi" | proposta | Conf. Executivo |
| [RN-040](RN-040-aprovar-compra-conclui-executivo.md) | Aprovar para compra conclui o executivo da linha | proposta | Conf. Executivo |
| [RN-041](RN-041-conf-executivo-conclui-sem-pendencia.md) | A Conf. Executivo só se conclui sem pendência de conferência | proposta | Conf. Executivo · Navegação da obra |
| [RN-042](RN-042-cliente-nao-barra-compra.md) | A aprovação do cliente não barra a compra | proposta | Conf. Executivo · Plano de Compras |
| [RN-043](RN-043-o-que-conta-como-liberado.md) | O que conta como liberado para compra | proposta | Conf. Executivo · Plano de Compras · Compras · Gestão |
| [RN-044](RN-044-material-para-compras-mo-para-contratos.md) | Material vai para Compras, mão de obra para Contratos | proposta | Executivo · Plano de Compras · Compras · Contratos · Gestão |
| [RN-045](RN-045-alocacao-corrigida-vira-padrao.md) | Alocação corrigida vira o padrão da empresa | proposta | Plano de Compras |
| [RN-046](RN-046-compra-avulsa-sem-valor.md) | Compra avulsa nasce sem valor | proposta | Plano de Compras |
| [RN-047](RN-047-acima-do-cmv-exige-justificativa.md) | Liberar o plano acima do CMV exige justificativa | proposta | Plano de Compras · CMV |
| [RN-048](RN-048-plano-liberado-congela-etapas.md) | Plano liberado congela as etapas anteriores | proposta | Plano de Compras · Navegação da obra |
| [RN-049](RN-049-fora-do-escopo-bloqueado.md) | Item fora do escopo vendido fica bloqueado | proposta | Plano de Compras · Contratos |
| [RN-050](RN-050-prazo-de-compra-por-grupo.md) | Prazo de compra por grupo | proposta | Plano de Compras · Gestão · Painel por canal · Início |
| [RN-051](RN-051-sienge-comprado-depois-de-solicitado.md) | No Sienge, comprado só depois de solicitado | proposta | Compras de Produtos |
| [RN-052](RN-052-troca-de-produto-exige-aprovador.md) | Trocar produto exige quem aprovou | proposta | Compras de Produtos |
| [RN-053](RN-053-item-elegivel-para-o-sienge.md) | Quando um item pode ir na solicitação ao Sienge | proposta | Compras de Produtos · EAP Sienge |
| [RN-054](RN-054-solicitacao-soma-itens-iguais.md) | A solicitação ao Sienge soma itens iguais | proposta | Compras de Produtos |
| [RN-055](RN-055-solicitacao-registrada-antes-do-envio.md) | A solicitação ao Sienge é registrada antes de sair | proposta | Compras de Produtos |
| [RN-056](RN-056-solicitante-sienge-fixo.md) | O solicitante no Sienge é sempre VALENTINA | proposta | Compras de Produtos |
| [RN-057](RN-057-mao-de-obra-contratada-desde-a-solicitacao.md) | Mão de obra conta como contratada desde a solicitação | proposta | Contratos · Gestão de compras e contratações |
| [RN-058](RN-058-escopo-copia-o-modelo.md) | O escopo de contratação copia o modelo | proposta | Contratos |
| [RN-059](RN-059-compra-atrasada-e-perto-do-prazo.md) | Compra atrasada e perto do prazo | proposta | Gestão de compras e contratações · Painel por canal · Início |
| [RN-060](RN-060-numero-do-aditivo.md) | O número do aditivo é sequencial na obra e não se reusa | proposta | Aditivos |
| [RN-061](RN-061-so-aditivo-aprovado-conta.md) | Só o aditivo aprovado muda o dinheiro da obra | proposta | Aditivos · Dashboard · Executivo · Plano de Compras · Compras |
| [RN-062](RN-062-saldo-do-aditivo.md) | Saldo e arredondamento do aditivo | proposta | Aditivos |
| [RN-063](RN-063-margem-do-aditivo.md) | A margem do aditivo é só da adição | proposta | Aditivos |
| [RN-064](RN-064-aditivo-entra-pelo-custo.md) | Aditivo entra no Plano de Compras pelo custo | proposta | Aditivos · Plano de Compras · Compras |
| [RN-065](RN-065-alocacao-do-item-de-aditivo.md) | Alocação do item de aditivo | proposta | Aditivos · Plano de Compras · Compras |
| [RN-066](RN-066-supressao-nao-vira-compra.md) | Supressão de aditivo não vira compra | proposta | Aditivos · Plano de Compras · Dashboard |
| [RN-067](RN-067-aditivo-aprovado-exige-pipefy.md) | Aditivo aprovado exige a Solicitação de contrato no Pipefy | proposta | Aditivos · Dashboard · Início |
| [RN-068](RN-068-exclusao-do-aditivo.md) | Só o criador ou o administrador exclui o aditivo | proposta | Aditivos |
| [RN-069](RN-069-revisao-da-apresentacao.md) | Revisão da apresentação não sobrescreve a anterior | proposta | Apresentação de especificações |
| [RN-070](RN-070-apresentacao-pronta-para-gerar.md) | A apresentação só sai com todo ambiente completo | proposta | Apresentação de especificações |
| [RN-071](RN-071-catalogo-grupo-e-verba.md) | O grupo do catálogo é a verba da EAP | proposta | Catálogo TKWS |
| [RN-072](RN-072-catalogo-so-produto-vai-para-obra.md) | Só produto vai do catálogo para a obra | proposta | Catálogo TKWS |
| [RN-073](RN-073-catalogo-produto-unico.md) | Produto único por fornecedor e código no catálogo | proposta | Catálogo TKWS |
| [RN-074](RN-074-catalogo-preco-com-data.md) | Preço do catálogo tem data e envelhece | proposta | Catálogo TKWS |
| [RN-075](RN-075-catalogo-envio-para-o-executivo.md) | Produto enviado do catálogo entra no Executivo | proposta | Catálogo TKWS · Executivo |
| [RN-076](RN-076-preco-de-referencia.md) | Preço de referência é a compra mais recente, sem "vb" | proposta | Banco de Preços |
| [RN-077](RN-077-cadastro-sienge-nao-sobrescreve-preco.md) | O cadastro do Sienge não sobrescreve o preço pago | proposta | Banco de Preços |
| [RN-078](RN-078-so-insumo-ativo-e-oferecido.md) | Só insumo ativo do Sienge é oferecido | proposta | Gerador de códigos Sienge · Banco de Preços · Compras |
| [RN-079](RN-079-detalhe-so-em-insumo-existente.md) | Produto novo entra no Sienge como detalhe de insumo existente | proposta | Gerador de códigos Sienge · Compras |
| [RN-080](RN-080-descricao-do-detalhe-sienge.md) | Padrão da descrição do detalhe no Sienge | proposta | Gerador de códigos Sienge · Compras |
| [RN-081](RN-081-codigo-auxiliar-unico.md) | Código auxiliar único no arquivo do Sienge | proposta | Gerador de códigos Sienge · Compras |
| [RN-082](RN-082-eap-importacao-cria-versao.md) | Importar a EAP cria versão nova | proposta | EAP Sienge |
| [RN-083](RN-083-eap-uma-versao-padrao.md) | Uma única versão padrão da EAP | proposta | EAP Sienge · Compras |
| [RN-084](RN-084-eap-so-folha-apropria.md) | Só a folha da EAP recebe apropriação | proposta | EAP Sienge |
| [RN-085](RN-085-eap-mapa-confirmado-pela-pessoa.md) | A ligação verba → EAP é decisão de uma pessoa | proposta | EAP Sienge |
| [RN-086](RN-086-cadastro-de-insumos-so-administrador.md) | Só o administrador mantém o cadastro de insumos | vigente | Configurações · Cadastro de Insumos |
| [RN-087](RN-087-insumo-pedido-ao-sienge-nao-se-apaga.md) | Insumo pedido ao Sienge não se apaga | vigente | Configurações · Cadastro de Insumos |
| [RN-088](RN-088-importacao-so-da-tabela-ativa.md) | A importação só aceita o relatório da tabela ativa | vigente | Configurações · Cadastro de Insumos |
| [RN-089](RN-089-insumo-em-vb-fica-fora-do-cadastro.md) | Insumo em "vb" não entra no cadastro | vigente | Configurações · Cadastro de Insumos |
| [RN-090](RN-090-template-sienge-so-com-decisao.md) | Produto só vai ao Template Sienge com a decisão tomada | vigente | Compras · Gerador de códigos Sienge |
