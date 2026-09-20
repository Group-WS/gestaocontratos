/* Os dois primitivos que o app nao tinha: o recado curto e o contorno.
 *
 * Roda com: node web/src/__testes__/aviso-e-esqueleto.test.mjs
 *
 * Primitivo sem usuario e' enfeite morto — e este app ja' tem o exemplo:
 * DOZE dos treze utilitarios do design-system.css nunca foram usados uma
 * vez, inclusive o .animate-shimmer, que existia desde que o DS foi
 * portado. Por isso o teste cobra os USUARIOS, nao so' os componentes.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const ler = (...p) => fs.readFileSync(path.join(aqui, "..", ...p), "utf8");
const aviso = ler("componentes", "Aviso.jsx");
const esqueleto = ler("componentes", "Esqueleto.jsx");
const app = ler("App.jsx");
const css = ler("estilos", "componentes.css");

let f = 0;
const conf = (n, o, e = true) => {
  const ok = JSON.stringify(o) === JSON.stringify(e);
  if (!ok) f++;
  console.log(`${ok ? "ok    " : "FALHOU"}  ${n.padEnd(56)}${ok ? "" : `${JSON.stringify(o)} esperava ${JSON.stringify(e)}`}`);
};

console.log("=== O AVISO ===");
conf("sai por portal, fora da arvore da tela", aviso.includes("createPortal("));
conf("se anuncia pra quem nao ve", /aria-live="polite"/.test(aviso));
conf("... polite, e nao assertive", /aria-live="assertive"/.test(aviso), false);
conf("... com role=status", /role="status"/.test(aviso));
conf("some sozinho", aviso.includes("setTimeout(() => fecharAviso(aviso.id)"));
conf("... e da' pra fechar na mao", /aria-label="Fechar aviso"/.test(aviso));
conf("chamavel de qualquer lugar, sem provider", aviso.includes("export function avisar("));
conf("o container existe uma vez no app", (app.match(/<Avisos \/>/g) || []).length, 1);

console.log("\n=== ... e seus usuarios de verdade ===");
conf("liberar acesso deixa de fechar em silencio", app.includes("avisar(perfil"));
conf("... e diz QUAL acesso a pessoa ganhou", app.includes("agora tem o acesso de"));
conf("cadastrar pessoa confirma que salvou", app.includes("entrou na Equipe."));
conf("... e distingue de uma edicao", app.includes("const eraEdicao = !!editando"));
conf("os tres tons tem estilo", [".aviso-erro", ".aviso-atencao", ".aviso "].every((s) => css.includes(s)));
conf("fica no canto de baixo, fora do caminho", /\.avisos \{[^}]*bottom: 16px/.test(css));

console.log("\n=== O ESQUELETO ===");
conf("usa o shimmer que ja' existia", esqueleto.includes("animate-shimmer"));
conf("... que era um dos utilitarios mortos do DS",
  ler("estilos", "design-system.css").includes(".animate-shimmer"));
conf("as barras nao sao faladas", esqueleto.includes('aria-hidden="true"'));
conf("... e a palavra vai uma vez, so' pro leitor", esqueleto.includes('className="sr-apenas"'));
conf("a classe existe no css", css.includes(".sr-apenas"));
conf("a ultima barra e' mais curta", esqueleto.includes('i === linhas - 1 ? "62%"'));

console.log("\n=== ... e seu usuario de verdade ===");
conf("a frase 'Carregando as obras' virou contorno", app.includes('rotulo="Carregando as obras…"'));
conf("... e nao e' mais uma nota solta",
  app.includes('<div className="empty-note">Carregando as obras…</div>'), false);
conf("o contorno imita a regua de indicadores", app.includes('classe="esq-regua"'));
conf("... e a lista de obras", app.includes('classe="esq-lista"'));

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
