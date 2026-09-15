/* O que entra numa solicitação de compra no Sienge — e o que é barrado.
 *
 * Roda com: node web/src/__testes__/sienge-solicitacao.test.mjs
 *
 * Aqui moram os dois erros que custam caro nessa integração:
 *
 *  1. Mandar o que não devia. Apropriação errada o Sienge ACEITA calado
 *     (o código existe, só não é aquele) e a conta só fecha errada no fim
 *     do mês. Por isso verba sem folha da EAP barra o item.
 *  2. Somar errado. Dois ambientes pedindo a mesma luminária são uma
 *     linha de duas unidades — mandar duas linhas devolve o 422 de
 *     "insumo já existe na solicitação" e a segunda se perde.
 */
import { montarSolicitacaoSienge, corpoDoEnvio, textoComparavel, casarDetalhes } from "../lib/siengeSolicitacao.js";
import { simboloSienge } from "../lib/sienge.js";

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(58)} ${String(o).padEnd(22)} ${ok ? "" : "esperava " + e}`); };

const MAPA = { "20": "04.001.001.001", "28": "04.009.001.001" };
const linha = (chave, over = {}) => ({
  chave, catIdx: 0, itemIdx: 0, catNum: "20", material: 36518.98,
  mae: { codigo: "275", nome: "AR CONDICIONADO" }, status: "exato",
  descritivo: "LG / AR CONDICIONADO CASSETE 18.000 BTU",
  ...over,
  it: { codigo: "20.1", desc: "Ar condicionado", un: "un", qtdExecutivo: 2, detalheSienge: "CASSETE 18.000", ...(over.it || {}) },
});

const opts = { mapaEap: MAPA, unidadeId: 9 };

console.log("\n— o caminho feliz —");
{
  const { itens, bloqueados } = montarSolicitacaoSienge([linha("0-0")], opts);
  conf("um item elegível vira um item", itens.length, 1);
  conf("nada bloqueado", bloqueados.length, 0);
  conf("productId é o código do insumo mãe", itens[0].productId, 275);
  conf("quantidade", itens[0].quantity, 2);
  conf("unidade normalizada", itens[0].unitySymbol, "un");
  conf("apropriação vem do mapa da verba", itens[0].costEstimationItemReference, "04.001.001.001");
  conf("unidade construtiva", itens[0].buildingUnitId, 9);
  // O custo da linha nas Compras é o material TOTAL; a API quer o unitário.
  conf("preço estimado é unitário", itens[0].estimatedPrice, 18259.49);
  conf("a descrição vai como observação", itens[0].notes, "LG / AR CONDICIONADO CASSETE 18.000 BTU");
}

console.log("\n— iguais somam numa linha só —");
{
  const { itens } = montarSolicitacaoSienge([
    linha("0-0"),
    linha("0-1", { material: 18259.49, it: { qtdExecutivo: 1 } }),
  ], opts);
  conf("duas linhas, um item", itens.length, 1);
  conf("quantidades somadas", itens[0].quantity, 3);
  conf("custo somado vira o unitário certo", itens[0].estimatedPrice, 18259.49);
  conf("as duas chaves ficam registradas", itens[0].chaves.join(","), "0-0,0-1");
}
{
  // Mesma coisa escrita diferente continua sendo a mesma coisa.
  const { itens } = montarSolicitacaoSienge([
    linha("0-0", { descritivo: "LG / AR CONDICIONADO CASSETE 18.000 BTU" }),
    linha("0-1", { descritivo: "lg / ar  condicionado cassete 18.000 btu" }),
  ], opts);
  conf("acento e caixa não separam", itens.length, 1);
}
{
  // Verbas diferentes são apropriações diferentes: não podem somar.
  const { itens } = montarSolicitacaoSienge([
    linha("0-0"),
    linha("1-0", { catNum: "28" }),
  ], opts);
  conf("verbas diferentes ficam separadas", itens.length, 2);
  conf("cada uma com a sua apropriação",
    itens.map((i) => i.costEstimationItemReference).join(" "), "04.001.001.001 04.009.001.001");
}

console.log("\n— o que é barrado (e por quê) —");
const barra = (over, esperado) => {
  const { itens, bloqueados } = montarSolicitacaoSienge([linha("0-0", over)], opts);
  conf(esperado, `${itens.length}/${bloqueados.length}`, "0/1");
  return bloqueados[0];
};
conf("sem insumo associado", barra({ mae: null }, "sem insumo associado").motivo.includes("sem insumo"), "true");
conf("quantidade zerada", barra({ it: { qtdExecutivo: 0 } }, "quantidade zerada").motivo.includes("zerada"), "true");
conf("unidade que o Sienge não tem", barra({ it: { un: "cj" } }, "unidade inexistente").motivo.includes("não existe no cadastro"), "true");
conf("já solicitado antes", barra({ it: { solicitado: true } }, "já solicitado").motivo.includes("já marcado"), "true");
// Comprado pressupõe solicitado (é o `estaSolicitado` da tela). Sem isto,
// item vindo marcado como comprado entraria numa segunda solicitação.
conf("comprado conta como solicitado", barra({ it: { comprado: true } }, "já comprado").motivo.includes("comprado"), "true");
/* O motivo diz ONDE o item entrou. Sem o número, quem lê "já solicitado"
   não tem como conferir no Sienge se aquilo é verdade. */
conf("e diz em qual solicitação",
  barra({ it: { solicitado: true, solicitacaoSienge: { id: 23503, em: "2026-09-15T22:49:30.000Z" } } }, "já solicitado com número")
    .motivo.includes("solicitação 23503"), "true");
conf("marcação manual não inventa número",
  barra({ it: { solicitado: true } }, "solicitado na mão").motivo.includes("sem número"), "true");
conf("verba fora do mapa da EAP", barra({ catNum: "99" }, "verba sem folha da EAP").motivo.includes("não está ligada"), "true");
{
  const { itens, bloqueados } = montarSolicitacaoSienge([linha("0-0")], { mapaEap: MAPA, unidadeId: null });
  conf("sem unidade construtiva nada sai", `${itens.length}/${bloqueados.length}`, "0/1");
}
{
  // O bloqueado carrega o suficiente pra tela dizer QUAL item é.
  const { bloqueados } = montarSolicitacaoSienge([linha("0-0", { mae: null })], opts);
  conf("o bloqueado se identifica", bloqueados[0].item, "20.1 Ar condicionado");
  conf("e diz de que verba é", bloqueados[0].verba, "20");
}

console.log("\n— detalhe novo também vai —");
{
  /* Até 15/09/2026 isto era barrado. Como o `detailId` não é enviado, o
     payload do detalhe novo é idêntico ao do já cadastrado: o que muda é
     só o texto da observação. Barrar não protegia nada. */
  const { itens, bloqueados } = montarSolicitacaoSienge([
    linha("0-0", { status: "aproximado", descritivo: "LG / AR CONDICIONADO / TEXTO EDITADO À MÃO" }),
  ], opts);
  conf("item de detalhe novo entra", itens.length, 1);
  conf("nada bloqueado", bloqueados.length, 0);
  // É o texto do quadro "cadastrar como detalhe novo" — inclusive editado.
  conf("a descrição editada vai como observação", itens[0].notes, "LG / AR CONDICIONADO / TEXTO EDITADO À MÃO");
  conf("e fica marcado pra tela avisar", itens[0].detalheNovo, "true");
  conf("o já cadastrado não é marcado",
    montarSolicitacaoSienge([linha("0-0")], opts).itens[0].detalheNovo, "false");
}
{
  // Sem texto nenhum não dá: `notes` é o que descreve o que se quer.
  const { itens, bloqueados } = montarSolicitacaoSienge([
    linha("0-0", { status: "aproximado", descritivo: "  ", it: { desc: "", detalheSienge: null } }),
  ], opts);
  conf("sem descrição nenhuma, barra", `${itens.length}/${bloqueados.length}`, "0/1");
}

console.log("\n— trocar o insumo troca a lista de detalhes —");
{
  /* O detalhe pertence ao insumo: o 4 do 275 é um ar-condicionado, e no
     insumo 300 seria outra coisa (ou nada). Trocar o código e manter o
     detalhe apontaria pra um produto que não existe. */
  const catalogo = [
    { id: 275, descricao: "AR CONDICIONADO", detalhes: [{ id: 4, codigo: null, descricao: "LG / SPLIT 18.000" }] },
    { id: 300, descricao: "CADEIRA", detalhes: [{ id: 1, codigo: null, descricao: "EIFFEL BRANCA" }] },
  ];
  const { itens } = montarSolicitacaoSienge([linha("0-0", { descritivo: "LG / SPLIT 18.000" })], opts);
  const original = casarDetalhes(itens, catalogo)[0];
  conf("no insumo certo, acha o detalhe", original.detailId, 4);

  // A troca é feita pela tela; aqui vale o efeito dela sobre o casamento.
  const trocado = casarDetalhes([{ ...itens[0], productId: 300 }], catalogo)[0];
  conf("no insumo trocado, o detalhe antigo não vale", trocado.detailId, undefined);
  conf("e a lista passa a ser a do novo insumo", trocado.detalhesDisponiveis[0].descricao, "EIFFEL BRANCA");
  conf("com o nome do novo insumo", trocado.insumoDescricao, "CADEIRA");
}

console.log("\n— toda linha selecionada tem que aparecer —");
{
  /* A conta que o modal mostra: nenhuma linha pode sumir entre "vai" e
     "não vai" — somada conta como aparecida. */
  const sel = [
    linha("0-0"),                                     // vai
    linha("0-1"),                                     // soma na anterior
    linha("0-2", { mae: null }),                      // bloqueada
    linha("0-3", { catNum: "28", status: "aproximado" }), // vai (detalhe novo, outra verba)
  ];
  const { itens, bloqueados } = montarSolicitacaoSienge(sel, opts);
  const representadas = itens.flatMap((i) => i.chaves).length + bloqueados.length;
  conf("todas as 4 linhas estão representadas", representadas, sel.length);
  conf("nenhuma chave aparece duas vezes",
    new Set([...itens.flatMap((i) => i.chaves), ...bloqueados.map((b) => b.chave)]).size, sel.length);
}

console.log("\n— o bom e o ruim na mesma seleção —");
{
  const { itens, bloqueados } = montarSolicitacaoSienge([
    linha("0-0"),
    linha("0-1", { mae: null }),
    linha("0-2", { it: { un: "cj" } }),
  ], opts);
  conf("o que dá pra mandar vai", itens.length, 1);
  conf("o que não dá volta explicado", bloqueados.length, 2);
}

console.log("\n— o detalhe do insumo (QUAL produto é) —");
{
  /* O insumo 275 é "AR CONDICIONADO"; o detalhe é que diz se é o split
     de 18.000 ou o cassete. Sem ele a solicitação sai genérica. Estes
     detalhes são os reais da obra 2045. */
  const catalogo = [{
    id: 275, descricao: "AR CONDICIONADO",
    detalhes: [
      { id: 3, codigo: null, descricao: "LG / SPLIT DUAL INVERTER 12.000 BTUS QUENTE E FRIO / BRANCO" },
      { id: 4, codigo: "A18", descricao: "LG / SPLIT DUAL INVERTER 18.000 BTUS QUENTE E FRIO / BRANCO" },
      { id: 5, codigo: null, descricao: "LG / SPLIT DUAL INVERTER 24.000 BTUS QUENTE E FRIO / BRANCO" },
    ],
  }];
  const comDetalhe = (descricao) => {
    const { itens } = montarSolicitacaoSienge([linha("0-0", { descritivo: descricao })], opts);
    return casarDetalhes(itens, catalogo)[0];
  };

  const exato = comDetalhe("LG / SPLIT DUAL INVERTER 18.000 BTUS QUENTE E FRIO / BRANCO");
  conf("descrição igual acha o detalhe", exato.detailId, 4);
  conf("traz a lista pra tela deixar trocar", exato.detalhesDisponiveis.length, 3);
  // O número do detalhe é como se confere o item dentro do Sienge.
  conf("guarda o código auxiliar do detalhe", exato.detalheCodigo, "A18");
  conf("e a descrição escolhida", exato.detalheDescricao, "LG / SPLIT DUAL INVERTER 18.000 BTUS QUENTE E FRIO / BRANCO");
  conf("detalhe sem código auxiliar não inventa um",
    comDetalhe("LG / SPLIT DUAL INVERTER 24.000 BTUS QUENTE E FRIO / BRANCO").detalheCodigo, "null");
  conf("e o nome do insumo no Sienge", exato.insumoDescricao, "AR CONDICIONADO");

  // Pontuação e caixa não podem separar o que é a mesma coisa.
  conf("acento, caixa e barra não atrapalham",
    comDetalhe("lg / split dual inverter 18.000 btus quente e frio / branco").detailId, 4);

  // 24.000 é outro produto: não pode cair no 18.000.
  conf("não confunde as potências", comDetalhe("LG / SPLIT DUAL INVERTER 24.000 BTUS QUENTE E FRIO / BRANCO").detailId, 5);

  /* Só igualdade: "parecido" não preenche nada. Quem confere vai olhar o
     seletor de qualquer jeito, e um palpite quase-certo aqui é o
     ar-condicionado errado no pedido. */
  conf("quase igual NÃO vira escolha", comDetalhe("LG SPLIT DUAL INVERTER 18.000 BTUS QUENTE FRIO").detailId, undefined);
  conf("coisa diferente também não", comDetalhe("CADEIRA EIFFEL BRANCA").detailId, undefined);
  conf("mas a lista continua lá pra escolher",
    comDetalhe("LG SPLIT DUAL INVERTER 18.000 BTUS QUENTE FRIO").detalhesDisponiveis.length, 3);
}
{
  // Insumo sem detalhe cadastrado: segue sem detailId, como sempre foi.
  const { itens } = montarSolicitacaoSienge([linha("0-0")], opts);
  const sem = casarDetalhes(itens, [{ id: 275, descricao: "AR CONDICIONADO", detalhes: [] }])[0];
  conf("insumo sem detalhes não ganha detailId", sem.detailId, undefined);
  conf("e a tela não oferece escolha", sem.detalhesDisponiveis.length, 0);
  // Insumo que nem está no catálogo (obra diferente, cadastro novo).
  const fora = casarDetalhes(itens, [])[0];
  conf("insumo fora do catálogo também não", fora.detailId, undefined);
}

console.log("\n— o corpo que vai pro servidor —");
{
  const { itens } = montarSolicitacaoSienge([linha("0-0")], opts);
  const corpo = corpoDoEnvio({ buildingId: "2519", notes: "teste", itens });
  conf("buildingId vai como número", typeof corpo.buildingId, "number");
  // `linhas` e `custoTotal` são da tela: mandar o objeto inteiro levaria
  // o item da obra junto, e a API rejeita campo que não conhece.
  conf("não leva o que é só da tela", Object.keys(corpo.itens[0]).sort().join(","),
    "buildingUnitId,chaves,costEstimationItemReference,estimatedPrice,notes,productId,quantity,unitySymbol");
}

console.log("\n— unidades —");
conf("und vira un", simboloSienge("und"), "un");
conf("M² vira m2", simboloSienge("M²"), "m2");
conf("pç vira pc", simboloSienge("pç"), "pc");
conf("vg vira vb", simboloSienge("vg"), "vb");
conf("cj não tem equivalente", simboloSienge("cj"), "null");
conf("vazio não vira nada", simboloSienge(""), "null");
conf("texto comparável ignora acento e caixa", textoComparavel(" Açaí  X "), "ACAI X");

console.log(f ? `\n${f} falharam` : "\ntodos passaram");
process.exit(f ? 1 : 0);
