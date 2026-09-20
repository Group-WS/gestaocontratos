# 00 · Protocolo do gate

> **Vale para qualquer agente (Codex, Claude Code) e para pessoas.** Nenhuma tarefa que altere
> código começa ou termina sem passar pelo gate. O gate não é uma sugestão de estilo: é a
> condição para o trabalho existir neste repositório.

## Por que existe

Projetos da Group WS são construídos em boa parte com IA, por pessoas diferentes, em
ferramentas diferentes. Sem um gate, cada sessão reinventa um pouco: uma tela com outro
espaçamento, uma tabela sem RLS, uma preferência salva no `localStorage`, uma regra de negócio
"ajustada" para o teste passar. Cada desvio é pequeno; somados, viram um produto inconsistente e
inseguro. O gate transforma o padrão em verificação.

## Os quatro estados do projeto

O comando `node .quality/checks/gate.mjs` (ou `pnpm quality:gate`) devolve um destes estados:

| Estado | Quando | O que é permitido |
|---|---|---|
| **SEM VÍNCULO** | Falta `.quality/manifest.json` válido ou o design system não está vinculado | Nenhuma tarefa de código. A única tarefa possível é criar o manifesto e vincular o DS. |
| **NÃO CONFORME** | Há violações e a adequação não foi iniciada | **Nenhuma tarefa nova.** Mostre o relatório ao dev e proponha iniciar a adequação. |
| **EM ADEQUAÇÃO** | Existe `.quality/adequacao.json` e não há violação nova fora da lista | **Só tarefas que corrigem itens da lista.** Tarefa nova é recusada até a lista zerar. |
| **CONFORME** | Zero violações | Qualquer tarefa, seguindo as regras. |

Tarefas que **não alteram código** — explicar, investigar, planejar, revisar, responder
perguntas — são sempre permitidas, em qualquer estado.

### GATE-01 · Manifesto válido `[AUTO]`

Todo projeto tem `.quality/manifest.json` preenchido: versão do padrão, perfil, caminhos,
design system vinculado e a lista do que pode ficar no navegador. Sem manifesto válido, o estado
é SEM VÍNCULO.

### GATE-02 · Versão do padrão coerente `[AUTO]`

`manifest.versaoDoPadrao` é igual a `.quality/VERSION`. Atualizar o padrão é copiar a nova versão
**e** revisar o manifesto no mesmo commit.

### GATE-03 · Arquivos do padrão íntegros `[AUTO]`

Os arquivos de `.quality/regras`, `.quality/checks` e `.quality/hooks` batem com
`.quality/checksums.json`. Ninguém — pessoa ou agente — edita o gate dentro do projeto para
"fazer passar". Regra errada se corrige no repositório do padrão.

### GATE-04 · Escape com motivo `[AUTO]`

Todo escape (`gate-allow <REGRA>: <motivo>`) tem um motivo de pelo menos 10 caracteres.

## Bloqueio total e adequação

Projeto existente que não está conforme **não recebe tarefa nova** até ficar 100% conforme.
Para que a correção possa acontecer em vários commits, existe o modo de adequação:

1. `node .quality/checks/gate.mjs --iniciar-adequacao` grava em `.quality/adequacao.json` a
   lista das violações atuais. Rode só com o aval do dev.
2. Enquanto o arquivo existir, o estado é **EM ADEQUAÇÃO**. O gate passa em commits que **não
   criam violação nova**; qualquer violação fora da lista reprova.
3. No CI (`--base`), o PR precisa **reduzir** o número de violações em relação à branch base. PR
   que não reduz é reprovado: em adequação, todo PR é de adequação.
4. `--atualizar-adequacao` remove da lista o que já foi corrigido.
5. Quando a lista zera, o gate pede a remoção do `adequacao.json`. O projeto fica CONFORME.

Violação não entra na lista para ser esquecida: a lista existe para ser zerada.

## Passo a passo de toda tarefa

