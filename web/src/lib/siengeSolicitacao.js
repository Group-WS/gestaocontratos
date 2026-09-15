import { simboloSienge } from "./sienge.js";

/* O que vai (e o que não vai) numa solicitação de compra no Sienge.
 * -----------------------------------------------------------------
 * Esta é a parte da funcionalidade que decide sozinha, sem rede e sem
 * tela — por isso mora aqui, testável. A conversa com o Sienge é do
 * backend (web/api/_lib/sienge.js).
 *
 * As linhas chegam com a situação do insumo já resolvida pela tela
 * (`mae` e `status`, de `situacaoNoSienge`), porque quem sabe casar item
 * da obra com insumo do Sienge é ela, com a base carregada na memória.
 *
 * A regra que organiza o resto: item que não pode ir NÃO SOME. Ele volta
 * em `bloqueados`, com o motivo, e a tela mostra os dois lados. Sumir
 * calado é o que faz alguém achar que pediu o que não pediu.
 */

/* Mesma normalização do resumo de cadastro: sem acento, sem espaço
   sobrando, em maiúsculas — "Cadeira  Eiffel" e "CADEIRA EIFFEL" são o
   mesmo detalhe e têm que somar numa linha só. */
export function textoComparavel(t) {
  return String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ").trim().toUpperCase();
}

const arred = (n, casas) => { const f = 10 ** casas; return Math.round(n * f) / f; };

/**
 * Monta o pedido a partir das linhas selecionadas nas Compras.
 *
 * `linhas`: `{ chave, catIdx, itemIdx, catNum, it, material, mae, status, descritivo }`
 * `mapaEap`: verba do GC → folha da EAP do Sienje (`{ "20": "04.001.001.001" }`)
 * `unidadeId`: a unidade construtiva (`buildingUnitId`) da apropriação
 *
 * Devolve `{ itens, bloqueados, verbas }`.
 */
