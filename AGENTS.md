<!-- groupws-dev-quality:inicio · padrão 1.0.0 · gerado por instalar.mjs — não edite entre os marcadores -->
# Gate de qualidade Group WS

Este repositório segue o **padrão de qualidade Group WS v1.0.0** (pasta `.quality/`). Vale
para Codex, Claude Code e pessoas. **Nenhuma tarefa que altere código começa ou termina sem passar
pelo gate.**

## 1. Entrada — antes de alterar qualquer arquivo

1. Rode `node .quality/checks/gate.mjs`.
2. Aja conforme o estado:

| Estado | O que é permitido |
|---|---|
| `CONFORME` | Seguir com a tarefa, dentro das regras. |
| `EM ADEQUAÇÃO` | Só tarefas que corrigem itens de `.quality/adequacao.json`. Recuse tarefa nova, explique ao dev e ofereça atacar os itens. |
| `NÃO CONFORME` | Nenhuma tarefa nova. Mostre o relatório ao dev e, com o aval dele, inicie a adequação (`node .quality/checks/gate.mjs --iniciar-adequacao`). |
| `SEM VÍNCULO` | Nenhuma tarefa de código. Primeiro: `.quality/manifest.json` válido e design system vinculado. |

   Tarefas que não alteram código (explicar, investigar, planejar, revisar) são sempre permitidas.

3. Classifique a tarefa e leia, **antes de escrever código**, os arquivos indicados em
   `.quality/regras/README.md` (tela → 05 e 06 · banco → 07 · API e login → 03 e o perfil ·
   regra de negócio → 02 · navegador → 04).

## 2. Regras de negócio são protegidas

- Regra de negócio — o que o negócio **permite, calcula ou exige** — mora na camada de regras
  (`caminhos.regrasDeNegocio` do manifesto), em funções puras com teste, e tem ficha `RN-NNN` no
  catálogo (`caminhos.catalogoDeRegras`).
- Fluxo de funcionalidade — telas, passos, rotas, hooks, server actions — **chama** a regra e nunca
  a reimplementa.
- **Não altere regra de negócio** (código, teste ou ficha) sem pedido explícito do dev nomeando a
  regra. Se a tarefa parece exigir, pare e pergunte. Nunca ajuste regra ou teste de regra para o
  build passar.

## 3. O que mais quebra (texto completo em `.quality/regras/`)

- **Telas:** só com o design system vinculado (`@group-ws/ws-ui`). Toda tela é um arquétipo
  (listagem, formulário, detalhe, configurações, dashboard, autenticação, página de sistema)
  montado sobre o template do DS, com a anatomia de `06-padroes-de-tela.md` — mesma intenção,
  mesma tela, mesmas proporções. Sem cor fora de token, sem valor arbitrário (`p-[13px]`), sem
  `style`, sem `<button>`/`<input>`/`<table>` nativos, sem card feito à mão, sem outra biblioteca
  de UI. Faltou algo no DS? Não crie versão local: registre a lacuna e pergunte.
- **Navegador:** só sessão e cache. Configuração, preferência e dado moram no banco. Storage só
  pelo wrapper declarado no manifesto.
- **Segurança:** toda rota, server action e route handler autenticados no servidor; autorização no
  servidor e no RLS (a tela é só UX); nenhum segredo no front, em `.env` versionado ou em arquivo;
  erro para o usuário sem detalhe técnico.
- **Banco:** schema só por migration nova (migration aplicada não se edita); RLS em toda tabela;
  policy com `to <papel>` e `(select auth.uid())`; índice em toda FK; nunca `select('*')`;
  listagem paginada no banco.
- **Testes essenciais:** regra de negócio com teste unitário; toda tabela com teste pgTAP de acesso
  negado; E2E marcados `@login` e `@acesso-negado`.

## 4. Saída — antes de dizer que terminou

1. `node .quality/checks/gate.mjs` aprovado.
2. Os comandos de `comandosDeValidacao` do manifesto verdes.
3. O relatório na resposta final:

```markdown
### Relatório do gate
- Estado: CONFORME · padrão 1.0.0
- Regras lidas: …
- Regras de negócio: usa … · alterou: nenhuma
- Testes: …
- Escapes adicionados: nenhum
- Validações: lint ✓ typecheck ✓ test ✓ build ✓
- Pendências / lacunas: …
```

## 5. Nunca

- Editar `.quality/regras`, `.quality/checks` ou `.quality/hooks`, nem mexer no manifesto para
  esconder violação.
- Usar escape (`gate-allow REGRA-00: motivo`) para fazer o gate passar — só em caso legítimo, com
  motivo.
- Marcar teste como `skip`/`only`, criar `.quality/adequacao.json` à mão ou incluir nele violação
  nova.
- Dizer que terminou sem rodar o gate e sem o relatório.
<!-- groupws-dev-quality:fim -->
