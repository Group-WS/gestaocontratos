/**
 * Leitor do PDF do Sienge — solicitações de compra e pedidos.
 *
 * Serve pra responder uma pergunta só, e ela é de conferência: o que a
 * planilha diz que tem pra comprar chegou mesmo no Sienge? Sienge é onde
 * a compra existe de verdade; enquanto ela não estiver lá, ela não foi
 * feita, por mais marcada que esteja aqui.
 *
 * O bloco de cada item NÃO tem tamanho fixo — o cabeçalho da página cai
 * no meio e o bloco vai de 11 a 22 linhas no mesmo arquivo. Por isso a
 * leitura é por PADRÃO e não por posição: ancora na linha do insumo e
 * procura cada campo pelo formato dele. Contar linhas funcionaria na
 * primeira página e erraria da segunda em diante, calado.
 */

const N_QTD = /^\d{1,3}(?:\.\d{3})*,\d{4}$/;     // 1,0000 · 12,0000
const DATA = /^\d{2}\/\d{2}\/\d{4}$/;
const APROPRIADO = /\[(MAT\/MO|MAT|MO)\]/i;
const UNIDADES = /^(un|und|m|m2|m²|m3|m³|kg|pç|pc|vb|cj|par|l|t|h|sc|br|rl|cx|jg)\.?$/i;

