/* A associação ao insumo do Sienge: uma faixa debaixo da descrição do item.
 *
 * Roda com: node web/src/__testes__/associar-insumo-painel.test.mjs
 *
 * Histórico: painel na coluna "Insumo no Sienge" (até 22/09/2026), painel
 * lateral (Sheet, 22 a 25/09 — o time não gostou de sair da tabela) e de
 * novo o painel na coluna, com ~610px por produto e só os 4 primeiros
 * detalhes. Em 25/09/2026 virou uma faixa de uma linha embaixo da descrição,
 * com dois seletores (Popover + Command do DS) e três situações (RN-090).
 */
import fs from "node:fs";
const src = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const trecho = (a, b) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a)));
const faixa = trecho("function FaixaSienge(", "function SeletorMae(");
const mae = trecho("function SeletorMae(", "function TextoComPalavrasDoItem(");
const detalhe = trecho("function SeletorDetalhe(", "function DetalheNovoSienge(");
const novo = trecho("function DetalheNovoSienge(", "function PedidoCompra(");
const tudo = trecho("function FaixaSienge(", "function PedidoCompra(");
const linhaCompra = trecho("function LinhaCompra(", "MÓDULO CONTRATOS");
const linhaGerador = trecho("function LinhaGerador(", "function CampoRascunho(");

let f = 0;
const conf = (n, ok) => { if (!ok) f++; console.log(`${ok ? "ok  " : "FALHOU"} ${n}`); };

/* ---- onde fica ---- */
conf("as duas telas usam a mesma faixa", (src.match(/<FaixaSienge /g) || []).length === 2
  && linhaCompra.includes("<FaixaSienge ") && linhaGerador.includes("<FaixaSienge "));
