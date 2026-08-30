/* O painel de um canal de compra (a Mehoo é o primeiro).
 *
 * Roda com: node web/src/__testes__/painel-canal.test.mjs
 *
 * É a obra vista pelo lado de quem FORNECE. O erro que dói aqui não é
 * número torto: é mandar pro fornecedor uma lista com item que não é
 * dele, ou esconder um que é — os dois viram compra errada.
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
  const verbaPorNome = (n) => ({ "Instalações Elétricas e Iluminação": "05",
    "Móveis Soltos": "24", "Pintura": "18" })[n] || null;
  const eapPadrao = () => [];
  ${trecho("const ALOC_MAT =", "/* =====[ FIM DO MODELO PURO")}
  ${bloco("function parcelasDoItem(")}
  ${bloco("function parcelasDaPlanilha(")}
  return { itensDoCanal, painelDoCanal };
})()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(56)} ${String(o).padEnd(12)} ${ok ? "" : "esperava " + e}`); };

const HOJE = new Date(2026, 7, 29);   // 29/08/2026
const it = (x) => ({ codigo: x.desc, ehTitulo: false, ...x });

/* Entrega em 30/09/2026. Móveis Soltos tem prazo de 75 dias: limite
   17/07 — JÁ VENCEU. Iluminação tem 30: limite 31/08, faltam 2 dias. */
const obra = {
  codigo: "2256", nome: "Bliss", dataEntrega: "2026-09-30",
  categorias: [
    { num: "24", nome: "Móveis Soltos", itens: [
      it({ desc: "Sofá", canalCompra: "mehoo", totalMaterial: 8000 }),
      it({ desc: "Poltrona", canalCompra: "mehoo", totalMaterial: 2000, comprado: true }),
      it({ desc: "Mesa", canalCompra: "sienge", totalMaterial: 5000 }),
      it({ desc: "Sem canal", totalMaterial: 900 }),
    ] },
    { num: "05", nome: "Instalações Elétricas e Iluminação", itens: [
      it({ desc: "Arandela", canalCompra: "mehoo", totalMaterial: 1500 }),
      it({ desc: "MARCENARIA", ehTitulo: true, canalCompra: "mehoo", totalMaterial: 999 }),
    ] },
    { num: "18", nome: "Pintura", itens: [
      it({ desc: "Pintura", canalCompra: "mehoo", totalMO: 3000 }),
    ] },
  ],
};

/* ---- 1. Só o que é do canal ----
   Mandar pro fornecedor item que não é dele, ou esconder um que é, vira
   compra errada dos dois jeitos. */
const meus = M.itensDoCanal(obra, "mehoo");
conf("pega só o canal pedido", meus.length, 4);
conf("item de outro canal fica fora", meus.some((r) => r.it.desc === "Mesa"), false);
conf("item sem canal fica fora", meus.some((r) => r.it.desc === "Sem canal"), false);
// Título de bloco nomeia escopo, nunca foi compra — nem com canal marcado.
conf("título de bloco não entra", meus.some((r) => r.it.desc === "MARCENARIA"), false);

/* ---- 2. Ordem: o mais apertado primeiro ----
   Móveis Soltos venceu em julho; iluminação vence em 2 dias; pintura não
   tem prazo de compra. */
conf("o vencido vem primeiro", meus[0].catNum, "24");
conf("sem prazo vai pro fim", meus[meus.length - 1].catNum, "18");

/* Saber que há quatro itens da Mehoo não ajuda sem saber até quando. */
conf("o limite vem calculado", meus[0].limite.toISOString().slice(0, 10), "2026-07-17");
conf("grupo sem regra não inventa prazo", meus[meus.length - 1].limite, null);

/* ---- 3. O painel ---- */
const outra = { codigo: "2307", nome: "Sunset", dataEntrega: "2027-06-30",
  categorias: [{ num: "24", nome: "Móveis Soltos", itens: [it({ desc: "Banqueta", canalCompra: "mehoo", totalMaterial: 700 })] }] };
const semNada = { codigo: "2405", nome: "Brisa", dataEntrega: null,
  categorias: [{ num: "24", nome: "Móveis Soltos", itens: [it({ desc: "Cadeira", canalCompra: "sienge", totalMaterial: 400 })] }] };

const p = M.painelDoCanal([outra, semNada, obra], "mehoo", HOJE);
/* Obra sem item do canal fica de fora: uma lista com quinze obras onde
   treze dizem "nenhum item" não é uma lista, é um estorvo. */
conf("obra sem item do canal não aparece", p.linhas.length, 2);
conf("a obra com atraso vem primeiro", p.linhas[0].obra.codigo, "2256");
conf("material do canal, só ele", p.linhas[0].total, 11500);
conf("o que já foi comprado", p.linhas[0].comprado, 2000);
conf("e o que falta", p.linhas[0].falta, 9500);
// Pintura é mão de obra: entra na lista, mas não no material a comprar.
conf("mão de obra não conta como material", p.linhas[0].itens.some((r) => r.mo === 3000), true);
conf("um item fora do prazo", p.linhas[0].atrasados, 1);
conf("total das duas obras", p.total, 12200);
conf("contagem de itens", p.nItens, 5);

/* Item já comprado não atrasa nada, mesmo com a data para trás: marcar de
   vermelho o que está resolvido ensina a ignorar o vermelho. */
const soComprado = M.painelDoCanal([{ ...obra, categorias: [
  { num: "24", nome: "Móveis Soltos", itens: [it({ desc: "Sofá", canalCompra: "mehoo", totalMaterial: 8000, comprado: true })] }] }], "mehoo", HOJE);
conf("comprado não atrasa", soComprado.linhas[0].atrasados, 0);

conf("lista vazia não quebra", M.painelDoCanal([], "mehoo", HOJE).linhas.length, 0);
conf("obra sem categorias não quebra", M.itensDoCanal({ codigo: "x" }, "mehoo").length, 0);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
