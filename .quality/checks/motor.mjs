// Motor do gate: carrega o manifesto, roda as verificações, aplica o modo de adequação e decide o
// estado do projeto. Importável pelos hooks e pelos testes; a CLI é gate.mjs.

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { carregarManifesto, validar, CAMINHO_MANIFESTO } from './lib/manifesto.mjs'
import { detectarPerfil, manifestoProvisorio } from './lib/deteccao.mjs'
import { criarContexto } from './lib/contexto.mjs'
import { criarGit } from './lib/git.mjs'
import gate from './verificacoes/gate.mjs'
import negocio from './verificacoes/negocio.mjs'
import seguranca from './verificacoes/seguranca.mjs'
import navegador from './verificacoes/navegador.mjs'
import designSystem from './verificacoes/design-system.mjs'
import telas from './verificacoes/telas.mjs'
import sql from './verificacoes/sql.mjs'
import testes from './verificacoes/testes.mjs'
import perfilViteHono from './verificacoes/perfil-webapp-vite-hono.mjs'
import perfilNext from './verificacoes/perfil-nextjs.mjs'

export const VERIFICACOES = [
  ...gate, ...designSystem, ...negocio, ...seguranca, ...navegador, ...telas, ...sql, ...testes, ...perfilViteHono, ...perfilNext,
]
export const REGRAS = new Map(VERIFICACOES.map((v) => [v.id, v]))
REGRAS.set('GATE-01', {
  id: 'GATE-01',
  titulo: 'Manifesto válido',
  doc: '00-protocolo-do-gate.md',
  correcao: 'Crie ou corrija `.quality/manifest.json` a partir do exemplo do seu perfil.',
})

export const ESTADOS = {
  SEM_VINCULO: 'SEM VÍNCULO',
  NAO_CONFORME: 'NÃO CONFORME',
  EM_ADEQUACAO: 'EM ADEQUAÇÃO',
  ADEQUACAO_CONCLUIDA: 'ADEQUAÇÃO CONCLUÍDA',
  CONFORME: 'CONFORME',
}

const ARQUIVO_ADEQUACAO = '.quality/adequacao.json'
const VERSAO_DO_PADRAO = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'VERSION'), 'utf8').trim()

export function impressao(v) {
  const base = `${v.regra}|${v.arquivo}|${(v.trecho ?? '').replace(/\s+/g, ' ').trim()}`
  return createHash('sha1').update(base).digest('hex').slice(0, 16)
}

function comImpressoes(violacoes) {
  const contagem = new Map()
  return violacoes.map((v) => {
    const base = impressao(v)
    const n = (contagem.get(base) ?? 0) + 1
    contagem.set(base, n)
    return { ...v, impressao: n === 1 ? base : `${base}#${n}` }
  })
}

function lerAdequacao(raiz) {
  const caminho = join(raiz, ARQUIVO_ADEQUACAO)
  if (!existsSync(caminho)) return null
  try {
    return JSON.parse(readFileSync(caminho, 'utf8'))
  } catch {
    return { invalido: true, itens: [] }
  }
}

/**
 * Executa o gate.
 * opcoes: { staged, base, regras?: string[] (só estas) }
 */
