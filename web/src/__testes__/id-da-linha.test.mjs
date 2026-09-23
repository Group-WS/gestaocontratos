/* O identificador da linha do Executivo (ADR-007).
 *
 * Roda com: node web/src/__testes__/id-da-linha.test.mjs
 *
 * O caso que originou a decisão (obra 9999, 23/09/2026): quatro "Painel de
 * embutir ECO 18W" na mesma verba, um por ambiente, dois aprovados. Casando
 * pela descrição, os quatro viravam um só.
 */
import { comIdDeLinha, identidadeDoProduto, casarLinhasDaVerba, casarLinhasDaObra } from "../lib/idDaLinha.js";

let f = 0;
const conf = (n, o, e) => { const ok = JSON.stringify(o) === JSON.stringify(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(66)} ${ok ? "" : `obtido ${JSON.stringify(o)} · esperado ${JSON.stringify(e)}`}`); };
const contador = () => { let n = 0; return () => `id-${++n}`; };

// ---------- o id não muda ----------
conf("linha sem id ganha um", comIdDeLinha({ desc: "Cuba" }, () => "novo").idLinha, "novo");
conf("linha com id fica com o dela", comIdDeLinha({ desc: "Cuba", idLinha: "velho" }, () => "novo").idLinha, "velho");
conf("a identidade ignora acento, caixa e espaço",
  identidadeDoProduto({ desc: " Painel  ECO ", ambiente: "Dormitório" }) === identidadeDoProduto({ desc: "painel eco", ambiente: "dormitorio" }), true);

// ---------- obra 9999: mesma descrição, ambientes diferentes ----------
const painel = (ambiente, extra = {}) => ({ desc: "Painel de embutir ECO 18W 20,2x20,2cm", ambiente, marca: "Stella", un: "un", ...extra });
const ambientes = ["Living", "Dormitório", "Banheiro", "Sacada"];
const verba = {
  num: "05",
  itensPlanilhaExecutivo: ambientes.map((a) => painel(a)),
  itens: ambientes.map((a, i) => painel(a, i < 2 ? { liberadoCompra: { por: "admin" } } : {})),
};
const r = casarLinhasDaVerba(verba, contador());
conf("os quatro painéis casam, um a um", r.casadas, 4);
conf("cada linha do Executivo tem o id do seu item",
  r.categoria.itensPlanilhaExecutivo.map((x, i) => x.idLinha === r.categoria.itens[i].idLinha), [true, true, true, true]);
conf("os quatro ids são diferentes", new Set(r.categoria.itens.map((x) => x.idLinha)).size, 4);
conf("a aprovação continua onde estava", r.categoria.itens.map((x) => !!x.liberadoCompra), [true, true, false, false]);

// ---------- a linha de mão de obra leva o id do produto ----------
const contrato = {
  num: "20",
  itensPlanilhaExecutivo: [painel("Sala")],
  itens: [painel("Sala"), painel("Sala", { separadoDe: { desc: "Painel" }, tipo: "servico" })],
};
const rc = casarLinhasDaVerba(contrato, contador());
conf("material e mão de obra com o mesmo id", rc.categoria.itens[0].idLinha === rc.categoria.itens[1].idLinha, true);
conf("... que é o da linha do Executivo", rc.categoria.itens[0].idLinha === rc.categoria.itensPlanilhaExecutivo[0].idLinha, true);

// ---------- o que não tem certeza fica sem id ----------
const empate = { num: "07", itensPlanilhaExecutivo: [painel("Sala"), painel("Sala")], itens: [painel("Sala"), painel("Sala")] };
const re = casarLinhasDaVerba(empate, contador());
conf("duas linhas iguais em tudo não casam", re.casadas, 0);
conf("... e vão para o relatório", re.empates.length, 2);
conf("... sem id", re.categoria.itens.every((x) => !x.idLinha), true);
const sozinha = { num: "08", itensPlanilhaExecutivo: [painel("Sala")], itens: [painel("Cozinha")] };
const rs = casarLinhasDaVerba(sozinha, contador());
conf("linha sem par não casa", rs.casadas, 0);
conf("... e os dois lados vão para o relatório", rs.semPar.map((x) => x.lado), ["executivo", "lista de trabalho"]);

// ---------- rodar de novo não muda nada ----------
const obra = casarLinhasDaObra([verba, contrato], contador());
const denovo = casarLinhasDaObra(obra.categorias, contador());
conf("a obra muda na primeira vez", obra.mudou, true);
conf("rodar de novo não troca id nenhum", denovo.mudou, false);
conf("... e devolve a mesma obra", JSON.stringify(denovo.categorias) === JSON.stringify(obra.categorias), true);
conf("título não entra", casarLinhasDaVerba({ itensPlanilhaExecutivo: [{ desc: "ELÉTRICA", ehTitulo: true }], itens: [{ desc: "ELÉTRICA", ehTitulo: true }] }, contador()).casadas, 0);

if (f) { console.log(`\n${f} falha(s)`); process.exit(1); }
console.log("\nid da linha: tudo certo");
