/* A fonte do app, para os testes que procuram texto nela.
 *
 * Ate' 20/09/2026 tudo morava no App.jsx — inclusive as 3.114 linhas de
 * CSS, num template literal <style>{`...`}</style>. Os testes liam um
 * arquivo so' e achavam regra de estilo junto com JSX.
 *
 * O CSS saiu para arquivos .css de verdade (ver a ordem em main.jsx).
 * Quem procura regra de estilo precisa olhar nos dois lugares, e e' isso
 * que `tudo` e': o App.jsx mais as folhas, na MESMA ordem do main.jsx —
 * porque teste de cascata (quem vence quem) depende da ordem.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const ler = (...p) => fs.readFileSync(path.join(aqui, "..", ...p), "utf8");

/* A ordem e' a do main.jsx. Mudou la', muda aqui. */
export const FOLHAS = [
  "design-system.css",
  "base.css",
  "shell.css",
  "telas.css",
  "componentes.css",
  "celular.css",
];

export const app = ler("App.jsx");
export const css = FOLHAS.map((f) => ler("estilos", f)).join("\n");
export const tudo = `${app}\n${css}`;
