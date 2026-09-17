/* Filtros do painel de Gestão de compras: fornecedor/comprador (recorte
 * item a item) e status (pendente, comprado, todos).
 *
 * Roda com: node web/src/__testes__/gestao-filtros.test.mjs
 *
 * O recorte vale igual pro painel e pro PDF da verba — os dois têm que
 * dizer o mesmo total.
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
const { resumoGeral, relatorioDaVerba } = eval(`(function () {
  const padraoDaDescricao = () => null;
  const verbaPorNome = (n) => ({ "Instalações Elétricas e Iluminação": "05", "Pintura": "18" })[n] || null;
  ${trecho("const ALOC_MAT =", "/* =====[ FIM DO MODELO PURO")}
  ${bloco("function liberadoParaCompra(")}
  ${bloco("function parcelasDoItem(")}
  ${bloco("function parcelasDaPlanilha(")}
  return { resumoGeral, relatorioDaVerba };
})()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(58)} ${String(o).padEnd(12)} ${ok ? "" : "esperava " + e}`); };

const HOJE = new Date(2026, 7, 29);
const item = (x) => ({ desc: "x", ...x });
const bliss = { id: "2256", codigo: "2256", nome: "Bliss", dataEntrega: "2026-09-30", categorias: [
  { num: "05", nome: "Instalações Elétricas e Iluminação", itens: [
    item({ codigo: "5.1", desc: "Spot", marca: "Lumini", totalMaterial: 1000, totalMO: 300 }),
    item({ codigo: "5.2", desc: "Arandela", marca: "Lumini", totalMaterial: 500, totalMO: 0, comprado: true }),
  ] },
  { num: "18", nome: "Pintura", itens: [
    item({ codigo: "18.1", desc: "Pintura das paredes", totalMaterial: 0, totalMO: 4000 }),
    item({ codigo: "18.2", desc: "Textura", totalMaterial: 0, totalMO: 1000, statusContrato: "contrato_gerado" }),
  ] },
] };
const lemme = { id: "2519", codigo: "2519", nome: "Lemme", dataEntrega: "2026-10-30", categorias: [
  { num: "05", nome: "Instalações Elétricas e Iluminação", itens: [
    item({ codigo: "5.4", desc: "Pendente", marca: "Stella", totalMaterial: 700, totalMO: 0 }),
  ] },
] };
const obras = [bliss, lemme];
const verba = (r, num, lado = "aComprar") => r[lado].find((g) => g.num === num);
const soma = (rel) => rel.reduce((a, l) => a + l.total, 0);

/* ---- 1. status ---- */
conf("pendente é o que falta (padrão de antes)", verba(resumoGeral(obras, { hoje: HOJE }), "05").total, 1700);
conf("comprado é o que já foi", verba(resumoGeral(obras, { hoje: HOJE, status: "comprado" }), "05").total, 500);
conf("todos é a soma dos dois", verba(resumoGeral(obras, { hoje: HOJE, status: "todos" }), "05").total, 2200);
conf("mão de obra contratada conta como feita", verba(resumoGeral(obras, { hoje: HOJE, status: "comprado" }), "18", "aContratar").total, 1000);
conf("o prazo não recorta o comprado", verba(resumoGeral(obras, { hoje: HOJE, horizonteDias: 0, status: "comprado" }), "05").total, 500);

/* ---- 2. fornecedor (recorte item a item) ---- */
const soStella = (it) => it.marca === "Stella";
const rs = resumoGeral(obras, { hoje: HOJE, filtroItem: soStella });
conf("só o fornecedor escolhido entra", verba(rs, "05").total, 700);
conf("... e só a obra que tem ele", [...verba(rs, "05").obras.keys()].join(), "2519");
conf("verba sem nada dele some", !!verba(rs, "18", "aContratar"), false);

/* ---- 3. o PDF bate com a linha ---- */
const g = verba(resumoGeral(obras, { hoje: HOJE, status: "comprado" }), "05");
conf("PDF do comprado = linha do comprado",
  soma(relatorioDaVerba(obras, "05", "mat", new Set([...g.obras.keys()].map(String)), { status: "comprado" })), g.total);
const gs = verba(rs, "05");
conf("PDF com fornecedor = linha com fornecedor",
  soma(relatorioDaVerba(obras, "05", "mat", new Set([...gs.obras.keys()].map(String)), { filtroItem: soStella })), gs.total);
conf("sem opções, o PDF segue igual ao de antes", soma(relatorioDaVerba(obras, "05", "mat")), 1700);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
