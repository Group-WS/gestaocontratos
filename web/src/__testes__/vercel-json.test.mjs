/* O vercel.json que a Vercel aceita.
 *
 * Roda com: node web/src/__testes__/vercel-json.test.mjs
 *
 * Em 17/09/2026 a 11ª publicação FALHOU na Vercel ("Deployment failed") por
 * causa de uma chave `_comentario` que eu tinha posto no vercel.json pra
 * explicar as regras — JSON não tem comentário, e o esquema da Vercel tem
 * `additionalProperties: false` no topo: chave desconhecida derruba a
 * montagem inteira. O site oficial ficou na versão anterior (a Vercel
 * continua servindo a última montagem boa), mas ninguém percebeu por CINCO
 * commits, porque na develop a falha só aparece nas montagens de teste.
 *
 * A explicação das regras mora aqui, então, e não no arquivo:
 *
 *   1. /api/(.*) -> /api vem PRIMEIRO. A Vercel aplica as regras em ordem;
 *      sem esta na frente, as chamadas do Sienge e do Monday cairiam no
 *      index.html.
 *   2. /(.*) -> /index.html é o que faz /obra/2450/compras existir no ar. O
 *      app é uma página só; qualquer endereço precisa devolver o index.html
 *      e deixar o próprio app decidir o que mostrar. Sem ela, F5 num endereço
 *      de obra dá 404. Arquivo que existe (assets/, favicon) continua sendo
 *      servido direto: a Vercel olha o sistema de arquivos antes das regras.
 *
 * O `$schema` no arquivo faz o editor sublinhar chave inválida na hora.
 *
 *   3. `headers` põe os cabeçalhos de segurança (SEG-35, VH-12) em toda
 *      resposta: HSTS, nosniff, Referrer-Policy, X-Frame-Options e
 *      Permissions-Policy. A CSP começou em `Content-Security-Policy-Report-Only`
 *      (21/09/2026): registra no console do navegador o que ela bloquearia,
 *      sem bloquear. Conferido o console da produção, a chave vira
 *      `Content-Security-Policy`.
 *   4. O script de tema do index.html é inline, e a CSP só o aceita pelo
 *      hash. Mexeu no script, o hash muda — este teste avisa.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const arquivo = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "vercel.json");
const indexHtml = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "index.html");

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(56)} ${String(o).padEnd(22)} ${ok ? "" : "esperava " + e}`); };

let v = null;
try { v = JSON.parse(fs.readFileSync(arquivo, "utf8")); } catch (e) { /* conferido abaixo */ }
conf("vercel.json é JSON válido", !!v, true);

/* Só chaves que o esquema da Vercel conhece. A lista é a das que este
   projeto usa ou pode vir a usar; chave nova de verdade entra aqui depois de
   conferida em https://openapi.vercel.sh/vercel.json. */
const ACEITAS = new Set(["$schema", "rewrites", "redirects", "headers", "cleanUrls", "trailingSlash",
  "functions", "buildCommand", "installCommand", "outputDirectory", "framework", "regions", "crons"]);
const chaves = Object.keys(v || {});
conf("nenhuma chave desconhecida no topo", chaves.filter((k) => !ACEITAS.has(k)).join(", ") || "nenhuma", "nenhuma");
conf("nenhuma chave de comentário (_algo)", chaves.some((k) => k.startsWith("_")), false);

const regras = v?.rewrites || [];
const iApi = regras.findIndex((r) => r.source === "/api/(.*)" && r.destination === "/api");
const iTudo = regras.findIndex((r) => r.source === "/(.*)" && r.destination === "/index.html");
conf("a regra do /api existe", iApi >= 0, true);
conf("a regra dos endereços de tela existe", iTudo >= 0, true);
conf("o /api vem ANTES da regra geral", iApi >= 0 && iTudo >= 0 && iApi < iTudo, true);
conf("toda regra tem source e destination", regras.every((r) => r.source && r.destination), true);

/* Cabeçalhos de segurança em toda resposta (SEG-35). */
const cabecalhos = new Map(((v?.headers || []).find((h) => h.source === "/(.*)")?.headers || []).map((h) => [h.key, h.value]));
for (const nome of ["Strict-Transport-Security", "X-Content-Type-Options", "Referrer-Policy", "X-Frame-Options", "Permissions-Policy"]) {
  conf(`cabeçalho ${nome}`, cabecalhos.has(nome), true);
}
conf("nosniff", cabecalhos.get("X-Content-Type-Options"), "nosniff");
conf("sem moldura de outro site", cabecalhos.get("X-Frame-Options"), "DENY");
const csp = cabecalhos.get("Content-Security-Policy") || cabecalhos.get("Content-Security-Policy-Report-Only") || "";
conf("há CSP (bloqueante ou só registrando)", csp.length > 0, true);
conf("a CSP proíbe moldura (frame-ancestors 'none')", csp.includes("frame-ancestors 'none'"), true);
conf("a CSP não libera script inline em geral", /script-src[^;]*'unsafe-inline'/.test(csp), false);
const html = fs.readFileSync(indexHtml, "utf8");
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const hashes = inline.map((s) => `'sha256-${crypto.createHash("sha256").update(s, "utf8").digest("base64")}'`);
conf("todo script inline do index.html tem o hash na CSP", hashes.every((h) => csp.includes(h)), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
