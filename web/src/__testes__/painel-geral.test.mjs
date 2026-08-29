/* O painel geral de compras e contratações.
 *
 * Roda com: node web/src/__testes__/painel-geral.test.mjs
 *
 * É o único lugar do app que soma obras DIFERENTES. Um erro aqui não
 * aparece como número torto numa linha: aparece como um planejamento de
 * compra inteiro apontando pro mês errado, e ninguém confere isso contra
 * a planilha — é justamente pra não ter que conferir que a tela existe.
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
/* parcelasDoItem mora depois do marcador de fim do modelo, junto com o
   JSX — é uma função pura no lugar errado, e mexer nela é assunto de
   outra tarefa. Enquanto isso, sai recortada à parte, como o teste da
   Dashboard MO já faz. */
const bloco = (assinatura, fim = "\n}\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei no App.jsx: ${assinatura}`);
  const f = src.indexOf(fim, i);
  return src.slice(i, f + fim.length);
};

const { resumoDaObra, resumoGeral } = eval(`(function () {
  const padraoDaDescricao = () => null;
  const verbaPorNome = (n) => ({ "Instalações Elétricas e Iluminação": "05",
    "Climatização": "20", "Mobília Solta": "24", "Pintura": "18",
    "Gesso e Drywall": "10", "Louças e Metais": "27" })[n] || null;
  ${trecho("const ALOC_MAT =", "/* =====[ FIM DO MODELO PURO")}
  ${bloco("function parcelasDoItem(")}
  ${bloco("function parcelasDaPlanilha(")}
  return { resumoDaObra, resumoGeral };
})()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(58)} ${String(o).padEnd(12)} ${ok ? "" : "esperava " + e}`); };

const HOJE = new Date(2026, 7, 29);            // 29/08/2026
/* Os totais vão direto: a planilha traz `totalMaterial`/`totalMO`, e é
   isso que `parcelasDoItem` lê. Passar custo unitário aqui obrigaria a
   também acertar `qtdExecutivo`, e o teste passaria a ser sobre o
   rateio, que já tem teste próprio. */
const item = (x) => ({ desc: "x", ...x });

/* Obra com entrega em 30/09/2026 — 32 dias à frente.
   Iluminação tem prazo de 30 dias: limite 31/08, ainda não venceu.
   Climatização também 30 dias.
   Mobília Solta tem 75: limite 17/07, JÁ VENCEU. */
const obra = {
  id: "2256", codigo: "2256", nome: "Bliss", dataEntrega: "2026-09-30",
  categorias: [
    { num: "05", nome: "Instalações Elétricas e Iluminação", itens: [
      item({ desc: "Spot", totalMaterial: 1000, totalMO: 300 }),
      item({ desc: "Arandela", totalMaterial: 500, totalMO: 0, comprado: true }),
    ] },
    { num: "24", nome: "Mobília Solta", itens: [
      item({ desc: "Sofá", totalMaterial: 8000, totalMO: 0 }),
    ] },
    { num: "18", nome: "Pintura", itens: [
      item({ desc: "Pintura das paredes", totalMaterial: 0, totalMO: 4000 }),
      item({ desc: "Textura", totalMaterial: 0, totalMO: 1000, statusContrato: "contrato_gerado" }),
    ] },
  ],
};

const R = resumoDaObra(obra, HOJE);

/* ---- 1. MAT e MO somam separado ---- */
conf("material total", R.mat.total, 9500);
conf("material já comprado", R.mat.feito, 500);
conf("mão de obra total", R.mo.total, 5300);
// Contrato gerado conta como andado; solicitação nenhuma, não.
conf("mão de obra já encaminhada", R.mo.feito, 1000);
conf("falta contratar", R.mo.falta, 4300);

/* ---- 2. Atraso é prazo vencido COM compra pendente ---- */
// Mobília: 75 dias antes de 30/09 é 17/07 — venceu, e o sofá não foi comprado.
conf("mobília aparece como atrasada", R.atrasos.some((a) => a.num === "24"), true);
// Iluminação: 30 dias antes de 30/09 é 31/08 — faltam 2 dias.
conf("iluminação está perto, não atrasada", R.perto.some((a) => a.num === "05"), true);
conf("iluminação não entra em atraso", R.atrasos.some((a) => a.num === "05"), false);
// Pintura é mão de obra: não tem prazo de compra e não pode inventar um.
conf("pintura não gera alerta de compra", [...R.atrasos, ...R.perto].some((a) => a.num === "18"), false);