export function montarSolicitacaoSienge(linhas, { mapaEap = {}, unidadeId = null } = {}) {
  const bloqueados = [];
  const porChave = new Map();
  const verbas = new Map();

  (linhas || []).forEach((r) => {
    const it = r.it || {};
    const barra = (motivo) => bloqueados.push({
      chave: r.chave, item: [it.codigo, it.desc].filter(Boolean).join(" ") || "(sem descrição)",
      verba: r.catNum, motivo,
    });

    /* 1. O insumo tem que existir no Sienge — é o `productId`, e ele é a
     *    MÃE. Sem ela não há o que pedir.
     *
     *    O detalhe não barra. Ele já foi barra até 15/09/2026, com o
     *    argumento de que "uma solicitação não cadastra insumo" — o que é
     *    verdade e não vinha ao caso: como o `detailId` não é enviado (o
     *    Sienge não expõe como descobri-lo, ver ADR-003), o payload do
     *    detalhe novo e o do já cadastrado são idênticos. A restrição não
     *    protegia nada e barrava metade da seleção. O que distingue os
     *    dois é só o texto que vai em `notes`. */
    if (!r.mae) return barra("sem insumo do Sienge associado — associe na coluna Insumo");
    const productId = Number(r.mae.codigo);
    if (!Number.isInteger(productId)) return barra(`o código do insumo (“${r.mae.codigo}”) não é um número`);

    // 2. Quantidade e unidade — os dois obrigatórios na API.
    const qtd = Number(it.qtdExecutivo ?? it.qtdVendida ?? it.qtd ?? 0) || 0;
    if (!(qtd > 0)) return barra("quantidade zerada");
    const unidade = simboloSienge(it.un);
    if (!unidade) return barra(`a unidade “${it.un || "(vazia)"}” não existe no cadastro do Sienge`);

    // 3. A apropriação. Verba sem folha da EAP para aqui de propósito:
    //    apropriar na conta errada o Sienge aceita calado (ver ADR-002).
    const codigoEap = mapaEap[r.catNum];
    if (!codigoEap) return barra(`a verba ${r.catNum} não está ligada a um item do orçamento — configure em EAP Sienge`);
    // `Number(null)` é 0, e 0 é inteiro — testar o número sozinho deixaria
    // passar "sem unidade construtiva" como se fosse a unidade zero.
    if (unidadeId == null || !Number.isInteger(Number(unidadeId))) {
      return barra("sem unidade construtiva definida — escolha a versão da EAP em EAP Sienge");
    }

    /* 4. O que já foi pedido não se pede de novo.
     *
     * Comprado conta como solicitado — é a mesma regra do `estaSolicitado`
     * da tela. Olhar só `solicitado` deixaria passar o item que veio
     * marcado como comprado de um fluxo antigo, e ele iria parar numa
     * segunda solicitação. */
    if (it.solicitado || it.comprado) {
      /* Dizer ONDE ele entrou, não só que entrou. O número da solicitação
         fica gravado no item desde o envio (`solicitacaoSienge`), e é
         exatamente o que alguém precisa pra conferir no Sienge — sem ele,
         "já marcado como solicitado" parece um estado inexplicado. */
      const s = it.solicitacaoSienge;
      const quando = s?.em ? new Date(s.em) : it.solicitadoEm ? new Date(it.solicitadoEm) : null;
      const data = quando && !isNaN(quando) ? ` em ${quando.toLocaleDateString("pt-BR")}` : "";
      if (s?.id) return barra(`já foi pedido na solicitação ${s.id}${data}`);
      if (it.comprado && !it.solicitado) return barra("já está marcado como comprado nas Compras");
      return barra(`já marcado como solicitado${data} — marcação manual, sem número de solicitação`);
    }

    /* Iguais somam numa linha só.
     *
     * Não é economia de requisição: é o que evita o 422 "não é possível
     * cadastrar mais de um insumo de mesmo código, obra, detalhe e marca".
     * Dois ambientes que pedem a mesma luminária são uma linha de duas
     * unidades, como seria se alguém digitasse no Sienge. */
    const descritivo = String(r.descritivo ?? it.detalheSienge ?? it.desc ?? "");
    if (!descritivo.trim()) return barra("sem descrição para mandar como observação do item");
    const chave = `${productId}|${textoComparavel(descritivo)}|${codigoEap}`;
    const custo = Number(r.material) || 0;
    const antes = porChave.get(chave);
    if (antes) {
      antes.quantity = arred(antes.quantity + qtd, 4);
      antes.custoTotal = arred(antes.custoTotal + custo, 2);
      antes.chaves.push(r.chave);
      antes.linhas.push(r);
      return;
    }
    porChave.set(chave, {
      productId,
      quantity: arred(qtd, 4),
      unitySymbol: unidade,
      notes: descritivo.slice(0, 4000),
      buildingUnitId: Number(unidadeId),
      costEstimationItemReference: codigoEap,
      custoTotal: arred(custo, 2),
      chaves: [r.chave],
      linhas: [r],
      verba: r.catNum,
      // Pra tela poder dizer que este detalhe ainda não existe no Sienge:
      // o item entra do mesmo jeito, mas quem confere merece saber.
      detalheNovo: r.status !== "exato",
    });
    if (!verbas.has(r.catNum)) verbas.set(r.catNum, { num: r.catNum, codigo: codigoEap, itens: 0 });
  });

  const itens = [...porChave.values()].map((i) => {
    verbas.get(i.verba).itens += 1;
    return {
      ...i,
      /* Preço ESTIMADO, e unitário: o custo que entra na linha das
         Compras é o material total previsto pelo executivo. Dividir pela
         quantidade é o que faz os dois lados falarem da mesma coisa.
         Zero não vai (ver a rota): "de graça" não é "não sei". */
      estimatedPrice: i.quantity > 0 ? arred(i.custoTotal / i.quantity, 2) : 0,
    };
  });

  return { itens, bloqueados, verbas: [...verbas.values()] };
}

