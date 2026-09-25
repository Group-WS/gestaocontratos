/* O link na especificação do item de Compras: o domínio ↗ na linha e o
 * texto inteiro num popover, sem mexer no que é gravado.
 *
 * Roda com: node web/src/__testes__/link-especificacao.test.mjs
 *
 * 24/09/2026: link com rastreio da loja empurrava a tabela pra direita.
 * 25/09/2026: o caminho encurtado ainda era cortado na borda da coluna, e o
 * "ver completo" ocupava uma linha só pra ele.
 */
import fs from "node:fs";
const src = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const trecho = (a, b) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a)));
const links = trecho("const RE_LINK", "function LinhaCompra(");
const linha = trecho("function LinhaCompra(", "\nfunction ", );

let f = 0;
const conf = (n, ok) => { if (!ok) f++; console.log(`${ok ? "ok  " : "FALHOU"} ${n}`); };

conf("na linha, o link mostra só o domínio", links.includes("{dominioDoLink(parte)}<ExternalLink"));
conf("o link abre em aba nova", (links.match(/target="_blank" rel="noopener noreferrer"/g) || []).length >= 3);
conf("o texto inteiro mora num popover do DS", links.includes("<PopoverContent") && links.includes("<TextoComLinks texto={texto} completo />"));
conf("o popover tem Abrir e Copiar", links.includes("Abrir</a>") && links.includes("navigator.clipboard.writeText(texto)"));
conf("o gatilho não é o ⋯ do menu da linha", !links.includes("MoreHorizontal"));
conf("o gatilho tem nome para leitor de tela", links.includes('aria-label="Ver especificação completa"'));
conf("não existe mais o 'ver completo' que abria na linha", !linha.includes("ver completo") && !linha.includes("especInteira"));
conf("a linha cinza nunca passa de duas linhas", linha.includes('className="line-clamp-2 min-w-0"'));
conf("encurtar é só exibição: o item não é regravado", !/onItemChange\([^)]*especificacao/.test(linha) && !links.includes("especificacao"));

/* 25/09/2026: o mesmo padrão na linha de conferência do Executivo. */
conf("Compras e Conf. Executivo usam o mesmo padrão",
  (src.match(/<TextoComLinks texto=\{(it|x\.it)\.especificacao\} \/>/g) || []).length >= 2
  && (src.match(/mostraEspecificacaoCompleta\((it|x\.it)\.especificacao\) && <EspecificacaoCompleta/g) || []).length >= 2);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
