/* A apresentacao de especificacoes.
 *
 * Duas coisas erram calado aqui: a quebra de linha da etiqueta, que
 * transforma uma descricao longa numa faixa atravessando o render; e a
 * conversao de coordenada -- na tela a origem e' no alto, no PDF e'
 * embaixo, e trocar isso poe a etiqueta fora da pagina sem erro nenhum. */
import assert from "node:assert";
import { quebrar, posicaoInicial, produtoParaEtiqueta, conferir,
         nomeDoArquivo, novaApresentacao, novoSlide, LARGURA, ALTURA, RODAPE, ETIQUETA }
  from "../lib/apresentacaoModelo.js";

let ok = 0;
const t = (nome, f) => { f(); console.log("ok  ", nome); ok++; };

t("descricao longa vira varias linhas curtas", () => {
  const l = quebrar("SOFÁ ELYSIUM NOA MODULO 220CM + 90CM + MODULO CHAISE 140CM", 26);
  assert.ok(l.length >= 2, `ficou em ${l.length} linha(s)`);
  l.forEach((x) => assert.ok(x.length <= 26, `linha longa: ${x}`));
});

t("palavra maior que a linha nao some nem e' cortada no meio", () => {
  const l = quebrar("ELETROELETRONICOSDEALTOPADRAOIMPORTADOS", 20);
  assert.deepStrictEqual(l, ["ELETROELETRONICOSDEALTOPADRAOIMPORTADOS"]);
});

t("texto vazio devolve uma linha vazia, e nao zero linhas", () =>
  assert.deepStrictEqual(quebrar(""), [""]));

t("as etiquetas nascem DENTRO da pagina", () => {
  for (const total of [1, 2, 5, 12, 30]) {
    for (let i = 0; i < total; i++) {
      const { x, y } = posicaoInicial(i, total);
      assert.ok(x >= 0 && x <= LARGURA - 100, `x=${x} fora (total ${total})`);
      assert.ok(y >= 0 && y <= ALTURA - 20, `y=${y} fora (total ${total})`);
    }
  }
});

t("nascem nas BORDAS — o meio e' onde esta' o render", () => {
  for (let i = 0; i < 10; i++) {
    const { x } = posicaoInicial(i, 10);
    assert.ok(x < 300 || x > LARGURA - 300, `x=${x} caiu no meio`);
  }
});

t("nenhuma nasce em cima da tarja do rodape", () => {
  /* Aconteceu na primeira geracao de teste: a ultima etiqueta caiu sobre
     o "TKWS | LIVING" e ficou ilegivel. */
  const limite = ALTURA - RODAPE - ETIQUETA.maxLinhas * ETIQUETA.entrelinha;
  for (const total of [1, 2, 3, 5, 8, 12, 30]) {
    for (let i = 0; i < total; i++) {
      const { y } = posicaoInicial(i, total);
      assert.ok(y <= limite, `total ${total}, etiqueta ${i}: y=${Math.round(y)} passa de ${limite}`);
    }
  }
});

t("duas etiquetas nunca nascem no mesmo ponto", () => {
  const p = Array.from({ length: 9 }, (_, i) => posicaoInicial(i, 9));
  const chaves = new Set(p.map((q) => `${Math.round(q.x)}:${Math.round(q.y)}`));
  assert.strictEqual(chaves.size, 9);
});

t("produto vira etiqueta com o texto do catalogo, e editavel depois", () => {
  const e = produtoParaEtiqueta({ id: "abc", descricao: "SPOT SNELLO BRANCO 5W 3000K" }, 0, 3);
  assert.strictEqual(e.produtoId, "abc");
  assert.strictEqual(e.texto, "SPOT SNELLO BRANCO 5W 3000K");
  assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y));
});

t("a conferencia acusa ambiente sem imagem ANTES de gerar", () => {
  const d = novaApresentacao({ codigo: 2307 });
  d.slides = [
    { ...novoSlide("Living"), imagem: "x.jpg", etiquetas: [{}, {}] },
    { ...novoSlide("Suíte"), imagem: null },
  ];
  const c = conferir(d);
  assert.strictEqual(c.slides, 2);
  assert.strictEqual(c.etiquetas, 2);
  assert.deepStrictEqual(c.semImagem, ["Suíte"]);
  assert.strictEqual(c.pronto, false);
});

t("apresentacao sem slide nenhum nao esta' pronta", () =>
  assert.strictEqual(conferir(novaApresentacao({ codigo: 1 })).pronto, false));

t("a capa ja' nasce preenchida com o que a obra sabe", () => {
  const d = novaApresentacao({ codigo: 2307, squad: "Comet", cliente: "Bertoni Passos", endereco: "Balneário Camboriú" });
  assert.strictEqual(d.capa.squad, "Comet");
  assert.strictEqual(d.capa.cliente, "Bertoni Passos");
  assert.strictEqual(d.capa.projeto, "2307");
  assert.strictEqual(d.capa.rev, "00");
});

