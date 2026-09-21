/* A busca abre as verbas, mas não tranca a seta. E o nome da verba não some.
 *
 * Roda com: node web/src/__testes__/busca-nao-trava-grupo.test.mjs
 *
 * Dois relatos dela em 19/09/2026, olhando a tela:
 *
 *   1. "quando escrevo algo no filtro, a barra do grupo em baixo fica travada
 *      para expandir ou fechar" — no Plano de Compras.
 *   2. "quando habilito a edicao nesa tela de aprovacoes, nome do grupo some"
 *      — na Conf. Executivo.
 *
 * O primeiro era `abertos.has(x) || buscando`: com texto no campo, o `||`
 * ganhava do clique e a seta virava enfeite. Estava em SEIS telas, todas as
 * que ganharam busca.
 *
 * O segundo era flexbox: com a edição ligada a barra ganha até três botões à
 * direita, e o nome da verba era o único item da esquerda sem trava de
 * encolhimento — ia a zero e sumia, levando a seta junto. A linha virava
 * "05" e três etiquetas, sem dizer de que verba se tratava.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(aqui, "..", "App.jsx"), "utf8");

const bloco = (assinatura, fim = "\n}\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei em App.jsx: ${assinatura}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(62)} ${String(o).padEnd(8)} ${ok ? "" : "esperava " + e}`); };

/* ============================================================
   1. O HOOK: a busca decide o PADRÃO, o clique continua mandando
   ============================================================ */
/* Roda de verdade, com um React de mentira.
 *
 * `render()` chama o hook de novo, e isso NÃO é detalhe: as funções que ele
 * devolve capturam o Set daquele render. No React, mudar o estado provoca
 * outro render e outras funções; um teste que reaproveitasse as antigas
 * diria que nada mudou — e estaria medindo o próprio teste. */
function sandbox(buscando) {
  let estado = new Set();
  const useState = () => [estado, (f) => { estado = typeof f === "function" ? f(estado) : f; }];
  const useEffect = (fn) => fn();
  const fonte = bloco("function useAbertosComBusca(");
  // eslint-disable-next-line no-new-func
  const criar = new Function("useState", "useEffect", "buscando",
    fonte + "\n return useAbertosComBusca(buscando);");
  return { render: () => criar(useState, useEffect, buscando) };
}

/* SEM busca: manda o estado normal da tela, como sempre mandou. */
{
  const s = sandbox(false);
  const h = s.render();
  conf("sem busca, verba fechada continua fechada", h.aberto("05", false), false);
  conf("sem busca, verba aberta continua aberta", h.aberto("05", true), true);
  let chamou = 0;
  h.alternar("05", () => { chamou += 1; });
  conf("sem busca, o clique vai pro estado normal da tela", chamou, 1);
}

/* COM busca: tudo abre — e fechar uma tem que funcionar. */
{
  const s = sandbox(true);
  conf("com busca, a verba abre mesmo fechada antes", s.render().aberto("05", false), true);
  let chamou = 0;
  s.render().alternar("05", () => { chamou += 1; });
  conf("com busca, o clique NÃO mexe no estado normal", chamou, 0);
  conf("... e a verba clicada FECHA", s.render().aberto("05", false), false);
  conf("... sem levar as outras junto", s.render().aberto("10", false), true);
  s.render().alternar("05", () => {});
  conf("... e abre de novo no segundo clique", s.render().aberto("05", false), true);
}

/* Limpar a busca esquece o que foi fechado a dedo: aquele fechamento era da
   busca, não da tela. */
{
  const s = sandbox(true);
  s.render().alternar("05", () => {});
  conf("fechou durante a busca", s.render().aberto("05", false), false);
  const limpo = sandbox(false);
  conf("limpando a busca, volta a mandar o estado da tela", limpo.render().aberto("05", false), false);
  conf("... e a verba aberta na tela segue aberta", limpo.render().aberto("05", true), true);
}

/* ============================================================
   2. AS SEIS TELAS ESTÃO LIGADAS NO HOOK
   ============================================================ */
const decls = (src.match(/const abreNaBusca = useAbertosComBusca\(/g) || []).length;
conf("as seis telas com busca declaram o hook", decls, 6);

/* E NENHUMA sobrou com o `||` que causava o defeito. Esta é a linha que
   impede o padrão de voltar num copiar-e-colar. */
conf("nenhuma tela força aberto com || buscando", /\|\| buscando;/.test(src), false);
conf("... nem com || filtrando", /\|\| filtrando;/.test(src), false);
conf("... nem com || !!busca.trim()", /\|\| !!busca\.trim\(\)\}/.test(src), false);

/* Os cliques passam pelo hook — sem isto o `aberto` novo não mudaria nada. */
const cliques = (src.match(/abreNaBusca\.alternar\(/g) || []).length;
conf("os seis cliques passam pelo hook", cliques, 6);

/* ============================================================
   3. O NOME DA VERBA NÃO SOME
   ============================================================ */
/* A regra dela, de 18/09/2026, sobre o alerta da Conf. Executivo: o texto
   aparece inteiro e não some — quem cede é a ALTURA. Vale igual aqui. */
/* O cabeçalho do grupo do Plano de Compras virou Colapsavel do DS: nome e
   etiquetas num contêiner que quebra linha, e o nome com piso de largura
   (basis-64) em vez de ir a zero. O nome aparece inteiro — quebra, não corta. */
const grupoPlano = src.slice(src.indexOf("function GrupoPlano("), src.indexOf("function FormAvulsa("));
conf("as etiquetas descem de linha em vez de espremer o nome",
  grupoPlano.includes('<span className="flex min-w-0 flex-1 flex-wrap items-start gap-x-4 gap-y-2">'), true);
conf("a seta nunca encolhe (Colapsavel)", grupoPlano.includes("<Colapsavel aberto={expanded} onAbrir={onToggle}"), true);
conf("e o nome tem um piso, em vez de ir a zero",
  grupoPlano.includes('<span className="flex min-w-0 flex-1 basis-64 items-start gap-2">'), true);
/* Sem truncate: o nome quebra de linha em vez de ser cortado. */
conf("... e aparece inteiro, sem corte", /min-w-0 flex-1 text-sm font-semibold text-text">\{cat\.nome\}/.test(grupoPlano), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
