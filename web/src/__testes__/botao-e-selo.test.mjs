/* Um botao com quatro variantes, e um selo com cinco tons.
 *
 * Roda com: node web/src/__testes__/botao-e-selo.test.mjs
 *
 * O app tem 51 nomes de classe `btn-*` e 34 de selo. A camada do Design
 * System ja' agrupava esses nomes em listas :is(), o que fazia parecer que
 * as variantes ja' existiam e so' faltava um nome. So' que ela unifica
 * MENOS do que parece: da' a pele (raio, cor, hover) e cada classe antiga
 * continua com a propria geometria. As tres tracejadas sao o caso claro —
 * .ad-addbtn tem padding 6px 12px e largura cheia, .btn-add-item tem
 * 4px 12px com 32px de margem, .btn-separar tem 1px 6px e raio menor.
 * Tres tamanhos pra uma variante.
 *
 * O que este teste protege: as classes canonicas entraram nas MESMAS
 * listas :is() das antigas. Se alguem tirar uma delas de la', o botao
 * novo perde a pele e ninguem percebe — o componente continua compilando.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const ler = (...p) => fs.readFileSync(path.join(aqui, "..", ...p), "utf8");
const botao = ler("componentes", "Botao.jsx");
const selo = ler("componentes", "Selo.jsx");
const css = ler("estilos", "componentes.css");
const app = ler("App.jsx");

let f = 0;
const conf = (n, o, e = true) => {
  const ok = JSON.stringify(o) === JSON.stringify(e);
  if (!ok) f++;
  console.log(`${ok ? "ok    " : "FALHOU"}  ${n.padEnd(58)}${ok ? "" : `${JSON.stringify(o)} esperava ${JSON.stringify(e)}`}`);
};

console.log("=== As classes canonicas vestem a roupa que ja' existia ===");
/* Cada par: a classe canonica e uma classe ANTIGA que tem de estar na
   mesma lista :is(). Juntas na mesma lista = mesma aparencia. */
[
  ["btn-primario", "btn-start"],
  ["btn-contorno", "btn-reabrir"],
  ["btn-tracejado", "ad-addbtn"],
  ["btn-icone", "btn-linha-excluir"],
  ["selo", "pill"],
].forEach(([nova, antiga]) => {
  const juntas = css.split("\n").some((l) =>
    l.includes(":is(") && l.includes("." + nova) && l.includes("." + antiga));
  conf(`.${nova} divide a lista :is() com .${antiga}`, juntas);
});

console.log("\n=== O que a lista :is() NAO da', e por isso mora aqui ===");
conf("btn-icone tem forma propria", /^\.btn-icone \{/m.test(css));
conf("btn-tracejado tem forma propria", /^\.btn-tracejado \{/m.test(css));
conf("o selo tambem, porque nao herda de classe antiga", /^\.selo \{/m.test(css));

console.log("\n=== O botao ===");
conf("quatro variantes, e nao mais", Object.keys({ primario: 1, contorno: 1, tracejado: 1, icone: 1 }).length, 4);
conf("... as quatro estao no componente",
  ["primario:", "contorno:", "tracejado:", "icone:"].every((v) => botao.includes(v)));
conf("o rotulo vira aria-label", botao.includes("aria-label={rotulo}"));
conf("avisa em desenvolvimento quando so' ha' icone e nao ha' rotulo",
  botao.includes("so' com icone e sem `rotulo`"));
conf("carregando desabilita", botao.includes("disabled={disabled || carregando}"));
conf("... e diz que esta' ocupado sem trocar o nome", botao.includes("aria-busy={carregando || undefined}"));

console.log("\n=== O selo ===");
conf("cinco tons, e tom aqui e' ESTADO",
  ["neutro:", "ok:", "atencao:", "risco:", "info:"].every((v) => selo.includes(v)));
conf("os cinco tem cor no css",
  [".selo-ok", ".selo-atencao", ".selo-risco", ".selo-info"].every((s) => css.includes(s)));
conf("o info e' indigo, e nao mais um verde/ambar/vermelho",
  /\.selo-info \{ color: var\(--obs\)/.test(css));

console.log("\n=== Ja' em uso, e nao guardados na gaveta ===");
conf("botoes de icone migrados", (app.match(/<Botao variante="icone"/g) || []).length >= 14);
conf("o contador da esteira virou Selo", app.includes('<Selo className="ini-esteira-conta"'));
conf("... com tom, e nao com classe modificadora", app.includes('tom={feitos === esteira.passos.length ? "ok"'));

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
