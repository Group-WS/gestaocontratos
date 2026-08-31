/* Ordem de declaração dentro do componente.
 *
 * Roda com: node web/src/__testes__/ordem-de-declaracao.test.mjs
 *
 * `const` não sobe. Uma variável usada acima de onde foi declarada morre
 * no primeiro render com "Cannot access before initialization" — e o que
 * a pessoa vê é a TELA INTEIRA EM BRANCO, em todas as telas, não só na
 * que tem o erro.
 *
 * Isso já derrubou a produção uma vez, com `eu` usado por `obrasAtivas`
 * antes de existir. O build passa: sintaxe válida, erro só em tempo de
 * execução. Por isso precisa de teste.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "App.jsx"), "utf8");
const linhas = src.split("\n");

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(58)} ${String(o).padEnd(10)} ${ok ? "" : "esperava " + e}`); };

/* Os pares que importam: quem é usado por quem, dentro do componente
   principal. Declarar depois é o bug; declarar antes é a regra. */
const pares = [
  ["const [pessoas, setPessoas]", "const eu = useMemo("],
  ["const eu = useMemo(", "const modulosVisiveis = useMemo("],
  ["const eu = useMemo(", "const obrasAtivas = useMemo("],
  ["const situacaoDe =", "const obrasAtivas = useMemo("],
  ["const [modulo, setModulo]", "const modulosVisiveis = useMemo("],
  ["const [usuario, setUsuario]", "const eu = useMemo("],
];

const onde = (t) => linhas.findIndex((l) => l.includes(t));

pares.forEach(([antes, depois]) => {
  const a = onde(antes), d = onde(depois);
  if (a === -1 || d === -1) {
    f++;
    console.log(`FALHOU  não achei "${a === -1 ? antes : depois}" no App.jsx`);
    return;
  }
  conf(`"${antes.slice(0, 30)}" antes de "${depois.slice(0, 26)}"`, a < d, true);
});

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
