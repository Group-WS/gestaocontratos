/* A importacao da planilha de padronizacao.
 *
 * Roda contra o ARQUIVO REAL quando ele esta na Downloads, e contra um
 * recorte fixo sempre -- assim o teste continua valendo depois que o
 * arquivo dela sair da maquina. */
import assert from "node:assert";
import { lerProdutos, ancorasDeImagem, juntar, resumoDaImportacao, verbaDoGrupo }
  from "../lib/catalogoImport.js";

const APELIDOS = {
  "05": ["instalacaoeletrica", "eletrica", "iluminacao", "luminotecnic"],
  "24": ["moveissolto", "solto"],
  "27": ["louca", "metaissanitario", "metais"],
  "30": ["cortina", "persian"],
  "28": ["eletroeletronic", "eletro"],
  "33": ["sonoriza", "audio"],
  "34": ["automacao", "automatiza", "domotic"],
};

let ok = 0;
const t = (nome, f) => { f(); console.log("ok  ", nome); ok++; };

t("o grupo da planilha vira verba da EAP", () => {
  assert.strictEqual(verbaDoGrupo("ILUMINAÇÃO", APELIDOS), "05");
  assert.strictEqual(verbaDoGrupo("LOUÇAS E METAIS", APELIDOS), "27");
  assert.strictEqual(verbaDoGrupo("MÓVEIS SOLTOS", APELIDOS), "24");
  assert.strictEqual(verbaDoGrupo("CORTINAS E PERSIANAS", APELIDOS), "30");
  assert.strictEqual(verbaDoGrupo("SONORIZAÇÃO", APELIDOS), "33");
  assert.strictEqual(verbaDoGrupo("AUTOMAÇÃO", APELIDOS), "34");
});

t("o apelido MAIS LONGO ganha — eletroeletronic antes de eletro", () =>
  assert.strictEqual(verbaDoGrupo("ELETROELETRÔNICOS", APELIDOS), "28"));

t("grupo desconhecido nao vira verba errada — vira nenhuma", () =>
  assert.strictEqual(verbaDoGrupo("PAISAGISMO DE VARANDA", APELIDOS), null));

/* --- recorte fixo, com as armadilhas da planilha dela --- */
const PLAN = [
  ["ILUMINAÇÃO"],
  ["IMAGEM", "DESCRIÇÃO", "CÓDIGO", "FORNECEDOR ", "OBSERVAÇÕES", "PREÇO"],
  ["", "SPOT EMBUTIDO POWERUS 3 LEDS BRANCO 6W 3000K", "6730", "NORDECOR", "", "1.213,11"],
  ["", "FITA LED NOR 2835 12V 8W 3000K", "7117", "NORDECOR", "DECORATIVO", ""],
  [],
  ["MÓVEIS SOLTOS", "0", "0", "0", "0"],
  ["IMAGEM", "DESCRIÇÃO", "CÓDIGO", "FORNECEDOR ", "OBSERVAÇÕES"],
  ["", "Colchão Queen 158x198cm", "C1728 - 5016337", "Herval ", ""],
];

const P = lerProdutos(PLAN, APELIDOS);

t("titulo de grupo e cabecalho repetido nao viram produto", () =>
  assert.strictEqual(P.length, 3));

t("titulo de grupo acompanhado de ZEROS ainda e' titulo", () =>
  assert.strictEqual(P[2].grupo, "MÓVEIS SOLTOS"));

t("cada produto herda a verba do seu grupo", () =>
  assert.deepStrictEqual(P.map((p) => p.verba), ["05", "05", "24"]));

t("espaco no fim nao cria fornecedor duplicado", () =>
  assert.strictEqual(P[2].fornecedor, "Herval"));

t("o subgrupo ja' vem classificado", () =>
  assert.deepStrictEqual(P.map((p) => p.subgrupo), ["Spots", "Fitas LED", "Colchões"]));

t("a linha e' preservada — e' por ela que a foto acha o produto", () =>
  assert.deepStrictEqual(P.map((p) => p.linha), [2, 3, 7]));

t("preco em texto brasileiro vira centavos inteiros", () =>
  assert.strictEqual(P[0].precoRef, 121311));

