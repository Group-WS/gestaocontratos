/* O PDF de uma linha do "Material a comprar, por insumo" (Gestão de compras)
 * diz o mesmo que a linha: mesmos itens, mesmo total, obra a obra.
 * E, na linha de prazo, quanto do que falta pelo Sienge já foi solicitado.
 *
 * Roda com: node web/src/__testes__/relatorio-insumo.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "App.jsx"), "utf8");
const trecho = (de, ate) => {
  const i = src.indexOf(de), f = src.indexOf(ate);
  if (i === -1 || f === -1) throw new Error(`não achei o intervalo: ${de} .. ${ate}`);
  return src.slice(i, f);
};
const bloco = (assinatura, fim = "\n}\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei no App.jsx: ${assinatura}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};
const M = eval(`(function () {
  const padraoDaDescricao = () => null;
  const verbaPorNome = () => null;
  const subgrupoDe = (desc) => (/cadeira|banqueta/i.test(desc) ? "Cadeiras e banquetas" : /mesa/i.test(desc) ? "Mesas" : null);
  ${bloco("function semAcentos(")}
  ${trecho("const ALOC_MAT =", "/* =====[ FIM DO MODELO PURO")}
  ${bloco("function parcelasDoItem(")}
  ${bloco("function parcelasDaPlanilha(")}
  return { resumoPorInsumo, resumoPorProduto, relatorioDoInsumo, resumoDaObra };
})()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(60)} ${String(o).padEnd(10)} ${ok ? "" : "esperava " + e}`); };

const item = (x) => ({ desc: "x", ...x });
const obraA = { id: "1", codigo: "1", nome: "A", categorias: [
  { num: "24", nome: "Móveis Soltos", itens: [
    item({ codigo: "24.1", desc: "Cadeira Eames", totalMaterial: 1000, canalCompra: "sienge", solicitado: true }),
    item({ codigo: "24.2", desc: "Banqueta alta", totalMaterial: 500, canalCompra: "sienge" }),
    item({ codigo: "24.3", desc: "Mesa lateral", totalMaterial: 300, canalCompra: "sienge", comprado: true }),
    item({ codigo: "24.4", desc: "Mesa de jantar", totalMaterial: 2000 }),
    item({ codigo: "24.5", desc: "Tapete", totalMaterial: 800 }),
  ] },
] };
const obraB = { id: "2", codigo: "2", nome: "B", categorias: [
  { num: "24", nome: "Móveis Soltos", itens: [item({ codigo: "24.1", desc: "Cadeira  Eames", totalMaterial: 700 })] },
] };
const obras = [obraA, obraB];
const soma = (linhas) => Math.round(linhas.reduce((a, l) => a + l.total, 0) * 100) / 100;

const cadeiras = M.relatorioDoInsumo(obras, "Cadeiras e banquetas", "categoria");
conf("categoria: as duas obras entram", cadeiras.length, 2);
conf("categoria: o total é o da linha", soma(cadeiras), 2200);
conf("categoria: a obra A leva os dois itens", cadeiras.find((l) => l.obra.codigo === "1").itens.length, 2);
conf("categoria: o item leva a verba", cadeiras[0].itens[0].verba.num, "24");
conf("comprado fica de fora", soma(M.relatorioDoInsumo(obras, "Mesas", "categoria")), 2000);
conf("sem categoria também tem relatório", soma(M.relatorioDoInsumo(obras, "Sem categoria", "categoria")), 800);
conf("produto: espaço dobrado é o mesmo produto", soma(M.relatorioDoInsumo(obras, "Cadeira Eames", "produto")), 1700);

// Pra cada linha do painel, o relatório soma o mesmo e tem as mesmas obras.
for (const [visao, grupos] of [["categoria", M.resumoPorInsumo(obras)], ["produto", M.resumoPorProduto(obras)]]) {
  const erradas = grupos.filter((g) => {
    const r = M.relatorioDoInsumo(obras, g.nome, visao);
    return Math.abs(soma(r) - g.total) > 0.005 || r.length !== g.obras.size;
  });
  conf(`${visao}: toda linha do painel bate com o seu PDF`, erradas.map((g) => g.nome).join() || "todas", "todas");
}

const filtro = (it) => it.codigo !== "24.2";
conf("o recorte do painel vale no PDF", soma(M.relatorioDoInsumo(obras, "Cadeiras e banquetas", "categoria", { filtroItem: filtro })), 1700);

const v24 = M.resumoDaObra(obraA, new Date(2026, 8, 15)).verbas.find((v) => v.num === "24");
conf("prazo: itens do Sienge que faltam comprar", v24.siengeFalta, 2);
conf("prazo: desses, já solicitados", v24.solicitadosFalta, 1);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
