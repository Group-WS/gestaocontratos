// Contra o que comparar mudanças, conforme o modo de execução do gate.
//
// - CI (`--base origin/main`): o que o PR mudou → `base...HEAD`.
// - Pré-commit (`--staged`) e execução local:
//   · regras de negócio (NEG-06): mudanças ainda não commitadas → contra HEAD;
//   · migrations (SQL-02): tudo que a branch mudou → contra o merge-base com a branch principal
//     (sem remoto, contra HEAD).

export function refDeComparacao(ctx, { paraRegrasDeNegocio }) {
  const { git, opcoes } = ctx
  if (!git.disponivel) return null
  if (opcoes.base) return git.refExiste(opcoes.base) ? { ref: opcoes.base, tresPontos: true } : null
  if (!git.temHead) return null
  if (paraRegrasDeNegocio) return { ref: 'HEAD', indice: !!opcoes.staged }
  const mergeBase = git.mergeBase(git.refPrincipal())
  return { ref: mergeBase ?? 'HEAD', indice: !!opcoes.staged }
}
