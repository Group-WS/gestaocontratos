/* A biblioteca de materiais em .pptx.
 *
 * Aqui nao ha tabela nem coluna: a informacao esta' na GEOMETRIA -- foto
 * em cima, legenda logo abaixo -- e a familia esta' no rodape do slide.
 * O que erra calado: legenda roubada do vizinho, e acabamento entrando
 * como produto (e virando linha de custo pra uma COR). */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { lerPptx, resumoPptx, familiaDoTitulo, fornecedorDoTitulo, tipoDoItem } from "../lib/catalogoPptx.js";

let ok = 0;
const t = (nome, f) => { f(); console.log("ok  ", nome); ok++; };

const EMU = 9525;
const forma = (tipo, x, y, w, h, extra) =>
  tipo === "pic"
    ? `<p:pic><p:blipFill><a:blip r:embed="${extra}"/></p:blipFill><p:spPr><a:xfrm>` +
      `<a:off x="${x*EMU}" y="${y*EMU}"/><a:ext cx="${w*EMU}" cy="${h*EMU}"/></a:xfrm></p:spPr></p:pic>`
    : `<p:sp><p:spPr><a:xfrm><a:off x="${x*EMU}" y="${y*EMU}"/><a:ext cx="${w*EMU}" cy="${h*EMU}"/>` +
      `</a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>${extra}</a:t></a:r></a:p></p:txBody></p:sp>`;

const RELS = `<Relationship Id="rId3" Target="../media/image1.png"/>
  <Relationship Id="rId4" Target="../media/image2.png"/>
  <Relationship Id="rId9" Target="../slideLayouts/slideLayout1.xml"/>`;

/* ---------- a familia, tirada do rodape ---------- */
t("MDF, laca e tecido sao ACABAMENTO; metal e eletro sao PRODUTO", () => {
  /* O ENQUADRAMENTO e' dela: madeira, couro, laca, MDF e tecido sao
     acabamentos de MOVEIS SOLTOS (24); travertino e quartzito sao de
     marmoraria (26); pintura e efeito, de pintura (18). */
  assert.strictEqual(familiaDoTitulo("ARQUIVOS BASE EXECUTIVO – MDFS PADRÃO DALMOBILE").tipo, "acabamento");
  assert.strictEqual(familiaDoTitulo("ARQUIVOS BASE EXECUTIVO – PINTURAS SUVINIL").tipo, "acabamento");
  assert.strictEqual(familiaDoTitulo("TECIDOS / BESS TECIDOS").tipo, "acabamento");
  assert.strictEqual(familiaDoTitulo("TECIDOS / BESS TECIDOS").verba, "24");
  assert.strictEqual(familiaDoTitulo("ARQUIVOS BASE EXECUTIVO – MDFS PADRÃO DALMOBILE").verba, "24");
  assert.strictEqual(familiaDoTitulo("ARQUIVOS BASE EXECUTIVO – PEDRAS").verba, "26");
  assert.strictEqual(familiaDoTitulo("TRAVERTINO E QUARTZITO").verba, "26");
  assert.strictEqual(familiaDoTitulo("ARQUIVOS BASE EXECUTIVO – PINTURAS SUVINIL").verba, "18");
  assert.strictEqual(familiaDoTitulo("ARQUIVOS BASE EXECUTIVO – METAIS").tipo, "produto");
  assert.strictEqual(familiaDoTitulo("ARQUIVOS BASE EXECUTIVO – ELETROS").tipo, "produto");
});

t("o mais especifico ganha: LAMINAS antes de MDF", () =>
  assert.strictEqual(
    familiaDoTitulo("ARQUIVOS BASE EXECUTIVO – MDFS PADRÃO DALMOBILE – LÂMINAS").familia, "Lâminas"));

t("slide que nao e' de material nao vira nada", () => {
  assert.strictEqual(familiaDoTitulo("TKWS  |  PLANTA BAIXA"), null);
  assert.strictEqual(familiaDoTitulo(""), null);
});

