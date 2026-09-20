// Integridade dos arquivos do padrão (GATE-03). Usado pelo gate e pelo instalador.

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

export const PASTAS_PROTEGIDAS = ['regras', 'checks', 'hooks']

/** { "regras/README.md": "<sha256>", … } relativo a `.quality/`. */
export function calcularChecksums(pastaQuality) {
  const resultado = {}
  const caminhar = (dir) => {
    for (const nome of readdirSync(dir).sort()) {
      const abs = join(dir, nome)
      if (statSync(abs).isDirectory()) caminhar(abs)
      else {
        const rel = relative(pastaQuality, abs).split(sep).join('/')
        resultado[rel] = createHash('sha256').update(readFileSync(abs)).digest('hex')
      }
    }
  }
  for (const pasta of PASTAS_PROTEGIDAS) {
    const abs = join(pastaQuality, pasta)
    if (existsSync(abs)) caminhar(abs)
  }
  return resultado
}
