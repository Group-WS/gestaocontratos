// TELA-01 · toda página alcança um template de página do DS

import { importsDe, resolverImport } from '../lib/arquivos.mjs'

const PROFUNDIDADE_MAXIMA = 4

export default [
  {
    id: 'TELA-01',
    titulo: 'Toda página usa um template do DS',
    doc: '06-padroes-de-tela.md',
    correcao: 'Classifique a tela (arquétipo) e monte-a sobre o template do DS correspondente; sem template publicado, componha sobre o PageShell com a anatomia do 06-padroes-de-tela.',
    executar(ctx) {
      const { templatesDePagina, arquivosDePagina, aliasRaiz } = ctx.manifesto.designSystem
      const usoDeTemplate = new RegExp(`<(?:${templatesDePagina.join('|')})\\b`)
      const paginas = ctx.todos.filter((rel) => ctx.casaGlob(rel, arquivosDePagina) && !ctx.ehTeste(rel))
      const violacoes = []

      for (const pagina of paginas) {
        const conteudo = ctx.ler(pagina)
        // Página que só redireciona não renderiza tela.
        if (!/<[A-Z]/.test(conteudo) && /\bredirect\(|<Navigate\b|throw\s+redirect\(/.test(conteudo)) continue
        if (!/<[A-Za-z]/.test(conteudo)) continue

        const visitados = new Set()
        let fila = [pagina]
        let encontrou = false
        for (let nivel = 0; nivel <= PROFUNDIDADE_MAXIMA && fila.length && !encontrou; nivel++) {
          const proxima = []
          for (const rel of fila) {
            if (visitados.has(rel)) continue
            visitados.add(rel)
            const texto = ctx.ler(rel)
            if (usoDeTemplate.test(texto)) {
              encontrou = true
              break
            }
            for (const { especificador } of importsDe(texto)) {
              const destino = resolverImport(rel, especificador, { existe: ctx.existe, aliasRaiz })
              if (destino && !ctx.ehDoDesignSystem(destino) && /\.[jt]sx?$/.test(destino)) proxima.push(destino)
            }
          }
          fila = proxima
        }

        if (!encontrou && !ctx.escapado(pagina, 0, 'TELA-01')) {
          violacoes.push({
            arquivo: pagina,
            linha: 1,
            trecho: `nenhum template (${templatesDePagina.join(', ')}) alcançado a partir desta página`,
          })
        }
      }
      return violacoes
    },
  },
]
