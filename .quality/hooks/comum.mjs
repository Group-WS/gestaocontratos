// Utilidades dos hooks (Claude Code e Codex). Hook nunca pode travar a ferramenta por erro
// próprio: na dúvida, sai com 0 e sem saída.

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { isAbsolute, join, relative, sep } from 'node:path'

export async function lerEntrada() {
  if (process.stdin.isTTY) return {}
  let bruto = ''
  for await (const pedaco of process.stdin) bruto += pedaco
  try {
    return JSON.parse(bruto || '{}')
  } catch {
    return {}
  }
}

export function raizDoProjeto(entrada = {}) {
  if (process.env.CLAUDE_PROJECT_DIR && existsSync(process.env.CLAUDE_PROJECT_DIR)) return process.env.CLAUDE_PROJECT_DIR
  const cwd = entrada.cwd && existsSync(entrada.cwd) ? entrada.cwd : process.cwd()
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' })
  return r.status === 0 ? r.stdout.trim() : cwd
}

export function relativo(raiz, caminho) {
  if (!caminho) return null
  const abs = isAbsolute(caminho) ? caminho : join(raiz, caminho)
  const rel = relative(raiz, abs).split(sep).join('/')
  return rel.startsWith('..') ? null : rel
}

export const responder = (objeto) => process.stdout.write(JSON.stringify(objeto))

/** Fichas do catálogo: [{ id, titulo, status }]. */
export function catalogoDeRegras(raiz, pasta) {
  const dir = join(raiz, pasta)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((nome) => /^RN-\d{3}-.+\.md$/.test(nome))
    .sort()
    .map((nome) => {
      const conteudo = readFileSync(join(dir, nome), 'utf8')
      const titulo = /^#\s+(.+)$/m.exec(conteudo)?.[1]?.trim() ?? nome
      const status = /Status:?\**:?\s*\**\s*(proposta|vigente|revogada)/i.exec(conteudo)?.[1]?.toLowerCase() ?? '?'
      return { id: nome.slice(0, 6), titulo, status, arquivo: `${pasta}/${nome}` }
    })
}