/* ---------- acabamento se reconhece pelo NOME, nao so' pelo slide ---------- */
t("num slide de decoracao, a peca e o acabamento se separam", () => {
  /* Prega e blackout sao jeitos de FAZER a cortina; persiana e' peca.
     Sem olhar o item, a prega viraria linha de custo no orcamento. */
  assert.strictEqual(tipoDoItem("PREGA MACHO", "produto"), "acabamento");
  assert.strictEqual(tipoDoItem("PREGA FÊMEA", "produto"), "acabamento");
  assert.strictEqual(tipoDoItem("BLACKOUT EMBUTIDO", "produto"), "acabamento");
  assert.strictEqual(tipoDoItem("BLACKOUT TRILHO", "produto"), "acabamento");
  assert.strictEqual(tipoDoItem("CORTINA LINHO OFF WHITE", "produto"), "acabamento");
  /* Persiana e cortina tambem sao acabamento: a linha inteira e', e foi
     ela quem enquadrou. Cortina nao se compra de catalogo, se especifica. */
  assert.strictEqual(familiaDoTitulo("ARQUIVOS BASE EXECUTIVO – DECORAÇÃO").tipo, "acabamento");
  assert.strictEqual(tipoDoItem("PERSIANA HORIZONTAL PRETA", "acabamento"), "acabamento");
});

t("peca dentro de slide de acabamento tambem e' reconhecida", () => {
  assert.strictEqual(tipoDoItem("TORNEIRA LIFT CROMADA", "acabamento"), "produto");
  assert.strictEqual(tipoDoItem("SPOT MR16 EMBUTIDO", "acabamento"), "produto");
});

t("o que nao tem marca nenhuma fica com o padrao do slide", () => {
  assert.strictEqual(tipoDoItem("ITEM QUE NINGUEM PREVIU", "acabamento"), "acabamento");
  assert.strictEqual(tipoDoItem("ITEM QUE NINGUEM PREVIU", "produto"), "produto");
});

/* ---------- o fornecedor ---------- */
t("o fornecedor sai do titulo, sem as palavras de estrutura", () => {
  assert.strictEqual(fornecedorDoTitulo("ARQUIVOS BASE EXECUTIVO – MDFS PADRÃO DALMOBILE"), "DALMOBILE");
  assert.strictEqual(fornecedorDoTitulo("ARQUIVOS BASE EXECUTIVO – PINTURAS SUVINIL"), "SUVINIL");
  assert.strictEqual(fornecedorDoTitulo("ARQUIVOS BASE EXECUTIVO – PINTURAS SHERWIN WILLIAMS"), "SHERWIN WILLIAMS");
});

t("'TECIDOS PARA BOX DE CAMA LIFE' da' LIFE, e nao a frase inteira", () =>
  assert.strictEqual(fornecedorDoTitulo("ARQUIVOS BASE EXECUTIVO – TECIDOS PARA BOX DE CAMA LIFE"), "LIFE"));

t("titulo sem nome de casa nao inventa fornecedor", () => {
  assert.strictEqual(fornecedorDoTitulo("ARQUIVOS BASE EXECUTIVO – METAIS"), null);
  assert.strictEqual(fornecedorDoTitulo("ARQUIVOS BASE EXECUTIVO – ILUMINAÇÃO E LINHAS DE CHAMADA"), null);
});

/* ---------- o pareamento foto <-> legenda ---------- */
t("cada foto pega a legenda de BAIXO DELA, e nao a do vizinho", () => {
  const xml = "<root>" +
    forma("sp", 39, 657, 400, 32, "ARQUIVOS BASE EXECUTIVO – MDFS PADRÃO DALMOBILE") +
    forma("pic", 100, 50, 120, 120, "rId3") +
    forma("pic", 300, 50, 120, 120, "rId4") +
    forma("sp", 95, 180, 130, 26, "MDF OFF WHITE") +
    forma("sp", 295, 180, 130, 26, "MDF FREIJO") + "</root>";
  const r = lerPptx([{ xml, rels: RELS }]);
  assert.strictEqual(r.length, 2);
  assert.strictEqual(r[0].descricao, "MDF OFF WHITE");
  assert.strictEqual(r[0].arquivoImagem, "ppt/media/image1.png");
  assert.strictEqual(r[1].descricao, "MDF FREIJO");
  assert.strictEqual(r[1].arquivoImagem, "ppt/media/image2.png");
});

