// VH-02 · VH-05 · VH-06

import { varrerLinhas } from '../lib/contexto.mjs'

const DOC = 'perfis/webapp-vite-hono.md'
const PERFIS = ['webapp-vite-hono']

const arquivosDeRota = (ctx) =>
  ctx
    .codigo({ areas: ['api'] })
    .filter((rel) => ctx.dentroDe(rel, ctx.manifesto.seguranca.pastasDeRotas) && !ctx.manifesto.seguranca.rotasPublicas.includes(rel))

export default [
  {
    id: 'VH-02',
    titulo: 'O front não acessa dados do Supabase',
    doc: DOC,
    perfis: PERFIS,
    correcao: 'Busque e grave pela API (hook com TanStack Query + `lib/api.ts`). No front, o Supabase é só `supabase.auth.*`.',
    executar(ctx) {
      const violacoes = []
      const re = /\bsupabase\s*\.\s*(from|rpc|storage|channel|schema)\b/
      for (const rel of ctx.codigo({ areas: ['frontend'] })) {
        const linhas = ctx.linhas(rel)
        linhas.forEach((linha, i) => {
          const t = linha.trim()
          if (t.startsWith('//') || t.startsWith('*')) return
          const encadeado = /^\.\s*(from|rpc|storage|channel|schema)\b/.test(t) && /\bsupabase\s*$/.test((linhas[i - 1] ?? '').trim())
          if ((re.test(linha) || encadeado) && !ctx.escapado(rel, i, 'VH-02')) {
            violacoes.push({ arquivo: rel, linha: i + 1, trecho: t })
          }
        })
      }
      return violacoes
    },
  },
  {
    id: 'VH-05',
    titulo: 'Toda rota da API autenticada',
    doc: DOC,
    perfis: PERFIS,
    correcao: "Aplique o helper de autenticação no arquivo da rota (`.use('*', requireAuth)`) ou declare a rota em `seguranca.rotasPublicas`.",
    executar(ctx) {
      const helpers = ctx.manifesto.seguranca.helpersDeAutenticacao
      const uso = new RegExp(String.raw`\b(?:${helpers.join('|')})\b`)
      const violacoes = []
      for (const rel of arquivosDeRota(ctx)) {
        const linhas = ctx.linhas(rel)
        const temRota = linhas.some((l) => /\.(?:get|post|put|patch|delete|all|on)\s*\(/.test(l))
        if (!temRota) continue
        const autentica = linhas.some((l) => uso.test(l) && !/^\s*import\b/.test(l))
        if (autentica || ctx.escapado(rel, 0, 'VH-05')) continue
        const i = linhas.findIndex((l) => /\.(?:get|post|put|patch|delete|all|on)\s*\(/.test(l))
        violacoes.push({ arquivo: rel, linha: i + 1, trecho: linhas[i].trim(), mensagem: `nenhum de ${helpers.join(', ')} aplicado` })
      }
      return violacoes
    },
  },
  {
    id: 'VH-06',
    titulo: 'Escrita validada com schema',
    doc: DOC,
    perfis: PERFIS,
    correcao: "Valide o corpo com `zValidator('json', schema)` usando o schema de `@repo/shared`.",
    executar(ctx) {
      const violacoes = []
      for (const rel of arquivosDeRota(ctx)) {
        const conteudo = ctx.ler(rel)
        if (/zValidator\s*\(\s*['"](?:json|form)['"]/.test(conteudo)) continue
        violacoes.push(...varrerLinhas(ctx, [rel], 'VH-06', /\.(?:post|put|patch)\s*\(/))
      }
      return violacoes
    },
  },
]
