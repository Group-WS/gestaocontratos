/* A APRESENTACAO DE ESPECIFICACOES.
 *
 * A geometria saiu do PPTX dela: o render ocupa um CANTO (692x355 de
 * 1280x720) e o resto do slide e' colagem -- foto do produto com a
 * descricao embaixo. Na primeira versao eu fiz sangria com etiquetas por
 * cima, que era outro documento.
 *
 * O que erra calado aqui: bloco que nasce em cima do render, bloco que
 * sai da pagina num arrasto, e a conversao de coordenada (tela conta do
 * alto, PDF conta de baixo). */
import assert from "node:assert";
import {
  quebrar, vagas, produtoParaBloco, acrescentar, dentro, renderDentro,
  conferir, nomeDoArquivo, novaApresentacao, novoSlide, alturaDoBloco, quantasCabem,
  LARGURA, ALTURA, RODAPE, BLOCO, CAMPOS_CAPA, RENDER_PADRAO,
  proximaRev, duplicarComoRev, caixaDoCampo, caixaDentro,
} from "../lib/apresentacaoModelo.js";
import { ambienteEm, textoDoBloco, faltamEmIngles, TEXTOS } from "../lib/apresentacaoIdioma.js";

let ok = 0;
const t = (nome, f) => { f(); console.log("ok  ", nome); ok++; };

/* ---------- legenda ---------- */
t("descricao longa vira linhas curtas", () => {
  const l = quebrar("SOFÁ ELYSIUM NOA MODULO 220CM + 90CM + MODULO CHAISE 140CM", 24);
  assert.ok(l.length >= 3);
  l.forEach((x) => assert.ok(x.length <= 24, x));
});
t("palavra maior que a linha nao e' cortada no meio", () =>
  assert.deepStrictEqual(quebrar("ELETROELETRONICOSIMPORTADOS", 20), ["ELETROELETRONICOSIMPORTADOS"]));
t("texto vazio devolve uma linha vazia", () => assert.deepStrictEqual(quebrar(""), [""]));

/* ---------- onde os blocos nascem ---------- */
const R = { ...RENDER_PADRAO, imagem: "render.jpg" };

t("nenhum bloco nasce EM CIMA do render", () => {
  const alt = BLOCO.largura + BLOCO.respiro + BLOCO.maxLinhas * BLOCO.entrelinha;
  vagas(R, 12).forEach((v, i) => {
    const cruza = v.x < R.x + R.w && v.x + BLOCO.largura > R.x
               && v.y < R.y + R.h && v.y + alt > R.y;
    assert.ok(!cruza, `bloco ${i} em (${Math.round(v.x)},${Math.round(v.y)}) cai sobre o render`);
  });
});

t("nenhum bloco nasce em cima da tarja do rodape", () => {
  const alt = BLOCO.largura + BLOCO.respiro + BLOCO.maxLinhas * BLOCO.entrelinha;
  vagas(R, 12).forEach((v) => assert.ok(v.y + alt <= ALTURA - RODAPE, `y=${Math.round(v.y)}`));
});

t("nenhum bloco nasce fora da pagina", () =>
  vagas(R, 20).forEach((v) => {
    assert.ok(v.x >= 0 && v.x + BLOCO.largura <= LARGURA, `x=${v.x}`);
    assert.ok(v.y >= 0, `y=${v.y}`);
  }));

t("o primeiro bloco nasce PERTO DA ESQUERDA", () => {
  /* Antes a varredura era linha por linha e, como o render ocupa o canto
     de cima a esquerda, os primeiros produtos caiam la' na direita --
     longe de onde a pessoa esta' olhando. */
  const [primeiro] = vagas(R, 6);
  assert.ok(primeiro.x < 60, `nasceu em x=${primeiro.x}, longe da esquerda`);
});

t("os blocos avancam da esquerda pra direita", () => {
  const v = vagas(R, 5);
  for (let i = 1; i < v.length; i++)
    assert.ok(v[i].x >= v[i - 1].x, `o bloco ${i + 1} voltou pra tras (x=${v[i].x} depois de ${v[i-1].x})`);
});

