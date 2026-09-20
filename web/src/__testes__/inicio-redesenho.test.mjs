/* O Inicio: o que resolver hoje, e onde cada obra esta' no prazo.
 *
 * Roda com: node web/src/__testes__/inicio-redesenho.test.mjs
 *
 * Tres coisas aqui falham em silencio, e por isso estao escritas:
 *
 *   1. A ORDEM. O comentario antigo dizia "ordenada pelo que doi
 *      primeiro" e a lista nunca foi ordenada — a ordem era a dos
 *      `push`, por acaso. Ninguem nota: a tela mostra nove linhas e
 *      parece que alguem escolheu aquela sequencia.
 *
 *   2. A REGUA. Ela mede a INVASAO da janela de 90 dias, nao o tempo que
 *      falta. Inverter isso da' uma barra bonita apontando pro lado
 *      errado, e "entrega em 61 dias" soa tranquilo enquanto "29 dias
 *      fora do prazo" nao soa.
 *
 *   3. O VERMELHO NOS SELOS. Ate' aqui so' o Executivo podia ficar
 *      vermelho no cartao, mas a lista ao lado cobrava Especificacao e
 *      Marcenaria tambem — a mesma obra dizia duas coisas em duas partes
 *      da mesma tela.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(aqui, "..", "App.jsx"), "utf8");
const css = fs.readFileSync(path.join(aqui, "..", "estilos", "telas.css"), "utf8");

let f = 0;
const conf = (n, o, e = true) => {
  const ok = JSON.stringify(o) === JSON.stringify(e);
  if (!ok) f++;
  console.log(`${ok ? "ok    " : "FALHOU"}  ${n.padEnd(56)}${ok ? "" : `${JSON.stringify(o)} esperava ${JSON.stringify(e)}`}`);
};

console.log("=== 1. A fila e' ordenada de verdade ===");
conf("a lista e' ordenada, e nao so' empilhada", app.includes("atencao.sort((a, b) => a.peso - b.peso || a.ordem - b.ordem)"));
conf("compra vencida ordena por VALOR, nao por dias", app.includes("peso: 0, ordem: -v.matFalta"));
conf("o prazo dos 90 dias vem depois do dinheiro", app.includes("peso: 1, ordem: dias"));
conf("a fila de acesso saiu do topo absoluto", app.includes("atencao.unshift"), false);
conf("... e virou um item com peso, como os outros", app.includes("tom: \"aviso\", peso: 2"));

console.log("\n=== 2. A linha diz o que fazer, nao o que aconteceu ===");
conf("cada item tem um verbo", /acao: <>Liberar a compra de/.test(app));
conf("... e um destino honesto no botao", /botao: "Abrir obra"/.test(app));
conf("o verbo e' o corpo da linha; o lugar, o apoio", css.includes(".ini-tarefa-acao"));
conf("o tom virou um filete, nao um cartao vermelho", css.includes(".ini-tarefa-tom"));
conf("os tres tons tem estilo — inclusive info", 
  [".ini-tarefa.ruim", ".ini-tarefa.aviso", ".ini-tarefa.info"].every((s) => css.includes(s)));

console.log("\n=== 3. O que ainda NAO venceu ===");
conf("L.perto deixou de ser descartado", app.includes("const paraVencer = r.linhas.flatMap"));
conf("... e soma o valor", app.includes("const totalParaVencer = paraVencer.reduce"));
conf("entra em voz baixa, no fim da lista", css.includes(".ini-avencer"));

console.log("\n=== 4. A regua dos 90 dias ===");
conf("o componente existe", app.includes("function ReguaDos90("));
conf("mede a INVASAO da janela, nao o que falta", app.includes("const dentro = Math.min(90, Math.max(0, 90 - dias))"));
conf("obra fora da janela nao tem regua", app.includes("if (dias == null || dias > 90) return null"));
conf("... e a barra usa essa medida", app.includes("width: `${pct}%`"));
conf("entra na linha da obra", app.includes("<ReguaDos90 obra={o} />"));

console.log("\n=== 5. A trilha X de 6 ===");
conf("o contador e' escrito, nao contado a olho", app.includes("{feitos} de {esteira.passos.length}"));
conf("... e vem antes dos selos", css.includes(".ini-esteira-conta"));
conf("TODO passo atrasado fica vermelho", app.includes("const alerta = atrasados.has(p.chave)"));
conf("... e nao so' o Executivo", app.includes('p.chave === "projeto" && executivoAtrasado'), false);

console.log("\n=== 6. O que ela pediu pra manter ===");
conf("o cabecalho com nome, data e recado continua", app.includes('<div className="ini-topo">'));
conf("... com a foto quando existe", app.includes('classe="ini-foto"'));
conf("... e o recado do dia", app.includes("<div className=\"ini-recado\">{mensagemDoDia()}</div>"));
conf("a barra superior continua", app.includes('<header className="topbar">'));

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
