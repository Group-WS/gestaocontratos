// Formatação do resultado do gate para terminal (humanos e agentes) e para contexto de hooks.

const MAXIMO_POR_REGRA = 15

export function criarCores(ativo) {
  const c = (codigo) => (texto) => (ativo ? `\x1b[${codigo}m${texto}\x1b[0m` : String(texto))
  return { vermelho: c('31'), verde: c('32'), amarelo: c('33'), azul: c('36'), cinza: c('90'), negrito: c('1') }
}

export const ORIENTACAO = {
  'SEM VÍNCULO':
    'Nenhuma tarefa de código é permitida. Primeiro: `.quality/manifest.json` válido e design system vinculado (05-design-system.md › DS-01).',
  'NÃO CONFORME':
    'Nenhuma tarefa nova é permitida. Mostre este relatório ao dev. Com o aval dele, inicie a adequação: `node .quality/checks/gate.mjs --iniciar-adequacao` (em adequação, violações novas continuam reprovando).',
  'EM ADEQUAÇÃO':
    'Só tarefas que corrigem itens de `.quality/adequacao.json` são permitidas. Recuse tarefa nova, explique ao dev e ofereça atacar os itens.',
  'ADEQUAÇÃO CONCLUÍDA':
    'Zero violações: remova `.quality/adequacao.json` no mesmo commit. O projeto passa a CONFORME.',
  CONFORME: 'Tarefas liberadas, seguindo as regras. Rode o gate de novo antes de encerrar e inclua o relatório do gate.',
}

function agrupar(violacoes) {
  const grupos = new Map()
  for (const v of violacoes) {
    if (!grupos.has(v.regra)) grupos.set(v.regra, [])
    grupos.get(v.regra).push(v)
  }
  return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR', { numeric: true }))
}

export function formatarTexto(resultado, regras, { cores = criarCores(false), resumo = false } = {}) {
  const { vermelho, verde, amarelo, azul, cinza, negrito } = cores
  const linhas = []
  const cabecalho = ['Gate de qualidade Group WS', `padrão ${resultado.versao ?? '?'}`, resultado.perfil && `perfil ${resultado.perfil}`, resultado.projeto, resultado.parcial && 'verificação parcial (--regra)', resultado.diagnostico && 'DIAGNÓSTICO · manifesto provisório, nada foi instalado']
    .filter(Boolean)
    .join(' · ')
  linhas.push(cinza(cabecalho), '')

  const mostrar = resultado.estado === 'EM ADEQUAÇÃO' || resultado.estado === 'NÃO CONFORME' && resultado.novas.length
    ? resultado.novas
    : resultado.violacoes
  const nRegras = new Set(resultado.violacoes.map((v) => v.regra)).size
  const simbolo = resultado.aprovado ? verde('✓') : vermelho('✗')
  const detalhe =
    resultado.estado === 'CONFORME'
      ? '0 violações'
      : resultado.adequacao
        ? `${resultado.violacoes.length} violações (lista de adequação: ${resultado.adequacao.total}, resolvidas: ${resultado.resolvidos.length}, novas: ${resultado.novas.length})`
        : `${resultado.violacoes.length} violações em ${nRegras} regra(s)`
  linhas.push(`${simbolo} ${negrito(resultado.estado)} — ${detalhe}`)
  if (resultado.motivoReprovacao) linhas.push(vermelho(`  ${resultado.motivoReprovacao}`))
  linhas.push('')

  if (resumo || resultado.estado === 'EM ADEQUAÇÃO') {
    if (resultado.estado === 'EM ADEQUAÇÃO' && !resumo) linhas.push('Itens restantes da adequação por regra:')
    for (const [regra, lista] of agrupar(resultado.violacoes)) {
      linhas.push(`  ${regra.padEnd(8)} ${String(lista.length).padStart(4)}  ${regras.get(regra)?.titulo ?? ''}`)
    }
    linhas.push('')
  } else {
    if (mostrar !== resultado.violacoes && mostrar.length) linhas.push(amarelo('Violações novas (fora da lista de adequação):'), '')
    for (const [regra, lista] of agrupar(mostrar)) {
      const info = regras.get(regra)
      linhas.push(`${negrito(azul(regra))} · ${info?.titulo ?? ''} — ${lista.length}`)
      for (const v of lista.slice(0, MAXIMO_POR_REGRA)) {
        linhas.push(`  ${v.arquivo}:${v.linha}${v.mensagem ? cinza(`  ${v.mensagem}`) : ''}`)
        if (v.trecho) linhas.push(cinza(`    ${v.trecho.slice(0, 140)}`))
      }
      if (lista.length > MAXIMO_POR_REGRA) linhas.push(cinza(`  … e mais ${lista.length - MAXIMO_POR_REGRA}`))
      if (info?.correcao) linhas.push(`  → ${info.correcao}`)
      if (info?.doc) linhas.push(cinza(`  → Regra: .quality/regras/${info.doc}`))
      linhas.push('')
    }
  }

  if (resultado.escapes?.length) {
    linhas.push(negrito(`Escapes em uso (${resultado.escapes.length})`))
    for (const e of resultado.escapes.slice(0, 30)) linhas.push(`  ${e.arquivo}:${e.linha} · ${e.regra} · ${e.motivo}`)
    linhas.push('')
  }
  const avisos = [...(resultado.avisos ?? []), ...(resultado.falhas ?? []).map((f) => `falha ao executar ${f}`)]
  if (avisos.length) {
    linhas.push(negrito('Avisos'))
    for (const a of avisos) linhas.push(amarelo(`  · ${a}`))
    linhas.push('')
  }
  linhas.push(negrito('O que fazer agora'))
  linhas.push(
    resultado.diagnostico
      ? '  Isto é um diagnóstico: nada foi instalado e os caminhos foram deduzidos do projeto.\n' +
        '  Para adotar o padrão: node <pasta-do-groupws-dev-quality>/instalar.mjs . --perfil <perfil>,\n' +
        '  revise o .quality/manifest.json e rode o gate de novo.'
      : `  ${ORIENTACAO[resultado.estado]}`,
  )
  linhas.push(cinza(`  (${resultado.duracaoMs} ms)`))
  return linhas.join('\n')
}

/** Resumo curto para injetar no contexto do agente (hooks). */
export function formatarContexto(resultado, regras) {
  const contagem = agrupar(resultado.violacoes)
    .map(([regra, lista]) => `${regra} (${lista.length})`)
    .join(', ')
  return [
    `Estado do gate: ${resultado.estado}${resultado.violacoes.length ? ` — ${resultado.violacoes.length} violações: ${contagem}` : ''}.`,
    resultado.motivoReprovacao ?? '',
    `O que isso permite: ${ORIENTACAO[resultado.estado]}`,
    resultado.novas?.length ? `Violações NOVAS fora da adequação: ${resultado.novas.map((v) => `${v.regra} ${v.arquivo}:${v.linha}`).slice(0, 10).join('; ')}.` : '',
  ]
    .filter(Boolean)
    .join('\n')
}
