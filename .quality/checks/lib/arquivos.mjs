// Leitura do projeto: varredura de arquivos, globs, classificação de código e escapes.
// Sem dependências: roda com o Node do projeto, antes de qualquer `install`.

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, relative, sep, posix, dirname, basename, extname } from 'node:path'

const PASTAS_IGNORADAS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.vercel', '.turbo', 'coverage',
  '.cache', 'storybook-static', 'playwright-report', 'test-results', '.ds-temp', '.pnpm-store',
])
const CAMINHOS_IGNORADOS = ['.quality/', 'supabase/.temp/', 'supabase/.branches/', '.claude/worktrees/']
const TAMANHO_MAXIMO = 2 * 1024 * 1024

export const EXTENSOES_CODIGO = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
export const EXTENSOES_UI = new Set(['.tsx', '.jsx'])

export const paraPosix = (caminho) => caminho.split(sep).join(posix.sep)

/** Converte um glob simples (`**`, `*`, `?`) em RegExp ancorada. */
export function globParaRegExp(glob) {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*') {
      if (glob[i + 1] === '*') {
        const barra = glob[i + 2] === '/'
        re += barra ? '(?:.*/)?' : '.*'
        i += barra ? 2 : 1
      } else {
        re += '[^/]*'
      }
    } else if (c === '?') {
      re += '[^/]'
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    }
  }
  return new RegExp(`^${re}$`)
}

export const casaGlob = (rel, globs = []) => globs.some((g) => globParaRegExp(g).test(rel))

/** `rel` está dentro de alguma das pastas (caminhos relativos à raiz)? */
export function dentroDe(rel, pastas = []) {
  return pastas.some((p) => {
    const pasta = p.replace(/\/+$/, '')
    return pasta === '' || pasta === '.' || rel === pasta || rel.startsWith(`${pasta}/`)
  })
}

export function ehArquivoDeTeste(rel) {
  return /(^|\/)(__tests__|__mocks__|tests?|e2e)\//.test(rel) || /\.(test|spec|e2e)\.[cm]?[jt]sx?$/.test(rel)
}

/** Linha só de comentário (JS/TS/CSS/SQL). */
export function ehLinhaDeComentario(linha) {
  const t = linha.trim()
  return t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') || t.startsWith('--') || t.startsWith('{/*')
}

const DIRETIVA = (nome) => new RegExp(`^\\s*['"]use ${nome}['"];?\\s*$`)

/** Diretiva de arquivo (`'use client'` / `'use server'`) antes de qualquer código. */
export function temDiretivaDeArquivo(conteudo, nome) {
  const re = DIRETIVA(nome)
  for (const linha of conteudo.split('\n')) {
    const t = linha.trim()
    if (t === '' || ehLinhaDeComentario(linha) || t.startsWith('#!')) continue
    return re.test(linha)
  }
  return false
}

export function criarLeitorDeArquivos(raiz, ignorarGlobs = []) {
  const cache = new Map()
  const todos = []

  const caminhar = (dir) => {
    let entradas
    try {
      entradas = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entrada of entradas) {
      if (PASTAS_IGNORADAS.has(entrada.name)) continue
      const abs = join(dir, entrada.name)
      const rel = paraPosix(relative(raiz, abs))
      if (CAMINHOS_IGNORADOS.some((c) => `${rel}/`.startsWith(c) || rel.startsWith(c))) continue
      if (entrada.isDirectory()) caminhar(abs)
      else if (entrada.isFile() && !casaGlob(rel, ignorarGlobs)) todos.push(rel)
    }
  }
  caminhar(raiz)
  todos.sort()

  const ler = (rel) => {
    if (cache.has(rel)) return cache.get(rel)
    let conteudo = ''
    try {
      const abs = join(raiz, rel)
      if (statSync(abs).size <= TAMANHO_MAXIMO) {
        const bruto = readFileSync(abs)
        conteudo = bruto.includes(0) ? '' : bruto.toString('utf8')
      }
    } catch {
      conteudo = ''
    }
    cache.set(rel, conteudo)
    return conteudo
  }

  return {
    todos,
    ler,
    linhas: (rel) => ler(rel).split('\n'),
    existe: (rel) => existsSync(join(raiz, rel)),
  }
}

/** Resolve um import local (`./x`, `../x`, `@/x`) para um arquivo do projeto, ou null. */
export function resolverImport(de, especificador, { existe, aliasRaiz }) {
  let base
  if (especificador.startsWith('@/')) {
    if (!aliasRaiz) return null
    base = posix.join(aliasRaiz, especificador.slice(2))
  } else if (especificador.startsWith('./') || especificador.startsWith('../')) {
    base = posix.join(posix.dirname(de), especificador)
  } else {
    return null
  }
  const candidatos = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '/index.ts', '/index.tsx', '/index.js']
  for (const sufixo of candidatos) {
    if (existe(base + sufixo) && extname(base + sufixo)) return base + sufixo
  }
  return null
}

/** Especificadores importados por um arquivo (import, export from, import(), require). */
export function importsDe(conteudo) {
  const encontrados = []
  // A cláusula entre `import` e `from` não tem aspas, `;`, `(`, `)` nem `=`: isso impede o casamento
  // de atravessar declarações (`export const x = …`) até um `from` distante.
  const re = /\b(?:import|export)\s+(?:type\s+)?(?:[^;'"()=]*?\s+from\s+)?['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)|\brequire\(\s*['"]([^'"]+)['"]\s*\)/g
  let m
  while ((m = re.exec(conteudo))) {
    const especificador = m[1] ?? m[2] ?? m[3]
    const linha = conteudo.slice(0, m.index).split('\n').length
    encontrados.push({ especificador, linha })
  }
  return encontrados
}

export { dirname, basename, extname, posix }