t("coluna de preco vazia, ou ausente na linha, nao vira zero", () => {
  assert.strictEqual(P[1].precoRef, null);
  assert.strictEqual(P[2].precoRef, null);
});

/* --- as ancoras de imagem --- */
const DRAW = `<xdr:twoCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:row>2</xdr:row></xdr:from>
  <xdr:pic><xdr:blipFill><a:blip r:embed="rId1"/></xdr:blipFill></xdr:pic></xdr:twoCellAnchor>
  <xdr:twoCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:row>7</xdr:row></xdr:from>
  <xdr:pic><xdr:blipFill><a:blip r:embed="rId2"/></xdr:blipFill></xdr:pic></xdr:twoCellAnchor>`;
const RELS = `<Relationship Id="rId1" Target="../media/image1.jpeg"/>
  <Relationship Id="rId2" Target="../media/image2.png"/>
  <Relationship Id="rId9" Target="../printerSettings/printerSettings1.bin"/>`;

const A = ancorasDeImagem(DRAW, RELS);

t("a ancora liga linha -> arquivo de imagem", () => {
  assert.strictEqual(A.get(2), "xl/media/image1.jpeg");
  assert.strictEqual(A.get(7), "xl/media/image2.png");
});

t("relacao que nao e' imagem fica de fora", () =>
  assert.strictEqual(A.size, 2));

t("juntar poe a foto no produto certo", () => {
  const J = juntar(P, A);
  assert.strictEqual(J[0].arquivoImagem, "xl/media/image1.jpeg");
  assert.strictEqual(J[1].arquivoImagem, null);
  assert.strictEqual(J[2].arquivoImagem, "xl/media/image2.png");
});

t("o resumo diz o que NAO vai entrar", () => {
  const orfao = lerProdutos([["PAISAGISMO"], ["", "Vaso de barro grande", "", "Faas"]], APELIDOS);
  const r = resumoDaImportacao(orfao);
  assert.strictEqual(r.total, 1);
  assert.strictEqual(r.validos, 0);
  assert.deepStrictEqual(r.gruposSemVerba, ["PAISAGISMO"]);
});

t("o resumo conta fotos, fornecedores e o que falta classificar", () => {
  const r = resumoDaImportacao(juntar(P, A));
  assert.strictEqual(r.comFoto, 2);
  assert.strictEqual(r.comPreco, 1);
  assert.deepStrictEqual(r.fornecedores, ["NORDECOR", "Herval"]);
  assert.strictEqual(r.semSubgrupo, 0);
});

/* --- o arquivo real, quando ele existe --- */
const CAMINHO = "/Users/priscilageraldo/Downloads/PADRONIZAÇÃO DE PRODUTOS TKWS.xlsx";
const fs = await import("node:fs");
if (fs.existsSync(CAMINHO)) {
  const XLSX = (await import("xlsx")).default;
  const wb = XLSX.read(fs.readFileSync(CAMINHO), { type: "buffer", bookFiles: true });
  const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: "" });
  const prods = lerProdutos(linhas, APELIDOS);
  const anc = ancorasDeImagem(
    wb.files["xl/drawings/drawing1.xml"]?.content?.toString?.("utf8"),
    wb.files["xl/drawings/_rels/drawing1.xml.rels"]?.content?.toString?.("utf8"));
  const r = resumoDaImportacao(juntar(prods, anc));

  t("ARQUIVO REAL: 56 produtos, todos com verba e subgrupo", () => {
    assert.strictEqual(r.total, 56);
    assert.strictEqual(r.validos, 56);
    assert.strictEqual(r.semSubgrupo, 0);
    assert.deepStrictEqual(r.gruposSemVerba, []);
  });
  t("ARQUIVO REAL: as fotos acham seus produtos", () => assert.ok(r.comFoto >= 30, `${r.comFoto} fotos`));
  t("ARQUIVO REAL: 7 fornecedores", () => assert.strictEqual(r.fornecedores.length, 7));
} else {
  console.log("--   (arquivo real nao esta na maquina; os casos fixos cobrem o resto)");
}

console.log(`\nOK — ${ok} casos`);
