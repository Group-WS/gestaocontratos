# 02 · Regras de negócio × fluxos de funcionalidade

> **Regra de negócio é protegida.** Um agente pode reescrever uma tela inteira, trocar a ordem
> dos passos de um cadastro ou refazer uma rota — mas não pode mudar *o que o negócio permite,
> calcula ou exige* sem que alguém tenha pedido exatamente isso. Para essa fronteira ser clara
> para a IA, regra e fluxo ficam **separados no código e na documentação**.

Neste arquivo, `NEG-xx` são as regras do gate. `RN-NNN` (três dígitos) são as regras de negócio
**do projeto**, catalogadas em `docs/regras-de-negocio/`.

## A diferença

| | Regra de negócio (`RN-NNN`) | Fluxo de funcionalidade |
|---|---|---|
| O que é | Política, invariante ou cálculo do negócio | Como o usuário realiza uma tarefa no sistema |
| Pergunta-teste | *Se trocássemos a tela e a tecnologia amanhã, isto continuaria valendo?* **Sim** | **Não** — é o jeito de fazer, não o que vale |
| Exemplos | "Pedido acima de R$ 50 mil exige aprovação do gestor" · "CNPJ é único por organização" · "Obra encerrada não aceita lançamento" · "Vencimento = emissão + 30 dias corridos" · "Desconto máximo de 15% sem aprovação" | "O cadastro de obra tem 3 etapas" · "Depois de salvar, volta para a listagem" · "O filtro de status fica na toolbar" · "A aprovação chega por notificação no sino" |
| Onde mora no código | `domain/` — funções puras | `features/`, rotas, telas, hooks, server actions |
| Onde mora na documentação | `docs/regras-de-negocio/RN-NNN-*.md` (ficha) | `docs/funcionalidades/*.md` (recomendado) |
| Quem pode mudar | Só com pedido explícito do dev, citando a regra | Qualquer tarefa que peça mudança no fluxo |

Casos de fronteira:

- **Mensagem de erro** de uma regra é fluxo (texto de interface); **a condição** que a dispara é
  regra.
- **Permissão** ("só gestor aprova") é regra de negócio **e** regra de segurança: mora em
  `domain/` para o fluxo consultar, e é garantida também no servidor e no banco
  ([03-seguranca-e-acesso](03-seguranca-e-acesso.md)).
- **Validação estrutural** (CNPJ tem 14 caracteres, e-mail tem formato válido) é contrato, fica no
  schema. **Validação de negócio** (CNPJ não pode se repetir na organização) é regra.

## Regras

### NEG-01 · Regras de negócio moram numa camada pura `[AUTO]`

Arquivos em `caminhos.regrasDeNegocio` (ex.: `packages/shared/src/domain/` ou `src/domain/`)
contêm **só funções puras**: recebem dados, devolvem decisão ou valor. Eles **não importam**
framework nem infraestrutura (`react`, `next`, `hono`, `@supabase/*`, `@tanstack/*`, clientes
HTTP, `node:fs`…) e **não usam** `process.env`, `fetch`, `window`, `document` ou storage.

Data e hora atuais entram como parâmetro (`now: Date`), nunca `new Date()` dentro da regra: a
regra fica determinística e testável.

```ts
// packages/shared/src/domain/purchasing/approval.ts

/** RN-012 — Pedido acima do limite da organização exige aprovação do gestor. */
export function requiresManagerApproval(order: { total: number }, policy: { approvalLimit: number }): boolean {
  return order.total > policy.approvalLimit
}
```

### NEG-02 · Toda regra tem ficha e o código cita o ID `[AUTO]`

- Cada regra tem uma ficha `docs/regras-de-negocio/RN-NNN-titulo-curto.md` (molde:
  `_template.md` na mesma pasta).
- Todo arquivo de `domain/` (exceto `index.ts`, `types.ts` e testes) cita pelo menos um `RN-NNN`.
- Todo `RN-NNN` citado no código existe no catálogo.

### NEG-03 · Toda regra tem teste unitário `[AUTO]`

Todo arquivo de `domain/` tem um teste ao lado (`approval.test.ts`) ou em `__tests__/`. O teste
reproduz os exemplos da ficha e usa o ID no nome:

