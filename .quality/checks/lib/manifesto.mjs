// Carrega e valida .quality/manifest.json (GATE-01) e aplica os valores padrão de cada perfil.

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export const PERFIS = ['webapp-vite-hono', 'nextjs']
export const DS_PADRAO = '@group-ws/ws-ui'
export const CAMINHO_MANIFESTO = '.quality/manifest.json'

const ehTexto = (v) => typeof v === 'string' && v.trim() !== ''
const ehListaDeTexto = (v, { vazia = false } = {}) =>
  Array.isArray(v) && v.every(ehTexto) && (vazia || v.length > 0)

export function carregarManifesto(raiz) {
  const caminho = join(raiz, CAMINHO_MANIFESTO)
  if (!existsSync(caminho)) {
    return { manifesto: null, erros: ['`.quality/manifest.json` não existe. Copie um dos exemplos de `.quality/` e preencha.'] }
  }
  let bruto
  try {
    bruto = JSON.parse(readFileSync(caminho, 'utf8'))
  } catch (erro) {
    return { manifesto: null, erros: [`\`.quality/manifest.json\` não é JSON válido: ${erro.message}`] }
  }
  return validar(bruto)
}

export function validar(bruto) {
  const erros = []
  const exigir = (condicao, mensagem) => {
    if (!condicao) erros.push(mensagem)
  }
  const m = structuredClone(bruto ?? {})

  exigir(ehTexto(m.versaoDoPadrao), '`versaoDoPadrao` é obrigatório.')
  exigir(ehTexto(m.projeto), '`projeto` é obrigatório.')
  exigir(PERFIS.includes(m.perfil), `\`perfil\` precisa ser um de: ${PERFIS.join(', ')}.`)
  exigir(ehListaDeTexto(m.comandosDeValidacao), '`comandosDeValidacao` precisa listar os comandos (lint, typecheck, test, build).')

  const c = (m.caminhos ??= {})
  exigir(ehListaDeTexto(c.frontend), '`caminhos.frontend` precisa listar as pastas do front.')
  if (m.perfil === 'nextjs') c.api ??= c.frontend
  exigir(ehListaDeTexto(c.api), '`caminhos.api` precisa listar as pastas do servidor.')
  exigir(ehListaDeTexto(c.regrasDeNegocio), '`caminhos.regrasDeNegocio` precisa apontar a camada de regras (ex.: `packages/shared/src/domain`).')
  exigir(ehTexto(c.catalogoDeRegras), '`caminhos.catalogoDeRegras` é obrigatório (ex.: `docs/regras-de-negocio`).')
  exigir(ehTexto(c.migrations), '`caminhos.migrations` é obrigatório (ex.: `supabase/migrations`).')
  exigir(ehTexto(c.testesDoBanco), '`caminhos.testesDoBanco` é obrigatório (ex.: `supabase/tests`).')
  exigir(ehListaDeTexto(c.testesE2E), '`caminhos.testesE2E` precisa listar as pastas dos testes Playwright.')
  c.ignorar ??= []
  exigir(ehListaDeTexto(c.ignorar, { vazia: true }), '`caminhos.ignorar` precisa ser uma lista de globs.')

  const ds = (m.designSystem ??= {})
  exigir(ehTexto(ds.pacote), '`designSystem.pacote` é obrigatório (padrão: `@group-ws/ws-ui`).')
  exigir(['pacote', 'copia'].includes(ds.vinculo), '`designSystem.vinculo` precisa ser `pacote` ou `copia`.')
  ds.pastasDoDesignSystem ??= []
  if (ds.vinculo === 'copia') {
    exigir(ehListaDeTexto(ds.pastasDoDesignSystem), 'Com `vinculo: "copia"`, `designSystem.pastasDoDesignSystem` precisa listar as pastas copiadas do DS.')
  }
  exigir(ehListaDeTexto(ds.templatesDePagina), '`designSystem.templatesDePagina` precisa listar os templates de página disponíveis no DS.')
  exigir(ehListaDeTexto(ds.arquivosDePagina), '`designSystem.arquivosDePagina` precisa listar os globs dos arquivos de página.')
  exigir(ehListaDeTexto(ds.fontes), '`designSystem.fontes` precisa listar as famílias tipográficas do DS.')
  if (ds.pacote && ds.pacote !== DS_PADRAO) {
    exigir(ehTexto(ds.adr), '`designSystem.adr` é obrigatório quando o DS não é o `@group-ws/ws-ui`.')
  }
  ds.exigirLogo ??= ds.pacote === DS_PADRAO ? 'GroupWsLogo' : false
  ds.fronteiraCliente ??= null
  ds.aliasRaiz ??= c.frontend?.[0] ?? null

  const nav = (m.navegador ??= {})
  exigir(nav.wrapper === null || ehTexto(nav.wrapper), '`navegador.wrapper` precisa ser o caminho do wrapper de storage ou `null`.')
  exigir(Array.isArray(nav.permitidos), '`navegador.permitidos` precisa ser uma lista (pode ser vazia).')
  nav.arquivosDeSessao ??=
    m.perfil === 'nextjs'
      ? ['src/lib/supabase/**', 'lib/supabase/**', 'src/proxy.ts', 'proxy.ts', 'src/middleware.ts', 'middleware.ts']
      : []

  const seg = (m.seguranca ??= {})
  exigir(ehListaDeTexto(seg.helpersDeAutenticacao), '`seguranca.helpersDeAutenticacao` precisa listar os helpers que autenticam (ex.: `requireAuth`).')
  seg.clientesAdministrativos ??= ['supabaseAdmin', 'createAdminClient']
  seg.rotasPublicas ??= []
  seg.pastasDeRotas ??= m.perfil === 'webapp-vite-hono' ? (c.api ?? []).map((p) => `${p}/routes`) : []

  const sb = (m.supabase ??= {})
  sb.schemasExpostos ??= ['public']

  return { manifesto: erros.length ? null : m, bruto: m, erros }
}