t("dois blocos nao nascem no mesmo ponto", () => {
  const v = vagas(R, 10);
  assert.strictEqual(new Set(v.map((p) => `${Math.round(p.x)}:${Math.round(p.y)}`)).size, 10);
});

t("render MENOR libera mais vagas — a grade respeita o que se redimensiona", () => {
  const grande = quantasCabem({ ...R, w: 700, h: 400 });
  const pequeno = quantasCabem({ ...R, w: 200, h: 150 });
  assert.ok(pequeno > grande, `pequeno ${pequeno} nao superou grande ${grande}`);
});

t("mais produtos do que cabem: o excedente amontoa, mas NAO some", () => {
  const v = vagas(R, 99);
  assert.strictEqual(v.length, 99);
});

/* ---------- produto vira bloco ---------- */
t("o bloco leva a descricao do CRIATIVO, nao a tecnica", () => {
  const b = produtoParaBloco({ id: "p1", descricao: "SPOT EMBUTIDO POWERUS 3 LEDS 6W 3000K",
    descricaoCriativo: "Spot embutido branco", imagem: "f.jpg" }, { x: 10, y: 20 });
  assert.strictEqual(b.texto, "Spot embutido branco");
  assert.strictEqual(b.imagem, "f.jpg");
  assert.strictEqual(b.produtoId, "p1");
});

t("sem a do criativo, o bloco usa a tecnica — nao fica vazio", () => {
  const b = produtoParaBloco({ id: "p", descricao: "SPOT X" }, { x: 0, y: 0 });
  assert.strictEqual(b.texto, "SPOT X");
});

t("acrescentar NAO empilha em cima do que ja' esta' no slide", () => {
  let s = novoSlide("Living");
  s.render = R;
  s = acrescentar(s, [{ id: 1, descricao: "A" }, { id: 2, descricao: "B" }]);
  s = acrescentar(s, [{ id: 3, descricao: "C" }]);
  assert.strictEqual(s.blocos.length, 3);
  const pontos = new Set(s.blocos.map((b) => `${Math.round(b.x)}:${Math.round(b.y)}`));
  assert.strictEqual(pontos.size, 3);
});

/* ---------- arrastar sem sair da pagina ---------- */
t("arrastar pra fora e' contido, e o bloco nao some do PDF", () => {
  const b = { x: -500, y: 9999, w: 110 };
  const d = dentro(b);
  assert.ok(d.x >= 0 && d.x <= LARGURA - 110);
  assert.ok(d.y >= 0 && d.y + alturaDoBloco(d) <= ALTURA - RODAPE);
});

t("o render tambem e' contido, e nao encolhe a ponto de sumir", () => {
  const r = renderDentro({ x: -100, y: -100, w: 5, h: 5 });
  assert.ok(r.w >= 80 && r.h >= 60);
  assert.ok(r.x >= 0 && r.y >= 0);
  const g = renderDentro({ x: 900, y: 500, w: 5000, h: 5000 });
  assert.ok(g.x + g.w <= LARGURA && g.y + g.h <= ALTURA);
});

/* ---------- a conferencia antes de gerar ---------- */
t("acusa ambiente sem imagem ANTES de gerar 40 paginas", () => {
  const d = novaApresentacao({ codigo: 2307 });
  d.slides = [
    { ...novoSlide("Living"), render: R, blocos: [{}, {}] },
    novoSlide("Suíte"),
  ];
  const c = conferir(d);
  assert.strictEqual(c.slides, 2);
  assert.strictEqual(c.blocos, 2);
  assert.deepStrictEqual(c.semImagem, ["Suíte"]);
  assert.strictEqual(c.pronto, false);
});

t("apresentacao sem slide nenhum nao esta' pronta", () =>
  assert.strictEqual(conferir(novaApresentacao({ codigo: 1 })).pronto, false));

