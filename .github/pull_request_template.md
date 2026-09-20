## O que muda e por quê

<!-- Uma ou duas frases. Link da issue/tarefa. -->

## Relatório do gate

- Estado:
- Regras lidas:
- Regras de negócio: usa … · alterou: …
- Testes:
- Escapes adicionados:
- Validações:
- Pendências / lacunas:

## Conferência do revisor (padrão Group WS)

- [ ] Gate aprovado no CI e testes do banco verdes.
- [ ] Nenhuma regra de negócio alterada sem pedido explícito; fichas `RN-NNN` atualizadas quando alteradas.
- [ ] Telas no arquétipo e template do DS, com todos os estados (carregando, vazio, vazio com filtro, erro, sem permissão).
- [ ] Autorização no servidor e no RLS; nada sensível no navegador além de sessão e cache declarado.
- [ ] Migration nova (nenhuma antiga editada), com RLS, policies com papel, índices e teste pgTAP.
- [ ] Consulta nova de listagem ou relatório com plano de execução anexado.
- [ ] Escapes adicionados são legítimos e têm motivo.
