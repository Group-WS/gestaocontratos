// Acesso ao git para as regras que olham mudanças (SQL-02, NEG-06) e para SEG-21/SEG-22.
// Toda função devolve "não sei" (null / []) quando o git não está disponível: a regra que
// depende dele é pulada e o relatório avisa.

import { spawnSync } from 'node:child_process'

export function criarGit(raiz) {
  const executar = (args) => {
    const r = spawnSync('git', ['-c', 'core.quotepath=false', ...args], {
      cwd: raiz,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    })
    return { ok: r.status === 0, saida: r.stdout ?? '' }
  }

  const disponivel = executar(['rev-parse', '--is-inside-work-tree']).saida.trim() === 'true'
  const temHead = disponivel && executar(['rev-parse', '--verify', '--quiet', 'HEAD']).ok

  const refExiste = (ref) => executar(['rev-parse', '--verify', '--quiet', ref]).ok

  /** Branch principal remota (origin/HEAD → origin/main…), ou null. */
  function refPrincipal() {
    if (!disponivel) return null
    const simbolica = executar(['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']).saida.trim()
    if (simbolica) return simbolica.replace('refs/remotes/', '')
    return ['origin/main', 'origin/master', 'origin/develop'].find(refExiste) ?? null
  }

  function mergeBase(ref) {
    if (!temHead || !ref) return null
    const r = executar(['merge-base', 'HEAD', ref])
    return r.ok ? r.saida.trim() : null
  }

  /**
   * Arquivos alterados em `caminhos`.
   * - `tresPontos`: `ref...HEAD` (o que o PR mudou em relação à base)
   * - `indice`: índice (staged) contra `ref`
   * - padrão: árvore de trabalho contra `ref`
   */
  function alterados({ ref, caminhos = [], indice = false, tresPontos = false }) {
    if (!disponivel || !ref) return null
    const args = ['diff', '--name-status', '-M']
    if (tresPontos) args.push(`${ref}...HEAD`)
    else {
      if (indice) args.push('--cached')
      args.push(ref)
    }
    args.push('--', ...(caminhos.length ? caminhos : ['.']))
    const r = executar(args)
    if (!r.ok) return null
    return r.saida
      .split('\n')
      .filter(Boolean)
      .map((linha) => {
        const [status, a, b] = linha.split('\t')
        const letra = status[0]
        return letra === 'R' || letra === 'C'
          ? { status: letra, caminho: b, caminhoAntigo: a }
          : { status: letra, caminho: a, caminhoAntigo: a }
      })
  }

  return {
    disponivel,
    temHead,
    refExiste,
    refPrincipal,
    mergeBase,
    alterados,
    versionados() {
      if (!disponivel) return null
      const r = executar(['ls-files', '-z'])
      return r.ok ? r.saida.split('\0').filter(Boolean) : null
    },
    mostrar(ref, caminho) {
      if (!disponivel || !ref) return null
      const r = executar(['show', `${ref}:${caminho}`])
      return r.ok ? r.saida : null
    },
    existeNoRef(ref, caminho) {
      return disponivel && !!ref && executar(['cat-file', '-e', `${ref}:${caminho}`]).ok
    },
    temMudancasLocais() {
      return disponivel && executar(['status', '--porcelain']).saida.trim() !== ''
    },
  }
}
