/* Teste do leitor do Vendido Contrato.
 *
 * Roda com: node web/api/_lib/__testes__/parse-vendido.test.cjs
 *
 * Os casos vieram do contrato real da obra 2519, do jeito que o extrator
 * de PDF entrega o texto: cada celula da tabela vira uma ou mais linhas, e
 * o ambiente cai DEPOIS da quantidade — as vezes quebrado em duas linhas.
 * Era exatamente isso que se perdia: ambiente de uma linha vinha, de duas
 * sumia, e ninguem via porque o import dizia "importado" do mesmo jeito.
 */
const fs = require("fs");
let src = fs.readFileSync(require("path").join(__dirname, "..", "mondayApp.js"), "utf8");
const ini = src.indexOf("function parseVendidoTexto");
const fim = src.indexOf("\n}\n", src.indexOf("return { verbas, itens, diagnostico };"));
const corpo = src.slice(ini, fim + 2);
const helpers = `
const parseBRLnum = (t) => { const n = Number(String(t).replace(/\\./g,"").replace(",",".")); return Number.isFinite(n)?n:null; };
const limparDescResidual = (s) => String(s||"").trim();
`;
const fn = eval(`(function(){ ${helpers}\n${corpo}\n return parseVendidoTexto; })()`);

// Layout do PDF: cada celula vira uma ou mais linhas
const texto = [
"Descrição","5","PINTURA","R$ 6.193,00",
"5.1","Tinta para pintura em parede com aplicação de 3 demãos de tinta látex PVA self color. Cor Papel Picado, lata de 16L","2,00un","Living, Circulação,","Suíte 02",
"5.2","Tinta para pintura em parede. Cor Linho do Oriente, lata de 0,9L","1,00un","Circulação",
"5.3","Tinta para pintura em parede. Cor Bronzeado Natural, lata de 16L","1,00un","Suíte Master, Suíte","01",
"5.4","Material para pintura e emassamento em forro. Cor Branco Neve, Lata de 16L","2,00un Geral",
"3","INSTALACOES ELETRICAS E ILUMINACAO","R$ 50.134,00",
"3.14","Spot de Sobrepor Face Recuada Redondo Dicroica PAR164,00un Living",
"3.15","Embutido recuado 14W","5,00un Circulacao",
"7","MOVEIS SOB MEDIDA","R$ 296.478,50",
"7.1","Inclui neste projeto: 1 Armário com 4 Portas de giro em MDF e 2 em alumínio;","Borda de cabeceira;","1,00vb Suíte Master",
"7.2","Inclui neste projeto: 1 Armário aéreo com nichos laterais e 2 Portas de alumínio;","1,00vb","Bwc Suíte Master","Master",
].join("\n");

const r = fn(texto);
console.log("verbas:", r.verbas.map(v=>v.num+" "+v.nome).join(" | "));
console.log("");
for (const it of r.itens) {
  console.log(`${it.codigo.padEnd(5)} qtd=${String(it.qtd).padEnd(5)} un=${String(it.un).padEnd(4)} amb=${it.ambiente || "(nulo)"}`);
}

const ESPERADO = {
  "5.1": { qtd: 2, un: "un", ambiente: "Living, Circulação, Suíte 02" },
  "5.2": { qtd: 1, un: "un", ambiente: "Circulação" },
  "5.3": { qtd: 1, un: "un", ambiente: "Suíte Master, Suíte 01" },
  "5.4": { qtd: 2, un: "un", ambiente: "Geral" },
  // Colado pelo extrator: nao da pra saber onde separa, entao a quantidade
  // fica vazia e o item e reportado — melhor que inventar 164 no lugar de 4.
  "3.14": { qtd: null, un: null, ambiente: null },
  "3.15": { qtd: 5, un: "un", ambiente: "Circulacao" },
  "7.1": { qtd: 1, un: "vb", ambiente: "Suíte Master" },
  "7.2": { qtd: 1, un: "vb", ambiente: "Bwc Suíte Master Master" },
};

let falhas = 0;
for (const it of r.itens) {
  const e = ESPERADO[it.codigo];
  if (!e) continue;
  for (const campo of ["qtd", "un", "ambiente"]) {
    if (String(it[campo]) !== String(e[campo])) {
      console.error(`FALHOU ${it.codigo}.${campo}: esperava "${e[campo]}", veio "${it[campo]}"`);
      falhas++;
    }
  }
}
if (!(r.diagnostico.qtdDuvidosa || []).includes("3.14")) { console.error("FALHOU 3.14 devia estar em qtdDuvidosa"); falhas++; }
const faltando = Object.keys(ESPERADO).filter((c) => !r.itens.some((i) => i.codigo === c));
if (faltando.length) { console.error("FALHOU itens nao lidos: " + faltando.join(", ")); falhas += faltando.length; }
if (r.verbas.length !== 3) { console.error("FALHOU verbas: esperava 3, veio " + r.verbas.length); falhas++; }

console.log(falhas === 0 ? `\nOK — ${r.itens.length} itens, ${r.verbas.length} verbas, tudo conforme o PDF` : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
