// NEG-01 · NEG-02 · NEG-03 · NEG-06 · NEG-09

import { EXTENSOES_CODIGO, extname, importsDe, posix, resolverImport } from '../lib/arquivos.mjs'
import { refDeComparacao } from '../lib/comparacao.mjs'

const DOC = '02-regras-de-negocio.md'
const RE_ID = /\bRN-(\d{3})\b/g

const IMPORTS_PROIBIDOS = [
  /^react(?:-dom)?(?:\/|$)/, /^next(?:\/|$)/, /^hono(?:\/|$)/, /^@hono\//, /^@supabase\//, /^@tanstack\//,
  /^axios$/, /^ky$/, /^ofetch$/, /^node:/, /^(?:fs|path|http|https|child_process|net|os|crypto)$/,
  /^@vercel\//, /^zustand(?:\/|$)/, /^swr$/,
]
const USOS_PROIBIDOS = [
  { re: /\bprocess\.env\b/, nome: 'process.env' },
  { re: /(?<![\w.])fetch\s*\(/, nome: 'fetch' },
  { re: /\bwindow\./, nome: 'window' },
  { re: /\bdocument\./, nome: 'document' },
  { re: /\b(?:localStorage|sessionStorage|indexedDB)\b/, nome: 'storage do navegador' },
  { re: /\bnew\s+Date\(\s*\)/, nome: 'new Date() sem argumento (receba `now` por parâmetro)' },
  { re: /\bDate\.now\(\s*\)/, nome: 'Date.now() (receba `now` por parâmetro)' },
  { re: /\bMath\.random\(\s*\)/, nome: 'Math.random()' },
]

const ehArquivoDeRegra = (rel) =>
  EXTENSOES_CODIGO.has(extname(rel)) && !rel.endsWith('.d.ts') && !/\.(test|spec)\.[cm]?[jt]sx?$/.test(rel) && !/(^|\/)__tests__\//.test(rel)
const ehApoio = (rel) => /^(index|types)\.[cm]?[jt]sx?$/.test(posix.basename(rel))

function catalogo(ctx) {
  const pasta = ctx.manifesto.caminhos.catalogoDeRegras.replace(/\/+$/, '')
  const fichas = new Map()
  for (const rel of ctx.todos) {
    if (!rel.startsWith(`${pasta}/`)) continue
    const m = /^RN-(\d{3})-[^/]+\.md$/.exec(posix.basename(rel))
    if (m) fichas.set(`RN-${m[1]}`, rel)
  }
  return { pasta, fichas }
}

const idsEm = (texto) => new Set([...texto.matchAll(RE_ID)].map((m) => `RN-${m[1]}`))

export default [
  {
    id: 'NEG-01',
    titulo: 'Regras de negócio numa camada pura',
    doc: DOC,
    correcao: 'Tire I/O e framework da regra: ela recebe dados (inclusive `now`) e devolve decisão. Quem busca e grava é o fluxo.',
    executar(ctx) {
      const pastas = ctx.manifesto.caminhos.regrasDeNegocio
      const violacoes = []
      for (const rel of ctx.codigo({ areas: ['regras'] })) {
        const conteudo = ctx.ler(rel)
        const linhas = conteudo.split('\n')
        for (const { especificador, linha } of importsDe(conteudo)) {
          let problema = null
          if (IMPORTS_PROIBIDOS.some((re) => re.test(especificador))) problema = `import de ${especificador}`
          else if (especificador.startsWith('.') || especificador.startsWith('@/')) {
            const destino = resolverImport(rel, especificador, { existe: ctx.existe, aliasRaiz: ctx.manifesto.designSystem.aliasRaiz })
            if (destino && !ctx.dentroDe(destino, pastas) && !/(^|\/)(types?|schemas?)(\/|\.|$)|\.types\.[jt]s$/.test(destino)) {
              problema = `import de fora da camada de regras: ${destino}`
            }
          }
          if (problema && !ctx.escapado(rel, linha - 1, 'NEG-01')) {
            violacoes.push({ arquivo: rel, linha, trecho: linhas[linha - 1].trim(), mensagem: problema })
          }
        }
        linhas.forEach((linha, i) => {
          const t = linha.trim()
          if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return
          const uso = USOS_PROIBIDOS.find(({ re }) => re.test(linha))
          if (uso && !ctx.escapado(rel, i, 'NEG-01')) violacoes.push({ arquivo: rel, linha: i + 1, trecho: t, mensagem: uso.nome })
        })
      }
      return violacoes
    },
  },
  {
    id: 'NEG-02',
    titulo: 'Toda regra tem ficha e o código cita o ID',
    doc: DOC,
    correcao: 'Cite o ID na regra (`/** RN-012 — … */`) e crie a ficha `RN-012-titulo.md` no catálogo a partir do `_template.md`.',
    executar(ctx) {
      const { pasta, fichas } = catalogo(ctx)
      const violacoes = []
      if (!ctx.todos.some((rel) => rel.startsWith(`${pasta}/`))) {
        violacoes.push({ arquivo: pasta, linha: 1, trecho: 'catálogo de regras de negócio não existe (README.md + _template.md)' })
      }
      const arquivos = ctx.todos.filter(
        (rel) => ctx.dentroDe(rel, ctx.manifesto.caminhos.regrasDeNegocio) && EXTENSOES_CODIGO.has(extname(rel)),
      )
      for (const rel of arquivos) {
        const conteudo = ctx.ler(rel)
        const ids = idsEm(conteudo)
        if (ehArquivoDeRegra(rel) && !ehApoio(rel) && ids.size === 0 && !ctx.escapado(rel, 0, 'NEG-02')) {
          violacoes.push({ arquivo: rel, linha: 1, trecho: 'arquivo de regra sem ID RN-NNN' })
        }
        for (const id of ids) {
          if (fichas.has(id)) continue
          const i = conteudo.split('\n').findIndex((l) => l.includes(id))
          if (!ctx.escapado(rel, i, 'NEG-02')) {
            violacoes.push({ arquivo: rel, linha: i + 1, trecho: ctx.linhas(rel)[i].trim(), mensagem: `${id} não tem ficha em ${pasta}` })
          }
        }
      }
      return violacoes
    },
  },
  {
    id: 'NEG-03',
    titulo: 'Toda regra tem teste unitário',
    doc: DOC,
    correcao: 'Crie `<arquivo>.test.ts` ao lado (ou em `__tests__/`) cobrindo os exemplos da ficha, com o ID no nome do teste.',
    executar(ctx) {
      const violacoes = []
      const existentes = new Set(ctx.todos)
      for (const rel of ctx.codigo({ areas: ['regras'] })) {
        if (!ehArquivoDeRegra(rel) || ehApoio(rel)) continue
        const dir = posix.dirname(rel)
        const ext = extname(rel)
        const base = posix.basename(rel, ext)
        const candidatos = ['test', 'spec'].flatMap((tipo) =>
          ['.ts', '.tsx', '.js', '.mjs', ext].flatMap((e) => [`${dir}/${base}.${tipo}${e}`, `${dir}/__tests__/${base}.${tipo}${e}`]),
        )
        if (candidatos.some((c) => existentes.has(c)) || ctx.escapado(rel, 0, 'NEG-03')) continue
        violacoes.push({ arquivo: rel, linha: 1, trecho: `sem ${base}.test${ext}` })
      }
      return violacoes
    },
  },
  {
    id: 'NEG-06',
    titulo: 'Mudar regra exige atualizar a ficha',
    doc: DOC,
    correcao: 'Atualize a ficha de cada RN afetada (enunciado, exemplos e uma linha nova em Histórico com data e quem aprovou) no mesmo commit/PR. Se a mudança não foi pedida, desfaça.',
    executar(ctx) {
      const comparacao = refDeComparacao(ctx, { paraRegrasDeNegocio: true })
      if (!comparacao) {
        ctx.avisos.push('NEG-06 não verificada: sem histórico git para comparar.')
        return []
      }
      const { pasta, fichas } = catalogo(ctx)
      const mudancasNasRegras = (ctx.git.alterados({ ...comparacao, caminhos: ctx.manifesto.caminhos.regrasDeNegocio }) ?? [])
        .filter((a) => ['M', 'D', 'R'].includes(a.status) && EXTENSOES_CODIGO.has(extname(a.caminhoAntigo)))
      if (!mudancasNasRegras.length) return []
      const fichasAlteradas = new Set(
        (ctx.git.alterados({ ...comparacao, caminhos: [pasta] }) ?? []).map((a) => posix.basename(a.caminho).slice(0, 6)),
      )
      const violacoes = []
      for (const mudanca of mudancasNasRegras) {
        const antes = ctx.git.mostrar(comparacao.ref, mudanca.caminhoAntigo) ?? ''
        const depois = mudanca.status === 'D' ? '' : ctx.ler(mudanca.caminho)
        const ids = new Set([...idsEm(antes), ...idsEm(depois)])
        if (!ids.size) {
          violacoes.push({ arquivo: mudanca.caminho, linha: 1, trecho: 'arquivo de regra alterado sem ID RN-NNN para rastrear' })
          continue
        }
        const semFicha = [...ids].filter((id) => !fichasAlteradas.has(id))
        if (semFicha.length) {
          violacoes.push({
            arquivo: mudanca.caminho,
            linha: 1,
            trecho: `alterado (${{ M: 'modificado', D: 'removido', R: 'renomeado' }[mudanca.status]}) sem atualizar a ficha: ${semFicha.map((id) => fichas.get(id) ?? id).join(', ')}`,
          })
        }
      }
      return violacoes
    },
  },
  {
    id: 'NEG-09',
    titulo: 'Ficha de regra completa',
    doc: DOC,
    correcao: 'Siga o `_template.md`: título com o ID, `Status:` (proposta | vigente | revogada) e as seções Enunciado, Exemplos, Implementação e Histórico, com caminhos que existem.',
    executar(ctx) {
      const { fichas } = catalogo(ctx)
      const violacoes = []
      for (const [id, rel] of fichas) {
        const conteudo = ctx.ler(rel)
        const problemas = []
        if (!new RegExp(`^#\\s+${id}\\b`, 'm').test(conteudo)) problemas.push(`título "# ${id} · …"`)
        if (!/^\s*[-*]?\s*\**Status:?\**:?\s*\**\s*(proposta|vigente|revogada)\b/im.test(conteudo)) problemas.push('Status (proposta | vigente | revogada)')
        for (const secao of ['Enunciado', 'Exemplos', 'Implementação', 'Histórico']) {
          if (!new RegExp(`^##\\s+${secao}\\b`, 'm').test(conteudo)) problemas.push(`seção "## ${secao}"`)
        }
        if (problemas.length) violacoes.push({ arquivo: rel, linha: 1, trecho: `faltando: ${problemas.join(', ')}` })

        const implementacao = /^##\s+Implementação\b([\s\S]*?)(?=^##\s|$(?![\s\S]))/m.exec(conteudo)
        if (implementacao) {
          const inicio = conteudo.slice(0, implementacao.index).split('\n').length
          implementacao[1].split('\n').forEach((linha, i) => {
            for (const [, caminho] of linha.matchAll(/`([\w./@-]+\/[\w.@-]+\.[a-z]{2,4})(?::\d+)?`/g)) {
              if (!ctx.existe(caminho)) violacoes.push({ arquivo: rel, linha: inicio + i, trecho: linha.trim(), mensagem: `${caminho} não existe` })
            }
          })
        }
      }
      return violacoes
    },
  },
]
