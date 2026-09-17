/* A fila da obra no Início: o que está parado e esperando quem.
 *
 * Roda com: node web/src/__testes__/marcos-inicio.test.mjs
 *
 * Pedido dela em 17/09/2026: além dos chips de "o documento chegou?", mostrar
 * quanta COISA está parada — esperando o cliente, esperando liberação, ou
 * esperando solicitação no Sienge.
 *
 * A regra que não pode quebrar: cada item conta numa etapa SÓ, a primeira em
 * que está travado. Se o mesmo item entrasse em duas, a tela inflaria a fila
 * e ninguém saberia o tamanho real do trabalho.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "App.jsx"), "utf8");
const bloco = (assinatura, fim = "\n}\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei no App.jsx: ${assinatura}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};
const trecho = (de, ate) => {
  const i = src.indexOf(de), f = src.indexOf(ate);
  if (i === -1 || f === -1) throw new Error(`não achei o intervalo: ${de} .. ${ate}`);
  return src.slice(i, f);
};

const M = eval(`(function () {
  const padraoDaDescricao = () => null;
  const verbaPorNome = () => null;
  const eapPadrao = () => [];
  ${trecho("const ALOC_MAT =", "/* =====[ FIM DO MODELO PURO")}
  ${bloco("function parcelasDoItem(")}
  ${bloco("function parcelasDaPlanilha(")}
  ${bloco("function liberadoParaCompra(")}
  ${bloco("function aprovadoPeloCliente(")}
  ${bloco("function estaSolicitado(")}
  return { pendenciasDaObra };
})()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(58)} ${String(o).padEnd(16)} ${ok ? "" : "esperava " + e}`); };

// Uma verba com material, pra alocação não mandar o item pra mão de obra.
const obraCom = (itens, extra = {}) => ({ categorias: [{ num: "27", nome: "Louças, Metais e Equipamentos Especiais", itens }], ...extra });
const item = (x = {}) => ({ desc: "Cuba de apoio", totalMaterial: 100, custo: 100, qtdVendida: 1, ...x });
const resumo = (o) => { const p = M.pendenciasDaObra(o); return `${p.cliente}/${p.liberar}/${p.solicitar}`; };

/* ---- 1. O funil: cada item conta numa etapa só ---- */
conf("item cru espera o cliente", resumo(obraCom([item()])), "1/0/0");
conf("aprovado pelo cliente, falta liberar",
  resumo(obraCom([item({ aprovadoCliente: { em: "x" } })])), "0/1/0");
conf("liberado sem canal não vira solicitação",
  resumo(obraCom([item({ aprovadoCliente: { em: "x" }, liberadoCompra: { em: "x" } })])), "0/0/0");
conf("liberado com canal Sienge, falta solicitar",
  resumo(obraCom([item({ aprovadoCliente: { em: "x" }, liberadoCompra: { em: "x" }, canalCompra: "sienge" })])), "0/0/1");
conf("já solicitado sai da fila",
  resumo(obraCom([item({ aprovadoCliente: { em: "x" }, liberadoCompra: { em: "x" }, canalCompra: "sienge", solicitado: true })])), "0/0/0");
conf("já comprado sai da fila",
  resumo(obraCom([item({ aprovadoCliente: { em: "x" }, liberadoCompra: { em: "x" }, canalCompra: "sienge", comprado: true })])), "0/0/0");

/* Canal que não é Sienge não tem etapa de solicitação — a compra é direta. */
conf("canal Mehoo não pede solicitação",
  resumo(obraCom([item({ aprovadoCliente: { em: "x" }, liberadoCompra: { em: "x" }, canalCompra: "mehoo" })])), "0/0/0");

/* ---- 2. A assinatura geral do cliente vale por todos ----
   É o campo que faltava no resumo do painel: sem ele a obra inteira
   apareceria "esperando o cliente" depois de o cliente ter assinado. */
conf("assinatura geral tira todo mundo da fila do cliente",
  resumo(obraCom([item(), item(), item()], { clienteAssinouEm: "2026-09-17" })), "0/3/0");

/* ---- 3. Quem NÃO entra na fila ---- */
conf("linha de título não conta", resumo(obraCom([item({ ehTitulo: true })])), "0/0/0");
conf("item excluído não conta", resumo(obraCom([item({ excluido: true })])), "0/0/0");
/* Mão de obra não se compra — vai pra Contratos. É a trava que toda regra de
   compra precisa ter ANTES de qualquer outra pergunta. */
conf("mão de obra fica fora da fila",
  resumo(obraCom([item({ totalMaterial: 0, totalMO: 500, custo: 500 })])), "0/0/0");

/* ---- 4. Não quebrar ---- */
conf("obra sem categorias", resumo({ categorias: [] }), "0/0/0");
conf("obra undefined", resumo(undefined), "0/0/0");
conf("verba sem itens", resumo({ categorias: [{ num: "27", nome: "x" }] }), "0/0/0");

/* ---- 5. Soma de vários, em etapas diferentes ---- */
conf("três etapas ao mesmo tempo", resumo(obraCom([
  item({ desc: "A" }),
  item({ desc: "B", aprovadoCliente: { em: "x" } }),
  item({ desc: "C", aprovadoCliente: { em: "x" } }),
  item({ desc: "D", aprovadoCliente: { em: "x" }, liberadoCompra: { em: "x" }, canalCompra: "sienge" }),
])), "1/2/1");

/* ---- 6. O resumo do painel precisa carregar a assinatura ----
   Sem esta coluna no SELECT, o teste 2 passa mas a tela mente. */
const dados = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "lib", "dadosObra.js"), "utf8");
const resumoDeVarias = dados.slice(dados.indexOf("export async function carregarResumoDeVarias"));
conf("o resumo do painel busca cliente_assinou_em", resumoDeVarias.includes("cliente_assinou_em"), true);
conf("e mapeia pra clienteAssinouEm", resumoDeVarias.includes("clienteAssinouEm"), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
