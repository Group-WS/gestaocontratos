/* O relatório em PDF de uma verba (Gestão de compras e contratações).
 *
 * Roda com: node web/src/__testes__/relatorio-verba.test.mjs
 *
 * O PDF é a lista item a item por trás de UMA linha da tela ("Mão de obra
 * a contratar, por verba" / "Material a comprar, por verba"). O que este
 * teste guarda é que os dois digam a mesma coisa: o total do relatório é o
 * total da linha, obra a obra — com as mesmas regras (comprado sai do
 * material, contrato solicitado sai da mão de obra) e o mesmo recorte.
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

// Mesmo recorte do teste do painel geral: o modelo puro + as parcelas.
const { resumoGeral, relatorioDaVerba } = eval(`(function () {
  const padraoDaDescricao = () => null;
  const verbaPorNome = (n) => ({ "Instalações Elétricas e Iluminação": "05", "Pintura": "18" })[n] || null;
  ${trecho("const ALOC_MAT =", "/* =====[ FIM DO MODELO PURO")}
  ${bloco("function parcelasDoItem(")}
  ${bloco("function parcelasDaPlanilha(")}
  return { resumoGeral, relatorioDaVerba };
})()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(58)} ${String(o).padEnd(12)} ${ok ? "" : "esperava " + e}`); };

const HOJE = new Date(2026, 7, 29);
const item = (x) => ({ desc: "x", ...x });
const bliss = {
  id: "2256", codigo: "2256", nome: "Bliss", dataEntrega: "2026-09-30",
  categorias: [
    { num: "05", nome: "Instalações Elétricas e Iluminação", itens: [
      item({ codigo: "5.1", desc: "Spot", totalMaterial: 1000, totalMO: 300 }),
      item({ codigo: "5.2", desc: "Arandela", totalMaterial: 500, totalMO: 0, comprado: true }),
    ] },
    { num: "18", nome: "Pintura", itens: [
      item({ codigo: "18.1", desc: "Pintura das paredes", totalMaterial: 0, totalMO: 4000 }),
      item({ codigo: "18.2", desc: "Textura", totalMaterial: 0, totalMO: 1000, statusContrato: "contrato_gerado" }),
    ] },
  ],
};
const lemme = {
  id: "2519", codigo: "2519", nome: "Lemme", dataEntrega: "2026-10-30",
  categorias: [
    { num: "05", nome: "Instalações Elétricas e Iluminação", itens: [
      item({ codigo: "5.4", desc: "Pendente", totalMaterial: 700, totalMO: 0 }),
    ] },
  ],
};
const obras = [bliss, lemme];
const r = resumoGeral(obras, { hoje: HOJE });
const daLinha = (g) => new Set([...g.obras.keys()].map(String));
const soma = (rel) => rel.reduce((a, l) => a + l.total, 0);

/* ---- 1. material: o total do PDF é o da linha ---- */
const g05 = r.aComprar.find((g) => g.num === "05");
const mat = relatorioDaVerba(obras, "05", "mat", daLinha(g05));
conf("material: total do relatório = total da linha", soma(mat), g05.total);
conf("material: as duas obras entram", mat.length, 2);
conf("material: a obra de maior valor vem primeiro", mat[0].obra.codigo, "2256");
conf("material: o comprado fica de fora", mat.some((l) => l.itens.some(({ it }) => it.desc === "Arandela")), false);
conf("material: cada obra bate com a linha", mat.every((l) => g05.obras.get(l.obra.codigo).valor === l.total), true);

/* ---- 2. mão de obra: contrato solicitado sai ---- */
const g18 = r.aContratar.find((g) => g.num === "18");
const mo = relatorioDaVerba(obras, "18", "mo", daLinha(g18));
conf("mão de obra: total do relatório = total da linha", soma(mo), g18.total);
conf("mão de obra: o contratado fica de fora", mo[0].itens.map(({ it }) => it.desc).join(), "Pintura das paredes");
const g05mo = r.aContratar.find((g) => g.num === "05");
conf("mão de obra da verba 05 = a parcela de MO do spot", soma(relatorioDaVerba(obras, "05", "mo", daLinha(g05mo))), 300);

/* ---- 3. o recorte da linha vale no PDF ---- */
conf("obra fora do recorte não entra", relatorioDaVerba(obras, "05", "mat", new Set(["2519"])).map((l) => l.obra.codigo).join(), "2519");
conf("sem recorte, entram todas as que têm pendência", relatorioDaVerba(obras, "05", "mat").length, 2);
conf("verba sem nada pendente: relatório vazio", relatorioDaVerba(obras, "21", "mat").length, 0);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
