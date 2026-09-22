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
conf("o trilho existe", src.includes('aria-label="Módulos">'), true);
/* Novas obras e Finalizadas SÃO OBRAS: moram no painel. Foi pedido dela, e
   deixa o trilho só com ferramenta e área. */
conf("novas e arquivo saem do trilho",
  src.includes('const DESTINOS_NO_PAINEL = new Set(["novas", "arquivo"]);'), true);
conf("o menu é filtrado por eles",
  src.includes("const noMenu = modulos.filter((m) => !DESTINOS_NO_PAINEL.has(m.id));"), true);
/* No trilho TODO destino é ícone sem rótulo — sem a dica de hover, a Equipe
   volta a ser impossível de achar, que era o defeito da barra antiga. */
/* O rotulo e' um Tooltip do DS em cada destino (ItemTrilho), a' direita. */
conf("a dica de hover vale pro trilho inteiro", src.includes('<TooltipContent side="right">{rotulo}</TooltipContent>'), true);
/* E ELA PRECISA SUMIR SOZINHA. Sair do trilho pro painel não é sair da barra
   — o painel é filho dela, então o `mouseleave` de baixo nunca chega. A dica
   "Obras" ficava colada em cima da lista, bem no bloco de novas obras, e o
   caminho que fazia isso era o de todo dia: clicar em Obras e escorregar pra
   direita pra escolher uma. Visto na tela em 20/09/2026. */
conf("... e todo destino passa pelo mesmo item", (src.match(/<ItemTrilho key=/g) || []).length, 2);
conf("modulo fora de grupo nunca some do menu", src.includes("i === GRUPOS_DO_MENU.length - 1 ? semGrupo : []"), true);
/* ... SEM PISCAR. A linha abaixo parece redundante ao lado da de cima e não
   é: ao mostrar a dica o `title` do botão é retirado, pra dica do navegador
   não subir por cima da nossa. Só que aí o botão deixa de ser achável por
   `closest("[title]")` — e mexer o mouse um pixel dentro dele caía na
   limpeza, a dica sumia, o `title` voltava, e o mouseover seguinte a trazia
   de novo. Relato dela em 20/09/2026, um minuto depois do conserto acima:
   "quando eu passo o mouse em cima dos botões ele fica piscando". */
conf("... sem listener caseiro de mouse", src.includes('addEventListener("mouseover"'), false);
/* A ordem é o conserto: a saída antecipada tem que vir ANTES da limpeza. */
conf("... e o rótulo também vai no aria-label", src.includes("aria-label={aberto ? undefined : rotulo}"), true);

/* A LISTA DE OBRAS FICA ABERTA (21/09/2026): dentro da obra ela aparece
   sempre, e não existe mais jeito de escondê-la — nem botão, nem recolher
   sozinho. Clicar em Obras abre a obra, e com ela a lista. */
conf("não existe mais estado de lista escondida", /painelEscondido/.test(src), false);
conf("nem o botão de esconder a lista", src.includes("Esconder a lista de obras"), false);

/* ============================================================
   3. O PAINEL
   ============================================================ */
/* O painel só existe onde há o que percorrer: hoje, dentro da obra. */
conf("o painel só aparece na obra", src.includes('const naObra = modulo === "comparativo";'), true);
conf("... e, na obra, está sempre aberto", src.includes("const temPainel = naObra && mostrarObras;"), true);
/* O destino ativo veste a cor do que abriu à direita. */
/* O destino ativo: fio da marca à esquerda e fundo suave (App Shell do DS). */
conf("o item ativo leva o fio e o fundo da marca",
  src.includes('"bg-brand-soft text-brand before:absolute before:inset-y-2 before:left-0 before:border-l-2 before:border-brand"'), true);
/* Item de menu e' link com endereco, nao Button: o Button do DS poe style
   inline de fundo e cor, que apagava o destaque do ativo. */
conf("o item do menu é um link com endereço", src.includes("<a href={href} onClick={aoClicar} className={classe}"), true);

/* O modo mora no banco desde 21/09/2026 (lib/preferencias.js): "numero" de
   padrão, "squad" quando escolhido — inclusive vindo da chave antiga. */
conf("os dois modos existem", src.includes('usePreferencia("obras.modo", "numero"')
  && src.includes('converter: (v) => (v === "squad" ? "squad" : "numero")'), true);
/* O símbolo do squad aparece UMA vez: na linha no modo número, no cabeçalho
   no modo squad. Dizê-lo duas vezes era o defeito da barra antiga. */
conf("no modo número o símbolo vai na linha", src.includes('filtradas.map((o) => linhaDaObra(o, true))'), true);
conf("no modo squad ele sai das linhas", src.includes("porSquad[nome].map((o) => linhaDaObra(o, false))"), true);
conf("... e sobe pro cabeçalho", /<CollapsibleTrigger asChild>[\s\S]{0,400}<IconeSquad nome=\{nome\}/.test(src), true);

/* AS NOVAS OBRAS NO TOPO, antes da busca. Estavam no pé e ela reparou: "achei
   muito pequeno no final da tela, pode passar despercebido". O problema era
   POSIÇÃO, não tamanho — o fim de uma lista é onde as coisas vão para ser
   ignoradas. Com isto o painel lê na ordem da vida de uma obra: as que vão
   começar, as que estão em andamento, as que terminaram. */
conf("as novas obras ficam no topo", src.includes('{novasNoPainel && novasCount > 0 && ('), true);
conf("... antes da busca",
  src.indexOf('onClick={() => irPara("novas")} title={novasNoPainel.sub}') < src.indexOf('placeholder="Nome, código ou cliente"'), true);
/* Zero obra esperando não ocupa o topo de nada. */
conf("... e só quando existe alguma", /novasNoPainel && novasCount > 0/.test(src), true);
/* Fonte normal, escolha dela: o destaque vem do lugar e do fundo. O 11.5px é
   o mesmo do nome da obra — se alguém aumentar aqui, a decisão se perde. */
conf("em fonte normal, não maior", /variant="outline" size="sm" className=\{cn\("mb-2 w-full justify-start gap-2 border-brand text-brand"/.test(src), true);
/* O número antes do rótulo: é ele que faz reparar. */
conf("o número vem antes do rótulo",
  src.includes('<span className="mono">{novasCount}</span>'), true);
conf("as Finalizadas ficam no pé", src.includes('onClick={() => irPara("arquivo")} title={finalizadasNoPainel.sub}'), true);
/* O painel tem 232px, e a barra antiga tinha 288: o texto da busca era
   cortado no meio da palavra ("...cód, clie"). */
conf("o texto da busca cabe no painel",
  src.includes('placeholder="Nome, código ou cliente"'), true);

/* O CAPACETE no lugar do prédio (escolha dela): num app de obra tudo é
   prédio, então o prédio não distinguia nada. */
conf("o destino Obras usa o capacete", src.includes("<HardHat size={16} />"), true);
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
conf("a linha alinha pelo topo", /const linhaDaObra = [\s\S]{0,1200}flex w-full items-start gap-2/.test(src), true);

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
