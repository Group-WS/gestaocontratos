/* A associação ao insumo do Sienge: resumo na tabela, escolha no painel.
 *
 * Roda com: node web/src/__testes__/associar-insumo-painel.test.mjs
 *
 * Em 22/09/2026 a escolha inteira morava numa coluna de 320px: cada linha
 * passava de 700px de altura, e as descrições do Sienge iam no `Label` do
 * DS (rótulo de campo — mono, caixa-alta, 10,5px), virando uma tira que não
 * dava para ler nem comparar. Estas travas impedem a volta disso.
 */
import fs from "node:fs";
const src = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const trecho = (a, b) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a)));
const escolha = trecho("function EscolhaSienge(", "function AssociacaoSienge(");
const painel = trecho("function AssociacaoSienge(", "function PedidoCompra(");

let f = 0;
const conf = (n, ok) => { if (!ok) f++; console.log(`${ok ? "ok  " : "FALHOU"} ${n}`); };

conf("as duas tabelas mostram o resumo, não a escolha inteira",
  (src.match(/<AssociacaoSienge /g) || []).length === 2 && (src.match(/<EscolhaSienge /g) || []).length === 1);
conf("a escolha inteira abre no painel lateral", painel.includes('<SheetContent side="right"') && painel.includes("<EscolhaSienge {...escolha} />"));
conf("o painel diz qual item está sendo associado", painel.includes("<SheetTitle>Associar ao insumo do Sienge</SheetTitle>") && painel.includes("{item}"));
conf("o resumo diz o que está decidido", painel.includes("usa detalhe existente") && painel.includes("cadastra detalhe novo"));
conf("sem mãe, o resumo avisa", painel.includes("sem insumo mãe"));
conf("modo leitura só consulta", painel.includes('"Ver associação"'));
conf("a descrição do Sienge não vai mais no Label do DS", !/<Label [^>]*>\{d\.insumo\.detalhe\}<\/Label>/.test(escolha));
conf("cada opção é um cartão clicável inteiro", /<label key=\{d\.insumo\.descricao \+ k\} htmlFor=/.test(escolha));
conf("a opção marcada fica em destaque", escolha.includes('marcada ? "border-brand bg-brand-soft"'));
conf("o selo vai embaixo do texto, e não numa coluna de largura fixa", !escolha.includes('className="w-32 shrink-0 text-right"'));

/* MODO LEITURA DITO DENTRO DO PAINEL (22/09/2026). "Aqui diz que bate tudo
   mas não consigo selecionar": a obra estava sem edição habilitada, os
   cartões seguiam com cursor de clique e nada dizia por que não mudavam. */
/* O MODO SEMPRE À VISTA, ao lado do título — nos dois sentidos. */
conf("o topo do painel diz quando é só consulta", painel.includes("só consulta</Badge>"));
conf("... e quando está em edição", painel.includes("em edição</Badge>"));
conf("o painel explica o modo leitura", painel.includes("Para escolher a descrição ou mudar o insumo, habilite a edição da obra."));
conf("... e oferece habilitar a edição ali mesmo", painel.includes("onClick={onHabilitar}"));
conf("... e diz quem está editando, quando é outra pessoa", painel.includes("{editandoPor}</b> está editando esta obra"));
conf("as Compras passam o habilitar até a linha", /<LinhaCompra [\s\S]{0,1500}onHabilitar=\{onHabilitar\} editandoPor=\{editandoPor\}/.test(src));
conf("cartão em modo leitura não finge ser clicável", escolha.includes('somenteLeitura ? "" : "cursor-pointer hover:bg-surface-2"'));

/* AS REGRAS, num ⓘ com tooltip, e não em parágrafos (22/09/2026: "está
   muito poluído com texto"). */
const ui = fs.readFileSync(new URL("../lib/ui.jsx", import.meta.url), "utf8");
conf("existe o ícone de dica do app, com o Tooltip do DS", /export function DicaInfo\(/.test(ui) && ui.includes("<TooltipContent side={lado}"));
conf("a dica é um botão (o Tab chega nela) com nome para leitor de tela", /<Button variant="ghost" size="icon" type="button" aria-label=\{rotulo\}/.test(ui));
conf("o painel não tem mais parágrafo de regra", !/<FieldHint>/.test(escolha));
conf("as quatro regras moram em dicas", (escolha.match(/rotuloDica=|<DicaInfo /g) || []).length >= 4);
conf("diz o que é o insumo mãe", escolha.includes("O grupo do Sienge em que este produto entra"));
conf("diz o que é 'bate tudo' e 'falta…'", escolha.includes("todas as palavras da descrição do item aparecem no detalhe"));
conf("o selo explica ao passar o mouse", /<Badge tone="warning" title=\{`Estas palavras da descrição do item não aparecem/.test(escolha));
conf("diz que a associação em massa só escolhe quando bate tudo", escolha.includes("A associação em massa só escolhe sozinha quando bate tudo."));
conf("diz que o código do detalhe pode ficar vazio", escolha.includes("o Sienge numera ao cadastrar"));
conf("diz o que é o auxiliar 'gerado'", escolha.includes("o fornecedor não informou código nem modelo"));

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
