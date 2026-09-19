/* Obra vazia não grava por cima de obra cheia.
 *
 * Roda com: node web/src/__testes__/obra-vazia-nao-grava.test.mjs
 *
 * O QUE ACONTECEU (19/09/2026). A obra 2450 amanheceu com as 33 verbas da EAP
 * e zero itens: 269 itens, cadernos, anexos, aprovações e CMV apagados de uma
 * vez. Nenhum SQL tinha mira nisso — o `limpar-apresentacao-caderno.sql` só
 * mexe em `cadernos`. Quem apagou foi o próprio app, e só um backup do
 * Supabase trouxe de volta.
 *
 * O CAMINHO. Ao abrir uma obra, ela começa na memória como o esqueleto do
 * cadastro do Monday — as verbas da EAP, sem item nenhum. Os itens chegam
 * numa SEGUNDA viagem ao banco. Se essa viagem falha, o esqueleto fica; o
 * "Carregando…" some, o "habilitar edição" reaparece, e o salvamento
 * automático — que não conferia nada — grava o esqueleto por cima da obra
 * inteira. Sem aviso e sem rastro.
 *
 * Este arquivo tranca as duas portas:
 *   1. `salvarDadosObra` RECUSA gravar quando a tela não tem item e o banco
 *      tem. Vale contra qualquer caminho, inclusive os que não conhecemos.
 *   2. A BarraEtapa não oferece edição numa obra que não carregou.
 *
 * O arquivo é fatiado em vez de importado: `dadosObra.js` puxa o cliente do
 * Supabase na primeira linha, e o Node não resolve esse import fora do Vite.
 * A montagem usa CONCATENAÇÃO, não template literal: o corpo de
 * `salvarDadosObra` tem `${...}` dentro, e uma crase aqui interpolaria tudo
 * na hora de montar o teste.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(aqui, "..", "lib", "dadosObra.js"), "utf8");
const app = fs.readFileSync(path.join(aqui, "..", "App.jsx"), "utf8");

const bloco = (assinatura, fim = "\n}\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei em dadosObra.js: ${assinatura}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};

let supabaseStub = null;
const M = eval("(function () {\n"
  + "  const supabaseConfigurado = true;\n"
  + "  const supabase = { from: (t) => supabaseStub.from(t) };\n"
  + "  const listaDeArquivos = (a) => (Array.isArray(a) ? a : []);\n"
  + "  const paraApp = (l) => l;\n"
  + bloco("export function temItemNasCategorias(").replace("export ", "")
  + bloco("export async function salvarDadosObra(").replace("export ", "")
  + "  return { temItemNasCategorias, salvarDadosObra };\n"
  + "})()");

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(60)} ${String(o).padEnd(8)} ${ok ? "" : "esperava " + e}`); };

/* ============================================================
   1. A PERGUNTA PURA: esta obra tem item?
   ============================================================ */
const { temItemNasCategorias: tem } = M;

/* O esqueleto do Monday, que é exatamente o que o banco da 2450 tinha depois
   do apagamento: verba com número, nome e os dois totais — e nada dentro. */
const esqueleto = [
  { num: "01", nome: "Arquitetura e Engenharia", vendido: 0, executivo: 0 },
  { num: "02", nome: "Serviços Complementares", vendido: 0, executivo: 0 },
];

conf("sem categorias, não tem item", tem([]), false);
conf("null não quebra", tem(null), false);
conf("undefined não quebra", tem(undefined), false);
conf("o esqueleto do Monday NÃO é obra cheia", tem(esqueleto), false);
conf("verba com lista vazia também não", tem([{ num: "01", itens: [], itensPlanilha: [] }]), false);

/* As QUATRO fontes contam. Uma obra que só tem o contrato importado é tão
   cheia quanto uma que já foi até as compras — perder qualquer uma é perder
   trabalho de alguém. */
conf("um item do Executivo já é obra cheia", tem([{ num: "01", itens: [{ desc: "x" }] }]), true);
conf("... e um do Vendido Contrato também", tem([{ num: "01", itensContrato: [{ desc: "x" }] }]), true);
conf("... e um do Vendido Planilha também", tem([{ num: "01", itensPlanilha: [{ desc: "x" }] }]), true);
conf("... e um da planilha do Executivo também", tem([{ num: "01", itensPlanilhaExecutivo: [{ desc: "x" }] }]), true);
conf("item numa verba lá no fim conta igual",
  tem([...esqueleto, { num: "33", itens: [{ desc: "x" }] }]), true);

/* ============================================================
   2. O CINTO: a gravação recusa
   ============================================================ */
function montarStub({ categoriasNoBanco, erroNaLeitura = null }) {
  const chamadas = { leu: 0, gravou: 0, payload: null };
  const stub = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            chamadas.leu += 1;
            return erroNaLeitura
              ? { data: null, error: { message: erroNaLeitura } }
              : { data: categoriasNoBanco === null ? null : { categorias: categoriasNoBanco }, error: null };
          },
        }),
      }),
      upsert: (linha) => {
        chamadas.gravou += 1;
        chamadas.payload = linha;
        return { select: () => ({ single: async () => ({ data: linha, error: null }) }) };
      },
    }),
  };
  return { stub, chamadas };
}

