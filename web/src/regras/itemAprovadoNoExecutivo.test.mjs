/* RN-002 · Item aprovado para compra não se edita nem se remove no Executivo.
 *
 * Roda com: node web/src/regras/itemAprovadoNoExecutivo.test.mjs
 *
 * Os exemplos da ficha (docs/regras-de-negocio/RN-002-item-aprovado-no-executivo.md),
 * um por um, mais os limites: item repetido, tirar a aprovação, item novo.
 */
import {
  itemTravadoNoExecutivo, linhaDoExecutivoTravada, linhasTravadasAlteradas, alteracoesEmItensAprovados,
} from "./itemAprovadoNoExecutivo.js";

let falhas = 0;
const conf = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome.padEnd(78)} ${ok ? "" : `obtido ${JSON.stringify(obtido)} · esperado ${JSON.stringify(esperado)}`}`);
};

const chave = (d) => String(d || "").toLowerCase().trim();
const carimbo = { em: "2026-09-23T13:00:00.000Z", por: "admin@tkws.com.br" };
const art = (extra = {}) => ({ codigo: "2.1", desc: "Anotação de responsabilidade técnica - ART", un: "vb", qtdVendida: 1, custoMaterial: 108, custo: 108, ...extra });
const frete = (extra = {}) => ({ codigo: "2.4", desc: "Fretes e deslocamentos", un: "vb", qtdVendida: 1, custoMaterial: 600, custo: 600, ...extra });

// ---------- o que trava ----------
conf("RN-002 · item sem aprovação não trava", itemTravadoNoExecutivo(art()), false);
conf("RN-002 · aprovado para compra trava", itemTravadoNoExecutivo(art({ liberadoCompra: carimbo })), true);
conf("RN-002 · já solicitado trava", itemTravadoNoExecutivo(art({ solicitado: true })), true);
conf("RN-002 · já comprado trava", itemTravadoNoExecutivo(art({ comprado: true })), true);
conf("RN-002 · com canal de compra trava", itemTravadoNoExecutivo(art({ canalCompra: "tkws" })), true);
conf("RN-002 · valores vazios não travam", itemTravadoNoExecutivo(art({ liberadoCompra: null, comprado: false, canalCompra: "" })), false);
conf("RN-002 · só o cliente aprovou não trava", itemTravadoNoExecutivo(art({ aprovadoCliente: carimbo })), false);

// ---------- a linha do Executivo ----------
conf("RN-002 · linha casa pela descrição e trava",
  linhaDoExecutivoTravada({ desc: "  anotação de responsabilidade técnica - art " }, [art({ liberadoCompra: carimbo })], chave), true);
conf("RN-002 · linha sem par aprovado não trava",
  linhaDoExecutivoTravada({ desc: "Fretes e deslocamentos" }, [art({ liberadoCompra: carimbo }), frete()], chave), false);

// ---------- a linha casa pelo id, não pela descrição (obra 9999, 23/09/2026) ----------
const painel = (ambiente, id, extra = {}) => ({ desc: "Painel de embutir ECO 18W 20,2x20,2cm", ambiente, idLinha: id, ...extra });
const paineis = [painel("Living", "a", { liberadoCompra: carimbo }), painel("Dormitório", "b", { liberadoCompra: carimbo }), painel("Banheiro", "c"), painel("Sacada", "d")];
conf("RN-002 · mesma descrição: a linha aprovada trava",
  linhaDoExecutivoTravada(painel("Living", "a"), paineis, chave), true);
conf("RN-002 · mesma descrição: a linha NÃO aprovada não trava",
  linhaDoExecutivoTravada(painel("Banheiro", "c"), paineis, chave), false);
conf("RN-002 · a linha de mão de obra aprovada trava o produto (mesmo id)",
  linhaDoExecutivoTravada(painel("Banheiro", "c"), [painel("Banheiro", "c"), painel("Banheiro", "c", { separadoDe: {}, liberadoCompra: carimbo })], chave), true);
conf("RN-002 · linha sem id fica do lado seguro (trava pela descrição)",
  linhaDoExecutivoTravada(painel("Banheiro", undefined), paineis, chave), true);

// ---------- a gravação: a planilha do Executivo ----------
/* A obra com a lista de trabalho (`itens`) e a planilha do Executivo
   (`itensPlanilhaExecutivo`), as duas com a mesma linha. */
const obra = (itens, planilha = itens) => [{ num: "02", itens, itensPlanilhaExecutivo: planilha }];
const aprovado = art({ idLinha: "L1", liberadoCompra: carimbo });
const linhaAprovada = art({ idLinha: "L1" });
const livre = frete({ idLinha: "L2" });
conf("RN-002 · editar o custo da linha aprovada no Executivo é recusado",
  linhasTravadasAlteradas(obra([aprovado, livre], [linhaAprovada, livre]), obra([aprovado, livre], [{ ...linhaAprovada, custoMaterial: 120, custo: 120 }, livre])), 1);
conf("RN-002 · remover a linha aprovada no Executivo é recusado",
  linhasTravadasAlteradas(obra([aprovado], [linhaAprovada]), obra([aprovado], [{ ...linhaAprovada, excluido: true, excluidoMotivo: "saiu" }])), 1);
conf("RN-002 · tirar a linha aprovada da planilha é recusado",
  linhasTravadasAlteradas(obra([aprovado, livre], [linhaAprovada, livre]), obra([aprovado, livre], [livre])), 1);
conf("RN-002 · editar linha não aprovada passa",
  linhasTravadasAlteradas(obra([aprovado, livre], [linhaAprovada, livre]), obra([aprovado, livre], [linhaAprovada, { ...livre, custoMaterial: 650 }])), 0);
conf("RN-002 · adicionar linha nova passa",
  linhasTravadasAlteradas(obra([aprovado], [linhaAprovada]), obra([aprovado], [linhaAprovada, frete({ idLinha: "L3" })])), 0);
conf("RN-002 · mudar de posição passa",
  linhasTravadasAlteradas(obra([aprovado, livre], [linhaAprovada, livre]), obra([aprovado, livre], [livre, linhaAprovada])), 0);
conf("RN-002 · desfazer a aprovação passa",
  linhasTravadasAlteradas(obra([aprovado], [linhaAprovada]), obra([{ ...aprovado, liberadoCompra: null }], [linhaAprovada])), 0);
conf("RN-002 · editar o item aprovado em Compras passa (fica no registro)",
  linhasTravadasAlteradas(obra([aprovado], [linhaAprovada]), obra([{ ...aprovado, marca: "Outra", custo: 90 }], [linhaAprovada])), 0);
conf("RN-002 · obra sem item aprovado grava qualquer coisa",
  linhasTravadasAlteradas(obra([art(), frete()]), []), 0);
conf("RN-002 · entrada vazia não quebra", linhasTravadasAlteradas(null, undefined), 0);

// ---------- o registro das mudanças no item aprovado ----------
conf("RN-002 · mudar a marca do aprovado em Compras fica no registro",
  alteracoesEmItensAprovados(obra([aprovado]), obra([{ ...aprovado, marca: "Outra" }])),
  [{ verba: "02", idLinha: "L1", desc: aprovado.desc, campo: "marca", antes: null, depois: "Outra" }]);
conf("RN-002 · um registro por campo que mudou",
  alteracoesEmItensAprovados(obra([aprovado]), obra([{ ...aprovado, custoMaterial: 120, custo: 120 }])).map((r) => r.campo),
  ["custo", "custoMaterial"]);
conf("RN-002 · tirar o aprovado da lista fica no registro como removido",
  alteracoesEmItensAprovados(obra([aprovado, livre]), obra([livre])).map((r) => [r.campo, r.antes, r.depois]),
  [["removido", true, null]]);
conf("RN-002 · mudança em item não aprovado não entra no registro",
  alteracoesEmItensAprovados(obra([aprovado, livre]), obra([aprovado, { ...livre, custo: 1 }])), []);
conf("RN-002 · mudar só o estado da compra não entra no registro",
  alteracoesEmItensAprovados(obra([aprovado]), obra([{ ...aprovado, solicitado: true }])), []);
conf("RN-002 · mudar de posição não entra no registro",
  alteracoesEmItensAprovados(obra([aprovado, livre]), obra([livre, aprovado])), []);
conf("RN-002 · produto e mão de obra com o mesmo id casam na ordem",
  alteracoesEmItensAprovados(obra([aprovado, { ...aprovado, custoMO: 10 }]), obra([aprovado, { ...aprovado, custoMO: 12 }])).map((r) => [r.campo, r.antes, r.depois]),
  [["custoMO", 10, 12]]);
conf("RN-002 · item sem id casa pela posição",
  alteracoesEmItensAprovados(obra([art({ comprado: true })]), obra([art({ comprado: true, un: "un" })])).map((r) => r.campo), ["un"]);
conf("RN-002 · registro com entrada vazia não quebra", alteracoesEmItensAprovados(null, undefined), []);

if (falhas) { console.log(`\n${falhas} falha(s)`); process.exit(1); }
console.log("\nRN-002: tudo certo");