/* ---------- capa ---------- */
t("a capa nasce preenchida com o que a obra sabe", () => {
  const d = novaApresentacao({ codigo: 2307, squad: "Comet", cliente: "Bertoni Passos",
    endereco: "Balneário Camboriú" });
  assert.strictEqual(d.capa.squad, "Comet");
  assert.strictEqual(d.capa.projeto, "2307");
  assert.strictEqual(d.capa.rev, "00");
});

t("travessao do banco nao vira cliente vazio na capa", () => {
  const d = novaApresentacao({ codigo: 1, cliente: "—", endereco: "—" });
  assert.strictEqual(d.capa.cliente, "");
  assert.strictEqual(d.capa.local, "");
});

t("as tarjas de rotulo da capa nao se invadem", () => {
  const comRotulo = CAMPOS_CAPA.filter((c) => c.rotuloX != null);
  const porLinha = {};
  comRotulo.forEach((c) => (porLinha[c.y] ||= []).push(c));
  Object.entries(porLinha).forEach(([y, cs]) => {
    cs.sort((a, b) => a.rotuloX - b.rotuloX);
    for (let i = 1; i < cs.length; i++)
      assert.ok(cs[i - 1].rotuloX + cs[i - 1].rotuloL <= cs[i].rotuloX,
        `linha y=${y}: ${cs[i-1].id} invade ${cs[i].id}`);
  });
});

t("o valor TERMINA depois do rotulo — ele e' alinhado a direita", () => {
  /* `x` e' a caixa, e nao o texto: o texto se alinha no fim dela. Antes
     `x` era o ponto do texto, e o teste checava o comeco -- agora quem
     tem que passar do rotulo e' o FIM da caixa. */
  CAMPOS_CAPA.filter((c) => c.rotuloX != null).forEach((c) =>
    assert.ok(c.x + c.w > c.rotuloX + c.rotuloL,
      `a caixa de ${c.id} termina antes do proprio rotulo`));
});

t("na mesma linha, uma caixa nao invade a outra", () => {
  const porLinha = {};
  CAMPOS_CAPA.forEach((c) => (porLinha[c.y] ||= []).push(c));
  Object.values(porLinha).forEach((cs) => {
    cs.sort((a, b) => a.x - b.x);
    for (let i = 1; i < cs.length; i++)
      assert.ok(cs[i - 1].x + cs[i - 1].w <= cs[i].x,
        `a caixa de ${cs[i-1].id} invade a de ${cs[i].id}`);
  });
});

t("todos os valores terminam no MESMO ponto — o fim da linha da arte", () => {
  const fins = CAMPOS_CAPA
    .filter((c) => !c.esquerda && c.id !== "data")
    .map((c) => c.x + c.w);
  assert.strictEqual(new Set(fins).size, 1, `fins diferentes: ${fins.join(", ")}`);
});

t("a caixa movida vale mais que a de fabrica, e a de fabrica volta sozinha", () => {
  const campo = CAMPOS_CAPA[0];
  const semMexer = caixaDoCampo({ capa: {} }, campo);
  assert.deepStrictEqual(semMexer, { x: campo.x, y: campo.y, w: campo.w });
  const movida = caixaDoCampo({ capa: { caixas: { [campo.id]: { x: 10, y: 20, w: 30 } } } }, campo);
  assert.deepStrictEqual(movida, { x: 10, y: 20, w: 30 });
});

t("arrastar a caixa pra fora e' contido", () => {
  const c = caixaDentro({ x: -900, y: 9999, w: 5 });
  assert.ok(c.x >= 0 && c.y >= 0 && c.w >= 40);
  const d = caixaDentro({ x: 5000, y: 5000, w: 5000 });
  assert.ok(d.x + d.w <= LARGURA && d.y <= ALTURA);
});

t("o nome do arquivo segue o padrao da casa, e marca o idioma", () => {
  const d = novaApresentacao({ codigo: 2307 });
  assert.strictEqual(nomeDoArquivo(d), "2307_PE_ESPECIFICACOES_REV00.pdf");
  assert.strictEqual(nomeDoArquivo(d, "en"), "2307_PE_ESPECIFICACOES_REV00_EN.pdf");
});

t("cada slide tem id proprio — cinquenta criados juntos nao colidem", () =>
  assert.strictEqual(new Set(Array.from({ length: 50 }, () => novoSlide("x").id)).size, 50));

