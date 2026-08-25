/* Prazo de compra: até quando o material TEM que estar comprado.
 *
 * Roda com: node web/src/__testes__/prazo-compra.test.mjs
 *
 * As funções são EXTRAÍDAS do App.jsx e rodam de verdade.
 *
 * O que está em jogo: móveis soltos levam 75 dias pra chegar. Comprados
 * com 40, atrasam a entrega da obra inteira — e ninguém faz essa
 * subtração de cabeça no meio de uma conferência de 200 itens.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "App.jsx"), "utf8");
const trecho = (de, ate) => {
  const i = src.indexOf(de), f = src.indexOf(ate);
  if (i === -1) throw new Error(`não achei no App.jsx o início: ${de}`);
  if (f === -1) throw new Error(`não achei no App.jsx o fim: ${ate}`);
  return src.slice(i, f);
};

const { prazoDoGrupo, dataLimiteCompra, diasAte, PRAZOS_COMPRA } =
  eval(`(function () {
    const verbaPorNome = (n) => ({
      "Instalações Elétricas e Iluminação": "05", "Climatização / Exaustão": "20",
      "Móveis Soltos": "24", "Louças, Metais e Equipamentos Especiais": "27",
      "Eletroeletrônico": "28", "Pintura": "18", "Serralheria": "22",
    })[n] || null;
    ${trecho("const PRAZOS_COMPRA = {", "/* =====[ FIM DO MODELO PURO")}
    return { prazoDoGrupo, dataLimiteCompra, diasAte, PRAZOS_COMPRA };
  })()`);

let f = 0;
const conf = (n, o, e) => {
  const ok = String(o) === String(e);
  if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(54)} ${String(o).padEnd(12)} ${ok ? "" : "esperava " + e}`);
};

const g = (num, nome, extra = {}) => ({ num, nome, ...extra });
const dias = (cat, itens) => { const p = prazoDoGrupo(cat, itens); return p ? p.dias : null; };

/* ---- 1. as regras que a Priscila passou ---- */
conf("iluminação: 30 dias", dias(g("05", "Instalações Elétricas e Iluminação")), 30);
conf("climatização: 30 dias", dias(g("20", "Climatização / Exaustão")), 30);
conf("móveis soltos: 75 dias", dias(g("24", "Móveis Soltos")), 75);
// Ela não passou número pra eletroeletrônico — fica em branco de propósito.
conf("eletroeletrônico: sem regra, fica em branco", dias(g("28", "Eletroeletrônico")), null);
conf("pintura: sem regra", dias(g("18", "Pintura")), null);
// Automação não está na EAP de 32 grupos: entra pelo nome.
conf("automação: 30 dias, mesmo fora da EAP",
  dias(g("—", "AUTOMAÇÃO", { foraDaEapPadrao: true })), 30);
conf("grupo fora da EAP sem regra fica em branco",
  dias(g("—", "MARCENARIA EXTERNA", { foraDaEapPadrao: true })), null);

/* ---- 2. louças e metais: dois prazos, por fornecedor ---- */
// Docol 90, Bracci 30. Um número só por grupo não dá conta.
const loucas = g("27", "Louças, Metais e Equipamentos Especiais");
const comDocol = [{ desc: "Torneira", marca: "Docol" }, { desc: "Cuba", marca: "Deca" }];
const comBracci = [{ desc: "Metal", marca: "Bracci Metais" }];
const comOsDois = [...comDocol, ...comBracci];
const semFornecedor = [{ desc: "Cuba", marca: "Histórico de compra" }];

conf("só Docol: 90 dias", dias(loucas, comDocol), 90);
conf("só Bracci: 30 dias", dias(loucas, comBracci), 30);
// Se tem Docol na verba, vale o dela: senão a peça chega depois da obra.
conf("os dois na verba: vale o mais apertado (90)", dias(loucas, comOsDois), 90);
conf("... e a tela avisa que há mais de um", prazoDoGrupo(loucas, comOsDois).varios, true);
conf("nomeia o fornecedor que mandou", prazoDoGrupo(loucas, comDocol).fornecedor, "Docol");

// Nenhum fornecedor reconhecido: vale o mais longo, marcado como incerto.
// Errar pro lado da compra adiantada custa estoque; pro outro, a entrega.
conf("sem fornecedor reconhecido: assume o mais longo", dias(loucas, semFornecedor), 90);
conf("... e marca como incerto", prazoDoGrupo(loucas, semFornecedor).incerto, true);
conf("verba vazia também assume o mais longo", dias(loucas, []), 90);

/* ---- 3. grupo sem regra não mostra nada ---- */
// Vinte células vazias pedindo um número que ninguém tem competem com as
// cinco que carregam informação de verdade. Sem regra, sem célula.
conf("sem regra devolve null, não um zero", prazoDoGrupo(g("28", "Eletroeletrônico"), []), null);
conf("... e não um objeto vazio", prazoDoGrupo(g("18", "Pintura"), []) === null, true);

/* ---- 4. a data, contada pra trás ---- */
const limite = dataLimiteCompra("2026-12-15", 30);
conf("15/12 menos 30 dias = 15/11", limite.toLocaleDateString("pt-BR"), "15/11/2026");
conf("... e não pula pro dia 14 por causa do fuso", limite.getDate(), 15);
conf("75 dias antes de 15/12 = 01/10",
  dataLimiteCompra("2026-12-15", 75).toLocaleDateString("pt-BR"), "01/10/2026");
conf("sem data de entrega não há limite", dataLimiteCompra(null, 30), null);
conf("data inválida não vira NaN na tela", dataLimiteCompra("nao-e-data", 30), null);

/* ---- 5. a contagem regressiva ---- */
const hoje = new Date(2026, 8, 1);          // 01/09/2026
conf("faltam 14 dias", diasAte(new Date(2026, 8, 15), hoje), 14);
conf("é hoje = 0", diasAte(new Date(2026, 8, 1), hoje), 0);
conf("já passou = negativo", diasAte(new Date(2026, 7, 20), hoje), -12);
// A hora do dia não pode mexer na contagem, senão "faltam 3 dias" vira 2.
conf("hora do dia não altera a conta",
  diasAte(new Date(2026, 8, 15, 23, 59), new Date(2026, 8, 1, 0, 1)), 14);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
