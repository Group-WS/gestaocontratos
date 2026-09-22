/* Roda todos os testes do Confere de uma vez.
 *
 *   npm test                  (de dentro de web/)
 *   node scripts/testes.mjs   (o mesmo, sem o npm)
 *
 * Os testes do projeto sao scripts Node comuns: cada um se roda sozinho,
 * imprime o que conferiu e sai com codigo 1 se algo falhou. Nao precisam
 * de framework — e por isso este arquivo nao traz nenhum. Ele so' faz o que
 * faltava: rodar os oitenta e tantos juntos e dizer, no fim, quantos
 * passaram. Antes, cada teste so' existia se alguem lembrasse de roda-lo.
 *
 * Roda em paralelo, com limite: sao todos independentes, e em sequencia a
 * suite leva o dobro. A saida de quem passa fica quieta; a de quem falha
 * aparece inteira, que e' o que se quer ler.
 */
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { cpus } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
// As regras de negócio (src/regras) têm o teste AO LADO do arquivo, como o
// padrão pede (NEG-03) — por isso a pasta entra aqui também.
const PASTAS = [join(WEB, "src", "__testes__"), join(WEB, "src", "regras"), join(WEB, "api", "_lib", "__testes__")];
const EH_TESTE = /\.test\.(mjs|cjs|js)$/;

const arquivos = PASTAS.flatMap((pasta) => {
  try {
    return readdirSync(pasta).filter((n) => EH_TESTE.test(n)).map((n) => join(pasta, n));
  } catch {
    return []; // pasta que nao existe: nada a rodar ali
  }
}).sort();

function rodar(arquivo) {
  return new Promise((resolve) => {
    const inicio = Date.now();
    const filho = spawn(process.execPath, [arquivo], { cwd: WEB });
    let saida = "";
    filho.stdout.on("data", (d) => { saida += d; });
    filho.stderr.on("data", (d) => { saida += d; });
    filho.on("close", (codigo) => resolve({ arquivo, codigo, saida, ms: Date.now() - inicio }));
  });
}

async function emLotes(itens, limite, fn) {
  const resultados = [];
  let proximo = 0;
  const trabalhadores = Array.from({ length: Math.min(limite, itens.length) }, async () => {
    while (proximo < itens.length) {
      const i = proximo++;
      resultados[i] = await fn(itens[i]);
    }
  });
  await Promise.all(trabalhadores);
  return resultados;
}

const inicio = Date.now();
const resultados = await emLotes(arquivos, Math.max(2, cpus().length), rodar);
const falhas = resultados.filter((r) => r.codigo !== 0);

for (const r of falhas) {
  console.log(`\n━━━ FALHOU: ${relative(WEB, r.arquivo)} ━━━`);
  console.log(r.saida.trim());
}

const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
console.log(`\n${resultados.length - falhas.length}/${resultados.length} testes passaram em ${segundos}s`);
if (falhas.length) {
  console.log("Falharam:");
  for (const r of falhas) console.log(`  · ${relative(WEB, r.arquivo)}`);
}
process.exit(falhas.length ? 1 : 0);
