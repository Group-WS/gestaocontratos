// Contexto compartilhado pelas verificações: arquivos classificados por área, leitura com cache,
// escapes (`gate-allow REGRA: motivo`) e acesso ao git.

import {
  EXTENSOES_CODIGO,
  casaGlob,
  criarLeitorDeArquivos,
  dentroDe,
  ehArquivoDeTeste,
  extname,
  temDiretivaDeArquivo,
} from './arquivos.mjs'
import { criarGit } from './git.mjs'

export const REGRAS_SEM_ESCAPE = new Set(['GATE-01', 'GATE-02', 'GATE-03', 'SEG-21', 'SEG-22', 'NEG-06'])
export const MOTIVO_MINIMO = 10

const RE_ESCAPE = /gate-allow\s+([A-Z]+-\d{2})\s*:\s*(.*)$/
/** Escapes herdados do check-ds do design system, aceitos nas regras equivalentes. */
const ESCAPES_DO_DS = { 'DS-03': 'ds-allow-hex', 'TST-08': 'ds-allow-any', 'DS-04': 'ds-allow-font' }

export function lerEscape(linha) {
  const m = RE_ESCAPE.exec(linha)
  if (!m) return null
  const motivo = m[2].replace(/\*\/\s*\}?\s*$/, '').replace(/-->\s*$/, '').trim()
  return { regra: m[1], motivo }
}

export function criarContexto({ raiz, manifesto, opcoes = {} }) {
  const leitor = criarLeitorDeArquivos(raiz, manifesto.caminhos.ignorar)
  const git = criarGit(raiz)
  const escapesUsados = []
  const ds = manifesto.designSystem

  const ehDoDesignSystem = (rel) => ds.vinculo === 'copia' && dentroDe(rel, ds.pastasDoDesignSystem)

  /**
   * Arquivos de código de uma ou mais áreas.
   * áreas: 'frontend' | 'api' | 'regras' · ds: incluir pastas do DS · testes: incluir testes
   */
  function codigo({ areas, extensoes = EXTENSOES_CODIGO, ds: incluirDs = false, testes = false }) {
    const pastas = areas.flatMap((a) =>
      a === 'frontend' ? manifesto.caminhos.frontend : a === 'api' ? manifesto.caminhos.api : manifesto.caminhos.regrasDeNegocio,
    )
    return leitor.todos.filter(
      (rel) =>
        extensoes.has(extname(rel)) &&
        !rel.endsWith('.d.ts') &&
        dentroDe(rel, pastas) &&
        (incluirDs || !ehDoDesignSystem(rel)) &&
        (testes || !ehArquivoDeTeste(rel)),
    )
  }

  /** A linha `indice` (0-based) ou a anterior liberam `regra` com motivo válido? */
  function escapado(rel, indice, regra) {
    if (REGRAS_SEM_ESCAPE.has(regra)) return false
    const linhas = leitor.linhas(rel)
    for (const i of [indice, indice - 1]) {
      if (i < 0 || i >= linhas.length) continue
      const escape = lerEscape(linhas[i])
      if (escape && escape.regra === regra && escape.motivo.length >= MOTIVO_MINIMO) {
        escapesUsados.push({ regra, arquivo: rel, linha: indice + 1, motivo: escape.motivo })
        return true
      }
      const doDs = ESCAPES_DO_DS[regra]
      if (doDs && linhas[i].includes(doDs)) {
        escapesUsados.push({ regra, arquivo: rel, linha: indice + 1, motivo: `${doDs} (escape do check-ds)` })
        return true
      }
    }
    return false
  }

  const cacheCliente = new Map()
  const ehCliente = (rel) => {
    if (!cacheCliente.has(rel)) cacheCliente.set(rel, temDiretivaDeArquivo(leitor.ler(rel), 'client'))
    return cacheCliente.get(rel)
  }

  return {
    raiz,
    manifesto,
    opcoes,
    git,
    todos: leitor.todos,
    ler: leitor.ler,
    linhas: leitor.linhas,
    existe: leitor.existe,
    codigo,
    escapado,
    escapesUsados,
    ehDoDesignSystem,
    ehCliente,
    ehTeste: ehArquivoDeTeste,
    dentroDe,
    casaGlob,
    avisos: [],
  }
}

/**
 * Varre linhas de arquivos aplicando uma expressão; devolve violações não escapadas.
 * `ignorarComentarios`: pula linhas que são só comentário.
 */
export function varrerLinhas(ctx, arquivos, regra, re, { ignorarComentarios = true, filtro, mensagem } = {}) {
  const violacoes = []
  for (const rel of arquivos) {
    const linhas = ctx.linhas(rel)
    linhas.forEach((linha, i) => {
      if (ignorarComentarios && ehComentario(linha)) return
      re.lastIndex = 0
      const m = re.exec(linha)
      if (!m) return
      if (filtro && !filtro(linha, m, rel, i)) return
      if (ctx.escapado(rel, i, regra)) return
      violacoes.push({
        regra,
        arquivo: rel,
        linha: i + 1,
        trecho: linha.trim(),
        mensagem: typeof mensagem === 'function' ? mensagem(m, linha) : mensagem,
      })
    })
  }
  return violacoes
}

function ehComentario(linha) {
  const t = linha.trim()
  return t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') || t.startsWith('--') || t.startsWith('{/*')
}