/* ---------- portugues ou ingles, so' na saida ---------- */
t("ambiente conhecido traduz", () => {
  assert.strictEqual(ambienteEm("Cozinha", "en"), "Kitchen");
  assert.strictEqual(ambienteEm("Lavabo", "en"), "Powder Room");
  assert.strictEqual(ambienteEm("Suíte Master", "en"), "Master Suite");
});
t("o NUMERO fica — e' ele que separa a suite 01 da 03", () =>
  assert.strictEqual(ambienteEm("Dormitório 2", "en"), "Bedroom 2"));
t("ambiente desconhecido sai como foi escrito", () =>
  assert.strictEqual(ambienteEm("Mirante do Cliente", "en"), "Mirante do Cliente"));
t("em portugues nada e' tocado", () =>
  assert.strictEqual(ambienteEm("Suíte Master", "pt"), "Suíte Master"));
t("bloco sem versao em ingles sai em portugues — nao sai vazio", () => {
  assert.strictEqual(textoDoBloco({ texto: "SOFÁ" }, "en"), "SOFÁ");
  assert.strictEqual(textoDoBloco({ texto: "SOFÁ", textoEn: "  " }, "en"), "SOFÁ");
  assert.strictEqual(textoDoBloco({ texto: "SOFÁ", textoEn: "SOFA" }, "en"), "SOFA");
});
t("a tela consegue dizer quantos faltam traduzir", () =>
  assert.strictEqual(faltamEmIngles({ slides: [
    { blocos: [{ texto: "a", textoEn: "A" }, { texto: "b" }] }, { blocos: [{ texto: "c" }] }] }), 2));
t("o titulo tem versao nos dois idiomas", () => {
  assert.match(TEXTOS.pt.titulo, /ESPECIFICAÇÕES/);
  assert.match(TEXTOS.en.titulo, /SPECIFICATIONS/);
});

/* ---------- controle de revisoes ---------- */
t("a proxima revisao e' a maior + 1, com dois digitos", () => {
  assert.strictEqual(proximaRev([]), "00");
  assert.strictEqual(proximaRev(["00"]), "01");
  assert.strictEqual(proximaRev(["00", "01", "02"]), "03");
  assert.strictEqual(proximaRev(["09"]), "10");
});

t("a ordem em que vieram nao importa — vale a MAIOR", () =>
  assert.strictEqual(proximaRev(["02", "00", "01"]), "03"));

t("rev com texto no meio nao quebra a conta", () =>
  assert.strictEqual(proximaRev(["REV 03", "01"]), "04"));

t("a revisao nova nasce SEM id — o banco grava linha nova, nao por cima", () => {
  const antiga = { id: "uuid-antigo", obraCodigo: "2307", capa: { rev: "00", cliente: "X" },
    slides: [{ id: "s1", blocos: [{ id: "b1", texto: "A" }] }] };
  const nova = duplicarComoRev(antiga, "01");
  assert.strictEqual(nova.id, undefined);
  assert.strictEqual(nova.capa.rev, "01");
  assert.strictEqual(nova.capa.cliente, "X");
});

t("a copia e' PROFUNDA — mexer na nova nao mexe na que foi ao cliente", () => {
  const antiga = { obraCodigo: "1", capa: { rev: "00" },
    slides: [{ id: "s1", blocos: [{ id: "b1", texto: "ORIGINAL" }] }] };
  const nova = duplicarComoRev(antiga, "01");
  nova.slides[0].blocos[0].texto = "MUDADO";
  nova.slides[0].blocos.push({ id: "b2", texto: "NOVO" });
  assert.strictEqual(antiga.slides[0].blocos[0].texto, "ORIGINAL");
  assert.strictEqual(antiga.slides[0].blocos.length, 1);
});

console.log(`\nOK — ${ok} casos`);

