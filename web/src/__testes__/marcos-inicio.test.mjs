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

/* ---- 1. O funil: cada item conta numa etapa só ----
   A APROVAÇÃO DO CLIENTE SAIU DO FUNIL em 18/09/2026: ela deixou de barrar a
   compra (decisão dela, junto com a remoção dos blocos de aprovação da Conf.
   Executivo). Quem segura agora são as duas decisões internas — o executivo
   conclui a linha, o administrador libera. O contador `cliente` continua no
   formato, em zero, pra não quebrar quem lê a fila. */
conf("item cru espera liberação, não o cliente", resumo(obraCom([item()])), "0/1/0");
conf("o carimbo do cliente não muda mais a fila",
  resumo(obraCom([item({ aprovadoCliente: { em: "x" } })])), "0/1/0");
conf("liberado sem canal não vira solicitação",
  resumo(obraCom([item({ liberadoCompra: { em: "x" } })])), "0/0/0");
conf("liberado com canal Sienge, falta solicitar",
  resumo(obraCom([item({ liberadoCompra: { em: "x" }, canalCompra: "sienge" })])), "0/0/1");
conf("já solicitado sai da fila",
  resumo(obraCom([item({ liberadoCompra: { em: "x" }, canalCompra: "sienge", solicitado: true })])), "0/0/0");
conf("já comprado sai da fila",
  resumo(obraCom([item({ liberadoCompra: { em: "x" }, canalCompra: "sienge", comprado: true })])), "0/0/0");

/* Canal que não é Sienge não tem etapa de solicitação — a compra é direta. */
conf("canal Mehoo não pede solicitação",
  resumo(obraCom([item({ liberadoCompra: { em: "x" }, canalCompra: "mehoo" })])), "0/0/0");

/* ---- 2. A assinatura geral não filtra mais nada ----
   Ela valia por todos os itens quando o cliente barrava a compra. Com o
   portão removido, obra assinada e obra sem assinatura contam igual — e é
   isso que este caso fixa, pra ninguém reintroduzir a regra sem querer. */
conf("obra assinada conta igual à não assinada",
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
conf("duas etapas ao mesmo tempo", resumo(obraCom([
  item({ desc: "A" }),
  item({ desc: "B" }),
  item({ desc: "C" }),
  item({ desc: "D", liberadoCompra: { em: "x" }, canalCompra: "sienge" }),
])), "0/3/1");

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
