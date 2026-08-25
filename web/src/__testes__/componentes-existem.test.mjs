/* Todo componente usado no JSX precisa existir.
 *
 * Roda com: node web/src/__testes__/componentes-existem.test.mjs
 *
 * Este teste nasceu de uma tela branca em produção. Uma edição apagou um
 * INTERVALO do App.jsx ("do marcador X até o marcador Y") e o
 * `PrazoCompra` morava dentro dele, sem ninguém perceber. O `<PrazoCompra
 * ... />` continuou na tabela.
 *
 * O build passa: JSX apontando pra componente inexistente é sintaxe
 * válida. Só quebra quando o React tenta renderizar — e aí a tela inteira
 * some com "ReferenceError: PrazoCompra is not defined". Nenhum outro
 * teste pega isso, porque nenhum deles renderiza a árvore.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(dir, "..", "App.jsx"), "utf8");

// Componentes que o React resolve sozinho ou que vêm de import.
const deFora = new Set([
  ...[...src.matchAll(/import\s+(?:\*\s+as\s+)?(\w+)/g)].map((m) => m[1]),
  ...[...src.matchAll(/import\s*\{([^}]+)\}/g)].flatMap((m) =>
    m[1].split(",").map((x) => x.trim().split(/\s+as\s+/).pop())),
  "React", "Fragment",
]);

const definidos = new Set([
  ...[...src.matchAll(/function\s+([A-Z]\w*)/g)].map((m) => m[1]),
  // `const Icon = g.icon` dentro de uma função é componente válido —
  // por isso não ancora no começo da linha.
  ...[...src.matchAll(/\b(?:const|let|var)\s+([A-Z]\w*)\s*=/g)].map((m) => m[1]),
  // Componente que chega como prop: function AContratarBloco({ Icone })
  ...[...src.matchAll(/function\s+\w+\s*\(\s*\{([^)]*)\}/g)]
    .flatMap((m) => m[1].split(",").map((x) => x.trim().split(/[:=\s]/)[0]))
    .filter((n) => /^[A-Z]\w*$/.test(n)),
  ...deFora,
]);

// <Componente ...> — só os que começam com maiúscula são componentes;
// <div>, <span> e afins são tags do HTML.
const usados = new Set([...src.matchAll(/<([A-Z]\w*)[\s/>]/g)].map((m) => m[1])
  .filter((n) => !n.startsWith("React.")));

const faltando = [...usados].filter((n) => !definidos.has(n) && !n.includes("."));

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(52)} ${String(o).padEnd(22)} ${ok ? "" : "esperava " + e}`); };

conf("nenhum componente usado sem existir", faltando.join(", ") || "nenhum", "nenhum");
conf("o PrazoCompra continua de pé", definidos.has("PrazoCompra"), true);
// A tela do plano depende destes; se um sumir, a aba fica em branco.
["GrupoPlano", "LinhaPlano", "TagAloc", "TagCanal", "DestinoCompra", "ComparativoView",
 "DashboardObra", "DashboardMO", "EscopoAberto", "FormNovoEscopo", "SecaoEscopo"].forEach((c) => {
  conf(`${c} existe`, definidos.has(c), true);
});
conf("achou componentes de verdade (sanidade)", usados.size > 25, true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
