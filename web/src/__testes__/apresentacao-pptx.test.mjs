/* O .pptx EDITAVEL da apresentacao.
 *
 * Diferente do PDF, aqui o formato do arquivo E' O PONTO: ela pediu
 * especificamente pra poder abrir no PowerPoint e mexer depois. Um .pptx
 * com um id de forma repetido, ou uma relacao que aponta pro lugar
 * errado, "as vezes abre, as vezes o Office oferece pra reparar" -- o
 * tipo de falha que so' aparece na maquina dela, tarde demais.
 *
 * Por isso a bateria AQUI e' estrutural: toda tag balanceada, toda
 * relacao resolvendo pra um arquivo que existe, todo r:embed com
 * contrapartida no .rels, nenhum id de forma repetido dentro do mesmo
 * slide. */
import assert from "node:assert";
import fs from "node:fs";
import { unzipSync } from "fflate";
import { gerarPptx } from "../lib/apresentacaoPptx.js";
import { novaApresentacao, novoSlide, acrescentar, alternarModoBloco } from "../lib/apresentacaoModelo.js";

let ok = 0;
const t = (nome, f) => { f(); console.log("ok  ", nome); ok++; };

/* Um PNG 1x1 valido, minusculo — nao precisamos de fotos de verdade pra
   provar que a ESTRUTURA do arquivo esta' certa. */
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64");

const doc = novaApresentacao({ codigo: 2307, squad: "Comet",
  cliente: "Bertoni Passos Incorporadora",
  endereco: "Balneário Camboriú, Condomínio bela vista, Quadra F, lote 12 e lote 10" });
let s = novoSlide("Living");
s.render.imagem = "render";
s = acrescentar(s, [
  { id: "1", descricao: "PENDENTE OPUS DOURADO", imagem: "p1" },
  { id: "2", descricao: "SOFÁ ELYSIUM NOA MODULO 220CM + 90CM + MODULO CHAISE 140CM", imagem: "p2" },
  { id: "3", descricao: "FITA LED NOR 2835 12V 8W 3000K", imagem: null },
]);
const idLista = s.blocos.find((b) => b.produtoId === "3").id;
s = alternarModoBloco(s, idLista);
doc.slides = [s, novoSlide("Suíte Master")];
doc.slides[1].render.imagem = "render2";

const artes = { abertura: PNG_1PX, dados: PNG_1PX, fechamento: PNG_1PX };
const bytes = await gerarPptx(doc, artes, async () => PNG_1PX, "pt");

t("gera um zip com conteudo — nao um arquivo vazio", () => assert.ok(bytes.length > 500));

const zip = unzipSync(bytes);
const dec = new TextDecoder();
const arquivo = (n) => dec.decode(zip[n]);

t("as 5 paginas saem: abertura, dados, 2 ambientes, fechamento", () => {
  const slides = Object.keys(zip).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  assert.strictEqual(slides.length, 5);
});

t("toda tag XML aberta tem uma fechada, em todo arquivo do pacote", () => {
  for (const nome of Object.keys(zip)) {
    if (!nome.endsWith(".xml") && !nome.endsWith(".rels")) continue;
    const xml = arquivo(nome);
    const aberturas = [...xml.matchAll(/<([a-zA-Z:][\w:.-]*)(?:\s[^>]*)?(?<!\/)>/g)].map((m) => m[1]);
    const fechamentos = [...xml.matchAll(/<\/([a-zA-Z:][\w:.-]*)>/g)].map((m) => m[1]);
    const contA = {}, contF = {};
    aberturas.forEach((x) => contA[x] = (contA[x] || 0) + 1);
    fechamentos.forEach((x) => contF[x] = (contF[x] || 0) + 1);
    for (const tag of new Set([...Object.keys(contA), ...Object.keys(contF)])) {
      assert.strictEqual(contA[tag] || 0, contF[tag] || 0,
        `${nome}: <${tag}> desbalanceada (${contA[tag]||0} vs ${contF[tag]||0})`);
    }
  }
});

t("todo Override de [Content_Types].xml aponta pra arquivo que existe", () => {
  const ct = arquivo("[Content_Types].xml");
  for (const m of ct.matchAll(/PartName="([^"]+)"/g)) {
    const caminho = m[1].replace(/^\//, "");
    assert.ok(zip[caminho], `Content_Types referencia ${caminho}, que nao existe`);
  }
});

/* Resolve caminho relativo tipo "../slideLayouts/x.xml" a partir da
   pasta de quem o declarou — NAO com a API URL, que trata a string como
   authority+path e resolve tudo errado pra path relativo sem host. */
