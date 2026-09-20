// NX-02 · NX-03 · NX-05 · NX-06 · NX-07 · NX-09 · NX-16

import { importsDe, posix, temDiretivaDeArquivo } from '../lib/arquivos.mjs'
import { varrerLinhas } from '../lib/contexto.mjs'

const DOC = 'perfis/nextjs.md'
const PERFIS = ['nextjs']
const PACOTES_ANTIGOS = ['@supabase/auth-helpers-nextjs', '@supabase/auth-helpers-react', '@supabase/auth-helpers-shared']
const METODOS_HTTP = 'GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS'

/** Blocos de cada export (do `export` até o próximo `export` de nível superior). */
function blocosExportados(conteudo, reNome) {
  const linhas = conteudo.split('\n')
  const inicios = []
  linhas.forEach((linha, i) => {
    if (/^export\s/.test(linha)) {
      const m = reNome.exec(linha)
      inicios.push({ i, nome: m ? (m[1] ?? m[2] ?? null) : null })
    }
  })
  return inicios
    .map((inicio, k) => ({
      ...inicio,
      corpo: linhas.slice(inicio.i, k + 1 < inicios.length ? inicios[k + 1].i : linhas.length).join('\n'),
    }))
    .filter((b) => b.nome)
}

const servidor = (ctx) => ctx.codigo({ areas: ['api'] }).filter((rel) => !ctx.ehCliente(rel))