/* ---------- A LISTAGEM ---------- */
import {
  blocosImagem, blocosLista, listaDoSlide, listaDentro, alturaDaLista,
  alternarModoBloco, LISTA_PADRAO, LISTA_ITEM,
} from "../lib/apresentacaoModelo.js";
{
  let ok2 = 0;
  const t2 = (nome, f) => { f(); console.log("ok  ", nome); ok2++; };

  const blocoImg = (over) => ({ id: `b${Math.random()}`, x: 0, y: 0, w: 110, texto: "X", ...over });

  t2("sem modo gravado, o bloco conta como IMAGEM — era o que ja' acontecia", () => {
    const s = { blocos: [blocoImg()] };
    assert.strictEqual(blocosImagem(s).length, 1);
    assert.strictEqual(blocosLista(s).length, 0);
  });

  t2("blocosImagem e blocosLista se separam pelo campo modo", () => {
    const s = { blocos: [blocoImg({ modo: "imagem" }), blocoImg({ modo: "lista" }), blocoImg({ modo: "lista" })] };
    assert.strictEqual(blocosImagem(s).length, 1);
    assert.strictEqual(blocosLista(s).length, 2);
  });

  t2("a listagem sem posicao salva usa a de fabrica", () => {
    const l = listaDoSlide({});
    assert.deepStrictEqual(l, LISTA_PADRAO);
  });

  t2("a listagem MOVIDA vale mais que a de fabrica", () => {
    const l = listaDoSlide({ lista: { x: 10, y: 20, w: 150 } });
    assert.deepStrictEqual(l, { x: 10, y: 20, w: 150 });
  });

  t2("a altura da listagem cresce com a quantidade de itens", () => {
    assert.ok(alturaDaLista(5) > alturaDaLista(2));
    assert.strictEqual(alturaDaLista(0), alturaDaLista(1));   // nunca fica com altura zero
  });

  t2("arrastar a listagem pra fora da pagina e' contido", () => {
    const c = listaDentro({ x: 9999, y: 9999, w: 190 }, 3);
    assert.ok(c.x + c.w <= LARGURA);
    assert.ok(c.y + alturaDaLista(3) <= ALTURA - RODAPE + 0.01);
    const d = listaDentro({ x: -900, y: -900, w: 5000 }, 3);
    assert.ok(d.x >= 0 && d.y >= 0 && d.w <= 400);
  });

  t2("alternar pra LISTA nao mexe em posicao nenhuma", () => {
    const s = { render: { x: 0, y: 0, w: 519, h: 266 }, blocos: [blocoImg({ id: "a", x: 300, y: 300 })] };
    const s2 = alternarModoBloco(s, "a");
    assert.strictEqual(s2.blocos[0].modo, "lista");
    assert.strictEqual(s2.blocos[0].x, 300);   // x,y ficam guardados, so' nao sao usados
  });

  t2("alternar DE VOLTA pra imagem acha uma vaga que nao encosta no render", () => {
    const s = { render: { x: 0, y: 0, w: 519, h: 266 }, blocos: [blocoImg({ id: "a", modo: "lista" })] };
    const s2 = alternarModoBloco(s, "a");
    assert.strictEqual(s2.blocos[0].modo, "imagem");
    const b = s2.blocos[0];
    const cruza = b.x < 519 && b.x + b.w > 0 && b.y < 266 && b.y + 110 > 0;
    assert.ok(!cruza, `voltou em cima do render: x=${b.x} y=${b.y}`);
  });

  t2("duas idas e voltas nao acumulam lixo no bloco", () => {
    let s = { render: { x: 0, y: 0, w: 519, h: 266 }, blocos: [blocoImg({ id: "a" })] };
    s = alternarModoBloco(s, "a");   // -> lista
    s = alternarModoBloco(s, "a");   // -> imagem de novo
    assert.strictEqual(s.blocos[0].modo, "imagem");
    assert.strictEqual(s.blocos.length, 1);
  });

  t2("bloco que nao existe nao quebra nada", () => {
    const s = { render: { x: 0, y: 0, w: 519, h: 266 }, blocos: [] };
    assert.strictEqual(alternarModoBloco(s, "fantasma"), s);
  });

  console.log(`OK — mais ${ok2} casos`);
}