```ts
describe('RN-012 · pedido acima do limite exige aprovação', () => {
  it('exige aprovação quando o total passa do limite', () => {
    expect(requiresManagerApproval({ total: 50_000.01 }, { approvalLimit: 50_000 })).toBe(true)
  })
  it('não exige aprovação no valor exato do limite', () => {
    expect(requiresManagerApproval({ total: 50_000 }, { approvalLimit: 50_000 })).toBe(false)
  })
})
```

### NEG-04 · Fluxo chama a regra, não a reimplementa `[REVISÃO]`

Rota, tela, hook e server action **chamam** a função de `domain/`. É proibido duplicar a condição
no fluxo (`if (total > 50000)` numa tela, `where total > 50000` escrito à mão numa rota).

Na tela, a regra pode ser consultada para **UX** (desabilitar botão, mostrar aviso), mas a decisão
que vale é sempre a do servidor, que chama a mesma função.

### NEG-05 · Regra de negócio é protegida `[AUTO via NEG-06 e hooks]`

O agente **não altera** regra de negócio — o código em `domain/`, o teste dela ou a ficha — a
menos que o pedido do dev:

1. nomeie a regra (pelo ID ou pelo enunciado), **e**
2. descreva a mudança desejada.

Se a tarefa de fluxo parece exigir mudar uma regra ("para a tela nova funcionar, o limite
precisaria ser por usuário"), **pare e pergunte**. Nunca:

- ajuste regra ou teste de regra para o build ou o CI passarem;
- "corrija" uma regra que parece estranha — ela pode estar certa; registre a dúvida no relatório;
- mova lógica de regra para dentro de um fluxo para contornar a proteção.

Como a proteção é aplicada:

| Onde | Mecanismo |
|---|---|
| Claude Code | Hook `PreToolUse`: editar arquivo de `domain/` ou do catálogo **pede sua confirmação** antes de acontecer. |
| Codex | Hook `PreToolUse`: edição em `domain/` ou no catálogo é **negada** a menos que a sessão tenha sido aberta com `GATE_RN_AUTORIZADA=RN-012` (lista separada por vírgula). |
| Commit e CI | [NEG-06](#neg-06--mudar-regra-exige-atualizar-a-ficha-auto) reprova mudança em `domain/` sem a ficha correspondente atualizada. |
| Revisão de PR | O relatório do gate lista as regras alteradas; o revisor confere com o pedido. |

### NEG-06 · Mudar regra exige atualizar a ficha `[AUTO]`

Arquivo de `domain/` **modificado, renomeado ou removido** (código ou teste) exige, no mesmo
commit (pré-commit) ou no mesmo PR (CI), alteração na ficha de cada `RN-NNN` que ele cita — com
uma linha nova em **Histórico**: data, o que mudou, quem aprovou.

Não existe escape para esta regra. Mudar regra sem rastro é exatamente o que ela impede.

### NEG-07 · Garantia no banco cita a regra `[REVISÃO]`

Quando a regra também é garantida no banco (`unique`, `check`, trigger, policy), o SQL cita o ID
num comentário. A fonte descritiva continua sendo a ficha; o banco é defesa em profundidade.

```sql
-- RN-007 — CNPJ é único por organização
alter table public.customers
  add constraint customers_org_cnpj_key unique (organization_id, cnpj);
```

### NEG-08 · Regra descoberta nasce como proposta `[REVISÃO]`

Ao encontrar uma regra implícita não catalogada (condição de negócio espalhada em tela ou rota), o
agente **não a cataloga como vigente por conta própria**. Ele:

1. registra no relatório do gate como "RN candidata", com onde a encontrou;
2. se o dev pedir, cria a ficha com `Status: proposta` e move a lógica para `domain/`;
3. a ficha só passa a `vigente` quando o dev confirmar o enunciado.

### NEG-09 · Ficha completa `[AUTO]`

Toda ficha tem: título com o ID, `Status:` (`proposta`, `vigente` ou `revogada`) e as seções
**Enunciado**, **Exemplos**, **Implementação** e **Histórico**. Todo caminho citado em
**Implementação** existe no repositório.

## Catálogo de funcionalidades (fluxos) `[RECOMENDADA]`

`docs/funcionalidades/<funcionalidade>.md` descreve o fluxo: objetivo, telas envolvidas, passos,
estados, permissões e **as regras que o fluxo usa** (só os IDs, sem repetir o enunciado). O molde
está em `docs/funcionalidades/_template.md`. Mudar fluxo é tarefa comum; o documento é atualizado
junto.