export default [
  {
    id: 'NX-02',
    titulo: '@supabase/ssr, nunca os pacotes antigos',
    doc: DOC,
    perfis: PERFIS,
    correcao: 'Migre para `@supabase/ssr` (clients em `lib/supabase/`) e remova os `auth-helpers`.',
    executar(ctx) {
      const violacoes = []
      for (const rel of ctx.todos.filter((r) => posix.basename(r) === 'package.json')) {
        try {
          const pkg = JSON.parse(ctx.ler(rel))
          for (const nome of PACOTES_ANTIGOS) {
            if (pkg.dependencies?.[nome] || pkg.devDependencies?.[nome]) violacoes.push({ arquivo: rel, linha: 1, trecho: `${nome} nas dependências` })
          }
        } catch {}
      }
      for (const rel of ctx.codigo({ areas: ['frontend', 'api'] })) {
        for (const { especificador, linha } of importsDe(ctx.ler(rel))) {
          if (PACOTES_ANTIGOS.includes(especificador)) violacoes.push({ arquivo: rel, linha, trecho: ctx.linhas(rel)[linha - 1].trim() })
        }
      }
      return violacoes
    },
  },
  {
    id: 'NX-03',
    titulo: 'Servidor não usa getSession()',
    doc: DOC,
    perfis: PERFIS,
    correcao: 'Use `supabase.auth.getClaims()` (ou `getUser()` em operação sensível) no servidor.',
    executar: (ctx) => varrerLinhas(ctx, servidor(ctx), 'NX-03', /\.auth\s*\.\s*getSession\s*\(/),
  },
  {
    id: 'NX-05',
    titulo: 'Toda Server Action autenticada',
    doc: DOC,
    perfis: PERFIS,
    correcao: 'Chame o helper de autenticação (ex.: `await requireUser()`) no início de cada Server Action exportada.',
    executar(ctx) {
      const helpers = ctx.manifesto.seguranca.helpersDeAutenticacao
      const chamada = new RegExp(String.raw`\b(?:${helpers.join('|')})\s*\(`)
      const violacoes = []
      for (const rel of ctx.codigo({ areas: ['api'] })) {
        const conteudo = ctx.ler(rel)
        if (!temDiretivaDeArquivo(conteudo, 'server')) continue
        const blocos = blocosExportados(conteudo, /^export\s+(?:default\s+)?(?:async\s+function\s+(\w+)|const\s+(\w+)\s*=\s*async\b)/)
        for (const bloco of blocos) {
          if (chamada.test(bloco.corpo) || ctx.escapado(rel, bloco.i, 'NX-05')) continue
          violacoes.push({ arquivo: rel, linha: bloco.i + 1, trecho: conteudo.split('\n')[bloco.i].trim(), mensagem: `Server Action ${bloco.nome} sem ${helpers.join('/')}` })
        }
      }
      return violacoes
    },
  },
  {
    id: 'NX-06',
    titulo: 'Todo Route Handler autenticado',
    doc: DOC,
    perfis: PERFIS,
    correcao: 'Chame o helper de autenticação em cada método exportado ou declare o arquivo em `seguranca.rotasPublicas` (webhook assinado, cron com CRON_SECRET).',
    executar(ctx) {
      const helpers = ctx.manifesto.seguranca.helpersDeAutenticacao
      const chamada = new RegExp(String.raw`\b(?:${helpers.join('|')})\s*\(`)
      const violacoes = []
      const rotas = ctx
        .codigo({ areas: ['api'] })
        .filter((rel) => /(^|\/)app\/(.+\/)?route\.[jt]s$/.test(rel) && !ctx.manifesto.seguranca.rotasPublicas.includes(rel))
      for (const rel of rotas) {
        const conteudo = ctx.ler(rel)
        const re = new RegExp(String.raw`^export\s+(?:async\s+function\s+(${METODOS_HTTP})\b|const\s+(${METODOS_HTTP})\s*=)`)
        const blocos = blocosExportados(conteudo, { exec: (linha) => { const m = re.exec(linha); return m ? [m[0], m[1] ?? m[2]] : null } })
        for (const bloco of blocos) {
          if (chamada.test(bloco.corpo) || ctx.escapado(rel, bloco.i, 'NX-06')) continue
          violacoes.push({ arquivo: rel, linha: bloco.i + 1, trecho: conteudo.split('\n')[bloco.i].trim(), mensagem: `${bloco.nome} sem ${helpers.join('/')}` })
        }
      }
      return violacoes
    },
  },
  {
    id: 'NX-07',
    titulo: "Segredo só em módulo 'server-only'",
    doc: DOC,
    perfis: PERFIS,
    correcao: "Adicione `import 'server-only'` no topo do módulo (separe as variáveis públicas num env.client.ts, se preciso).",
    executar(ctx) {
      const violacoes = []
      const nomes = ctx.manifesto.seguranca.clientesAdministrativos
      const reSegredo = new RegExp(
        String.raw`\b(?:SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY|CRON_SECRET)\b|\bprocess\.env\.(?!NEXT_PUBLIC_)[A-Z0-9_]*(?:SECRET|TOKEN|PRIVATE|PASSWORD)|\b(?:function|const)\s+(?:${nomes.join('|')})\b`,
      )
      for (const rel of servidor(ctx)) {
        const conteudo = ctx.ler(rel)
        if (/(^|\/)(?:route|proxy|middleware|instrumentation)\.[jt]s$/.test(rel) || temDiretivaDeArquivo(conteudo, 'server')) continue
        if (/import\s+['"]server-only['"]/.test(conteudo)) continue
        const i = conteudo.split('\n').findIndex((l) => reSegredo.test(l) && !/^\s*(\/\/|\*)/.test(l))
        if (i === -1 || ctx.escapado(rel, i, 'NX-07')) continue
        violacoes.push({ arquivo: rel, linha: i + 1, trecho: ctx.linhas(rel)[i].trim() })
      }
      return violacoes
    },
  },
  {
    id: 'NX-09',
    titulo: 'Design system pela fronteira client',
    doc: DOC,
    perfis: PERFIS,
    correcao: "Importe os componentes do DS pelo arquivo de fronteira (`'use client'` + reexportações nomeadas), não direto num Server Component.",
    executar(ctx) {
      const { pacote, fronteiraCliente } = ctx.manifesto.designSystem
      const violacoes = []
      for (const rel of ctx.codigo({ areas: ['frontend'] })) {
        if (rel === fronteiraCliente || ctx.ehCliente(rel)) continue
        for (const { especificador, linha } of importsDe(ctx.ler(rel))) {
          if (especificador !== pacote || ctx.escapado(rel, linha - 1, 'NX-09')) continue
          violacoes.push({ arquivo: rel, linha, trecho: ctx.linhas(rel)[linha - 1].trim(), mensagem: 'import do DS fora de arquivo client' })
        }
      }
      if (fronteiraCliente && ctx.existe(fronteiraCliente)) {
        const conteudo = ctx.ler(fronteiraCliente)
        if (!temDiretivaDeArquivo(conteudo, 'client')) {
          violacoes.push({ arquivo: fronteiraCliente, linha: 1, trecho: "fronteira do DS sem 'use client'" })
        }
        violacoes.push(
          ...varrerLinhas(ctx, [fronteiraCliente], 'NX-09', /^\s*export\s*\*\s*from\b/, { mensagem: '`export *` não é suportado em fronteira client' }),
        )
      }
      return violacoes
    },
  },
  {
    id: 'NX-16',
    titulo: 'Imagem pelo next/image',
    doc: DOC,
    perfis: PERFIS,
    correcao: 'Use `<Image>` de `next/image` com largura e altura.',
    executar: (ctx) => varrerLinhas(ctx, ctx.codigo({ areas: ['frontend'], extensoes: new Set(['.tsx', '.jsx']) }), 'NX-16', /<img(?=[\s>/])/),
  },
]
