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
 * "Carregando…" some, o "habilitar edição" reaparecia, e o salvamento
 * automático — que não conferia nada — gravava o esqueleto por cima da obra
 * inteira. Sem aviso e sem rastro.
 *
 * Este arquivo tranca as duas portas:
 *   1. a gravação RECUSA quando o que vai ser gravado não tem item e o banco
 *      tem. Desde 22/09/2026 quem confere é a função `salvar_obra`, no banco
 *      (supabase/salvar-obra.sql), na mesma transação da gravação — antes era
 *      uma leitura extra feita pelo navegador, com uma janela entre conferir
 *      e gravar. O comportamento é provado contra o banco de verdade em
 *      supabase/tests/12-salvar-obra.sql; aqui fica o desenho.
 *   2. A FaixaDaEdicao não oferece edição numa obra que não carregou.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { erroDaResposta, avisoDaGravacao } from "../lib/gravacaoObra.js";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(aqui, "..", "App.jsx"), "utf8");
const sql = fs.readFileSync(path.join(aqui, "..", "..", "..", "supabase", "salvar-obra.sql"), "utf8");
const teste = fs.readFileSync(path.join(aqui, "..", "..", "..", "supabase", "tests", "12-salvar-obra.sql"), "utf8");

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(60)} ${String(o).padEnd(8)} ${ok ? "" : "esperava " + e}`); };

/* ============================================================
   1. O CINTO, NO BANCO
   ============================================================ */
const salvar = sql.slice(sql.indexOf("create or replace function public.salvar_obra("),
  sql.indexOf("revoke execute on function public.salvar_obra("));
const conta = sql.slice(sql.indexOf("create or replace function private.obra_conta_itens("),
  sql.indexOf("$$;", sql.indexOf("create or replace function private.obra_conta_itens(")));

/* As QUATRO fontes contam. Uma obra que só tem o contrato importado é tão
   cheia quanto uma que já foi até as compras — perder qualquer uma é perder
   trabalho de alguém. */
["itens", "itensContrato", "itensPlanilha", "itensPlanilhaExecutivo"].forEach((fonte) => {
  conf(`a conta de itens olha ${fonte}`, conta.includes(`c -> '${fonte}'`), true);
});
conf("lista que não é lista vale zero, sem derrubar a gravação", conta.includes("jsonb_typeof(c -> 'itens') = 'array'"), true);

conf("tela sem item + banco com item: recusa com o motivo 'vazia'",
  /private\.obra_conta_itens\(p_conteudo -> 'categorias'\) = 0\s*\n\s*and private\.obra_conta_itens\(linha\.categorias\) > 0 then\s*\n\s*return jsonb_build_object\('ok', false, 'motivo', 'vazia'\)/.test(salvar), true);
/* A ORDEM IMPORTA: o cinto tem que vir ANTES da escrita. Depois dela não
   serviria de nada. */
conf("o cinto vem antes da gravação",
  salvar.indexOf("'motivo', 'vazia'") > 0 && salvar.indexOf("'motivo', 'vazia'") < salvar.indexOf("private.obra_dados_escrever("), true);
/* Na MESMA transação: a linha fica segura (`for update`) desde a leitura, e
   ninguém grava entre conferir e escrever. */
conf("... com a linha segura desde a conferência", /from public\.obra_dados d\s*\n\s*where d\.obra_codigo = p_codigo\s*\n\s*for update;/.test(salvar), true);
/* Obra nova de verdade (vazia dos dois lados) grava: senão nenhuma começa.
   E obra cheia grava como sempre. O teste do banco prova os dois lados. */
conf("o teste do banco prova a recusa", teste.includes("'obra sem item não grava por cima de obra com itens'"), true);
conf("... e que os itens ficam", teste.includes("'... e os itens ficam'"), true);

/* A tela diz o que aconteceu — e não manda dar F5, que levaria junto o que
   outras obras ainda não gravaram. A saída é recarregar ESTA obra. */
const aviso = avisoDaGravacao({ estado: "conflito", erro: erroDaResposta(409, { motivo: "vazia" }) }, { obra: "2450" });
conf("a recusa vira conflito (não é repetida por cima)", erroDaResposta(409, { motivo: "vazia" }).tipo, "conflito");
conf("... e a tela explica que foi de propósito", /apagaria o trabalho de todo mundo/.test(aviso.descricao), true);
conf("... oferecendo recarregar a obra", aviso.acao, "recarregar");
conf("... sem mandar dar F5", /F5/.test(aviso.descricao), false);

/* ============================================================
   2. A SEGUNDA PORTA: obra que não carregou não abre pra edição
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
const barra = app.slice(app.indexOf("function FaixaDaEdicao({"), app.indexOf("function FaixaDaEdicao({") + 6000);
conf("o aviso de falha existe na barra", barra.includes("} else if (falhouCarregar) {"), true);
conf("... antes do botão de habilitar",
  barra.indexOf("} else if (falhouCarregar) {") < barra.indexOf("onClick={onHabilitar}"), true);
conf("... e diz o que acontece", barra.includes("Não consegui carregar esta obra") && barra.includes("A edição fica fechada até ela carregar."), true);
/* A saída era "recarregue a página (F5)". Agora é tentar carregar de novo
   aqui mesmo: recarregar a página levaria junto o que outras obras desta
   aba ainda não gravaram. */
conf("... oferecendo tentar de novo, sem recarregar a página", barra.includes("onClick={onTentarCarregar}"), true);
conf("... e sem mandar dar F5", /F5/.test(barra.slice(barra.indexOf("} else if (falhouCarregar) {"), barra.indexOf("} else if (edicao.por) {"))
  .split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n")), false);
conf("tentar de novo roda a abertura outra vez", app.includes("onTentarCarregar={() => setCargaPedida((n) => n + 1)}"), true);
conf("... porque o efeito da abertura depende do pedido", app.includes("}, [obra?.codigo, usuario, cargaPedida]);"), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