t("travessao do banco nao vira cliente vazio na capa", () => {
  const d = novaApresentacao({ codigo: 1, cliente: "—", endereco: "—" });
  assert.strictEqual(d.capa.cliente, "");
  assert.strictEqual(d.capa.local, "");
});

t("o nome do arquivo segue o padrao da casa", () => {
  const d = novaApresentacao({ codigo: 2307 });
  assert.strictEqual(nomeDoArquivo(d), "2307_PE_ESPECIFICACOES_REV00.pdf");
});

t("cada slide tem id proprio — dois criados juntos nao colidem", () => {
  const ids = new Set(Array.from({ length: 50 }, () => novoSlide("x").id));
  assert.strictEqual(ids.size, 50);
});

console.log(`\nOK — ${ok} casos`);

/* ---------- PORTUGUES OU INGLES, so' na saida ---------- */
import { ambienteEm, textoDaEtiqueta, faltamEmIngles, TEXTOS } from "../lib/apresentacaoIdioma.js";
{
  let ok2 = 0;
  const t2 = (nome, f) => { f(); console.log("ok  ", nome); ok2++; };

  t2("ambiente conhecido traduz", () => {
    assert.strictEqual(ambienteEm("Cozinha", "en"), "Kitchen");
    assert.strictEqual(ambienteEm("Lavabo", "en"), "Powder Room");
    assert.strictEqual(ambienteEm("Suíte Master", "en"), "Master Suite");
    assert.strictEqual(ambienteEm("Dormitório", "en"), "Bedroom");
  });

  t2("o NUMERO fica — e' ele que separa a suite 01 da 03", () => {
    assert.strictEqual(ambienteEm("BWC Suíte 03", "en"), "Bathroom Suíte 03");
    assert.strictEqual(ambienteEm("Dormitório 2", "en"), "Bedroom 2");
  });

  t2("nome composto que a lista nao tem inteiro traduz o comeco", () =>
    assert.strictEqual(ambienteEm("Cozinha Gourmet", "en"), "Kitchen Gourmet"));

  t2("ambiente desconhecido sai como foi escrito, e nao traduzido errado", () =>
    assert.strictEqual(ambienteEm("Mirante do Cliente", "en"), "Mirante do Cliente"));

  t2("em portugues nada e' tocado", () => {
    assert.strictEqual(ambienteEm("Cozinha", "pt"), "Cozinha");
    assert.strictEqual(ambienteEm("Suíte Master", "pt"), "Suíte Master");
  });

  t2("etiqueta sem versao em ingles sai em portugues — nao sai vazia", () => {
    assert.strictEqual(textoDaEtiqueta({ texto: "SOFÁ ELYSIUM" }, "en"), "SOFÁ ELYSIUM");
    assert.strictEqual(textoDaEtiqueta({ texto: "SOFÁ", textoEn: "  " }, "en"), "SOFÁ");
    assert.strictEqual(textoDaEtiqueta({ texto: "SOFÁ", textoEn: "SOFA" }, "en"), "SOFA");
    assert.strictEqual(textoDaEtiqueta({ texto: "SOFÁ", textoEn: "SOFA" }, "pt"), "SOFÁ");
  });

  t2("a tela consegue dizer quantas faltam traduzir", () => {
    const d = { slides: [{ etiquetas: [{ texto: "a", textoEn: "A" }, { texto: "b" }] },
                         { etiquetas: [{ texto: "c" }] }] };
    assert.strictEqual(faltamEmIngles(d), 2);
  });

  t2("o titulo tem versao nos dois idiomas", () => {
    assert.match(TEXTOS.pt.titulo, /ESPECIFICAÇÕES/);
    assert.match(TEXTOS.en.titulo, /SPECIFICATIONS/);
  });

  console.log(`OK — mais ${ok2} casos`);
}

/* A tarja que cobre o rotulo da capa na emissao em ingles NAO pode
   invadir a do vizinho. Data e Rev dividem a linha, e a do Rev apagou o
   "Date" na primeira geracao. */
import { CAMPOS_CAPA } from "../lib/apresentacaoModelo.js";
{
  const porLinha = {};
  CAMPOS_CAPA.forEach((c) => (porLinha[c.y] ||= []).push(c));
  Object.entries(porLinha).forEach(([y, cs]) => {
    cs.sort((a, b) => a.rotuloX - b.rotuloX);
    for (let i = 1; i < cs.length; i++) {
      assert.ok(cs[i - 1].rotuloX + cs[i - 1].rotuloL <= cs[i].rotuloX,
        `na linha y=${y}, a tarja de ${cs[i-1].id} invade a de ${cs[i].id}`);
    }
    // e o VALOR de cada campo tem que ficar depois do proprio rotulo
    cs.forEach((c) => assert.ok(c.x >= c.rotuloX + c.rotuloL - 6,
      `o valor de ${c.id} cai em cima do proprio rotulo`));
  });
  console.log("ok   as tarjas de rotulo da capa nao se invadem");
}

console.log("\nOK — todas passaram");
