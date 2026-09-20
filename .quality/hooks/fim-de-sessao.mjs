#!/usr/bin/env node
// Hook Stop (Claude Code e Codex): se a sessão deixou mudanças no repositório, roda o gate. Se o
// gate reprovar, pede ao agente para continuar (uma vez) — corrigir o que a tarefa introduziu ou
// explicar ao dev e trazer o relatório do gate.

import { spawnSync } from 'node:child_process'
import { lerEntrada, raizDoProjeto, responder } from './comum.mjs'

try {
  const entrada = await lerEntrada()
  if (entrada.stop_hook_active) process.exit(0)
  const raiz = raizDoProjeto(entrada)
  const status = spawnSync('git', ['status', '--porcelain'], { cwd: raiz, encoding: 'utf8' })
  if (status.status !== 0 || !status.stdout.trim()) process.exit(0)

  const { executarGate } = await import('../checks/motor.mjs')
  const resultado = await executarGate(raiz)
  if (resultado.aprovado) process.exit(0)

  const alvo = resultado.novas.length ? resultado.novas : resultado.violacoes
  const porRegra = new Map()
  for (const v of alvo) porRegra.set(v.regra, (porRegra.get(v.regra) ?? 0) + 1)
  const resumo = [...porRegra].map(([regra, n]) => `${regra} (${n})`).join(', ')

  responder({
    decision: 'block',
    reason: [
      `Gate de qualidade reprovado — estado ${resultado.estado}${resumo ? `: ${resumo}` : ''}.${resultado.motivoReprovacao ? ` ${resultado.motivoReprovacao}` : ''}`,
      'Antes de encerrar: rode `node .quality/checks/gate.mjs` para ver o detalhe e corrija o que esta tarefa introduziu.',
      'Se não for possível corrigir agora, explique ao dev o motivo e inclua o "Relatório do gate" na resposta final.',
    ].join(' '),
  })
} catch {
  process.exit(0)
}
