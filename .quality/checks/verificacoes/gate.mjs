// GATE-02 · GATE-03 · GATE-04

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { calcularChecksums } from '../lib/checksums.mjs'
import { MOTIVO_MINIMO, REGRAS_SEM_ESCAPE, lerEscape } from '../lib/contexto.mjs'

const DOC = '00-protocolo-do-gate.md'

export default [
  {
    id: 'GATE-02',
    titulo: 'Versão do padrão coerente',
    doc: DOC,
    correcao: 'Deixe `versaoDoPadrao` do manifesto igual a `.quality/VERSION` (e revise o manifesto para a versão nova).',
    executar(ctx) {
      const caminho = join(ctx.raiz, '.quality/VERSION')
      const versao = existsSync(caminho) ? readFileSync(caminho, 'utf8').trim() : null
      if (versao && versao === ctx.manifesto.versaoDoPadrao) return []
      return [{
        arquivo: '.quality/manifest.json',
        linha: 1,
        trecho: `versaoDoPadrao: ${ctx.manifesto.versaoDoPadrao} · .quality/VERSION: ${versao ?? 'ausente'}`,
      }]
    },
  },
  {
    id: 'GATE-03',
    titulo: 'Arquivos do padrão íntegros',
    doc: DOC,
    correcao: 'Não edite `.quality/regras`, `.quality/checks` nem `.quality/hooks`. Restaure copiando de novo a versão do padrão (instalar.mjs).',
    executar(ctx) {
      const pasta = join(ctx.raiz, '.quality')
      const arquivoChecksums = join(pasta, 'checksums.json')
      if (!existsSync(arquivoChecksums)) {
        return [{ arquivo: '.quality/checksums.json', linha: 1, trecho: 'arquivo ausente — o padrão não foi instalado pelo instalar.mjs' }]
      }
      let esperados
      try {
        esperados = JSON.parse(readFileSync(arquivoChecksums, 'utf8')).arquivos ?? {}
      } catch {
        return [{ arquivo: '.quality/checksums.json', linha: 1, trecho: 'JSON inválido' }]
      }
      const atuais = calcularChecksums(pasta)
      const violacoes = []
      for (const [rel, hash] of Object.entries(esperados)) {
        if (!(rel in atuais)) violacoes.push({ arquivo: `.quality/${rel}`, linha: 1, trecho: 'arquivo do padrão removido' })
        else if (atuais[rel] !== hash) violacoes.push({ arquivo: `.quality/${rel}`, linha: 1, trecho: 'arquivo do padrão alterado' })
      }
      for (const rel of Object.keys(atuais)) {
        if (!(rel in esperados)) violacoes.push({ arquivo: `.quality/${rel}`, linha: 1, trecho: 'arquivo adicionado dentro do padrão' })
      }
      return violacoes
    },
  },
  {
    id: 'GATE-04',
    titulo: 'Escape com motivo',
    doc: DOC,
    correcao: `Use \`gate-allow <REGRA>: <motivo>\` com uma regra [AUTO] existente e motivo de pelo menos ${MOTIVO_MINIMO} caracteres. Regras sem escape: ${[...REGRAS_SEM_ESCAPE].join(', ')}.`,
    executar(ctx) {
      const violacoes = []
      const pastas = [
        ...ctx.manifesto.caminhos.frontend,
        ...ctx.manifesto.caminhos.api,
        ...ctx.manifesto.caminhos.regrasDeNegocio,
        ctx.manifesto.caminhos.migrations,
        ctx.manifesto.caminhos.testesDoBanco,
        ...ctx.manifesto.caminhos.testesE2E,
      ]
      for (const rel of ctx.todos) {
        if (!ctx.dentroDe(rel, pastas) || !/\.(?:[cm]?[jt]sx?|sql|css|html)$/.test(rel)) continue
        ctx.linhas(rel).forEach((linha, i) => {
          if (!linha.includes('gate-allow')) return
          const escape = lerEscape(linha)
          let problema = null
          if (!escape) problema = 'formato inválido (esperado `gate-allow REGRA-00: motivo`)'
          else if (!ctx.regrasAuto.has(escape.regra)) problema = `${escape.regra} não é uma regra [AUTO] conhecida`
          else if (REGRAS_SEM_ESCAPE.has(escape.regra)) problema = `${escape.regra} não aceita escape`
          else if (escape.motivo.length < MOTIVO_MINIMO) problema = 'motivo ausente ou curto demais'
          if (problema) violacoes.push({ arquivo: rel, linha: i + 1, trecho: linha.trim(), mensagem: problema })
        })
      }
      return violacoes
    },
  },
]
