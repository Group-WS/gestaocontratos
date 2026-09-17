/* O histórico da obra: quem fez o que, e quando.
 *
 * Roda com: node web/src/__testes__/historico.test.mjs
 *
 * Pedido dela em 17/09/2026: "foi tudo liberado para compra e eu nao sei quem
 * liberou. tem como no final da pagina criar um histórico? esse histório pode
 * ser bem discreto, mas ajuda saber cada alteração e aprovação."
 *
 * Duas coisas aqui não podem quebrar:
 *   1. o histórico NÃO INVENTA autor. Comprado e solicitado guardam só a
 *      data; a linha tem que sair sem nome em vez de com o nome errado.
 *   2. item que conta como liberado sem ninguém ter liberado é CONTADO e
 *      dito. Era a pergunta que gerou o pedido: na 2450, 152 itens
 *      apareciam liberados e nenhum tinha carimbo.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "App.jsx"), "utf8");
const trecho = (de, ate) => {
  const i = src.indexOf(de), f = src.indexOf(ate);
  if (i === -1 || f === -1) throw new Error(`não achei o intervalo: ${de} .. ${ate}`);
  return src.slice(i, f);
};
const bloco = (assinatura, fim = "\n}\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei no App.jsx: ${assinatura}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};

const M = eval(`(function () {
  const padraoDaDescricao = () => null;
  const verbaPorNome = () => null;
  const eapPadrao = () => [];
  ${trecho("const ALOC_MAT =", "/* =====[ FIM DO MODELO PURO")}
  ${bloco("function liberadoParaCompra(")}
  return { historicoDerivado, historicoDaTela, liberadosSemRegistro, itemDoHistorico, TELA_DO_EVENTO, FRASE_DO_EVENTO };
})()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(58)} ${String(o).padEnd(30)} ${ok ? "" : "esperava " + e}`); };

const obra = {
  categorias: [{ num: "27", nome: "Louças e Metais", itens: [
    { desc: "Cuba de apoio", codigo: "27.1", liberadoCompra: { em: "2026-09-17T10:00:00Z", por: "barbara.franco@groupws.com.br" } },
    { desc: "Torneira alta", codigo: "27.2", aprovadoCliente: { em: "2026-09-16T09:00:00Z", por: "ana@groupws.com.br" },
      alertaConferido: { em: "2026-09-16T09:30:00Z", por: "ana@groupws.com.br" } },
    { desc: "Chuveiro", codigo: "27.3", liberadoSemCliente: { em: "2026-09-15T08:00:00Z", por: "ana@groupws.com.br", motivo: "prazo do fornecedor", autorizadoPor: "Priscila" } },
    // Comprado e solicitado guardam a data, nunca o autor.
    { desc: "Ralo", codigo: "27.4", comprado: true, compradoEm: "2026-09-14T12:00:00Z", solicitado: true, solicitadoEm: "2026-09-13T12:00:00Z" },
    // Já estava no fluxo antes da regra: conta como liberado, sem carimbo.
    { desc: "Papeleira", codigo: "27.5", canalCompra: "sienge" },
    { desc: "TÍTULO", ehTitulo: true, liberadoCompra: { em: "2026-09-01T00:00:00Z", por: "x@y" } },
  ] }],
  cmvLiberadoEm: "2026-09-10T10:00:00Z", cmvLiberadoPor: "priscila.wayhs@groupws.com.br",
  clienteAssinouEm: "2026-09-11T10:00:00Z", clienteAssinaturaPor: "gleice.ribeiro@groupws.com.br",
  etapasConcluidas: { executivo: { em: "2026-09-12T10:00:00Z", por: "barbara.franco@groupws.com.br" } },
};
const eventos = M.historicoDerivado(obra);
const acha = (tipo) => eventos.find((e) => e.tipo === tipo);

/* ---- 1. Cada carimbo virou uma linha ---- */
conf("liberação para compra entrou", acha("liberou_compra")?.por, "barbara.franco@groupws.com.br");
conf("aprovação do cliente entrou", acha("aprovou_cliente")?.por, "ana@groupws.com.br");
conf("alerta conferido entrou", acha("conferiu_alerta")?.por, "ana@groupws.com.br");
conf("exceção sem cliente entrou com o motivo", acha("liberou_sem_cliente")?.detalhe, "prazo do fornecedor");
conf("e com quem autorizou", acha("liberou_sem_cliente")?.autorizadoPor, "Priscila");
conf("CMV liberado entrou", acha("cmv")?.por, "priscila.wayhs@groupws.com.br");
conf("assinatura do cliente entrou", acha("assinatura")?.por, "gleice.ribeiro@groupws.com.br");
conf("etapa concluída entrou", acha("etapa")?.detalhe, "executivo");

