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

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