const cheia = [{ num: "01", nome: "Arquitetura", itens: [{ desc: "mesa" }] }];

/* O CASO DA 2450: tela vazia, banco cheio. Não grava, e diz por quê. */
{
  const { stub, chamadas } = montarStub({ categoriasNoBanco: cheia });
  supabaseStub = stub;
  let erro = null;
  await M.salvarDadosObra("2450", { categorias: esqueleto }, "eu@x.com").catch((e) => { erro = e; });
  conf("tela vazia + banco cheio: NÃO grava", chamadas.gravou, 0);
  conf("... conferiu o banco antes", chamadas.leu, 1);
  conf("... e explicou que foi de propósito", /NÃO GRAVEI/.test(erro?.message || ""), true);
  conf("... mandando recarregar", /F5/.test(erro?.message || ""), true);
}

/* Obra NOVA de verdade: vazia dos dois lados. Tem que gravar — senão nenhuma
   obra começa. */
{
  const { stub, chamadas } = montarStub({ categoriasNoBanco: null });
  supabaseStub = stub;
  let erro = null;
  await M.salvarDadosObra("9999", { categorias: esqueleto }, "eu@x.com").catch((e) => { erro = e; });
  conf("obra nova (banco sem linha): grava", chamadas.gravou, 1);
  conf("... sem erro", erro, "null");
}

/* Linha existente, mas também sem item: segue gravando. É o caso de quem
   acabou de iniciar a obra e ainda não subiu planilha nenhuma. */
{
  const { stub, chamadas } = montarStub({ categoriasNoBanco: esqueleto });
  supabaseStub = stub;
  await M.salvarDadosObra("9999", { categorias: esqueleto }, "eu@x.com").catch(() => {});
  conf("banco também vazio: grava", chamadas.gravou, 1);
}

/* Obra CHEIA: grava como sempre gravou, e NEM LÊ o banco antes. A consulta
   extra só existe no caso perigoso — o salvamento normal não fica mais lento. */
{
  const { stub, chamadas } = montarStub({ categoriasNoBanco: cheia });
  supabaseStub = stub;
  await M.salvarDadosObra("2450", { categorias: cheia }, "eu@x.com").catch(() => {});
  conf("obra cheia: grava", chamadas.gravou, 1);
  conf("... sem consulta extra", chamadas.leu, 0);
}

/* Não deu pra conferir? Também não grava. A dúvida pesa mais que a gravação:
   o que está na tela é uma obra sem item nenhum. */
{
  const { stub, chamadas } = montarStub({ categoriasNoBanco: cheia, erroNaLeitura: "sem rede" });
  supabaseStub = stub;
  let erro = null;
  await M.salvarDadosObra("2450", { categorias: esqueleto }, "eu@x.com").catch((e) => { erro = e; });
  conf("leitura falhou: NÃO grava", chamadas.gravou, 0);
  conf("... e conta o motivo", /sem rede/.test(erro?.message || ""), true);
}

/* A ORDEM IMPORTA no código-fonte: o cinto tem que estar ANTES do upsert.
   Depois dele não serviria de nada. */
const corpo = bloco("export async function salvarDadosObra(");
conf("o cinto vem antes da gravação",
  corpo.indexOf("temItemNasCategorias(conteudo.categorias)") < corpo.indexOf(".upsert("), true);

/* ============================================================
   3. A SEGUNDA PORTA: obra que não carregou não abre pra edição
   ============================================================ */
conf("a falha de carregamento é guardada por CÓDIGO",
  app.includes("const [falhaAoCarregar, setFalhaAoCarregar] = useState(null);"), true);
conf("... marcada quando a leitura da obra falha",
  app.includes("setErroBanco(e.message || String(e)); setFalhaAoCarregar(codigo);"), true);
conf("... e zerada ao abrir outra obra",
  app.includes("setEdicao({ minha: false, por: null, desde: null });\n    setFalhaAoCarregar(null);"), true);
conf("a barra recebe a falha desta obra, não de qualquer uma",
  app.includes('falhouCarregar={String(falhaAoCarregar || "") === String(obra.codigo)}'), true);

/* E o aviso tem que vir ANTES do ramo que oferece "habilitar edição" — é o
   ramo final do if, quem chegar lá ganha o botão. */
const barra = app.slice(app.indexOf("function BarraEtapa({"), app.indexOf("function BarraEtapa({") + 4000);
conf("o aviso de falha existe na barra", barra.includes("} else if (falhouCarregar) {"), true);
conf("... antes do botão de habilitar",
  barra.indexOf("} else if (falhouCarregar) {") < barra.indexOf("onClick={onHabilitar}"), true);
conf("... e diz o que fazer", barra.includes("recarregue a página (F5) antes de mexer"), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
