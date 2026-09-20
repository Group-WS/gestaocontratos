/* Painel por canal: uma tela, seis canais.
 *
 * Roda com: node web/src/__testes__/painel-por-canal.test.mjs
 *
 * Pedido dela em 19/09/2026: "assim como a gente criou uma tela separada para
 * Mehoo, queria criar uma para cada canal... criar a tela na sidebar, com um
 * nome chamado 'Painel por canal', e quando eu clico pode expandir. Assim eu
 * posso selecionar qual canal eu quero ver."
 *
 * Respostas dela sobre o conteúdo: "igual a mehoo e pode também incluir em
 * todos a informação do GC responsável"; "vê todas [as obras], pois tudo é
 * para uso interno".
 *
 * A decisão que este arquivo protege: UMA TELA, não seis. Copiar a tela da
 * Mehoo por canal criaria seis telas para manter, seis lugares onde um
 * defeito aparece, e uma sétima no dia em que nascer outro canal. Como
 * `painelDoCanal(obras, canalId)` já era genérico desde o começo, o que
 * prendia era a tela.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(aqui, "..", "App.jsx"), "utf8");

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(62)} ${String(o).padEnd(8)} ${ok ? "" : "esperava " + e}`); };

/* ---- 1. Uma tela só, recebendo o canal ---- */
conf("a tela recebe o canal em vez de fixá-lo",
  src.includes("function PainelCanalView({ obras, carregando, erro, canalId }) {"), true);
conf("... e monta o painel com ele", src.includes("painelDoCanal(visiveis, canalId)"), true);
/* Nenhum "mehoo" escrito à mão sobrou DENTRO da tela: era isso que a
   prendia a um canal. */
const tela = src.slice(src.indexOf("function PainelCanalView("), src.indexOf("function ObraDoCanal(") > src.indexOf("function PainelCanalView(")
  ? src.indexOf("function ObraDoCanal(") : src.length);
conf("nenhum canal fixo sobrou dentro da tela", /"mehoo"/.test(tela.slice(0, tela.indexOf("\n}\n"))), false);
/* Os rótulos falam o nome do canal que está na tela. */
conf("o total diz o nome do canal", src.includes("rot={`MATERIAL — ${canal.nome.toUpperCase()}`}"), true);
conf("o vazio também", src.includes("Nenhum item de {canal.nome} ainda"), true);

/* ---- 2. A Mehoo passa a usar a MESMA tela ---- */
/* Ela tem perfil próprio e gente usando, então o módulo continua existindo —
   mas sem código separado, senão volta a haver duas telas divergindo. */
conf("o módulo Mehoo usa a tela genérica",
  src.includes('<PainelCanalView obras={obrasDoPainel} carregando={painelCarregando} erro={painelErro} canalId="mehoo" />'), true);
conf("não existe mais uma MehooView separada", /function MehooView\(/.test(src), false);

/* ---- 3. A escolha do canal ---- */
conf("o módulo novo existe na barra lateral",
  src.includes('{ id: "painel_canal", nome: "Painel por canal"'), true);
/* Os chips saem da lista de canais, e não de uma lista escrita à mão: canal
   novo aparece sozinho, sem ninguém mexer aqui. */
conf("os chips saem da lista de canais", src.includes("{CANAIS_COMPRA.map((c) => ("), true);
conf("o canal começa no primeiro da lista",
  src.includes("useState(CANAIS_COMPRA[0].id)"), true);

/* ---- 4. O GC em todos (pedido dela) ---- */
conf("a linha da obra mostra o GC", src.includes('<span className="mh-obra-gc">· GC {nomeDoEmail(o.gc)}</span>'), true);

/* ---- 5. O CONSERTO QUE VEIO JUNTO ----
   `o.gc` só existia na obra ABERTA: a lista vinha do Monday, e os
   responsáveis moram no NOSSO banco. O Início mostrava a linha "GC ..." vazia
   nas sete obras, e ninguém tinha reparado — o que falta não chama atenção.
   Foi montar o painel que revelou. */
conf("os responsáveis entram na lista de obras",
  src.includes("if (linha?.gc && linha.gc !== o.gc) papeis.gc = linha.gc;"), true);
conf("... o tailor made também", src.includes("papeis.tailorMade = linha.tailor_made;"), true);
conf("... e o responsável do executivo", src.includes("papeis.responsavelExecutivo = linha.responsavel_executivo;"), true);
/* Só troca quando algo mudou de verdade: devolver um objeto novo a cada
   passada faria a lista inteira renderizar sem motivo, em loop. */
conf("a lista só é trocada quando algo muda",
  src.includes("if (!trocaEndereco && !Object.keys(papeis).length) return o;"), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
