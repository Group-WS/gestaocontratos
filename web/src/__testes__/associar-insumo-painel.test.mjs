/* A associação ao insumo do Sienge: a escolha na própria linha da tabela.
 *
 * Roda com: node web/src/__testes__/associar-insumo-painel.test.mjs
 *
 * De 22 a 25/09/2026 a escolha abria num painel lateral (Sheet). Os usuários
 * não gostaram de sair da tabela pra escolher, e ela voltou pra linha, em
 * lista compacta (25/09/2026). Ficam as travas do que veio depois e vale na
 * linha: o texto do Sienge legível (fora do `Label` do DS), as regras nas
 * dicas ⓘ e o selo que explica ao passar o mouse.
 */
import fs from "node:fs";
const src = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const trecho = (a, b) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a)));
const escolha = trecho("function EscolhaSienge(", "function AssociacaoSienge(");
const painel = trecho("function AssociacaoSienge(", "function PedidoCompra(");

let f = 0;
const conf = (n, ok) => { if (!ok) f++; console.log(`${ok ? "ok  " : "FALHOU"} ${n}`); };

conf("as duas tabelas mostram a escolha na linha",
  (src.match(/<AssociacaoSienge /g) || []).length === 2 && painel.includes("return <EscolhaSienge {...escolha} />;"));
conf("sem painel lateral: a escolha não abre outra tela", !painel.includes("<Sheet") && !escolha.includes("<Sheet"));
conf("a descrição do Sienge não vai no Label do DS", !/<Label [^>]*>\{d\.insumo\.detalhe\}<\/Label>/.test(escolha));
conf("lista compacta: bolinha e texto, sem cartão", /<label htmlFor=\{`\$\{idBase\}-v\$\{k\}`\}/.test(escolha) && !escolha.includes("border-brand bg-brand-soft"));
/* 25/09/2026: o selo ao lado ("falta linee, broto, boucle") espremia o texto
   numa palavra por linha. Ele vai embaixo, e curto. */
conf("o selo vai embaixo do texto, e não disputa a largura", /<span className="flex min-w-0 flex-1 flex-col items-start gap-1">\s*<label htmlFor=\{`\$\{idBase\}-v/.test(escolha));
conf("o selo diz quantas palavras faltam, não quais", escolha.includes("`faltam ${d.faltaram.length} palavras`") && !escolha.includes("falta {d.faltaram.slice("));
conf("opção em modo leitura não finge ser clicável", escolha.includes('somenteLeitura ? "" : "cursor-pointer"'));

/* AS REGRAS, num ⓘ com tooltip, e não em parágrafos (22/09/2026: "está
   muito poluído com texto"). */
const ui = fs.readFileSync(new URL("../lib/ui.jsx", import.meta.url), "utf8");
conf("existe o ícone de dica do app, com o Tooltip do DS", /export function DicaInfo\(/.test(ui) && ui.includes("<TooltipContent side={lado}"));
conf("a dica é um botão (o Tab chega nela) com nome para leitor de tela", /<Button variant="ghost" size="icon" type="button" aria-label=\{rotulo\}/.test(ui));
/* O ⓘ na mesma linha do texto (22/09/2026: "não pode ficar torto"). É um
   botão de 24px, sem linha de base: com items-baseline ele descia. */
conf("título com dica centraliza a linha", ui.includes('${dica ? "items-center" : "items-baseline"}'));
conf("o ícone não força alinhamento próprio", !/aria-label=\{rotulo\}\s*\n\s*className="[^"]*self-center/.test(ui));
conf("o painel não tem mais parágrafo de regra", !/<FieldHint>/.test(escolha));
conf("as quatro regras moram em dicas", (escolha.match(/rotuloDica=|<DicaInfo /g) || []).length >= 4);
conf("diz o que é o insumo mãe", escolha.includes("O grupo do Sienge em que este produto entra"));
conf("diz o que é 'bate tudo' e 'faltam N palavras'", escolha.includes("todas as palavras da descrição do item aparecem no detalhe"));
conf("o selo explica ao passar o mouse", /<Badge tone="warning" title=\{`Estas palavras da descrição do item não aparecem/.test(escolha));
conf("diz que a associação em massa só escolhe quando bate tudo", escolha.includes("A associação em massa só escolhe sozinha quando bate tudo."));
conf("diz que o código do detalhe pode ficar vazio", escolha.includes("o Sienge numera ao cadastrar"));
conf("diz o que é o auxiliar 'gerado'", escolha.includes("o fornecedor não informou código nem modelo"));

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
