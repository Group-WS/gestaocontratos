/* RN-002 · Item aprovado para compra não se edita nem se remove no Executivo.
 *
 * Roda com: node web/src/regras/itemAprovadoNoExecutivo.test.mjs
 *
 * Os exemplos da ficha (docs/regras-de-negocio/RN-002-item-aprovado-no-executivo.md),
 * um por um, mais os limites: item repetido, tirar a aprovação, item novo.
 */
import {
  itemTravadoNoExecutivo, linhaDoExecutivoTravada, travadosAlterados,
} from "./itemAprovadoNoExecutivo.js";

let falhas = 0;
const conf = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome.padEnd(78)} ${ok ? "" : `obtido ${JSON.stringify(obtido)} · esperado ${JSON.stringify(esperado)}`}`);
};

const chave = (d) => String(d || "").toLowerCase().trim();
const carimbo = { em: "2026-09-23T13:00:00.000Z", por: "admin@tkws.com.br" };
const obra = (...itens) => [{ num: "02", itens }];
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

// ---------- a gravação ----------
const aprovado = art({ liberadoCompra: carimbo });
conf("RN-002 · editar o custo do aprovado é recusado",
  travadosAlterados(obra(aprovado, frete()), obra({ ...aprovado, custoMaterial: 120, custo: 120 }, frete())), 1);
conf("RN-002 · remover o aprovado é recusado",
  travadosAlterados(obra(aprovado), obra({ ...aprovado, excluido: true, excluidoMotivo: "saiu" })), 1);
conf("RN-002 · tirar a linha aprovada da planilha é recusado",
  travadosAlterados(obra(aprovado, frete()), obra(frete())), 1);
conf("RN-002 · editar item não aprovado passa",
  travadosAlterados(obra(aprovado, frete()), obra(aprovado, frete({ custoMaterial: 650 }))), 0);
conf("RN-002 · adicionar item novo passa",
  travadosAlterados(obra(aprovado), obra(aprovado, frete({ codigo: "2.8" }))), 0);
conf("RN-002 · mudar de posição passa",
  travadosAlterados(obra(aprovado, frete()), obra(frete(), aprovado)), 0);
conf("RN-002 · desfazer a aprovação passa (a digital não muda)",
  travadosAlterados(obra(aprovado), obra({ ...aprovado, liberadoCompra: null })), 0);
conf("RN-002 · marcar como solicitado passa",
  travadosAlterados(obra(aprovado), obra({ ...aprovado, solicitado: true })), 0);
conf("RN-002 · dois aprovados iguais: editar um é recusado",
  travadosAlterados(obra(aprovado, aprovado), obra(aprovado, { ...aprovado, qtdVendida: 2 })), 1);
conf("RN-002 · obra sem item aprovado grava qualquer coisa",
  travadosAlterados(obra(art(), frete()), obra()), 0);
conf("RN-002 · entrada vazia não quebra", travadosAlterados(null, undefined), 0);

if (falhas) { console.log(`\n${falhas} falha(s)`); process.exit(1); }
console.log("\nRN-002: tudo certo");
