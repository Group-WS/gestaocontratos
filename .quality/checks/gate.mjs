#!/usr/bin/env node
// Gate de qualidade Group WS — CLI.
//
//   node .quality/checks/gate.mjs                     verificação completa (entrada e saída de tarefa)
//   node .quality/checks/gate.mjs --staged            pré-commit: compara mudanças do índice
//   node .quality/checks/gate.mjs --base origin/main  CI: compara o PR com a branch base
//   node .quality/checks/gate.mjs --resumo            contagem por regra
//   node <padrão>/gate.mjs --raiz . --diagnostico     projeto SEM o padrão instalado: diagnóstico
//                                                     com manifesto provisório (nada é gravado)
//   node .quality/checks/gate.mjs --json              resultado em JSON
//   node .quality/checks/gate.mjs --iniciar-adequacao grava a lista de adequação (com aval do dev)
//   node .quality/checks/gate.mjs --atualizar-adequacao remove da lista o que já foi corrigido
//
// Saída 0: CONFORME ou EM ADEQUAÇÃO sem violação nova. Saída 1: reprovado. Saída 2: erro de uso.

import { resolve } from 'node:path'
import { atualizarAdequacao, executarGate, iniciarAdequacao, REGRAS } from './motor.mjs'
import { criarCores, formatarTexto } from './lib/relatorio.mjs'

const AJUDA = `Uso: node .quality/checks/gate.mjs [--staged | --base <ref>] [--resumo | --json]
            [--iniciar-adequacao | --atualizar-adequacao] [--regra <ID>]... [--raiz <dir>] [--sem-cor]
            [--diagnostico [--perfil webapp-vite-hono|nextjs]]`

function lerArgumentos(argv) {
  const opcoes = { regras: [] }
  for (let i = 0; i < argv.length; i++) {
    const [chave, valorInline] = argv[i].split('=')
    const valor = () => valorInline ?? argv[++i]
    switch (chave) {
      case '--staged': opcoes.staged = true; break
      case '--diagnostico': opcoes.diagnostico = true; break
      case '--perfil': opcoes.perfil = valor(); break
      case '--base': opcoes.base = valor(); break
      case '--json': opcoes.json = true; break
      case '--resumo': opcoes.resumo = true; break
      case '--iniciar-adequacao': opcoes.iniciar = true; break
      case '--atualizar-adequacao': opcoes.atualizar = true; break
      case '--regra': opcoes.regras.push(valor()); break
      case '--raiz': opcoes.raiz = valor(); break
      case '--sem-cor': opcoes.semCor = true; break
      case '--ajuda': case '-h': case '--help': opcoes.ajuda = true; break
      default:
        console.error(`Opção desconhecida: ${argv[i]}\n${AJUDA}`)
        process.exit(2)
    }
  }
  return opcoes
}

const opcoes = lerArgumentos(process.argv.slice(2))
if (opcoes.ajuda) {
  console.log(AJUDA)
  process.exit(0)
}

const raiz = resolve(opcoes.raiz ?? process.cwd())
const resultado = await executarGate(raiz, {
  staged: opcoes.staged,
  base: opcoes.base,
  diagnostico: opcoes.diagnostico,
  perfil: opcoes.perfil,
  regras: opcoes.regras.length ? opcoes.regras : undefined,
})

if ((opcoes.iniciar || opcoes.atualizar) && (opcoes.regras.length || opcoes.diagnostico)) {
  console.error('✗ --iniciar-adequacao e --atualizar-adequacao usam todas as regras e exigem o padrão instalado; remova --regra/--diagnostico.')
  process.exit(2)
}

if (opcoes.iniciar || opcoes.atualizar) {
  try {
    if (opcoes.iniciar) {
      const total = iniciarAdequacao(raiz, resultado)
      console.log(`✓ Adequação iniciada: ${total} violações gravadas em .quality/adequacao.json. Commite o arquivo.`)
    } else {
      const { antes, depois } = atualizarAdequacao(raiz, resultado)
      console.log(`✓ Lista de adequação atualizada: ${antes} → ${depois} itens.`)
    }
    process.exit(0)
  } catch (erro) {
    console.error(`✗ ${erro.message}`)
    process.exit(1)
  }
}

if (opcoes.json) {
  console.log(JSON.stringify(resultado, null, 2))
} else {
  const cores = criarCores(!opcoes.semCor && !process.env.NO_COLOR && process.stdout.isTTY)
  console.log(formatarTexto(resultado, REGRAS, { cores, resumo: opcoes.resumo }))
}
process.exit(resultado.aprovado ? 0 : 1)