### 1. Entrada — antes de alterar qualquer arquivo

1. Rode `node .quality/checks/gate.mjs`.
2. Aja conforme o estado (tabela acima). Se a tarefa não é permitida, **pare**, explique ao dev
   em uma frase por quê e ofereça o caminho (vincular DS, iniciar adequação, atacar itens).
3. Classifique a tarefa e leia os arquivos de regra correspondentes
   ([índice](README.md#o-que-ler-antes-de-cada-tipo-de-tarefa)).
4. Consulte o catálogo de regras de negócio (`docs/regras-de-negocio/`). Anote as RNs que a
   tarefa **usa** e as que ela **alteraria**. Se alteraria alguma que o pedido não nomeia
   explicitamente, pare e pergunte ([NEG-05](02-regras-de-negocio.md)).

### 2. Execução

- Siga as regras. Quando uma regra e o pedido do dev conflitarem, a regra vence até o dev
  decidir — explique o conflito e pergunte.
- Não invente padrão. Tela nova usa o template do DS para aquele tipo de tela; tabela nova segue
  o molde de migration; rota nova segue o molde do perfil.
- Faltou componente, variante ou template no design system? **Não crie versão local.** Registre
  a lacuna ([DS-12](05-design-system.md)) e pergunte como seguir.

### 3. Saída — antes de dizer que terminou

1. `node .quality/checks/gate.mjs` sem violações (ou, em adequação, sem violação nova).
2. Os comandos de validação do projeto (`manifest.comandosDeValidacao`) verdes.
3. Os testes essenciais da mudança existem ([09-testes-e-qualidade](09-testes-e-qualidade.md)).
4. O **relatório do gate** na resposta final, neste formato:

```markdown
### Relatório do gate
- Estado: CONFORME (0 violações) · versão do padrão 1.0.0
- Regras lidas: 05-design-system, 06-padroes-de-tela, 07-supabase-e-sql
- Regras de negócio: usa RN-004, RN-011 · alterou: nenhuma
- Testes: supabase/tests/obras_rls.test.sql (novo), e2e/obras.spec.ts @acesso-negado (novo)
- Escapes adicionados: nenhum
- Validações: lint ✓ typecheck ✓ test ✓ build ✓
- Pendências / lacunas: DS não tem template de detalhe (DS-12) — usada composição com DetailHero
```

## Escapes: quando uma regra `[AUTO]` erra

Toda verificação automática pode ter falso positivo. Para o caso **legítimo** e raro, existe o
escape, na mesma linha ou na linha imediatamente anterior:

```tsx
// gate-allow DS-05: largura fixa exigida pelo PDF do contrato (A4, 794px)
<Card className="w-[794px]">
```

```sql
-- gate-allow SQL-30: tabela de log só recebe insert; nunca consultada por esta coluna
```

Regras do escape:

- O motivo explica **por que o caso é legítimo**, não o que o código faz.
- Escape nunca serve para "fazer o gate passar". Na dúvida, não é legítimo: pergunte.
- Todo escape aparece no relatório do gate e é aprovado na revisão do PR.
- Não existe escape para `GATE-01`, `GATE-02`, `GATE-03`, `SEG-21`, `SEG-22` e `NEG-06`.

## O que nunca fazer

- Editar `.quality/regras`, `.quality/checks` ou `.quality/hooks`.
- Mudar `.quality/manifest.json` para esconder violação (ampliar `ignorar` ou
  `arquivosDeSessao`, tirar pasta de `caminhos`, declarar pasta de app como pasta do DS, marcar
  rota como pública) sem o dev pedir explicitamente.
- Criar `adequacao.json` à mão ou incluir nele violação nova.
- Pular, desativar ou marcar teste como `skip` para o gate ou o CI passarem.
- Alterar regra de negócio — código, teste ou ficha — sem pedido explícito ([NEG-05](02-regras-de-negocio.md)).
- Dizer que terminou sem rodar o gate e sem o relatório.
