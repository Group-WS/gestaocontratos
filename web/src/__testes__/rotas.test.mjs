/* O endereço de cada tela.
 *
 * Roda com: node web/src/__testes__/rotas.test.mjs
 *
 * Endereço errado não é detalhe de enfeite: é link compartilhado que abre
 * a tela errada, e F5 que joga a pessoa pra outro lugar no meio do
 * trabalho. As duas funções são espelho uma da outra — o que uma escreve,
 * a outra tem que ler de volta.
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
const pedaco = (de, ate) => {
  const i = src.indexOf(de), f = src.indexOf(ate, i);
  if (i === -1 || f === -1) throw new Error(`não achei: ${de}`);
  return src.slice(i, f);
};

const M = eval(`(function () {
  ${pedaco("const SLUG_ETAPA = {", "/* O endereco que representa a tela aberta. */")}
  ${bloco("function enderecoDaTela(")}
  ${bloco("function telaDoEndereco(")}
  ${bloco("function resolverRotaPendente(")}
  return { enderecoDaTela, telaDoEndereco, resolverRotaPendente, SLUG_ETAPA, SLUG_MODULO };
})()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(56)} ${String(o).padEnd(26)} ${ok ? "" : "esperava " + e}`); };

/* ---- 1. Da tela pro endereço ---- */
conf("o início é a raiz", M.enderecoDaTela({ modulo: "inicio" }), "/");
conf("um módulo vira uma palavra", M.enderecoDaTela({ modulo: "aditivos" }), "/aditivos");
conf("a gestão tem nome próprio", M.enderecoDaTela({ modulo: "a_contratar" }), "/gestao");
conf("obra sem etapa é o dashboard dela", M.enderecoDaTela({ modulo: "comparativo", codigoDaObra: "2450" }), "/obra/2450");
conf("obra com etapa", M.enderecoDaTela({ modulo: "comparativo", codigoDaObra: "2450", tab: "compras" }), "/obra/2450/compras");
conf("a conferência do executivo", M.enderecoDaTela({ modulo: "comparativo", codigoDaObra: "2498", tab: "executivo_conferencia" }), "/obra/2498/conferencia");
conf("o plano de compras", M.enderecoDaTela({ modulo: "comparativo", codigoDaObra: "2498", tab: "comparativo" }), "/obra/2498/plano");
/* Sem obra escolhida não existe endereço de obra: cair em /obra/undefined
   seria um link que não abre nada. */
conf("obra sem código volta pra raiz", M.enderecoDaTela({ modulo: "comparativo", codigoDaObra: null }), "/");

/* ---- 2. Do endereço pra tela ---- */
conf("a raiz é o início", M.telaDoEndereco("/").modulo, "inicio");
conf("vazio não quebra", M.telaDoEndereco("").modulo, "inicio");
conf("módulo conhecido", M.telaDoEndereco("/equipe").modulo, "equipe");
conf("gestão volta pro id interno", M.telaDoEndereco("/gestao").modulo, "a_contratar");
conf("obra", M.telaDoEndereco("/obra/2450").codigoDaObra, "2450");
conf("obra abre no dashboard", M.telaDoEndereco("/obra/2450").tab, null);
conf("obra com etapa", M.telaDoEndereco("/obra/2450/compras").tab, "compras");
conf("etapa com nome traduzido", M.telaDoEndereco("/obra/2450/conferencia").tab, "executivo_conferencia");
/* Link velho, erro de digitação e recorte de mensagem acontecem: cair no
   Início é melhor que tela branca. */
conf("endereço desconhecido cai no início", M.telaDoEndereco("/coisa-que-nao-existe").modulo, "inicio");
conf("etapa desconhecida abre a obra mesmo assim", M.telaDoEndereco("/obra/2450/xpto").tab, null);
conf("barra sobrando não atrapalha", M.telaDoEndereco("/obra/2450/compras/").tab, "compras");

/* ---- 3. Uma é o espelho da outra ----
   Tudo que o app escreve, ele tem que conseguir ler de volta. */
const telas = [
  { modulo: "inicio" },
  { modulo: "novas" },
  { modulo: "aditivos" },
  { modulo: "a_contratar" },
  { modulo: "arquivo" },
  { modulo: "comparativo", codigoDaObra: "2450", tab: null },
  { modulo: "comparativo", codigoDaObra: "2450", tab: "executivo" },
  { modulo: "comparativo", codigoDaObra: "2498", tab: "executivo_conferencia" },
  { modulo: "comparativo", codigoDaObra: "2195", tab: "contratos" },
];
telas.forEach((t) => {
  const url = M.enderecoDaTela(t);
  const volta = M.telaDoEndereco(url);
  const igual = volta.modulo === t.modulo
    && String(volta.codigoDaObra || "") === String(t.codigoDaObra || "")
    && (volta.tab || null) === (t.tab || null);
  conf(`ida e volta: ${url}`, igual, true);
});

/* Toda etapa da esteira tem nome no endereço: uma etapa sem slug viraria
   um link que abre a obra no lugar errado, calado. */
["vendido_planilha", "vendido_conferencia", "executivo", "executivo_conferencia",
 "comparativo", "compras", "contratos", "diario"].forEach((etapa) => {
  conf(`a etapa ${etapa} tem endereço`, !!M.SLUG_ETAPA[etapa], true);
});

/* A ABA "Aprovação do Cliente" foi aposentada em 18/09/2026 — as duas coisas
   dela moram dentro da Conf. Executivo. O endereço antigo NÃO pode virar tela
   em branco: link salvo, e-mail antigo e favorito continuam abrindo, agora na
   Conf. Executivo. */
conf("a rota antiga /cliente ainda responde", M.telaDoEndereco("/obra/2498/cliente")?.tab, "executivo_conferencia");
conf("... e a etapa aposentada não gera mais endereço", !!M.SLUG_ETAPA.assinatura_cliente, false);

/* ---- A obra errada: as duas corridas de 17/09/2026 ----
   Entrar por /obra/2450/executivo abriu a 2195 duas vezes em quatro. A 2195
   e a 2498 são do Squad Comet; a 2450 é do Sun. */
const rota = M.telaDoEndereco("/obra/2450/executivo");
const comet = [{ id: "c1", codigo: "2195" }, { id: "c2", codigo: "2498" }];
const tudo = [...comet, { id: "s1", codigo: "2450" }];
const acao = (d) => (d.acao === "abrir" ? `abrir ${d.obraId} ${d.tab}` : d.acao);

/* Corrida 1: o Comet respondeu primeiro. A 2450 ainda não existe na lista, e
   antes o endereço DESISTIA aqui — e a regra de sempre abria a 2195. */
conf("só o Comet chegou: espera, não desiste", acao(M.resolverRotaPendente(rota, { obras: comet, prontas: false })), "esperar");
/* Corrida 2: o Monday inteiro chegou, mas o banco ou o perfil não. A lista de
   ativas ainda está vazia, e abrir agora deixava a outra regra zerar a obra. */
conf("Monday completo sem banco/perfil: espera", acao(M.resolverRotaPendente(rota, { obras: tudo, prontas: false })), "esperar");
conf("tudo carregado: abre a 2450 na etapa certa", acao(M.resolverRotaPendente(rota, { obras: tudo, prontas: true })), "abrir s1 executivo");
conf("obra que não existe, tudo carregado: desiste", acao(M.resolverRotaPendente(M.telaDoEndereco("/obra/9999/plano"), { obras: tudo, prontas: true })), "desistir");
conf("obra sem etapa abre a visão geral", M.resolverRotaPendente(M.telaDoEndereco("/obra/2450"), { obras: tudo, prontas: true }).tab, null);
/* Módulo não depende da lista de obras: não tem por que esperar. */
conf("módulo aplica na hora, mesmo sem lista", acao(M.resolverRotaPendente(M.telaDoEndereco("/aditivos"), { obras: [], prontas: false })), "modulo");
conf("sem endereço pendente, nada", acao(M.resolverRotaPendente(null, { obras: tudo, prontas: true })), "nada");
conf("código comparado como texto", acao(M.resolverRotaPendente(rota, { obras: [{ id: "n", codigo: 2450 }], prontas: true })), "abrir n executivo");

/* As travas no App: sem elas a função acima não protege nada. */
conf("a regra 'primeira ativa' não age com endereço esperando",
  /if \(rotaPendente\?\.modulo === "comparativo"\) return;\s*\n\s*if \(obrasAtivas\.length === 0\)/.test(src), true);
conf("a lista pronta espera Monday, banco e perfil",
  /const obrasProntas = !loading && registroCarregado && \(migracaoPendente \|\| \(!!usuario && !pessoasCarregando\)\)/.test(src), true);
conf("o banco avisa quando respondeu, com ou sem erro",
  src.includes(".finally(() => { if (vivo) setRegistroCarregado(true); })"), true);

/* ---- O CADEADO SOME QUANDO JÁ HÁ COMPRA (regra dela, 18/09/2026) ----
 *
 * "se tiver um item ja aprovado para compra, o cadeado deve sumir do menu
 * plano de compras e compras de produtos, pois ja tem uma compra para ser
 * feita."
 *
 * A trava da esteira existe para ninguém comprar antes de conferir. Assim que
 * um item é aprovado, a compra dele já existe — esconder a tela onde ela
 * acontece não protege mais nada.
 */
const ate = (a, fim) => {
  const i = src.indexOf(a);
  if (i === -1) throw new Error(`não achei: ${a}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};