t("legenda da fila DE BAIXO nao e' roubada pela foto de cima", () => {
  const xml = "<root>" +
    forma("sp", 39, 657, 400, 32, "ARQUIVOS BASE EXECUTIVO – PEDRAS") +
    forma("pic", 100, 50, 120, 120, "rId3") +
    forma("sp", 95, 500, 130, 26, "PEDRA MUITO LONGE") + "</root>";
  assert.strictEqual(lerPptx([{ xml, rels: RELS }]).length, 0);
});

t("foto sem legenda nao vira produto sem nome", () => {
  const xml = "<root>" +
    forma("sp", 39, 657, 400, 32, "ARQUIVOS BASE EXECUTIVO – METAIS") +
    forma("pic", 100, 50, 120, 120, "rId3") + "</root>";
  assert.strictEqual(lerPptx([{ xml, rels: RELS }]).length, 0);
});

t("o titulo do slide nao vira legenda de ninguem", () => {
  const xml = "<root>" +
    forma("sp", 39, 657, 400, 32, "ARQUIVOS BASE EXECUTIVO – METAIS") +
    forma("pic", 100, 560, 60, 60, "rId3") + "</root>";
  assert.strictEqual(lerPptx([{ xml, rels: RELS }]).length, 0);
});

t("executivo e criativo entram IGUAIS na importacao", () => {
  const xml = "<root>" +
    forma("sp", 39, 657, 400, 32, "ARQUIVOS BASE EXECUTIVO – METAIS") +
    forma("pic", 100, 50, 120, 120, "rId3") +
    forma("sp", 95, 180, 130, 26, "TORNEIRA LIFT CROMADA") + "</root>";
  const [p] = lerPptx([{ xml, rels: RELS }]);
  assert.strictEqual(p.descricao, "TORNEIRA LIFT CROMADA");
  assert.strictEqual(p.descricaoCriativo, "TORNEIRA LIFT CROMADA");
  assert.strictEqual(p.tipoItem, "produto");
  assert.strictEqual(p.verba, "27");
});

/* ---------- o arquivo REAL, quando ele esta' na maquina ---------- */
const RAIZ = "/tmp/px2";
if (fs.existsSync(path.join(RAIZ, "ppt/slides"))) {
  const arqs = fs.readdirSync(path.join(RAIZ, "ppt/slides")).filter((f) => f.endsWith(".xml"))
    .sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)));
  const slides = arqs.map((f) => ({
    xml: fs.readFileSync(path.join(RAIZ, "ppt/slides", f), "utf8"),
    rels: fs.existsSync(path.join(RAIZ, "ppt/slides/_rels", f + ".rels"))
      ? fs.readFileSync(path.join(RAIZ, "ppt/slides/_rels", f + ".rels"), "utf8") : "",
  }));
  const r = resumoPptx(lerPptx(slides));
  t("ARQUIVO REAL: 290 itens, todos com foto e com verba", () => {
    assert.strictEqual(r.total, 290);
    assert.strictEqual(r.validos, 290);
    assert.strictEqual(r.comFoto, 290);
  });
  t("ARQUIVO REAL: separa 70 pecas de 220 acabamentos", () => {
    /* Cortina inteira conta como acabamento — os 4 itens de decoracao
       sairam de produto pra acabamento quando ela enquadrou. */
    assert.strictEqual(r.produtos, 70);
    assert.strictEqual(r.acabamentos, 220);
    assert.strictEqual(r.produtos + r.acabamentos, r.total);
  });
  t("ARQUIVO REAL: acha os fornecedores nomeados nos titulos", () => {
    ["DALMOBILE", "ELETTROMEC", "SUVINIL", "SHERWIN WILLIAMS", "LIFE"]
      .forEach((f) => assert.ok(r.fornecedores.includes(f), `faltou ${f}`));
  });
} else {
  console.log("--   (o .pptx real nao esta' descompactado em /tmp/px2; os casos fixos cobrem o resto)");
}

console.log(`\nOK — ${ok} casos`);
