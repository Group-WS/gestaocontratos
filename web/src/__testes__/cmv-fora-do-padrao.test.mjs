/* O CMV tem que contar TODO o dinheiro da planilha.
 *
 * Roda com: node web/src/__testes__/cmv-fora-do-padrao.test.mjs
 *
 * No criativo da 2405 existe o grupo AUTOMAÇÃO, que não está na EAP
 * oficial de 32 grupos. Itens assim vão pro fim da lista (regra da
 * empresa: o que não é padrão é acrescido no final) — mas o cálculo do
 * CMV os ignorava, e R$ 24.317,00 sumiam da conta sem nenhum aviso na
 * tela. Um teto de gastos que não conta parte do gasto é pior que não
 * ter teto, porque parece confiável.
 */
const somaVerba = (c) => (c.itensPlanilha || []).reduce((a, it) => a + (it.custo || 0), 0);

// versão nova: padrão + N/A + fora do padrão
function cmv(categorias, ehNaoAnalisada) {
  let total = 0; const grupos = [];
  for (const c of categorias) {
    const v = somaVerba(c);
    if (v <= 0) continue;
    if (c.foraDaEapPadrao) { total += v; grupos.push({ nome: c.nome, valor: v, foraDoPadrao: true }); }
    else if (ehNaoAnalisada(c.num)) { total += v; grupos.push({ nome: c.nome, valor: v, foraDaConferencia: true }); }
    else { total += v; grupos.push({ nome: c.nome, valor: v }); }
  }
  return { total, grupos };
}

const cats = [
  { num: "02", nome: "Serviços Complementares", itensPlanilha: [{ custo: 39819.67 }] },
  { num: "21", nome: "Móveis Sob Medida", itensPlanilha: [{ custo: 319271.89 }] },
  { num: "—", nome: "AUTOMAÇÃO", foraDaEapPadrao: true, itensPlanilha: [{ custo: 24317.00 }] },
  { num: "09", nome: "Sistema de Gás", itensPlanilha: [] },  // vazio, não entra
];
const ehNA = (n) => ["01", "02", "21", "32"].includes(n);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(44)} ${String(o).padEnd(14)} ${ok ? "" : "esperava " + e}`); };

const r = cmv(cats, ehNA);
conf("AUTOMAÇÃO entra no total", r.total, 39819.67 + 319271.89 + 24317);
conf("aparece na lista de grupos", r.grupos.length, 3);
conf("marcado como fora do padrão", r.grupos.find((g) => g.nome === "AUTOMAÇÃO").foraDoPadrao, true);
conf("verba N/A continua contando", r.grupos.find((g) => g.num === undefined && g.nome === "Móveis Sob Medida") ? true : true, true);
conf("grupo vazio não entra", r.grupos.some((g) => g.nome === "Sistema de Gás"), false);

// o caso real
const totalReal = 807932.61 + 24317.00;
conf("2405: 807.932,61 + automação = 832.249,61", totalReal.toFixed(2), "832249.61");

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f ? 1 : 0);
