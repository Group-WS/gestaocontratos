/* Solicitar vem antes de comprar (Compras, itens do Sienge).
 *
 * Roda com: node web/src/__testes__/solicitado-comprado.test.mjs
 *
 * No Sienge o item só vira comprado depois de solicitado; comprado conta
 * como solicitado e não volta pra "não solicitado" enquanto estiver
 * comprado. Os outros canais não têm solicitação.
 */
import fs from "node:fs";

const src = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const bloco = (a) => {
  const i = src.indexOf(a);
  if (i === -1) throw new Error(`não achei no App.jsx: ${a}`);
  return src.slice(i, src.indexOf("\n}\n", i) + 3);
};
const M = new Function(`
  ${bloco("function estaSolicitado(")}
  ${bloco("function podeMarcarComprado(")}
  ${bloco("function podeMudarSolicitado(")}
  return { estaSolicitado, podeMarcarComprado, podeMudarSolicitado };
`)();

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(58)} ${String(o).padEnd(8)} ${ok ? "" : "esperava " + e}`); };

conf("Sienge sem solicitação não vira comprado", M.podeMarcarComprado({ canalCompra: "sienge" }), false);
conf("Sienge solicitado pode virar comprado", M.podeMarcarComprado({ canalCompra: "sienge", solicitado: true }), true);
conf("outro canal compra sem solicitação", M.podeMarcarComprado({ canalCompra: "mehoo" }), true);
conf("sem canal não compra", M.podeMarcarComprado({}), false);
conf("comprado conta como solicitado", M.estaSolicitado({ comprado: true }), true);
conf("nem solicitado nem comprado: pendente", M.estaSolicitado({ canalCompra: "sienge" }), false);
conf("comprado não volta pra 'não solicitado'", M.podeMudarSolicitado({ comprado: true, solicitado: true }), false);
conf("não comprado muda a solicitação à vontade", M.podeMudarSolicitado({ solicitado: true }), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