/* ---- 2. NÃO INVENTA AUTOR ----
   O campo guarda só a data. A linha sai sem nome, e a tela escreve "alguém". */
conf("comprado entra sem autor", acha("comprou")?.por, "null");
conf("solicitado entra sem autor", acha("solicitou")?.por, "null");
conf("mas a data do comprado vem", acha("comprou")?.em, "2026-09-14T12:00:00Z");
conf("a tela diz alguém quando não há autor", /\{ev\.por \? nomeDoEmail\(ev\.por\) : "alguém"\}/.test(src), true);

/* ---- 3. Ordem e limpeza ---- */
conf("o mais recente vem primeiro", eventos[0]?.tipo, "liberou_compra");
conf("linha de título não entra", eventos.some((e) => String(e.item || "").includes("TÍTULO")), false);
conf("carimbo sem data não entra", M.historicoDerivado({ categorias: [{ num: "1", itens: [{ desc: "x", liberadoCompra: { por: "y" } }] }] }).length, 0);
conf("obra vazia não quebra", M.historicoDerivado(undefined).length, 0);
conf("o item aparece com verba, código e nome", acha("liberou_compra")?.item, "27 · 27.1 · Cuba de apoio");

/* ---- 4. Cada tela mostra o que é dela ---- */
const naConferencia = M.historicoDaTela(eventos, "executivo_conferencia");
conf("a conferência mostra a liberação", naConferencia.some((e) => e.tipo === "liberou_compra"), true);
conf("a conferência NÃO mostra a compra", naConferencia.some((e) => e.tipo === "comprou"), false);
const nasCompras = M.historicoDaTela(eventos, "compras");
conf("as Compras mostram o comprado", nasCompras.some((e) => e.tipo === "comprou"), true);
conf("as Compras NÃO mostram a liberação", nasCompras.some((e) => e.tipo === "liberou_compra"), false);
/* Concluir etapa é da obra, não de um lugar: aparece em toda tela. */
conf("etapa concluída aparece na conferência", naConferencia.some((e) => e.tipo === "etapa"), true);
conf("etapa concluída aparece nas Compras", nasCompras.some((e) => e.tipo === "etapa"), true);

/* ---- 5. O que o histórico NÃO sabe, ele diz ----
   Papeleira tem canal e nenhum carimbo; Ralo está comprado e sem carimbo. */
conf("conta os liberados sem registro", M.liberadosSemRegistro(obra), 2);
conf("item com carimbo não é contado como sem registro",
  M.liberadosSemRegistro({ categorias: [{ num: "1", itens: [{ desc: "x", liberadoCompra: { em: "2026-09-17T10:00:00Z", por: "y" } }] }] }), 0);
conf("obra vazia não quebra a contagem", M.liberadosSemRegistro(undefined), 0);

/* ---- 6. Toda frase existe ---- */
Object.keys(M.TELA_DO_EVENTO).forEach((tipo) => {
  conf(`o evento ${tipo} tem frase`, !!M.FRASE_DO_EVENTO[tipo], true);
});

/* ---- 7. O painel está no pé de toda tela da obra ---- */
conf("o histórico fecha a página da obra", /<HistoricoDaObra obra=\{obra\} tela=\{/.test(src), true);
conf("e o CSS dele existe", src.includes(".hist-abrir {") && src.includes(".hist-nota {"), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