export async function executarGate(raiz, opcoes = {}) {
  const inicio = Date.now()
  let { manifesto, bruto, erros } = carregarManifesto(raiz)
  const versao = existsSync(join(raiz, '.quality/VERSION'))
    ? readFileSync(join(raiz, '.quality/VERSION'), 'utf8').trim()
    : VERSAO_DO_PADRAO

  // Diagnóstico: projeto sem o padrão instalado. Monta um manifesto provisório (nada é gravado) e
  // pula as regras da própria instalação (GATE-*), que ainda não fazem sentido.
  let diagnostico = false
  if (opcoes.diagnostico && !manifesto) {
    const perfil = opcoes.perfil ?? detectarPerfil(raiz)
    if (!perfil) {
      return {
        estado: ESTADOS.SEM_VINCULO,
        aprovado: false,
        diagnostico: true,
        versao,
        perfil: null,
        violacoes: comImpressoes([{ regra: 'GATE-01', arquivo: '.', linha: 1, trecho: 'não consegui identificar o perfil do projeto (Next.js ou Vite + Hono): rode de novo com --perfil' }]),
        novas: [], escapes: [], avisos: [], duracaoMs: Date.now() - inicio,
      }
    }
    const validado = validar(manifestoProvisorio(raiz, perfil))
    manifesto = validado.manifesto
    erros = validado.erros
    diagnostico = true
  }

  if (!manifesto) {
    const violacoes = erros.map((mensagem) => ({ regra: 'GATE-01', arquivo: CAMINHO_MANIFESTO, linha: 1, trecho: mensagem }))
    return {
      estado: ESTADOS.SEM_VINCULO,
      aprovado: false,
      versao,
      perfil: bruto?.perfil ?? null,
      violacoes: comImpressoes(violacoes),
      novas: [],
      escapes: [],
      avisos: [],
      duracaoMs: Date.now() - inicio,
    }
  }

  const parcial = Array.isArray(opcoes.regras) && opcoes.regras.length > 0
  const ctx = criarContexto({ raiz, manifesto, opcoes })
  ctx.regrasAuto = new Set(REGRAS.keys())
  let violacoes = []
  const falhas = []

  for (const verificacao of VERIFICACOES) {
    if (verificacao.perfis && !verificacao.perfis.includes(manifesto.perfil)) continue
    if (parcial && !opcoes.regras.includes(verificacao.id)) continue
    if (diagnostico && verificacao.id.startsWith('GATE-')) continue
    try {
      const achados = (await verificacao.executar(ctx)) ?? []
      violacoes.push(...achados.map((a) => ({ regra: verificacao.id, ...a })))
    } catch (erro) {
      falhas.push(`${verificacao.id}: ${erro.message}`)
    }
  }
  violacoes = comImpressoes(violacoes)

  const semVinculo = violacoes.some((v) => v.regra === 'DS-01')
  const doGate = violacoes.filter((v) => v.regra.startsWith('GATE-'))
  const adequacao = lerAdequacao(raiz)
  let estado
  let novas = []
  let resolvidos = []
  let motivoReprovacao = null

  if (semVinculo) {
    estado = ESTADOS.SEM_VINCULO
  } else if (!adequacao) {
    estado = violacoes.length ? ESTADOS.NAO_CONFORME : ESTADOS.CONFORME
  } else if (adequacao.invalido) {
    estado = ESTADOS.NAO_CONFORME
    motivoReprovacao = '`.quality/adequacao.json` inválido.'
  } else {
    const conhecidas = new Set(adequacao.itens.map((i) => i.impressao))
    novas = violacoes.filter((v) => !conhecidas.has(v.impressao) || v.regra.startsWith('GATE-'))
    const atuais = new Set(violacoes.map((v) => v.impressao))
    // Verificação parcial (--regra) não enxerga as demais regras: não conclui nem mede redução.
    resolvidos = parcial ? [] : adequacao.itens.filter((i) => !atuais.has(i.impressao))
    if (novas.length) estado = ESTADOS.NAO_CONFORME
    else if (!violacoes.length && !parcial) estado = ESTADOS.ADEQUACAO_CONCLUIDA
    else estado = ESTADOS.EM_ADEQUACAO

    if (estado === ESTADOS.EM_ADEQUACAO && opcoes.base && !parcial) {
      const git = criarGit(raiz)
      const naBase = git.mostrar(opcoes.base, ARQUIVO_ADEQUACAO)
      if (naBase) {
        try {
          const itensNaBase = JSON.parse(naBase).itens.length
          if (violacoes.length >= itensNaBase) {
            motivoReprovacao = `Projeto em adequação: este PR precisa reduzir as violações (base: ${itensNaBase}, agora: ${violacoes.length}).`
          }
        } catch {}
      }
    }
  }

  if (doGate.length && estado === ESTADOS.EM_ADEQUACAO) estado = ESTADOS.NAO_CONFORME
  const aprovado = (estado === ESTADOS.CONFORME || estado === ESTADOS.EM_ADEQUACAO) && !motivoReprovacao && !falhas.length

  return {
    estado,
    aprovado,
    parcial,
    diagnostico,
    motivoReprovacao,
    versao,
    perfil: manifesto.perfil,
    projeto: manifesto.projeto,
    violacoes,
    novas,
    resolvidos,
    escapes: ctx.escapesUsados,
    avisos: ctx.avisos,
    falhas,
    adequacao: adequacao && !adequacao.invalido ? { iniciadaEm: adequacao.iniciadaEm, total: adequacao.itens.length } : null,
    duracaoMs: Date.now() - inicio,
  }
}

export function iniciarAdequacao(raiz, resultado) {
  const caminho = join(raiz, ARQUIVO_ADEQUACAO)
  if (existsSync(caminho)) throw new Error('A adequação já foi iniciada (`.quality/adequacao.json` existe).')
  if (resultado.estado === ESTADOS.SEM_VINCULO) throw new Error('Projeto SEM VÍNCULO: vincule o design system e valide o manifesto antes da adequação.')
  const doGate = resultado.violacoes.filter((v) => v.regra.startsWith('GATE-'))
  if (doGate.length) throw new Error(`Corrija antes as violações do próprio gate (${[...new Set(doGate.map((v) => v.regra))].join(', ')}).`)
  if (!resultado.violacoes.length) throw new Error('Projeto já está CONFORME: não há o que adequar.')
  gravarAdequacao(caminho, resultado, new Date().toISOString().slice(0, 10))
  return resultado.violacoes.length
}

export function atualizarAdequacao(raiz, resultado) {
  const caminho = join(raiz, ARQUIVO_ADEQUACAO)
  const atual = lerAdequacao(raiz)
  if (!atual || atual.invalido) throw new Error('Não há adequação válida em andamento.')
  if (resultado.novas.length) throw new Error(`Há ${resultado.novas.length} violação(ões) nova(s): corrija antes de atualizar a lista.`)
  const atuais = new Set(resultado.violacoes.map((v) => v.impressao))
  const itens = atual.itens.filter((i) => atuais.has(i.impressao))
  writeFileSync(caminho, `${JSON.stringify({ ...atual, atualizadaEm: new Date().toISOString().slice(0, 10), itens }, null, 2)}\n`)
  return { antes: atual.itens.length, depois: itens.length }
}

function gravarAdequacao(caminho, resultado, data) {
  const itens = resultado.violacoes.map(({ regra, arquivo, linha, trecho, impressao }) => ({ regra, arquivo, linha, trecho, impressao }))
  writeFileSync(caminho, `${JSON.stringify({ versaoDoPadrao: resultado.versao, iniciadaEm: data, itens }, null, 2)}\n`)
}
