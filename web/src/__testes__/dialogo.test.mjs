/* O que o <Dialogo> tem de garantir — uma vez, aqui, e nao em cada uso.
 *
 * Roda com: node web/src/__testes__/dialogo.test.mjs
 *
 * Existiam SEIS sobreposicoes escritas a mao, cada uma lembrando de uma
 * parte: uma tinha Escape e role, outra so' clique fora, outra so' Escape.
 * Nenhuma das seis prendia o foco nem o devolvia pra onde estava.
 *
 * O custo disso nao aparece no olho: com a caixa aberta, o Tab passeia por
 * tras dela, e quem navega por teclado vai parar num botao que nao ve. Ao
 * fechar, o foco volta pro topo da pagina em vez do botao que abriu.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(aqui, "..", "componentes", "Dialogo.jsx"), "utf8");
const app = fs.readFileSync(path.join(aqui, "..", "App.jsx"), "utf8");

let f = 0;
const conf = (nome, obtido, esperado = true) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) f++;
  console.log(`${ok ? "ok    " : "FALHOU"}  ${nome.padEnd(54)}${ok ? "" : `${JSON.stringify(obtido)} esperava ${JSON.stringify(esperado)}`}`);
};

console.log("=== o que o primitivo garante ===");
conf("sai por portal, fora da arvore da tela", src.includes("createPortal("));
conf("se anuncia como dialogo", /role: "dialog"/.test(src));
conf("... modal, pra o leitor ignorar o resto", /"aria-modal": "true"/.test(src));
conf("... e com nome, pelo rotulo", /"aria-label": rotulo/.test(src));
conf("Escape fecha", /e\.key === "Escape"/.test(src));
conf("... mas nao enquanto algo esta' em voo", /e\.key === "Escape" && podeFechar/.test(src));
conf("clique no fundo fecha", /e\.target === e\.currentTarget/.test(src));
conf("... e da' pra desligar isso", src.includes("fecharNoFundo"));

console.log("\n=== o foco, que nenhuma das seis tinha ===");
conf("guarda quem tinha o foco antes", src.includes("document.activeElement"));
conf("foca o primeiro campo ao abrir", /focaveis\(\)\[0\]/.test(src));
conf("prende o Tab: do ultimo volta pro primeiro", /document\.activeElement === ultimo/.test(src));
conf("... e o Shift+Tab do primeiro vai pro ultimo", /e\.shiftKey && document\.activeElement === primeiro/.test(src));
conf("devolve o foco ao fechar", /refAnterior\.current\?\.isConnected/.test(src));
conf("a pagina de tras para de rolar", src.includes('document.body.style.overflow = "hidden"'));
conf("... e volta a rolar depois", /document\.body\.style\.overflow = rolagem/.test(src));

console.log("\n=== quem usa ===");
const usos = (app.match(/<Dialogo /g) || []).length;
conf("as seis sobreposicoes passaram por aqui", usos, 6);
conf("nenhuma sobreposicao a mao sobrou", /className="(sobreposto-fundo|detalhe-fundo|rel-overlay)"/.test(app), false);
conf("a caixa e' opcional, pra quem tem dois filhos irmaos", /caixa \? \(/.test(src));

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
