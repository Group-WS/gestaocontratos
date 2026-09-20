#!/usr/bin/env node
// Hook PreToolUse — proteção das regras de negócio (NEG-05).
//
// Claude Code (--ferramenta=claude): alterar regra existente pede confirmação ao dev ("ask").
// Codex (--ferramenta=codex): o Codex não suporta "ask" em hook; a alteração é negada, a menos que
// a sessão tenha sido aberta com GATE_RN_AUTORIZADA=RN-012,RN-015 (IDs autorizados pelo dev).
//
// Criar arquivo novo não é bloqueado (regra nova nasce como proposta — NEG-08). Protegidos:
// arquivos de código existentes na camada de regras e fichas RN-NNN existentes.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { lerEntrada, raizDoProjeto, relativo, responder } from './comum.mjs'

const ferramenta = process.argv.includes('--ferramenta=codex') ? 'codex' : 'claude'

try {
  const entrada = await lerEntrada()
  const raiz = raizDoProjeto(entrada)
  const { carregarManifesto } = await import('../checks/lib/manifesto.mjs')
  const { bruto } = carregarManifesto(raiz)
  const camadas = bruto?.caminhos?.regrasDeNegocio ?? []
  const catalogo = bruto?.caminhos?.catalogoDeRegras
  if (!camadas.length && !catalogo) process.exit(0)

  const dentro = (rel, pasta) => !!pasta && (rel === pasta || rel.startsWith(`${pasta.replace(/\/+$/, '')}/`))
  const protegido = (rel) =>
    !!rel &&
    existsSync(join(raiz, rel)) &&
    ((camadas.some((c) => dentro(rel, c)) && /\.[cm]?[jt]sx?$/.test(rel)) ||
      (dentro(rel, catalogo) && /(^|\/)RN-\d{3}-[^/]+\.md$/.test(rel)))

  const nome = entrada.tool_name ?? ''
  const dados = entrada.tool_input ?? {}
  const alvos = new Set()

  if (['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(nome)) {
    const rel = relativo(raiz, dados.file_path ?? dados.notebook_path)
    if (protegido(rel)) alvos.add(rel)
  } else if (nome === 'apply_patch') {
    const patch = String(dados.command ?? dados.input ?? dados.patch ?? '')
    for (const m of patch.matchAll(/^\*\*\* (?:Update File|Delete File|Move to): (.+)$/gm)) {
      const rel = relativo(raiz, m[1].trim())
      if (protegido(rel)) alvos.add(rel)
    }
  } else if (nome === 'Bash') {
    const comando = String(dados.command ?? '')
    const escreve = /(?<![0-9&=-])>>?\s*\S|\btee\b|\bsed\s+(?:-[a-zA-Z]*\s+)*-i|\bperl\s+-[a-z]*i|\b(?:mv|cp|rm|truncate|dd|patch)\s|\bgit\s+(?:checkout|restore|apply|mv|rm)\b/.test(comando)
    if (escreve) {
      for (const pasta of [...camadas, catalogo].filter(Boolean)) {
        if (comando.includes(pasta)) alvos.add(pasta)
      }
    }
  }

  if (!alvos.size) process.exit(0)

  const ids = new Set()
  for (const rel of alvos) {
    for (const m of rel.matchAll(/RN-\d{3}/g)) ids.add(m[0])
    const abs = join(raiz, rel)
    if (existsSync(abs) && /\.[a-z]+$/.test(rel)) {
      for (const m of readFileSync(abs, 'utf8').matchAll(/\bRN-\d{3}\b/g)) ids.add(m[0])
    }
  }
  const listaIds = [...ids].sort()
  const descricao = `${[...alvos].join(', ')}${listaIds.length ? ` (${listaIds.join(', ')})` : ''}`

  if (ferramenta === 'claude') {
    responder({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: `Regra de negócio protegida (NEG-05): o agente quer alterar ${descricao}. Aprove só se você pediu explicitamente esta mudança de regra. Aprovando, a ficha RN correspondente precisa ser atualizada no mesmo commit (NEG-06).`,
      },
    })
    process.exit(0)
  }

  const autorizadas = (process.env.GATE_RN_AUTORIZADA ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (listaIds.length && listaIds.every((id) => autorizadas.includes(id))) process.exit(0)
  responder({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `Regra de negócio protegida (NEG-05): alteração em ${descricao} negada. Pare e pergunte ao dev se esta mudança de regra foi pedida. Se ele confirmar, ele precisa abrir a sessão do Codex com GATE_RN_AUTORIZADA=${listaIds.join(',') || 'RN-NNN'} e a ficha deve ser atualizada no mesmo commit (NEG-06).`,
    },
  })
} catch {
  process.exit(0)
}
