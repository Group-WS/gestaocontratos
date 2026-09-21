/* Observações na obra — o recado pra quem executa depois.
 *
 * Roda com: node web/src/__testes__/observacoes.test.mjs
 *
 * Pedido dela em 19/09/2026: "outras pessoas podem criar alertas para
 * aquelas que vao executar essa tarefa" — "falta comprar divisor de talher",
 * "nao pode esquecer de ver o tapetinho das gavetas".
 *
 * Decisões dela, todas travadas aqui:
 *   · por ITEM e por VERBA;
 *   · sem "resolvido" por enquanto;
 *   · TODO MUNDO comenta;
 *   · começa só pelas Compras de Produtos.
 *
 * E duas decisões de engenharia que valem teste próprio, porque desfazê-las
 * por engano estraga em silêncio:
 *   1. o recado gruda na DESCRIÇÃO do produto, não na posição da linha;
 *   2. ele mora em tabela própria, fora de `obra_dados.categorias`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(aqui, "..", "lib", "comentarios.js"), "utf8");
const app = fs.readFileSync(path.join(aqui, "..", "App.jsx"), "utf8");
/* `(select auth.jwt())` e `auth.jwt()` sao a MESMA regra: o primeiro so'
   avalia uma vez por consulta em vez de uma vez por linha (regra SQL-12 do
   padrao Group WS). Normalizar antes de comparar mantem as conferencias
   abaixo cobrando a regra — e nao a grafia, que muda quando alguem otimiza. */
const sql = fs.readFileSync(path.join(aqui, "..", "..", "..", "supabase", "obra-comentario.sql"), "utf8")
  .replaceAll("(select auth.jwt())", "auth.jwt()");