/** O corpo que a rota espera — sem os campos que só a tela usa. */
export function corpoDoEnvio({ buildingId, notes, itens }) {
  return {
    buildingId: Number(buildingId),
    notes,
    itens: itens.map((i) => ({
      productId: i.productId,
      // Só vai quando existe: `detailId: undefined` some do JSON, e
      // `null` seria recusado pela API.
      ...(Number.isInteger(i.detailId) ? { detailId: i.detailId } : {}),
      quantity: i.quantity,
      unitySymbol: i.unitySymbol,
      estimatedPrice: i.estimatedPrice,
      notes: i.notes,
      buildingUnitId: i.buildingUnitId,
      costEstimationItemReference: i.costEstimationItemReference,
      chaves: i.chaves,
    })),
  };
}

/* ============================================================
   O DETALHE DO INSUMO — qual produto, afinal

   O insumo é a categoria ("AR CONDICIONADO", código 275); o DETALHE é o
   produto ("LG / SPLIT DUAL INVERTER 18.000 BTUS QUENTE E FRIO /
   BRANCO", id 4). Solicitação sem detalhe é compra genérica: quem vai
   cotar não sabe o que comprar.

   Os detalhes vêm de `/building-cost-estimations/{obra}/resources`
   (rota /api/sienge/insumos). Aqui é só o casamento: qual dos detalhes
   cadastrados corresponde ao que a linha da obra diz.
   ============================================================ */

/** A descrição sem os separadores do padrão da casa, pra comparar texto com texto. */
const soPalavras = (t) => textoComparavel(t).replace(/[^A-Z0-9]+/g, " ").trim();

/**
 * Acha o detalhe do Sienge cuja descrição é a MESMA da linha.
 *
 * Só igualdade — ignorando caixa, acento e pontuação, porque "LG / SPLIT
 * 18.000" e "lg  split 18000" são o mesmo texto. Quem escolheu a variante
 * em "Associar insumos" já tem o texto do detalhe na linha, e aqui ele só
 * reencontra o código correspondente.
 *
 * Não existe "parecido" de propósito. Já existiu, com 70% das palavras em
 * comum, e saiu: quem confere o envio vai olhar o detalhe de qualquer
 * forma, então a sugestão aproximada não poupava trabalho — só criava a
 * chance de mandar o ar-condicionado de 24.000 no lugar do de 18.000
 * enquanto alguém rolava a lista depressa. Sem casamento, o seletor abre
 * vazio e a escolha é explícita.
 */
export function acharDetalhe(descricao, detalhes) {
  const alvo = soPalavras(descricao);
  if (!alvo) return null;
  return (detalhes || []).find((d) => soPalavras(d.descricao) === alvo) || null;
}

/**
 * Preenche `detailId` nos itens, a partir do catálogo de insumos do Sienge.
 *
 * Não altera item nenhum quando o insumo não tem detalhe cadastrado — a
 * solicitação sai sem `detailId`, como sempre saiu, e o texto continua
 * descrevendo o produto.
 */
export function casarDetalhes(itens, catalogo) {
  const porId = new Map((catalogo || []).map((i) => [Number(i.id), i]));
  return (itens || []).map((i) => {
    const insumo = porId.get(Number(i.productId));
    const detalhes = insumo?.detalhes || [];
    if (!detalhes.length) return { ...i, detalhesDisponiveis: [], detailId: undefined };
    const detalhe = acharDetalhe(i.notes, detalhes);
    return {
      ...i,
      detalhesDisponiveis: detalhes,
      detailId: detalhe ? detalhe.id : undefined,
      // O código auxiliar do detalhe no cadastro do Sienge, quando existe.
      detalheCodigo: detalhe ? detalhe.codigo ?? null : null,
      detalheDescricao: detalhe ? detalhe.descricao : null,
      // O nome do insumo no Sienge, pra tela poder mostrar o que está
      // pedindo em vez de só o número.
      insumoDescricao: insumo?.descricao || null,
    };
  });
}
