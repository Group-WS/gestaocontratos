// SEG-02 · SEG-15 · SEG-20 · SEG-21 · SEG-22 · SEG-31 · SEG-32 · SEG-33 · SEG-36 · SEG-41

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { posix } from '../lib/arquivos.mjs'
import { varrerLinhas } from '../lib/contexto.mjs'

const DOC = '03-seguranca-e-acesso.md'
const AQUI = dirname(fileURLToPath(import.meta.url))

const RE_NOME_SECRETO = /(?:SECRET|SERVICE_ROLE|PRIVATE|PASSWORD)/
const RE_SEGREDOS = [
  { nome: 'chave secreta do Supabase', re: /\bsb_secret_([A-Za-z0-9_-]{20,})/, valor: 1 },
  { nome: 'chave privada', re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----/ },
  { nome: 'token do GitHub', re: /\b(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{50,})\b/ },
  { nome: 'chave de produção do Stripe', re: /\b[rs]k_live_[A-Za-z0-9]{20,}\b/ },
  { nome: 'chave de acesso da AWS', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { nome: 'token do Slack', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
]
/** Valor de exemplo (`sb_secret_xxxxxxxx…`): poucos caracteres distintos ou palavra de placeholder. */
const ehPlaceholder = (valor) =>
  new Set(valor).size < 8 || /^(?:x+|your|seu|sua|example|exemplo|placeholder|changeme|replace)/i.test(valor)
const RE_JWT = /\beyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g

/** Código que roda no servidor: pastas de API (Vite+Hono) ou arquivos de servidor (Next.js). */
export function codigoDeServidor(ctx) {
  if (ctx.manifesto.perfil === 'webapp-vite-hono') return ctx.codigo({ areas: ['api'] })
  return ctx.codigo({ areas: ['api'] }).filter((rel) => !ctx.ehCliente(rel))
}

function versaoMinimaViolada(versao, regras) {
  const [maior, menor] = versao.split('.').map(Number)
  const comparar = (a, b) => {
    const pa = a.split('.').map(Number)
    const pb = b.split('.').map(Number)
    for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
    return 0
  }
  for (const regra of regras) {
    const faixa = regra.faixa
    if (faixa.startsWith('<')) {
      if (maior < Number(faixa.slice(1))) return regra
      continue
    }
    const [fMaior, fMenor] = faixa.split('.').map(Number)
    if (fMaior !== maior || (fMenor !== undefined && fMenor !== menor)) continue
    if (regra.bloquear || comparar(versao, regra.minima) < 0) return regra
  }
  return null
}

function versoesInstaladas(ctx, pacote) {
  const versoes = new Map() // versão → arquivo onde apareceu
  const escapar = pacote.replace(/[/.]/g, '\\$&')
  for (const rel of ctx.todos) {
    const nome = posix.basename(rel)
    if (nome === 'pnpm-lock.yaml') {
      // `(?<!@[\w-]+)/` evita casar `@types/react@…` quando o pacote é `react`.
      for (const m of ctx.ler(rel).matchAll(new RegExp(String.raw`(?:^|[\s'"]|(?<!@[\w-]+)/)${escapar}@(\d+\.\d+\.\d+)`, 'gm'))) versoes.set(m[1], rel)
    } else if (nome === 'package-lock.json') {
      try {
        const lock = JSON.parse(ctx.ler(rel))
        for (const [caminho, info] of Object.entries(lock.packages ?? {})) {
          if (caminho.endsWith(`node_modules/${pacote}`) && info.version) versoes.set(info.version, rel)
        }
      } catch {}
    } else if (nome === 'yarn.lock') {
      for (const m of ctx.ler(rel).matchAll(new RegExp(String.raw`^"?${escapar}@[^\n]*:\n\s+version:? "?(\d+\.\d+\.\d+)`, 'gm'))) versoes.set(m[1], rel)
    }
  }
  if (versoes.size) return versoes
  for (const rel of ctx.todos.filter((r) => posix.basename(r) === 'package.json')) {
    try {
      const pkg = JSON.parse(ctx.ler(rel))
      const faixa = pkg.dependencies?.[pacote] ?? pkg.devDependencies?.[pacote]
      const m = /(\d+\.\d+\.\d+)/.exec(faixa ?? '')
      if (m) versoes.set(m[1], rel)
    } catch {}
  }
  return versoes
}

export default [
  {
    id: 'SEG-02',
    titulo: 'Servidor verifica o token (sem getSession)',
    doc: DOC,
    correcao: 'No servidor, use `supabase.auth.getClaims()` ou `getUser()`; `getSession()` não verifica o token.',
    perfis: ['webapp-vite-hono'],
    executar: (ctx) => varrerLinhas(ctx, codigoDeServidor(ctx), 'SEG-02', /\.auth\s*\.\s*getSession\s*\(/),
  },
  {
    id: 'SEG-15',
    titulo: 'Cliente administrativo sob controle',
    doc: DOC,
    correcao: 'Use o client do usuário (RLS). Se o client administrativo for indispensável, faça a checagem de autorização antes e registre `gate-allow SEG-15: motivo`.',
    executar(ctx) {
      const nomes = ctx.manifesto.seguranca.clientesAdministrativos
      if (!nomes.length) return []
      const chamada = new RegExp(String.raw`\b(${nomes.join('|')})\s*\(`)
      const definicao = new RegExp(String.raw`\b(?:function|const|let)\s+(?:${nomes.join('|')})\b`)
      const arquivos = ctx
        .codigo({ areas: ['frontend', 'api'] })
        .filter((rel) => !definicao.test(ctx.ler(rel)))
      return varrerLinhas(ctx, [...new Set(arquivos)], 'SEG-15', chamada, {
        filtro: (linha) => !/^\s*(?:import|export)\b/.test(linha),
      })
    },
  },
  {
    id: 'SEG-20',
    titulo: 'Nenhuma chave secreta no front',
    doc: DOC,
    correcao: 'O front só conhece a URL do Supabase e a publishable key. Segredo fica em variável sem prefixo público, lida em código de servidor.',
    executar(ctx) {
      const violacoes = []
      const perfil = ctx.manifesto.perfil
      const front =
        perfil === 'nextjs'
          ? ctx.codigo({ areas: ['frontend'] }).filter((rel) => ctx.ehCliente(rel))
          : ctx.codigo({ areas: ['frontend'] })
      violacoes.push(
        ...varrerLinhas(ctx, front, 'SEG-20', /\b(?:SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY)\b|\bsb_secret_/),
      )
      const rePublica = new RegExp(String.raw`\b(?:VITE|NEXT_PUBLIC)_[A-Z0-9_]*${RE_NOME_SECRETO.source}[A-Z0-9_]*\b`)
      violacoes.push(...varrerLinhas(ctx, ctx.codigo({ areas: ['frontend', 'api'] }), 'SEG-20', rePublica))
      for (const rel of ctx.todos.filter((r) => /(^|\/)\.env[^/]*$/.test(r))) {
        ctx.linhas(rel).forEach((linha, i) => {
          if (rePublica.test(linha.split('=')[0]) && !ctx.escapado(rel, i, 'SEG-20')) {
            violacoes.push({ arquivo: rel, linha: i + 1, trecho: linha.split('=')[0].trim() })
          }
        })
      }
      return violacoes
    },
  },
  {
    id: 'SEG-21',
    titulo: 'Nenhum .env versionado',
    doc: DOC,
    correcao: 'Remova do git (`git rm --cached <arquivo>`), inclua no .gitignore e **rotacione** as chaves que estavam nele.',
    executar(ctx) {
      const versionados = ctx.git.versionados()
      if (!versionados) {
        ctx.avisos.push('SEG-21 não verificada: git indisponível.')
        return []
      }
      return versionados
        .filter((rel) => /(^|\/)\.env(\.[^/]*)?$/.test(rel) && !/\.(example|sample|template)$/.test(rel))
        .map((rel) => ({ arquivo: rel, linha: 1, trecho: 'arquivo de ambiente versionado' }))
    },
  },
  {
    id: 'SEG-22',
    titulo: 'Nenhum segredo literal no repositório',
    doc: DOC,
    correcao: 'Tire o segredo do arquivo, leia de variável de ambiente e **rotacione a chave**: o que entrou no histórico do git está vazado.',
    executar(ctx) {
      const versionados = new Set(ctx.git.versionados() ?? ctx.todos)
      const violacoes = []
      for (const rel of ctx.todos) {
        if (!versionados.has(rel) || /(?:^|\/)(?:pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/.test(rel)) continue
        ctx.linhas(rel).forEach((linha, i) => {
          for (const { nome, re, valor } of RE_SEGREDOS) {
            const m = re.exec(linha)
            if (!m || (valor && ehPlaceholder(m[valor]))) continue
            violacoes.push({ arquivo: rel, linha: i + 1, trecho: `${nome} (valor omitido)` })
          }
          for (const m of linha.matchAll(RE_JWT)) {
            try {
              const payload = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8'))
              // As chaves do `supabase start` (iss "supabase-demo") são públicas e só valem localmente.
              if (payload.role === 'service_role' && payload.iss !== 'supabase-demo') {
                violacoes.push({ arquivo: rel, linha: i + 1, trecho: 'JWT de service_role do Supabase (valor omitido)' })
              }
            } catch {}
          }
        })
      }
      return violacoes
    },
  },
  {
    id: 'SEG-31',
    titulo: 'Sem HTML não confiável',
    doc: DOC,
    correcao: 'Renderize o conteúdo com os componentes do DS (MarkdownView) em vez de injetar HTML.',
    executar: (ctx) => varrerLinhas(ctx, ctx.codigo({ areas: ['frontend'] }), 'SEG-31', /\bdangerouslySetInnerHTML\b/),
  },
  {
    id: 'SEG-32',
    titulo: 'Sem execução dinâmica de código',
    doc: DOC,
    correcao: 'Remova `eval`/`new Function`; resolva com código estático.',
    executar: (ctx) =>
      varrerLinhas(ctx, [...new Set(ctx.codigo({ areas: ['frontend', 'api', 'regras'] }))], 'SEG-32', /(?<![\w.])eval\s*\(|\bnew\s+Function\s*\(/),
  },
  {
    id: 'SEG-33',
    titulo: 'Erro para o usuário sem detalhe técnico',
    doc: DOC,
    correcao: 'Registre o detalhe no log com um identificador de correlação e responda com a mensagem padrão e um código (ARQ-06).',
    executar(ctx) {
      const re = /\b(?:error|err|e|erro|ex|exception)\.message\b/
      return varrerLinhas(ctx, codigoDeServidor(ctx), 'SEG-33', re, {
        filtro: (linha) =>
          /\b(?:c\.(?:json|text)|Response\.json|NextResponse\.json|new\s+Response)\s*\(|\breturn\s*\{|[{,]\s*(?:error|message)\s*:/.test(linha) &&
          !/\b(?:log(?:ger)?|console|captureException|Sentry|span|report)\b/i.test(linha),
      })
    },
  },
  {
    id: 'SEG-36',
    titulo: 'CORS explícito',
    doc: DOC,
    correcao: 'Liste as origens permitidas por ambiente; nunca `*` com credenciais.',
    executar(ctx) {
      const violacoes = []
      for (const rel of codigoDeServidor(ctx)) {
        const conteudo = ctx.ler(rel)
        const comCredenciais = /credentials\s*:\s*true|Access-Control-Allow-Credentials['"]?\s*[,:]\s*['"]true/.test(conteudo)
        if (!comCredenciais) continue
        violacoes.push(
          ...varrerLinhas(ctx, [rel], 'SEG-36', /\borigin\s*:\s*\[?\s*['"]\*['"]|Access-Control-Allow-Origin['"]?\s*[,:]\s*['"]\*['"]/),
        )
      }
      return violacoes
    },
  },
  {
    id: 'SEG-41',
    titulo: 'Versões mínimas de framework',
    doc: DOC,
    correcao: 'Atualize a dependência para a versão mínima indicada (ou para a linha estável atual) e rode as validações.',
    executar(ctx) {
      const tabela = JSON.parse(readFileSync(join(AQUI, '..', 'versoes-minimas.json'), 'utf8'))
      const violacoes = []
      for (const [pacote, regras] of Object.entries(tabela.pacotes)) {
        for (const [versao, arquivo] of versoesInstaladas(ctx, pacote)) {
          const regra = versaoMinimaViolada(versao, regras)
          if (regra) {
            violacoes.push({
              arquivo,
              linha: 1,
              trecho: `${pacote}@${versao}`,
              mensagem: regra.bloquear ? `${regra.motivo}` : `mínimo ${regra.minima}: ${regra.motivo}`,
            })
          }
        }
      }
      return violacoes
    },
  },
]

