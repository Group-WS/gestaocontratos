/* A barra lateral: trilho de destinos + painel do lugar.
 *
 * Roda com: node web/src/__testes__/barra-trilho-painel.test.mjs
 *
 * A barra antiga empilhava três coisas numa coluna só: os 12 destinos
 * (reduzidos a uma tira de glifos de 16px SEM RÓTULO, no rodapé, abaixo de
 * tudo), a lista de obras com quatro filtros, e o usuário. Recolhida a 62px
 * ela virava outro app — os nomes sumiam e apareciam códigos soltos
 * misturados a símbolos de squad e a ícones de módulo.
 *
 * Reescrita em 19/09/2026 com ela, em cima de uma referência que ela mandou.
 * Duas colunas, uma pergunta cada: o trilho responde "onde posso ir", o
 * painel "o que tem aqui dentro".
 *
 * Decisões dela, todas travadas aqui:
 *   · claro, não escuro ("gosto mais os menus claros");
 *   · lista por número, crescente, como padrão; por squad quando ela pede;
 *   · Novas obras e Finalizadas moram no painel, não no trilho — são obras;
 *   · "Arquivo" virou "Finalizadas";
 *   · o nome da obra NUNCA corta.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(aqui, "..", "App.jsx"), "utf8");

const bloco = (assinatura, fim = "\n};\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei em App.jsx: ${assinatura}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};

const M = eval("(function () {\n"
  + bloco("const porCodigo = (a, b) => {")
  + "  return { porCodigo };\n"
  + "})()");

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(60)} ${String(o).padEnd(10)} ${ok ? "" : "esperava " + e}`); };

/* ============================================================
   1. A ORDEM: pelo código, crescente
   ============================================================ */
const ordenar = (cods) => cods.map((c) => ({ codigo: c })).sort(M.porCodigo).map((o) => o.codigo).join(" ");

conf("ordena do menor pro maior", ordenar(["2597", "2195", "2450"]), "2195 2450 2597");
/* Os códigos são TEXTO no banco. Comparados como texto, "999" viria depois de
   "2450" — e a lista abriria errada sem ninguém entender por quê. */
conf("compara como número, não como texto", ordenar(["2450", "999"]), "999 2450");
conf("a lista real da casa", ordenar(["2572", "2204", "2469", "2195", "2597", "2450", "2498"]),
  "2195 2204 2450 2469 2498 2572 2597");
/* Código que não é número existe (obra cadastrada à mão): não pode quebrar a
   ordenação nem jogar a obra pra fora da lista. */
conf("código não numérico não quebra", ordenar(["2450", "OBRA-X", "2195"]).includes("OBRA-X"), true);
conf("... e fica em ordem estável", ordenar(["B", "A"]), "A B");

/* ============================================================
   2. O TRILHO
   ============================================================ */
conf("o trilho existe", src.includes('<nav className="trilho">'), true);
/* Novas obras e Finalizadas SÃO OBRAS: moram no painel. Foi pedido dela, e
   deixa o trilho só com ferramenta e área. */
conf("novas e arquivo saem do trilho",
  src.includes('const DESTINOS_NO_PAINEL = new Set(["novas", "arquivo"]);'), true);
conf("o trilho é filtrado por eles",
  src.includes("const noTrilho = modulos.filter((m) => !DESTINOS_NO_PAINEL.has(m.id));"), true);
/* No trilho TODO destino é ícone sem rótulo — sem a dica de hover, a Equipe
   volta a ser impossível de achar, que era o defeito da barra antiga. */
conf("a dica de hover vale pro trilho inteiro", src.includes('if (!b.closest(".trilho")) return;'), true);

/* CLICAR EM "OBRAS" SÓ MOSTRA. Relato dela: "depois que eu entrar na obra, no
   primeiro clique dentro a barra da sidebar recolhe" — era o botão Obras
   dobrando a lista. Esconder tem botão próprio. */
conf("clicar em Obras nunca esconde", src.includes("setPainelEscondido(false);"), true);
conf("esconder tem botão próprio", src.includes('className="trilho-item trilho-dobrar"'), true);

/* ============================================================
   3. O PAINEL
   ============================================================ */
/* O painel só existe onde há o que percorrer: hoje, dentro da obra. */
conf("o painel só aparece na obra", src.includes('const naObra = modulo === "comparativo";'), true);
conf("... e some quando escondido", src.includes("const temPainel = naObra && mostrarObras && !painelEscondido;"), true);
/* O destino ativo veste a cor do que abriu à direita. */
conf("sem painel, o trilho ativo veste o campo",
  src.includes(".barra.sem-painel .trilho-item.ativo { background: var(--page); }"), true);

