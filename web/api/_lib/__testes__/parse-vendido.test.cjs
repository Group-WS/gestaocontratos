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
"13","LOUCAS, METAIS E EQUIPAMENTOS ESPECIAIS","R$ 44.370,87",
// Descricao, quantidade e ambiente TODOS colados numa linha so — foi o
// que a Priscila viu na verba 27: "...Em Inox1,00un Living"
"13.1","Churrasqueira Parrilha Em Inox1,00un Living",
"13.5","Monocomando Tramontina Arko Em Aco Inox Com Bica Articulada1,00un Living",
"13.15","Chuveiro Statement2,00un Suite Master",
// Casos reais que a leitura curta errava: "7W"+12 virava 2, e
// "cromado"+10 virava 0 — quantidade zero num item que foi vendido.
"3.9","LP Mini embutido recuado 7W12,00un Living",
"13.37","Fixador de porta, cromado10,00un Tamoyo",
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
  // "PAR16" e designacao tecnica de refletor, nao quantidade: reconhecida
  // pela lista de codigos, o "4,00" e separado certo.
  "3.14": { qtd: 4, un: "un", ambiente: "Living" },
  "3.15": { qtd: 5, un: "un", ambiente: "Circulacao" },
  "13.1":  { qtd: 1, un: "un", ambiente: "Living" },
  "13.5":  { qtd: 1, un: "un", ambiente: "Living" },
  "13.15": { qtd: 2, un: "un", ambiente: "Suite Master" },
  "3.9":   { qtd: 12, un: "un", ambiente: "Living" },
  "13.37": { qtd: 10, un: "un", ambiente: "Tamoyo" },
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
// "13.1" continua duvidoso de proposito: "Inox1,00" nao tem codigo tecnico
// que ancore a separacao, entao a leitura e palpite e precisa ser conferida.
// Ja o "3.14" saiu da lista — com PAR16 reconhecido, a separacao deixou de
// ser chute.
if ((r.diagnostico.qtdDuvidosa || []).includes("3.14")) { console.error("FALHOU 3.14 nao devia mais ser duvidoso: PAR16 e reconhecido"); falhas++; }
if (!(r.diagnostico.qtdDuvidosa || []).includes("13.1")) { console.error("FALHOU 13.1 devia estar em qtdDuvidosa"); falhas++; }
const faltando = Object.keys(ESPERADO).filter((c) => !r.itens.some((i) => i.codigo === c));
if (faltando.length) { console.error("FALHOU itens nao lidos: " + faltando.join(", ")); falhas += faltando.length; }
if (r.verbas.length !== 4) { console.error("FALHOU verbas: esperava 4, veio " + r.verbas.length); falhas++; }

// Contrato SEM valor por verba (caso da 2506): a linha depois do nome do
// grupo e "0,000", nao um R$. O parser tem que devolver as verbas e os
// itens do mesmo jeito — quem decide se isso e erro e a tela, e ela so
// deve recusar quando nao veio NADA.
const semValor = [
  "Descrição",
  "2","SERVICOS COMPLEMENTARES","0,0000",
  "2.1","Anotacao de responsabilidade tecnica - RRT1,00vb0",
  "2.2","Cacambas de entulho1,00un 0",
  "6","CLIMATIZACAO/ EXAUSTAO","0,0000",
  "6.1","Ar-Condicionado Electrolux Split 18.000 BTUs Frio1,00un Living",
].join("\n");
const sv = fn(semValor);
if (sv.verbas.length !== 2) { console.error(`FALHOU sem-valor: esperava 2 verbas, veio ${sv.verbas.length}`); falhas++; }
if (sv.verbas.some((v) => v.valor != null)) { console.error("FALHOU sem-valor: nenhuma verba devia ter valor"); falhas++; }
if (sv.itens.length !== 3) { console.error(`FALHOU sem-valor: esperava 3 itens, veio ${sv.itens.length}`); falhas++; }
const ar = sv.itens.find((i) => i.codigo === "6.1");
if (!ar || ar.qtd !== 1 || ar.ambiente !== "Living") {
  console.error(`FALHOU sem-valor 6.1: qtd=${ar && ar.qtd} amb=${ar && ar.ambiente}`); falhas++;
}

console.log(falhas === 0 ? `\nOK — ${r.itens.length} itens, ${r.verbas.length} verbas, tudo conforme o PDF` : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