const bloco = (assinatura, fim = "\n}\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei em comentarios.js: ${assinatura}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};
const trecho = (comeco, fim) => {
  const i = src.indexOf(comeco);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};

let enviado = null;
const supabaseStub = {
  from: () => ({
    insert: (linha) => { enviado = linha; return { select: () => ({ single: async () => ({ data: { id: 1, ...linha }, error: null }) }) }; },
  }),
};
const M = eval("(function () {\n"
  + "  const supabaseConfigurado = true;\n"
  + "  const supabase = supabaseStub;\n"
  + trecho("const semTabela =", ";\n")
  + bloco("export async function criarComentario(").replace("export ", "")
  + "  return { semTabela, criarComentario };\n"
  + "})()");

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(60)} ${String(o).padEnd(10)} ${ok ? "" : "esperava " + e}`); };

/* ============================================================
   1. ESCREVER
   ============================================================ */
{
  enviado = null;
  await M.criarComentario({ obraCodigo: 2597, verbaNum: "21", itemChave: "divisor de talher", texto: "  falta comprar  ", autor: "Lorena@GroupWS.com.br" });
  conf("grava o texto sem os espaços das pontas", enviado.texto, "falta comprar");
  conf("o autor vai em minúsculas", enviado.autor, "lorena@groupws.com.br");
  conf("a obra vai como texto", enviado.obra_codigo, "2597");
  conf("e a verba também", enviado.verba_num, "21");
  conf("a chave do item vai junto", enviado.item_chave, "divisor de talher");
}
/* Sem chave = observação da VERBA. String vazia tem que virar null, senão o
   comentário fica preso a um produto de nome "" que não existe. */
{
  enviado = null;
  await M.criarComentario({ obraCodigo: 2597, verbaNum: "21", itemChave: "", texto: "ver o tapetinho", autor: "a@b.com" });
  conf("sem item, é observação da verba", enviado.item_chave, "null");
}
/* Texto vazio não vira recado — e o banco também recusa (check). */
{
  let erro = null;
  await M.criarComentario({ obraCodigo: 1, verbaNum: "1", texto: "   ", autor: "a@b.com" }).catch((e) => { erro = e; });
  conf("texto em branco é recusado", /Escreva a observação/.test(erro?.message || ""), true);
}
/* SEM AUTOR NÃO GRAVA. Recado sem dono não se cobra de ninguém — mesmo
   cuidado da remoção de item, onde quem carimba é quem grava. */
{
  let erro = null;
  await M.criarComentario({ obraCodigo: 1, verbaNum: "1", texto: "oi", autor: null }).catch((e) => { erro = e; });
  conf("sem autor não grava", /quem está escrevendo/.test(erro?.message || ""), true);
}

conf("42P01 é tabela que não existe", M.semTabela({ code: "42P01" }), true);
conf("PGRST205 também", M.semTabela({ code: "PGRST205" }), true);
conf("erro de rede não é", M.semTabela({ code: "500" }), false);

/* ============================================================
   2. O BANCO
   ============================================================ */
conf("existe tabela própria", sql.includes("create table if not exists obra_comentario"), true);
/* Fora de `obra_dados`: `categorias` é trocada inteira quando alguém
   substitui a Planilha Executivo, e foi ela que uma gravação vazia zerou em
   três obras em 18/09. Recado que some com a planilha não serve. */
conf("a chave do item é texto, não posição", /item_chave\s+text/.test(sql), true);
conf("texto em branco é recusado pelo banco também",
  sql.includes("check (length(btrim(texto)) > 0)"), true);
conf("tem RLS", sql.includes("alter table obra_comentario enable row level security"), true);
conf("todo mundo lê", /create policy "leitura do time"[\s\S]{0,120}for select/.test(sql), true);
/* Escrever só em nome próprio: sem o `with check`, bastaria mandar outro
   e-mail no payload pra assinar como outra pessoa. */
conf("só dá pra assinar em nome próprio",
  sql.includes("with check (autor = lower(auth.jwt() ->> 'email'))"), true);
conf("apagar é do autor ou do admin",
  sql.includes("using (autor = lower(auth.jwt() ->> 'email') or public.admin_do_time())"), true);
/* Editar não existe de propósito: recado alterado depois de lido confunde
   mais do que ajuda. */
conf("não existe editar", /for update[\s\S]{0,160}on obra_comentario/.test(sql), false);

/* ============================================================
   3. A TELA (Compras de Produtos)
   ============================================================ */
/* GRUDA NA DESCRIÇÃO, NÃO NA POSIÇÃO. Posição desgruda na primeira linha
   inserida acima, e aí o recado aparece no produto errado — pior do que
   recado nenhum. */
conf("o recado do item segue a descrição",
  app.includes("obs={obsDoItem(g.num, r.it.desc)}"), true);
conf("... normalizada pela mesma régua do Entrou/saiu",
  app.includes("const chave = chaveDescricao(desc);"), true);
conf("nenhum índice de linha entra na chave",
  /obsDoItem\([^)]*itemIdx/.test(app), false);

/* Estado FORA de `obra`: observação não é conteúdo da obra, não passa pelo
   salvamento dela e não pode arrastar a obra numa gravação. */
conf("as observações têm estado próprio", app.includes("const [obs, setObs] = useState([]);"), true);
conf("a observação da verba fica FORA do botão que abre o grupo",
  app.indexOf('<Observacoes lista={obsDaVerba(g.num)}') > app.indexOf('</button>'), true);

/* O filtro que ela pediu. Só aparece quando há o que filtrar. */
conf("existe o chip de filtrar por observação", app.includes('<Toggle size="sm" pressed={soComObs} onPressedChange={(v) => setSoComObs(!!v)}'), true);
conf("... e ele some quando não há nenhuma", app.includes("{obs.length > 0 && ("), true);
conf("com o filtro, a verba sem observação nenhuma sai",
  app.includes("if (soComObs && naTela.length === 0 && obsDaVerba(g.num).length === 0) return null;"), true);
/* A busca continua sendo uma lente sobre a mesma lista: as duas peneiram
   juntas, e nenhuma mexe em total nenhum. */
conf("a busca e o filtro peneiram a mesma lista",
  app.includes("const naTela = soComObs ? comBusca.filter((r) => obsDoItem(g.num, r.it.desc).length > 0) : comBusca;"), true);

/* Sem o SQL rodado, a tela não oferece o que não funciona. */
conf("sem a tabela, não aparece nada de observação",
  app.includes("if (semTabela && !lista.length) return null;"), true);

/* O NOME É "OBSERVAÇÃO INTERNA" (pedido dela, 19/09/2026), e é o mesmo em
   todo lugar: botão, filtro e dica. Campo com dois nomes é campo que a
   equipe acha que são dois. "Interna" também diz o que ela é — recado da
   casa, não algo que sai para cliente ou fornecedor. */
conf("o botão de criar diz observação interna", app.includes("<Plus size={10} /> observação interna"), true);
conf("o filtro também", app.includes("com observação interna ({obs.length})"), true);
conf("a dica do item também", app.includes('"Deixar uma observação interna neste produto"'), true);
conf("a dica da verba também", app.includes('"Deixar uma observação interna nesta verba"'), true);
conf("e a de apagar", app.includes('rotulo="Apagar esta observação interna"'), true);
conf("as mensagens da biblioteca falam o mesmo nome",
  src.includes("Escreva a observação interna antes de salvar."), true);
/* Nenhum "observação" solto sobrou nesta tela — é o que impede o nome de
   voltar pela metade num ajuste futuro. */
conf("não sobrou nenhum rótulo pela metade",
  /observação(?! interna)(?![\w])/.test(app.slice(app.indexOf("function Observacoes("), app.indexOf("function LinhaCompra("))), false);

/* A cor é própria: laranja, verde e vermelho já significam estado do item. */
const ds = fs.readFileSync(path.join(aqui, "..", "estilos", "design-system.css"), "utf8");
conf("a observação usa o token de organização do design system",
  ds.includes("--obs: var(--mod-organizacao);"), true);
const tokens = fs.readFileSync(path.join(aqui, "..", "..", "node_modules", "@group-ws", "ws-ui", "src", "styles", "tokens.css"), "utf8");
conf("o pacote define o token de organização nos dois temas",
  (tokens.match(/--mod-organizacao:/g) || []).length === 2, true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
