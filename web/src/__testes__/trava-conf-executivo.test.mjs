/* A trava do "Concluir etapa" da Conf. Executivo.
 *
 * Roda com: node web/src/__testes__/trava-conf-executivo.test.mjs
 *
 * A regra (set/2026): para concluir a Conf. Executivo e ir para a
 * próxima etapa, Divergente e Conferência técnica precisam estar 100%
 * aprovados — zero pendência. "Entrou ou saiu" não trava.
 *
 * Roda as funções de verdade do App.jsx, a regra do alerta técnico
 * inclusive. Só o cruzamento das planilhas é trocado por linhas prontas,
 * no formato que conferirExecutivoObra devolve.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "App.jsx"), "utf8");
const bloco = (assinatura, fim = "\n}\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei no App.jsx: ${assinatura}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};
const regras = src.slice(src.indexOf("function semAcentos("), src.indexOf("// Palavras que aparecem em quase toda"));

const M = eval(`(function () {
  ${regras}
  const cruzamentoExecutivo = (obra) => obra.cruzamento;
  ${bloco("function linhaConfExecutivo(")}
  ${bloco("function pendenciasConfExecutivo(")}
  ${bloco("function bloqueioDaEtapa(")}
  return { bloqueioDaEtapa };
})()`);

// Uma linha do cruzamento, no formato de conferirExecutivoObra.
const linha = (num, codigo, status, vendido, executivo) => ({
  codigo, status, motivo: null, verba: { num, nome: `Verba ${num}` },
  planilhaVendido: vendido ? { desc: vendido, qtdVendida: 1, un: "un", custo: 100 } : null,
  planilhaExecutivo: executivo ? { desc: executivo, qtdVendida: 1, un: "un", custo: 100 } : null,
});
const obra = (cruzamento, aprovadas = []) => ({ cruzamento, aprovacoes: new Set(aprovadas) });
const trava = (o, etapa = "executivo_conferencia") => M.bloqueioDaEtapa(etapa, o);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(50)} ${String(o).padEnd(46)} ${ok ? "" : "esperava " + e}`); };

const conferida = linha("05", "5.1", "ok", "Spot Snello 7W 3000K", "Spot Snello 7W 3000K");
const divergente = linha("11", "11.2", "diferente", "Porcelanato 60x60", "Porcelanato 60x60");
// O par real da obra: o número bate, mas nenhum lado diz se é GN ou GLP.
const aquecedor = linha("28", "28.4", "ok", "Aquecedor a gás 45L Komeco Komeco Sacada", "Aquecedor a Gás KO 45DI Prime");
const entrou = linha("28", "28.9", "somente_um", null, "Televisor 55 polegadas");

console.log("=== O QUE TRAVA ===");
conf("tudo conferido: libera", trava(obra([conferida])), null);
conf("um divergente trava", trava(obra([conferida, divergente])), "Falta aprovar 1 divergente");
conf("dois divergentes, no plural", trava(obra([divergente, linha("11", "11.3", "diferente", "Rodapé", "Rodapé")])), "Falta aprovar 2 divergentes");
conf("aquecedor sem GN/GLP vira conferência técnica", trava(obra([aquecedor])), "Falta aprovar 1 em conferência técnica");
conf("os dois juntos", trava(obra([divergente, aquecedor])), "Falta aprovar 1 divergente e 1 em conferência técnica");

console.log("\n=== O QUE LIBERA ===");
conf("aprovada não conta mais", trava(obra([divergente, aquecedor], ["exec:11:11.2", "exec:28:28.4"])), null);
conf("aprovar só uma deixa a outra travando", trava(obra([divergente, aquecedor], ["exec:11:11.2"])), "Falta aprovar 1 em conferência técnica");
conf("'entrou ou saiu' não trava", trava(obra([entrou])), null);

console.log("\n=== SÓ NA CONF. EXECUTIVO ===");
conf("outra etapa não tem essa trava", trava(obra([divergente]), "executivo"), null);
conf("sem obra não quebra", M.bloqueioDaEtapa("executivo_conferencia", null), null);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