const M2 = eval(`(function () {
  ${bloco("function liberadoParaCompra(")}
  ${ate("const temCompraAprovada =", "liberadoParaCompra(it)));")}
  ${ate("const ETAPAS_QUE_ABREM_COM_COMPRA =", "]);")}
  return { temCompraAprovada, ETAPAS_QUE_ABREM_COM_COMPRA };
})()`);
const obraCom = (itens) => ({ categorias: [{ num: "05", itens }] });
conf("obra sem nada aprovado continua travada",
  M2.temCompraAprovada(obraCom([{ desc: "Spot" }])), false);
conf("um item aprovado abre as telas da compra",
  M2.temCompraAprovada(obraCom([{ desc: "Spot" }, { desc: "Cuba", liberadoCompra: { em: "x" } }])), true);
conf("item já comprado também conta", M2.temCompraAprovada(obraCom([{ desc: "X", comprado: true }])), true);
/* Título e removido não geram compra nenhuma. */
conf("título não abre", M2.temCompraAprovada(obraCom([{ desc: "PAREDE", ehTitulo: true, liberadoCompra: { em: "x" } }])), false);
conf("item removido não abre", M2.temCompraAprovada(obraCom([{ desc: "X", excluido: true, liberadoCompra: { em: "x" } }])), false);
conf("obra vazia não quebra", M2.temCompraAprovada({ categorias: [] }), false);
conf("obra undefined não quebra", M2.temCompraAprovada(undefined), false);
/* Só as duas telas da compra abrem — o resto da esteira continua em ordem. */
conf("só Plano de Compras e Compras abrem",
  [...M2.ETAPAS_QUE_ABREM_COM_COMPRA].sort().join(","), "comparativo,compras");
conf("a trava da aba consulta a regra",
  src.includes("&& !(ETAPAS_QUE_ABREM_COM_COMPRA.has(t.id) && temCompraAprovada(obra));"), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