function resolverCaminho(baseDir, rel) {
  const partes = (baseDir + rel).split("/").filter(Boolean);
  const pilha = [];
  for (const p of partes) { if (p === ".") continue; if (p === "..") pilha.pop(); else pilha.push(p); }
  return pilha.join("/");
}

t("toda Relationship Target resolve pra um arquivo real do zip", () => {
  for (const nome of Object.keys(zip)) {
    if (!nome.endsWith(".rels")) continue;
    // o .rels da raiz do pacote e' "_rels/.rels" -- nome de parte vazio
    // antes da extensao, por isso [^/]* (zero ou mais) e nao +
    const base = nome.replace(/_rels\/[^/]*\.rels$/, "");
    const xml = arquivo(nome);
    for (const m of xml.matchAll(/Target="([^"]+)"/g)) {
      if (/^https?:/.test(m[1])) continue;
      const resolvido = resolverCaminho(base, m[1]);
      assert.ok(zip[resolvido], `${nome}: Target="${m[1]}" -> ${resolvido} nao existe`);
    }
  }
});

/* Bug real, achado só num .pptx de verdade (o validador de "toda
   relação resolve" não pega isto, porque a relação que falta não é
   referenciada por ninguém — ela só precisa EXISTIR). Todo slide.xml.rels
   tem que declarar a relação com o slideLayout, MESMO quando o slide não
   tem nenhuma imagem — sem ela o PowerPoint oferece pra reparar. Um `||`
   que devia suprir essa relação nos slides sem foto nunca disparava,
   porque `relXml([])` já devolve uma string não-vazia mesmo vazia de
   itens. */
t("todo slide declara a relacao com o slideLayout, com ou sem foto", () => {
  for (const nome of Object.keys(zip)) {
    if (!/^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(nome)) continue;
    assert.match(arquivo(nome), /relationships\/slideLayout/,
      `${nome} nao declara relacao de slideLayout`);
  }
});

t("todo r:embed num slide tem Relationship correspondente no .rels dele", () => {
  for (const nome of Object.keys(zip)) {
    if (!/^ppt\/slides\/slide\d+\.xml$/.test(nome)) continue;
    const xml = arquivo(nome);
    const relsNome = nome.replace("slides/", "slides/_rels/") + ".rels";
    const idsDefinidos = new Set([...(zip[relsNome] ? arquivo(relsNome) : "").matchAll(/Id="([^"]+)"/g)].map((m) => m[1]));
    for (const m of xml.matchAll(/r:embed="([^"]+)"/g)) {
      assert.ok(idsDefinidos.has(m[1]), `${nome}: r:embed="${m[1]}" sem Relationship em ${relsNome}`);
    }
  }
});

t("nenhum id de forma se repete DENTRO do mesmo slide", () => {
  /* O grupo raiz do slide ja' usa id=1 -- foi um bug real aqui: o
     retangulo de fundo tambem nascia com id="1" e colidia. */
  for (const nome of Object.keys(zip)) {
    if (!/^ppt\/slides\/slide\d+\.xml$/.test(nome)) continue;
    const ids = [...arquivo(nome).matchAll(/<p:cNvPr id="(\d+)"/g)].map((m) => m[1]);
    assert.strictEqual(new Set(ids).size, ids.length, `${nome}: id repetido entre ${ids.join(",")}`);
  }
});

t("o tamanho do slide bate com 960x540pt — mesma geometria do editor e do PDF", () => {
  const pres = arquivo("ppt/presentation.xml");
  const m = /<p:sldSz cx="(\d+)" cy="(\d+)"/.exec(pres);
  assert.strictEqual(Number(m[1]) / 12700, 960);
  assert.strictEqual(Number(m[2]) / 12700, 540);
});

t("os valores da capa aparecem como TEXTO, nao desenhados — e' o ponto do arquivo", () => {
  const slide2 = arquivo("ppt/slides/slide2.xml");
  assert.match(slide2, /<a:t>Comet<\/a:t>/);
  assert.match(slide2, /<a:t>Bertoni Passos Incorporadora<\/a:t>/);
  assert.match(slide2, /algn="r"/);   // alinhado a direita, como a arte
});

t("a listagem entra como UMA caixa de texto com as linhas, nao cortada", () => {
  const slide3 = arquivo("ppt/slides/slide3.xml");
  assert.match(slide3, /FITA LED NOR 2835 12V 8W 3000K/);
});

console.log(`\nOK — ${ok} casos`);