/* Grupo já comprado não atrasa nada, mesmo com a data para trás —
   marcar de vermelho o que está resolvido ensina a ignorar o vermelho. */
const semFalta = resumoDaObra({ ...obra, categorias: [
  { num: "24", nome: "Mobília Solta", itens: [item({ desc: "Sofá", totalMaterial: 8000, comprado: true })] },
] }, HOJE);
conf("grupo comprado não atrasa", semFalta.atrasos.length, 0);

/* ---- 3. Somando obras ---- */
const obra2 = {
  id: "2307", codigo: "2307", nome: "Sunset", dataEntrega: "2027-06-30",
  categorias: [{ num: "18", nome: "Pintura", itens: [item({ desc: "Pintura", totalMO: 6000 })] }],
};
const G = resumoGeral([obra, obra2], { hoje: HOJE });
const pintura = G.aContratar.find((g) => g.num === "18");
// 4.000 do que falta na 2256 (a textura já tem contrato) + 6.000 da 2307.
conf("pintura soma as duas obras", pintura.total, 10000);
conf("e sabe quantas obras são", pintura.obras.size, 2);
conf("obra atrasada vem primeiro na lista", G.linhas[0].codigo, "2256");
conf("conta as obras atrasadas", G.totais.obrasAtrasadas, 1);

/* ---- 4. Horizonte ----
   É a pergunta que a tela existe pra responder: "quanto de pintura nas
   próximas semanas". A 2256 entrega em 30/09 (32 dias à frente); a 2307
   só em jun/27. */
const G4 = resumoGeral([obra, obra2], { hoje: HOJE, horizonteDias: 28 });
// 32 dias > 28: a mão de obra da 2256 ainda não é problema destas semanas.
conf("em 4 semanas nenhuma pintura entra", G4.aContratar.some((g) => g.num === "18"), false);
// Mas comprar tem prazo próprio, e ele é ANTES da entrega: iluminação
// vence em 31/08, daqui a 2 dias.
conf("mas a compra de iluminação entra", G4.aComprar.some((g) => g.num === "05"), true);
// Mobília venceu em julho: atraso não sai da conta por ser velho.
conf("o que já venceu continua na conta", G4.aComprar.some((g) => g.num === "24"), true);

const G8 = resumoGeral([obra, obra2], { hoje: HOJE, horizonteDias: 56 });
conf("em 8 semanas entra a pintura da 2256", G8.aContratar.find((g) => g.num === "18").total, 4000);
conf("e a 2307 continua fora", G8.aContratar.find((g) => g.num === "18").obras.size, 1);

/* Obra sem data não pode ser recortada por prazo. Ela sai do recorte e é
   contada à parte — some calada seria pior que aparecer de fora. */
const semData = { id: "9", codigo: "9", nome: "Sem data", dataEntrega: null,
  categorias: [{ num: "18", nome: "Pintura", itens: [item({ desc: "Pintura", totalMO: 7000 })] }] };
const GS = resumoGeral([obra, semData], { hoje: HOJE, horizonteDias: 56 });
conf("obra sem data fica fora do recorte", GS.aContratar.find((g) => g.num === "18").total, 4000);
conf("mas o valor dela é anunciado", GS.semData, 7000);
// Sem recorte ela entra normalmente.
conf("sem recorte ela entra", resumoGeral([obra, semData], { hoje: HOJE })
  .aContratar.find((g) => g.num === "18").total, 11000);

/* ---- 5. Obra sem planilha não polui a lista ---- */
const vazia = { id: "0", codigo: "0", nome: "Vazia", categorias: [{ num: "18", nome: "Pintura", itens: [] }] };
conf("obra sem planilha não vira linha", resumoGeral([vazia], { hoje: HOJE }).linhas.length, 0);
conf("lista vazia não quebra", resumoGeral([], { hoje: HOJE }).linhas.length, 0);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