conf("os dois modos existem", src.includes('localStorage.getItem(CHAVE_MODO_OBRAS) === "squad" ? "squad" : "numero"'), true);
/* O símbolo do squad aparece UMA vez: na linha no modo número, no cabeçalho
   no modo squad. Dizê-lo duas vezes era o defeito da barra antiga. */
conf("no modo número o símbolo vai na linha", src.includes('filtradas.map((o) => linhaDaObra(o, true))'), true);
conf("no modo squad ele sai das linhas", src.includes("porSquad[nome].map((o) => linhaDaObra(o, false))"), true);
conf("... e sobe pro cabeçalho", /<button className="squad-cab"[\s\S]{0,200}<IconeSquad/.test(src), true);

/* AS NOVAS OBRAS NO TOPO, antes da busca. Estavam no pé e ela reparou: "achei
   muito pequeno no final da tela, pode passar despercebido". O problema era
   POSIÇÃO, não tamanho — o fim de uma lista é onde as coisas vão para ser
   ignoradas. Com isto o painel lê na ordem da vida de uma obra: as que vão
   começar, as que estão em andamento, as que terminaram. */
conf("as novas obras ficam no topo", src.includes('{novasNoPainel && novasCount > 0 && ('), true);
conf("... antes da busca",
  src.indexOf('className={`painel-novas') < src.indexOf('className="obra-search painel-busca"'), true);
/* Zero obra esperando não ocupa o topo de nada. */
conf("... e só quando existe alguma", /novasNoPainel && novasCount > 0/.test(src), true);
/* Fonte normal, escolha dela: o destaque vem do lugar e do fundo. O 11.5px é
   o mesmo do nome da obra — se alguém aumentar aqui, a decisão se perde. */
conf("em fonte normal, não maior", /\.painel-novas \{[^}]*font-size: 11\.5px/.test(src), true);
/* O número antes do rótulo: é ele que faz reparar. */
conf("o número vem antes do rótulo",
  src.includes('<span className="painel-novas-n mono">{novasCount}</span>'), true);
conf("as Finalizadas ficam no pé", src.includes('<div className="painel-pe">'), true);

/* O CAPACETE no lugar do prédio (escolha dela): num app de obra tudo é
   prédio, então o prédio não distinguia nada. */
conf("o destino Obras usa o capacete", src.includes("<HardHat size={18} />"), true);
conf("... e ele entra pelo import", /MessageSquare, HardHat/.test(src), true);
conf("o módulo se chama Finalizadas", src.includes('{ id: "arquivo", nome: "Finalizadas"'), true);
/* O endereço continua /arquivo: trocar quebraria link salvo. */
conf("mas o endereço continua o mesmo", src.includes('arquivo: "arquivo"'), true);

/* ============================================================
   4. O NOME DA OBRA NUNCA CORTA
   ============================================================ */
/* Pedido dela: "nunca corte o nome da obra, sempre mostre tudo". Mesma regra
   do alerta da Conf. Executivo — quem cede é a ALTURA. */
conf("o nome não tem reticências", /\.obra-nome \{[^}]*text-overflow/.test(src), false);
conf("... nem fica numa linha só", /\.obra-nome \{[^}]*nowrap/.test(src), false);
conf("... e quebra palavra comprida", /\.obra-nome \{[^}]*overflow-wrap: anywhere/.test(src), true);
/* Alinhado ao topo, pra o código ficar na primeira linha quando o nome desce. */
conf("a linha alinha pelo topo", /\.obra-linha \{[^}]*align-items: flex-start/.test(src), true);

/* ============================================================
   5. O QUE VEIO DE BRINDE
   ============================================================ */
/* `listarTravas` existia com o comentário "pra sidebar mostrar o cadeado" e
   nunca tinha sido chamada: quem estava editando só aparecia DEPOIS de abrir
   a obra, quando já era tarde pra escolher outra. */
conf("o cadeado usa a função que já existia", src.includes("listarTravas().then((m) =>"), true);
conf("... e chega na barra", src.includes("travas={travas}"), true);
/* O Painel por canal foi publicado sem slug: caía em "/" e não sobrevivia a
   um F5 — justo o único módulo que o perfil "Canal de compra" enxerga. */
conf("o Painel por canal ganhou endereço", src.includes('painel_canal: "painel-canal"'), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
