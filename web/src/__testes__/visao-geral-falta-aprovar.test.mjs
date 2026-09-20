/* A Visão geral diz quantos itens esperam aprovação — e o clique leva lá.
 *
 * Roda com: node web/src/__testes__/visao-geral-falta-aprovar.test.mjs
 *
 * Pedido dela em 19/09/2026: "tem que trazer ali no resuminho que faltam, por
 * exemplo, 7 itens para ser liberados para compra. Essa informação é bem
 * importante, e daí quando a pessoa clica vai direto lá para a conferência do
 * Executivo, que é onde precisa liberar esses produtos. Já aparece filtrado:
 * falta aprovar para compra."
 *
 * O que este arquivo protege, e que não é óbvio:
 *
 *   1. UMA RÉGUA SÓ. O número da Visão geral e o do chip da Conf. Executivo
 *      saem da MESMA função. Dois lugares contando por conta própria foi como
 *      a tela chegou a dizer "13 de 8 liberados" em 17/09 — e quem lê não tem
 *      como saber qual dos dois é o verdadeiro.
 *
 *   2. O FILTRO VALE UMA VEZ. Se ficasse guardado, voltar à aba depois abriria
 *      filtrado de novo, sem ninguém ter pedido — e a pessoa veria uma lista
 *      curta achando que é a lista inteira.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(aqui, "..", "App.jsx"), "utf8");

const linha = (comeco) => {
  const i = src.indexOf(comeco);
  if (i === -1) throw new Error(`não achei em App.jsx: ${comeco}`);
  return src.slice(i, src.indexOf("\n", i) + 1);
};

/* A conta roda de verdade, com um `compraveisDoGrupo` de mentira igual ao do
   app: item que não é título entra, independente da alocação (ADR-005). */
const M = eval("(function () {\n"
  + "  const compraveisDoGrupo = (g) => (g.itens || []).filter((x) => !x.titulo);\n"
  + linha("const faltaAprovarNosGrupos =")
  + linha("  .reduce((a, g) =>")
  + "  return { faltaAprovarNosGrupos };\n"
  + "})()");

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(60)} ${String(o).padEnd(8)} ${ok ? "" : "esperava " + e}`); };

/* ============================================================
   1. A CONTA
   ============================================================ */
const conta = M.faltaAprovarNosGrupos;

conf("sem grupos, zero", conta([]), 0);
conf("nulo não quebra", conta(null), 0);
conf("conta o que ainda não foi liberado",
  conta([{ itens: [{ liberado: true }, { liberado: false }, {}] }]), 2);
/* Linha de título não é item: ninguém aprova "MÓVEIS SOB MEDIDA" para compra. */
conf("título não entra na conta",
  conta([{ itens: [{ titulo: true }, { liberado: false }] }]), 1);
conf("soma as verbas",
  conta([{ itens: [{}, {}] }, { itens: [{ liberado: true }, {}] }]), 3);
conf("tudo liberado dá zero",
  conta([{ itens: [{ liberado: true }, { liberado: true }] }]), 0);
conf("verba sem itens não quebra", conta([{ num: "01" }]), 0);

/* ============================================================
   2. UMA RÉGUA SÓ
   ============================================================ */
/* Se o chip voltar a fazer a conta na mão, os dois números podem divergir —
   e foi essa divergência que já confundiu ela uma vez. */
conf("o chip da Conf. Executivo usa a mesma função",
  src.includes("contador: faltaAprovarNosGrupos(gruposParaLiberar),"), true);
conf("a Visão geral usa a mesma função",
  src.includes("const faltaAprovar = useMemo(() => faltaAprovarParaCompra(obra), [obra]);"), true);
conf("e ninguém mais repete a conta na mão",
  (src.match(/filter\(\(x\) => !x\.liberado\)\.length, 0\)/g) || []).length, 1);

/* ============================================================
   3. O ATALHO
   ============================================================ */
conf("a linha só aparece quando há o que aprovar",
  src.includes("{faltaAprovar > 0 && onIrParaLiberacao && ("), true);
/* "Nada pedindo atenção" não pode aparecer junto com 29 itens esperando. */
conf("o 'nada pedindo atenção' conta com ela também",
  src.includes("{pendencias.length === 0 && faltaAprovar === 0 ? ("), true);
conf("o clique abre a Conf. Executivo já filtrada",
  src.includes('onIrParaLiberacao={() => { setFiltroConferencia("falta_liberar"); setGrupo("planejamento"); setTab("executivo_conferencia"); }}'), true);
conf("a dica diz aonde leva",
  src.includes("Abre a Conf. Executivo já filtrada em 'Falta aprovar p/ compra'"), true);

/* ============================================================
   4. O FILTRO VALE UMA VEZ
   ============================================================ */
conf("o filtro pedido entra na montagem da tela",
  src.includes('const [filtro, setFiltro] = useState(() => filtroInicial || telaExtra?.id || "todos");'), true);
conf("... e a tela avisa que consumiu",
  src.includes("useEffect(() => { if (filtroInicial) onFiltroUsado?.(); }, []);"), true);
conf("... e quem pediu esquece", src.includes("onFiltroUsado={() => setFiltroConferencia(null)}"), true);
/* Sem atalho, a tela abre como sempre abriu — mostrando tudo. */
conf("sem pedido, o padrão continua 'todos'",
  src.includes('const [filtroConferencia, setFiltroConferencia] = useState(null);'), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