conf("não existe mais a coluna 'Insumo no Sienge'", !src.includes('<TableHead className="w-80">Insumo no Sienge</TableHead>'));
conf("o painel antigo saiu", !src.includes("function EscolhaSienge(") && !src.includes("function AssociacaoSienge("));
conf("sem painel lateral: a escolha não abre outra tela", !tudo.includes("<Sheet"));
/* 25/09/2026: "precisa ocupar o espaço de todas as colunas após descrição". */
conf("em Compras, a faixa é uma linha própria, da descrição até a última coluna",
  /\{mostraFaixa && \(\s*<TableRow className=\{tomDaLinha\}>\s*<TableCell colSpan=\{nCols - 2\} className="border-b border-line-1 pt-0">\s*<FaixaSienge /.test(linhaCompra));
conf("... lida junto com o item: sem o fio entre as duas linhas, check e código nas duas",
  linhaCompra.includes('<TableRow className={cn(tomDaLinha, mostraFaixa && "sem-fio !border-b-0")}>') && (linhaCompra.match(/rowSpan=\{mostraFaixa \? 2 : undefined\}/g) || []).length === 2);

/* ---- os dois seletores: combobox do DS, com busca ---- */
conf("mãe e detalhe abrem num Popover com busca", [mae, detalhe].every((t) => t.includes("<Popover ") && t.includes("<CommandInput ")));
conf("a busca é nossa (sem acento, por palavra), não a do cmdk", [mae, detalhe].every((t) => t.includes("<Command shouldFilter={false}>")));
conf("o gatilho se anuncia como combobox", [mae, detalhe].every((t) => t.includes('role="combobox" aria-expanded={aberto}')));
conf("a mãe vem sempre da base, sem texto livre (RN-079)", !mae.includes("onMae(busca") && mae.includes("onMae(g.codigo)"));
conf("a mãe procura na base inteira ao digitar", mae.includes("(grupos || []).filter("));

/* ---- o detalhe: todos, em grupos, com as palavras do item em destaque ---- */
conf("mostra todos os detalhes, não só os quatro primeiros", !tudo.includes(".slice(0, 4)"));
conf("primeiro os que têm todas as palavras do item", detalhe.includes('heading="Têm todas as palavras do item"'));
conf("depois os parecidos", detalhe.includes('heading="Parecidos — confira"'));
conf("os demais aparecem aos poucos, com 'mostrar mais'", detalhe.includes("mostrar mais") && /const DETALHES_DE_CARA = \d+;/.test(src));
conf("as palavras do item ficam em destaque no texto", detalhe.includes("<TextoComPalavrasDoItem texto={d.insumo.detalhe} casaram={d.casaram} />"));
conf("o parecido diz quantas palavras faltam; quais, ao passar o mouse",
  /<Badge tone="warning"[\s\S]*title=\{`Estas palavras do item não aparecem neste detalhe/.test(detalhe) && detalhe.includes("falta {d.faltaram.length}"));
conf("a descrição do item aparece para comparar", detalhe.includes("Item: <span className=\"text-text\">{desc}</span>"));
conf("o mesmo detalhe repetido na base aparece uma vez", faixa.includes("vistos.has(d.insumo.descricao)"));
conf("'cadastrar como detalhe novo' é uma escolha, no fim da lista", detalhe.includes('value="__novo__" onSelect={() => { onNovo();'));

/* ---- as três situações (RN-090) ---- */
conf("a situação vem da regra", src.includes('from "./regras/detalheDoSienge.js"') && linhaCompra.includes("decisaoDoDetalhe(it, { solicitado: estaSolicitado(it) })"));
conf("as três situações têm selo com texto", ['texto: "já existe"', 'texto: "detalhe novo"', 'texto: "a conferir"'].every((t) => src.includes(t)));
conf("sem decisão não se finge 'detalhe novo'", !tudo.includes('?? "__nova__"'));
conf("trocar a mãe volta a situação para 'a conferir'", linhaCompra.includes('detalheSienge: null, detalheNovoSienge: false }, "Insumo mãe trocado.")'));
conf("escolher 'detalhe novo' grava a decisão", linhaCompra.includes("detalheSienge: null, detalheNovoSienge: true,"));
conf("a massa marca a escolha como detalhe que existe", src.includes("detalheSienge: melhor.insumo.descricao,\n        detalheNovoSienge: false,"));
conf("a barra do grupo conta os que estão a conferir", src.includes("insumos\"} Sienge a conferir"));
/* 25/09/2026: só com borda, a faixa sumia no tom da linha. */
conf("a faixa tem fundo próprio, de token, sem virar card", faixa.includes('"flex min-w-0 flex-col gap-2 rounded-lg bg-surface-1 px-3 py-2", className') && !/className="[^"]*\bborder\b[^"]*bg-surface-1/.test(faixa));
conf("a situação vem primeiro, com largura fixa (alinha na coluna)", faixa.includes('<Badge tone={situacao.tom} className="w-24 justify-center"'));

/* ---- 25/09/2026, depois da crítica de design ---- */
const compras = trecho("function ComprasView(", "function LinhaCompra(");
const gerador = trecho("function GeradorSiengeView(", "function LinhaGerador(");
// 1. detalhe escolhido que diverge do item
conf("detalhe escolhido sem todas as palavras vira 'confira'", faixa.includes('faltam.length ? { tom: "warning", texto: "confira" }'));
conf("... e a palavra que falta aparece ao lado", faixa.includes('falta: <b className="font-semibold text-text">{faltam.join(", ")}</b>'));
conf("... e conta como pendente", src.includes("detalheDivergente(it.desc, it.detalheSienge)"));
// 2. faixa sempre visível, sugestões sozinhas
conf("o botão 'Associar insumos' saiu", !src.includes("async function associarGrupo(") && !/>\s*\{associando === g\.num/.test(src));
conf("a base carrega sozinha na etapa Sienge", compras.includes("if (!naEtapaSienge || baseSienge || carregando || erroBase) return;"));
conf("as sugestões vêm um produto por vez, só das verbas abertas",
  compras.includes("if (!abreNaBusca.aberto(g.num, abertos.has(g.num))) continue;") && compras.includes("new Map(antes).set(semSugestao.chave, casarComSienge("));
conf("o que já foi decidido aparece sem esperar a sugestão", linhaCompra.includes("(casamento || it.maeSienge || it.detalheSienge)"));
// 3. conferência
conf("o contador 'a conferir' é o filtro da verba", compras.includes("aria-pressed={filtrandoConferir}") && compras.includes("insumoPedeConferencia(r.it)) : comObs"));
conf("'usar' em um clique quando há detalhe com todas as palavras", faixa.includes("onClick={() => escolher(sugestao.insumo.descricao)}") && faixa.includes("detalhes[0].faltaram.length === 0"));
conf("depois de escolher, o foco vai ao próximo pendente", faixa.includes("irAoProximoPendente(raiz.current)") && src.includes('data-pendente={pendente ? "sim" : "nao"}'));
conf("toda escolha nas Compras avisa com Desfazer", (linhaCompra.match(/mudarNoSienge\(\{/g) || []).length === 3 && linhaCompra.includes('acao: { rotulo: "Desfazer", aoClicar: () => onItemChange(antes) }'));
conf("toda escolha no Gerador avisa com Desfazer", (gerador.match(/comDesfazer\(i, /g) || []).length === 2 && src.includes('comDesfazer(c.i, "Insumo mãe trocado.")'));
const confirmar = fs.readFileSync(new URL("../lib/confirmar.jsx", import.meta.url), "utf8");
conf("o aviso aceita um botão de ação", confirmar.includes("o.action = { label: opcoes.acao.rotulo, onClick: opcoes.acao.aoClicar }"));

/* ---- o detalhe novo: segunda linha, só nesse caso ---- */
conf("o descritivo e os códigos só aparecem no detalhe novo", faixa.includes("{decisao === DECISAO_DO_DETALHE.NOVO && (\n        <DetalheNovoSienge "));
conf("o descritivo é um campo de uma linha", novo.includes("<CampoRascunho as={Input} id={`${idBase}-desc`}") && !novo.includes("as={Textarea}"));
conf("todo campo tem rótulo visível", (novo.match(/<Label htmlFor=/g) || []).length === 3);

/* ---- modo leitura ---- */
conf("em leitura os seletores viram texto", [mae, detalhe].every((t) => /if \(somenteLeitura\) \{\s*return/.test(t)));

/* ---- as regras moram em dicas ⓘ, não em parágrafos (22/09/2026) ---- */
const ui = fs.readFileSync(new URL("../lib/ui.jsx", import.meta.url), "utf8");
conf("existe o ícone de dica do app, com o Tooltip do DS", /export function DicaInfo\(/.test(ui) && ui.includes("<TooltipContent side={lado}"));
conf("a dica é um botão (o Tab chega nela) com nome para leitor de tela", /<Button variant="ghost" size="icon" type="button" aria-label=\{rotulo\}/.test(ui));
conf("título com dica centraliza a linha", ui.includes('${dica ? "items-center" : "items-baseline"}'));
conf("o ícone não força alinhamento próprio", !/aria-label=\{rotulo\}\s*\n\s*className="[^"]*self-center/.test(ui));
conf("a faixa não tem parágrafo de regra", !/<FieldHint>/.test(tudo));
conf("diz o que é o insumo mãe e o detalhe", faixa.includes("o grupo do Sienge em que o produto entra"));
conf("diz que a associação em massa só escolhe quando tem todas", faixa.includes("A associação em massa só escolhe\n          sozinha quando o detalhe tem todas."));
conf("diz o que é 'a conferir'", faixa.includes("ninguém decidiu ainda — fica fora do Template Sienge"));
conf("diz que o código do detalhe pode ficar vazio", novo.includes("o Sienge numera ao cadastrar"));
conf("diz o que é o auxiliar 'gerado'", novo.includes("o fornecedor não informou código nem modelo"));

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
