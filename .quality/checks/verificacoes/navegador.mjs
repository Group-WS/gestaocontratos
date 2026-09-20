// NAV-03 · NAV-04

import { importsDe } from '../lib/arquivos.mjs'
import { varrerLinhas } from '../lib/contexto.mjs'

const DOC = '04-dados-no-navegador.md'

const RE_STORAGE =
  /\b(?:localStorage|sessionStorage|indexedDB)\b|\bdocument\.cookie\b|\bcaches\.(?:open|match|delete|keys|has)\s*\(|\bcreateJSONStorage\b|\bpersistQueryClient\b|\bPersistQueryClientProvider\b|\bcookies\(\)\s*\)?\s*\.set\s*\(|\.cookies\.set\s*\(/
const PACOTES_DE_PERSISTENCIA = ['idb-keyval', 'localforage', 'dexie', 'js-cookie', 'universal-cookie', 'react-cookie', 'cookies-next', '@tanstack/query-sync-storage-persister', '@tanstack/query-async-storage-persister', '@tanstack/react-query-persist-client']

function chavesDoWrapper(conteudo) {
  const inicio = conteudo.search(/\bALLOWED_KEYS\b[^=]*=\s*\{/)
  if (inicio === -1) return null
  const abre = conteudo.indexOf('{', inicio)
  let profundidade = 0
  let fim = abre
  for (let i = abre; i < conteudo.length; i++) {
    if (conteudo[i] === '{') profundidade++
    else if (conteudo[i] === '}' && --profundidade === 0) {
      fim = i
      break
    }
  }
  const corpo = conteudo.slice(abre + 1, fim)
  const chaves = []
  let profundidadeCorpo = 0
  for (const m of corpo.matchAll(/[{}]|(['"])([^'"]+)\1\s*:/g)) {
    if (m[0] === '{') profundidadeCorpo++
    else if (m[0] === '}') profundidadeCorpo--
    else if (profundidadeCorpo === 0) chaves.push(m[2])
  }
  return chaves
}

export default [
  {
    id: 'NAV-03',
    titulo: 'Acesso ao navegador só pelo wrapper',
    doc: DOC,
    correcao: 'Grave pelo wrapper (`readCache`/`writeCache`) com a chave declarada no manifesto — e só se for sessão ou cache. Configuração e dado vão para o banco.',
    executar(ctx) {
      const { wrapper, arquivosDeSessao } = ctx.manifesto.navegador
      const arquivos = ctx
        .codigo({ areas: ['frontend'] })
        .filter((rel) => rel !== wrapper && !ctx.casaGlob(rel, arquivosDeSessao))
      const violacoes = varrerLinhas(ctx, arquivos, 'NAV-03', RE_STORAGE, {
        mensagem: (m) => `acesso direto: ${m[0].trim()}`,
      })
      for (const rel of arquivos) {
        const conteudo = ctx.ler(rel)
        for (const { especificador, linha } of importsDe(conteudo)) {
          const persistencia =
            PACOTES_DE_PERSISTENCIA.includes(especificador) ||
            (especificador === 'zustand/middleware' && /\bpersist\s*\(/.test(conteudo))
          if (!persistencia || ctx.escapado(rel, linha - 1, 'NAV-03')) continue
          violacoes.push({ arquivo: rel, linha, trecho: ctx.linhas(rel)[linha - 1].trim(), mensagem: `persistência via ${especificador}` })
        }
      }
      return violacoes
    },
  },
  {
    id: 'NAV-04',
    titulo: 'Toda chave do navegador declarada no manifesto',
    doc: DOC,
    correcao: 'Cada chave de `ALLOWED_KEYS` do wrapper precisa estar em `navegador.permitidos` (tipo, motivo, fonteDaVerdade, validade), e vice-versa.',
    executar(ctx) {
      const { wrapper, permitidos } = ctx.manifesto.navegador
      const violacoes = []
      const manifesto = '.quality/manifest.json'

      permitidos.forEach((item, i) => {
        const faltando = []
        if (!item?.chave) faltando.push('chave')
        if (!['sessao', 'cache'].includes(item?.tipo)) faltando.push('tipo (sessao | cache)')
        if (!item?.motivo) faltando.push('motivo')
        if (item?.tipo === 'cache' && !item?.fonteDaVerdade) faltando.push('fonteDaVerdade')
        if (item?.tipo === 'cache' && !item?.validade) faltando.push('validade')
        if (faltando.length) {
          violacoes.push({ arquivo: manifesto, linha: 1, trecho: `navegador.permitidos[${i}] (${item?.chave ?? 'sem chave'})`, mensagem: `faltando: ${faltando.join(', ')}` })
        }
      })

      const declaradasCache = permitidos.filter((p) => p?.tipo === 'cache').map((p) => p.chave)
      if (!wrapper) {
        if (declaradasCache.length) {
          violacoes.push({ arquivo: manifesto, linha: 1, trecho: 'há chaves de cache declaradas, mas `navegador.wrapper` é null' })
        }
        return violacoes
      }
      if (!ctx.existe(wrapper)) {
        if (declaradasCache.length) violacoes.push({ arquivo: manifesto, linha: 1, trecho: `wrapper ${wrapper} não existe` })
        return violacoes
      }
      const chaves = chavesDoWrapper(ctx.ler(wrapper))
      if (chaves === null) {
        violacoes.push({ arquivo: wrapper, linha: 1, trecho: 'wrapper sem `ALLOWED_KEYS` (molde em 04-dados-no-navegador.md)' })
        return violacoes
      }
      const linhas = ctx.linhas(wrapper)
      for (const chave of chaves) {
        if (declaradasCache.includes(chave)) continue
        const i = Math.max(0, linhas.findIndex((l) => l.includes(`'${chave}'`) || l.includes(`"${chave}"`)))
        violacoes.push({ arquivo: wrapper, linha: i + 1, trecho: linhas[i].trim(), mensagem: `chave '${chave}' não declarada como cache no manifesto` })
      }
      for (const chave of declaradasCache) {
        if (!chaves.includes(chave)) violacoes.push({ arquivo: manifesto, linha: 1, trecho: `chave de cache '${chave}' declarada no manifesto e ausente do wrapper` })
      }
      return violacoes
    },
  },
]
