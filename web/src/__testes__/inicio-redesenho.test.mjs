/* O Inicio diz o que fazer, e onde cada obra esta' no prazo.
 *
 * Roda com: node web/src/__testes__/inicio-redesenho.test.mjs
 *
 * Veio da branch design-preview (20/09/2026), escrito sobre o InicioView
 * antigo. O Inicio agora e' o DashboardPage: a fila e' montada no InicioView
 * (App.jsx) e desenhada no painel. As regras sao as mesmas; o lugar mudou.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(aqui, "..", "App.jsx"), "utf8");
const painel = fs.readFileSync(path.join(aqui, "..", "features", "dashboard", "DashboardPage.jsx"), "utf8");

let f = 0;
const conf = (n, o, e = true) => {
  const ok = JSON.stringify(o) === JSON.stringify(e);
  if (!ok) f++;
  console.log(`${ok ? "ok    " : "FALHOU"}  ${n.padEnd(56)}${ok ? "" : `${JSON.stringify(o)} esperava ${JSON.stringify(e)}`}`);
};

console.log("=== 1. a fila e' ordenada de verdade ===");
conf("o painel ordena por faixa e desempate", painel.includes(".sort((a, b) => (a.peso ?? 9) - (b.peso ?? 9) || (a.ordem ?? 0) - (b.ordem ?? 0))"));
conf("... e nao mais pela posicao da obra", painel.includes("sort((a, b) => a.rank - b.rank).flatMap"), false);
conf("compra vencida ordena por VALOR, nao por dias", app.includes("peso: 0, ordem: -v.matFalta"));
conf("o prazo dos 90 dias vem depois do dinheiro", app.includes("peso: 1, ordem: criticalSteps.dias"));
conf("a fila de acesso tem peso, como os outros", app.includes('id: "acessos", peso: 2'));

console.log("\n=== 2. a linha diz o que fazer ===");
conf("cada item tem um verbo", app.includes("text: `Liberar a compra de ${v.nome}`"));
conf("... e um destino honesto no botao", app.includes('button: "Abrir obra"'));
conf("o botao mostra esse destino", painel.includes('{alert.button || "Abrir"}'));
conf("o 'Resolver' que nao resolvia saiu", painel.includes(">Resolver <"), false);

console.log("\n=== 3. o que esta' para vencer ===");
conf("L.perto deixou de ser descartado", app.includes("(summary?.perto || []).forEach"));
conf("... entra no fim da fila", app.includes("upcoming: true, peso: 5"));
conf("... e em voz baixa, com selo proprio", painel.includes('alert.upcoming ? "A vencer"'));

console.log("\n=== 4. a regua dos 90 dias ===");
conf("o componente existe", painel.includes("function ReguaDos90("));
conf("mede a INVASAO da janela, nao o que falta", painel.includes("const dentro = Math.min(90, Math.max(0, 90 - days))"));
conf("obra fora da janela nao tem regua", painel.includes("if (days == null || days > 90) return null"));
conf("entra na linha da obra", painel.includes("<ReguaDos90 days={row.days} />"));

console.log("\n=== 5. a esteira ===");
conf("o contador e' escrito, nao contado a olho", painel.includes("{row.steps.filter((step) => step.feito).length} de {row.steps.length}"));
conf("TODO passo atrasado fica vermelho", painel.includes('row.overdueSteps?.includes(step.chave) ? "danger"'));
conf("... e nao so' o Executivo", painel.includes('step.chave === "projeto" ? "danger"'), false);
conf("a linha leva os passos atrasados", app.includes("overdueSteps: criticalSteps.passos.map((p) => p.chave)"));

console.log(f ? `\n${f} FALHA(S)` : "\nTudo certo.");
process.exit(f ? 1 : 0);
