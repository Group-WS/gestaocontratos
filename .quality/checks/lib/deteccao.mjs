// Detecção da estrutura do projeto: usada pelo instalador (para propor o manifesto) e pelo modo
// de diagnóstico do gate (manifesto provisório, sem gravar nada).

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const EXEMPLOS = join(AQUI, '..', '..', 'exemplos')

const lerJson = (caminho) => {
  try {
    return JSON.parse(readFileSync(caminho, 'utf8'))
  } catch {
    return null
  }
}

/** `nextjs`, `webapp-vite-hono` ou null quando não dá para afirmar. */
export function detectarPerfil(raiz) {
  const existe = (rel) => existsSync(join(raiz, rel))
  const pacotes = ['package.json', 'apps/web/package.json', 'web/package.json']
    .map((rel) => lerJson(join(raiz, rel)))
    .filter(Boolean)
  const temDependencia = (nome) => pacotes.some((p) => p.dependencies?.[nome] || p.devDependencies?.[nome])

  if (temDependencia('next') && (existe('app') || existe('src/app'))) return 'nextjs'
  if (temDependencia('hono') || existe('apps/api')) return 'webapp-vite-hono'
  if (temDependencia('vite') && existe('apps/web')) return 'webapp-vite-hono'
  if (temDependencia('next')) return 'nextjs'
  return null
}

/** Manifesto do exemplo do perfil, ajustado ao que existe no projeto. O dev revisa depois. */
export function manifestoProvisorio(raiz, perfil) {
  const existe = (rel) => existsSync(join(raiz, rel))
  const m = JSON.parse(readFileSync(join(EXEMPLOS, `manifest.${perfil}.json`), 'utf8'))
  m.projeto = lerJson(join(raiz, 'package.json'))?.name ?? raiz.split('/').filter(Boolean).pop()

  if (perfil === 'nextjs' && !existe('src/app') && existe('app')) {
    const raizes = ['app', 'components', 'lib', 'features', 'domain', 'hooks'].filter(existe)
    m.caminhos.frontend = raizes
    m.caminhos.api = raizes
    m.caminhos.regrasDeNegocio = [existe('lib') ? 'lib/domain' : 'domain']
    m.caminhos.ignorar = ['**/database.types.ts']
    m.designSystem.arquivosDePagina = ['app/**/page.tsx']
    m.designSystem.aliasRaiz = '.'
    m.designSystem.fronteiraCliente = 'components/ds.ts'
    m.navegador.wrapper = 'lib/browser-storage.ts'
    m.seguranca.rotasPublicas = []
  }
  if (perfil === 'webapp-vite-hono' && !existe('apps/web/src/components/ui')) {
    if (lerJson(join(raiz, 'apps/web/package.json'))?.dependencies?.['@group-ws/ws-ui']) {
      m.designSystem.vinculo = 'pacote'
      m.designSystem.pastasDoDesignSystem = []
    }
  }
  if (!existe('e2e') && existe('tests')) m.caminhos.testesE2E = ['tests']
  return m
}
