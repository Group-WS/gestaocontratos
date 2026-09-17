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
  return { enderecoDaTela, telaDoEndereco, SLUG_ETAPA, SLUG_MODULO };
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
  { modulo: "comparativo", codigoDaObra: "2498", tab: "assinatura_cliente" },
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
 "assinatura_cliente", "comparativo", "compras", "contratos", "diario"].forEach((etapa) => {
  conf(`a etapa ${etapa} tem endereço`, !!M.SLUG_ETAPA[etapa], true);
});

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
