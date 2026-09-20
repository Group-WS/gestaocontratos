// TST-01 · TST-03 · TST-04 · TST-05 · TST-08 · TST-09

import { EXTENSOES_CODIGO, extname } from '../lib/arquivos.mjs'
import { migracoesDo } from '../lib/sql.mjs'
import { varrerLinhas } from '../lib/contexto.mjs'

const DOC = '09-testes-e-qualidade.md'
const WORKFLOW = '.github/workflows/quality-gate.yml'

export default [
  {
    id: 'TST-01',
    titulo: 'Gate e validações rodam no CI',
    doc: DOC,
    correcao: `Mantenha \`${WORKFLOW}\` (instalado com o padrão) chamando \`.quality/checks/gate.mjs\`.`,
    executar(ctx) {
      if (ctx.existe(WORKFLOW) && ctx.ler(WORKFLOW).includes('.quality/checks/gate.mjs')) return []
      return [{ arquivo: WORKFLOW, linha: 1, trecho: 'workflow do gate ausente ou sem chamar o gate' }]
    },
  },
  {
    id: 'TST-03',
    titulo: 'Toda tabela exposta tem teste de policy',
    doc: DOC,
    correcao: 'Crie um teste pgTAP em `supabase/tests/` que cite a tabela e prove acesso negado (`is_empty`, `throws_ok`) além do permitido.',
    executar(ctx) {
      const pasta = ctx.manifesto.caminhos.testesDoBanco.replace(/\/+$/, '')
      const testes = ctx.todos
        .filter((rel) => rel.startsWith(`${pasta}/`) && /\.(sql|pg)$/.test(rel))
        .map((rel) => ctx.ler(rel))
        .filter((texto) => /\b(?:is_empty|throws_ok|throws_like)\s*\(/.test(texto))
      const violacoes = []
      for (const t of migracoesDo(ctx).tabelas.values()) {
        if (!t.arquivo || t.removida || !ctx.manifesto.supabase.schemasExpostos.includes(t.schema)) continue
        const cita = new RegExp(String.raw`(?<![\w.])(?:${t.schema}\.)?"?${t.nome}"?(?![\w])`, 'i')
        if (testes.some((texto) => cita.test(texto))) continue
        if (ctx.escapado(t.arquivo, t.linha - 1, 'TST-03')) continue
        violacoes.push({ arquivo: t.arquivo, linha: t.linha, trecho: (ctx.linhas(t.arquivo)[t.linha - 1] ?? '').trim(), mensagem: `${t.chave} sem teste pgTAP de acesso negado` })
      }
      return violacoes
    },
  },
  {
    id: 'TST-04',
    titulo: 'E2E de login e de acesso negado',
    doc: DOC,
    correcao: 'Crie specs do Playwright com `{ tag: \'@login\' }` e `{ tag: \'@acesso-negado\' }` nas pastas de `caminhos.testesE2E`.',
    executar(ctx) {
      const pastas = ctx.manifesto.caminhos.testesE2E
      const specs = ctx.todos.filter((rel) => ctx.dentroDe(rel, pastas) && /\.(spec|test|e2e)\.[cm]?[jt]s$/.test(rel))
      const conteudo = specs.map((rel) => ctx.ler(rel)).join('\n')
      const violacoes = []
      const temConfig = ctx.todos.some((rel) => /(^|\/)playwright\.config\.[cm]?[jt]s$/.test(rel))
      if (!temConfig) violacoes.push({ arquivo: 'playwright.config.ts', linha: 1, trecho: 'configuração do Playwright não encontrada' })
      for (const tag of ['@login', '@acesso-negado']) {
        if (!conteudo.includes(tag)) violacoes.push({ arquivo: pastas[0], linha: 1, trecho: `nenhum teste E2E marcado ${tag}` })
      }
      return violacoes
    },
  },
  {
    id: 'TST-05',
    titulo: 'Nada de teste focado ou pulado',
    doc: DOC,
    correcao: 'Remova `.only`/`.skip`/`x…`/`f…`: conserte o teste ou apague-o com justificativa no PR.',
    executar(ctx) {
      const pastas = [
        ...ctx.manifesto.caminhos.frontend,
        ...ctx.manifesto.caminhos.api,
        ...ctx.manifesto.caminhos.regrasDeNegocio,
        ...ctx.manifesto.caminhos.testesE2E,
      ]
      const testes = [...new Set(ctx.todos.filter((rel) => ctx.dentroDe(rel, pastas) && ctx.ehTeste(rel) && EXTENSOES_CODIGO.has(extname(rel))))]
      return varrerLinhas(ctx, testes, 'TST-05', /\b(?:it|test|describe|context|suite)\.(?:only|skip|fixme)\s*\(|(?<![\w.])(?:xit|xdescribe|xtest|fit|fdescribe)\s*\(/)
    },
  },
  {
    id: 'TST-08',
    titulo: 'TypeScript estrito',
    doc: DOC,
    correcao: 'Use `unknown` e refine; troque `@ts-ignore` por `@ts-expect-error` com motivo; mantenha `strict: true`.',
    executar(ctx) {
      const arquivos = [...new Set(ctx.codigo({ areas: ['frontend', 'api', 'regras'], extensoes: new Set(['.ts', '.tsx']) }))]
      const violacoes = [
        ...varrerLinhas(ctx, arquivos, 'TST-08', /(?::\s*any\b|\bas\s+any\b|<any(?:[,>\s]))/, { mensagem: 'any' }),
        ...varrerLinhas(ctx, arquivos, 'TST-08', /@ts-(?:ignore|nocheck)\b/, { ignorarComentarios: false, mensagem: '@ts-ignore/@ts-nocheck' }),
      ]
      for (const rel of ctx.todos.filter((r) => /(^|\/)tsconfig[\w.-]*\.json$/.test(r))) {
        const i = ctx.linhas(rel).findIndex((l) => /"strict"\s*:\s*false/.test(l))
        if (i !== -1) violacoes.push({ arquivo: rel, linha: i + 1, trecho: ctx.linhas(rel)[i].trim() })
      }
      const algumEstrito = ctx.todos.some((r) => /(^|\/)tsconfig[\w.-]*\.json$/.test(r) && /"strict"\s*:\s*true/.test(ctx.ler(r)))
      if (!algumEstrito && arquivos.length) violacoes.push({ arquivo: 'tsconfig.json', linha: 1, trecho: 'nenhum tsconfig declara "strict": true' })
      return violacoes
    },
  },
  {
    id: 'TST-09',
    titulo: 'Sem console.log no front e nas regras',
    doc: DOC,
    correcao: 'Remova o log de depuração; no servidor, use o logger estruturado.',
    executar(ctx) {
      const areas = ctx.manifesto.perfil === 'nextjs' ? ['regras'] : ['frontend', 'regras']
      const arquivos = ctx.codigo({ areas })
      if (ctx.manifesto.perfil === 'nextjs') arquivos.push(...ctx.codigo({ areas: ['frontend'] }).filter((rel) => ctx.ehCliente(rel)))
      return varrerLinhas(ctx, [...new Set(arquivos)], 'TST-09', /\bconsole\.(?:log|debug|info)\s*\(/)
    },
  },
]

