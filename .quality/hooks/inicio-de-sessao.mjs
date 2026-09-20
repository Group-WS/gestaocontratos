#!/usr/bin/env node
// Hook SessionStart (Claude Code e Codex): injeta no contexto do agente o estado do gate, o
// protocolo resumido e o catálogo de regras de negócio protegidas.

import { catalogoDeRegras, lerEntrada, raizDoProjeto, responder } from './comum.mjs'

const entrada = await lerEntrada()
const raiz = raizDoProjeto(entrada)
let texto

try {
  const { executarGate, REGRAS } = await import('../checks/motor.mjs')
  const { formatarContexto } = await import('../checks/lib/relatorio.mjs')
  const { carregarManifesto } = await import('../checks/lib/manifesto.mjs')
  const resultado = await executarGate(raiz)
  const { bruto } = carregarManifesto(raiz)
  const regras = bruto?.caminhos?.catalogoDeRegras ? catalogoDeRegras(raiz, bruto.caminhos.catalogoDeRegras) : []

  texto = [
    `GATE DE QUALIDADE GROUP WS (padrão ${resultado.versao ?? '?'}, perfil ${resultado.perfil ?? '?'}) — obrigatório neste repositório. Protocolo: AGENTS.md › "Gate de qualidade Group WS"; regras completas em .quality/regras/.`,
    formatarContexto(resultado, REGRAS),
    'Antes de alterar código: classifique a tarefa e leia os arquivos indicados em .quality/regras/README.md.',
    `Regras de negócio são PROTEGIDAS (NEG-05): não altere código, teste ou ficha de regra sem pedido explícito do dev nomeando a regra.${
      bruto?.caminhos?.regrasDeNegocio ? ` Camada de regras: ${bruto.caminhos.regrasDeNegocio.join(', ')}.` : ''
    }`,
    regras.length
      ? `Catálogo (${regras.length}):\n${regras.slice(0, 80).map((r) => `- ${r.titulo} [${r.status}]`).join('\n')}`
      : 'Catálogo de regras de negócio: nenhuma ficha ainda.',
    'Antes de encerrar: node .quality/checks/gate.mjs aprovado + comandos de validação do manifesto + "Relatório do gate" na resposta final.',
  ].join('\n\n')
} catch (erro) {
  texto = `GATE DE QUALIDADE GROUP WS: não foi possível rodar o gate automaticamente (${erro.message}). Rode \`node .quality/checks/gate.mjs\` antes de alterar qualquer arquivo e siga o protocolo do AGENTS.md.`
}

responder({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: texto } })