const numBR = (t) => {
  const n = Number(String(t).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/**
 * Devolve { documentos: [{ numero, data, obra, solicitante, itens }], itens: [...] }
 *
 * `itens` vem achatado porque a comparação não liga de qual solicitação
 * cada linha veio — ela só quer saber se o produto está lá.
 */
export function parsePedidoSienge(texto) {
  const L = String(texto || "").split("\n").map((x) => x.trim()).filter(Boolean);

  // Cabeçalho: o mesmo se repete a cada página, então o primeiro basta.
  const acha = (rot, deslocamento = 1) => {
    const i = L.findIndex((l) => l === rot);
    return i >= 0 ? L[i + deslocamento] : null;
  };
  const numero = acha("Solicitação") || acha("Pedido") || acha("Pedido de Compra");
  const obraLinha = (() => {
    const i = L.findIndex((l) => l === "Obra");
    return i >= 0 ? L[i + 1] : null;
  })();
  const obraCodigo = obraLinha ? (obraLinha.match(/^(\d{3,5})/) || [])[1] || null : null;

  const itens = [];
  L.forEach((linha, i) => {
    // "405 - MOBÍLIA SOLTA -POLTRONA / DESTACK / ..."
    const m = linha.match(/^(\d{1,6})\s*-\s*(.+)$/);
    if (!m) return;
    /* A linha da OBRA tem a mesma cara de um item: "2307 - Condominio
       Bella Vista...". E ela se repete no cabecalho de cada pagina, entao
       um PDF de 8 paginas ganhava 8 itens fantasmas — todos sem
       quantidade e sem verba, que era o unico sinal de que algo estava
       errado. Quem manda e o ROTULO da linha anterior. */
    if (/^(obra|solicitante|solicita|pedido)$/i.test(L[i - 1] || "")) return;
    if (/^(obra|solicita|pedido)/i.test(m[2])) return;

    const codigo = m[1];
    const descricao = m[2].trim();
    // Janela ate' o proximo item; e' onde os campos deste moram.
    const fim = Math.min(L.length, i + 26);
    const janela = [];
    for (let k = i + 1; k < fim; k++) {
      if (/^(\d{1,6})\s*-\s*\S/.test(L[k]) && !/^(obra|solicita|pedido)/i.test(L[k])) break;
      janela.push(L[k]);
    }

    const un = (janela.find((x) => UNIDADES.test(x)) || "").replace(".", "") || null;
    const quantidades = janela.filter((x) => N_QTD.test(x)).map(numBR);
    const apropriado = janela.find((x) => APROPRIADO.test(x)) || null;
    const aloc = apropriado ? (apropriado.match(APROPRIADO) || [])[1]?.toUpperCase() : null;

    itens.push({
      codigo,
      descricao,
      // Nome completo como aparece no Sienge — e' por ele que a
      // comparacao casa com o insumo escolhido na tela de compras.
      textoSienge: `${codigo} - ${descricao}`,
      un,
      // A primeira e' a prevista; a segunda, a atendida; a terceira, o saldo.
      qtdPrevista: quantidades[0] ?? null,
      qtdAtendida: quantidades[1] ?? null,
      saldo: quantidades[2] ?? null,
      autorizado: /^sim$/i.test(janela[0] || ""),
      entrega: janela.find((x) => DATA.test(x)) || null,
      // "Móveis soltos [MAT/MO]" — a verba e a alocação, direto do Sienge.
      verba: apropriado ? apropriado.replace(APROPRIADO, "").trim() : null,
      alocacao: aloc === "MAT/MO" ? "AMBOS" : aloc,
    });
  });

  return {
    numero: numero || null,
    obraCodigo,
    obra: obraLinha,
    solicitante: acha("Solicitante"),
    data: L.find((x) => DATA.test(x)) || null,
    itens,
  };
}

/* O MESMO relatorio, mas em Excel.
 *
 * Excel e' melhor que PDF pra isto e por uma razao so: no PDF o valor de
 * cada campo vem como linha solta e a leitura depende de reconhecer o
 * formato ("1,0000" e' quantidade, "17/08/2026" e' data). Na planilha
 * cada coisa ja esta na sua coluna.
 *
 * As colunas sao achadas pelo NOME do cabecalho, nao pela posicao: o
 * Sienge deixa escolher quais colunas exportar, entao a mesma tela gera
 * arquivos com ordem diferente conforme quem exportou.
 */
export function parsePedidoSiengeExcel(linhas) {
  const L = (linhas || []).filter((r) => Array.isArray(r) && r.some((c) => String(c ?? "").trim()));
  const norm = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  // O cabecalho e a primeira linha que nomeia insumo/descricao.
  const iCab = L.findIndex((r) => r.some((c) => /insumo|descri/.test(norm(c))));
  if (iCab === -1) return { numero: null, obraCodigo: null, itens: [] };

  /* `Array.from` e nao `.map`: a planilha vem com array ESPARSO — celula
     vazia e um buraco, nao um valor. `.map` pula buraco e o mantem, e
     `findIndex` (que NAO pula) acabava testando `undefined`.

     O estrago era silencioso e especifico: `/^und/.test(undefined)` testa
     a string "undefined", que comeca com "und" — entao a coluna de
     unidade casava com a primeira celula VAZIA do cabecalho, e toda
     unidade voltava nula. */
  const cab = Array.from(L[iCab] || [], norm);
  const acha = (...padroes) => {
    for (const p of padroes) {
      const i = cab.findIndex((c) => p.test(c || ""));
      if (i >= 0) return i;
    }
    return -1;
  };
  const iDesc = acha(/^insumo/, /descri/);
  const iUn = acha(/^und/, /^un\b/, /unidade/);
  // "prevista" antes de "qtd" solto: um relatorio traz prevista, atendida
  // e saldo, e pegar a primeira "qtd" daria a coluna errada.
  const iQtd = acha(/qtd.*prevista/, /quantidade/, /^qtd/);
  const iApropriado = acha(/apropriado/, /verba/, /centro de custo/);

  // Cabecalho fora da tabela: numero da solicitacao e obra.
  const texto = L.slice(0, iCab).flat().map((c) => String(c ?? "").trim()).filter(Boolean);
  const acharDepois = (re) => {
    const i = texto.findIndex((t) => re.test(norm(t)));
    return i >= 0 ? texto[i + 1] || null : null;
  };
  const numero = acharDepois(/^(solicitacao|pedido)$/) || (texto.find((t) => /^\d{3,8}$/.test(t)) || null);
  const obraTxt = acharDepois(/^obra$/) || texto.find((t) => /^\d{3,5}\s*-\s*\S/.test(t)) || null;

  const itens = [];
  L.slice(iCab + 1).forEach((r) => {
    const bruto = String(r[iDesc] ?? "").replace(/\s+/g, " ").trim();
    if (!bruto) return;
    // Repeticao do cabecalho no meio da planilha (pagina do relatorio).
    if (/^insumo$|^descri/.test(norm(bruto))) return;

    const m = bruto.match(/^(\d{1,6})\s*-\s*(.+)$/);
    const apropriado = iApropriado >= 0 ? String(r[iApropriado] ?? "").trim() : "";
    const aloc = (apropriado.match(/\[(MAT\/MO|MAT|MO)\]/i) || [])[1];
    const qtd = iQtd >= 0 ? Number(String(r[iQtd] ?? "").replace(/\./g, "").replace(",", ".")) : null;

    itens.push({
      codigo: m ? m[1] : null,
      descricao: m ? m[2].trim() : bruto,
      textoSienge: bruto,
      un: iUn >= 0 ? String(r[iUn] ?? "").trim() || null : null,
      qtdPrevista: Number.isFinite(qtd) ? qtd : null,
      qtdAtendida: null, saldo: null, autorizado: null, entrega: null,
      verba: apropriado ? apropriado.replace(/\[(MAT\/MO|MAT|MO)\]/i, "").trim() : null,
      alocacao: aloc ? (aloc.toUpperCase() === "MAT/MO" ? "AMBOS" : aloc.toUpperCase()) : null,
    });
  });

  return {
    numero, obra: obraTxt,
    obraCodigo: obraTxt ? (obraTxt.match(/^(\d{3,5})/) || [])[1] || null : null,
    solicitante: acharDepois(/^solicitante$/),
    itens,
  };
}

/* CONFERE a planilha contra o que foi lancado no Sienge.

   E a pergunta que motiva o upload: faltou lancar alguma coisa? Sienge e
   onde a compra existe de verdade — enquanto ela nao estiver la, ela nao
   foi feita, por mais marcada que esteja aqui.

   Tres respostas, e cada uma manda pra um lado:

     confirmados  — esta nos dois. Nada a fazer.
     faltaLancar  — esta aqui e NAO esta no Sienge. E o risco: alguem
                    achou que pediu e nao pediu.
     naoListados  — esta no Sienge e nao esta aqui. Pode ser compra que
                    nasceu fora da planilha, ou a mesma coisa escrita
                    diferente — por isso ela aparece, em vez de sumir.

   O casamento e por semelhanca de descricao porque e a unica coisa que
   os dois lados tem em comum: o codigo do item da obra e da EAP, o do
   Sienge e do insumo. Mesma razao do depara.
*/
export function conferirComSienge(produtos, itensSienge, cobertura, corte = 0.6) {
  const sobrando = new Set((itensSienge || []).map((_, i) => i));
  const confirmados = [], faltaLancar = [];

  (produtos || []).forEach((p) => {
    const alvo = p.it?.detalheSienge || p.it?.desc || "";
    let melhor = null;
    /* Linha ja usada sai da disputa. Sem isso, dois produtos parecidos
       davam os dois por confirmados com a MESMA linha do Sienge, e uma
       compra que faltou passava despercebida.

       Onde a obra tem duas linhas do mesmo movel e o Sienge tem uma so
       com quantidade 2, isso gera um "falta lancar" falso. E o lado
       seguro do erro: alarme falso faz alguem conferir e achar tudo
       certo; confirmacao falsa esconde uma compra que nao foi feita. */
    sobrando.forEach((i) => {
      const s = itensSienge[i];
      const score = cobertura(alvo, s.descricao);
      if (score >= corte && (!melhor || score > melhor.score)) melhor = { i, s, score };
    });
    if (melhor) {
      sobrando.delete(melhor.i);
      confirmados.push({ ...p, sienge: melhor.s, score: melhor.score });
    } else {
      faltaLancar.push(p);
    }
  });

  return {
    confirmados,
    faltaLancar,
    naoListados: [...sobrando].map((i) => itensSienge[i]),
  };
}
