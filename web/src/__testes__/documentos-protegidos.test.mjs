/* O aditivo e a apresentação, do lado da tela: o que elas fazem para nada se perder.
 *
 * Roda com: node web/src/__testes__/documentos-protegidos.test.mjs
 *
 * A obra já gravava com versão conferida no banco; estes dois documentos,
 * não. O que estava aberto:
 *   1. o aditivo só gravava no botão "Salvar" — sair da tela jogava fora o
 *      digitado;
 *   2. os dois gravavam o documento inteiro sem versão, então duas pessoas
 *      no mesmo aditivo (ou na mesma revisão) se apagavam em silêncio;
 *   3. a apresentação descartava a edição feita durante uma gravação em
 *      andamento, dizendo "Salvo.";
 *   4. abrir editava a cópia que a lista trouxe, que podia ser de meia hora
 *      atrás;
 *   5. as imagens dos ambientes iam para um balde público.
 *
 * O "não" de verdade é do banco (supabase/salvar-aditivo-apresentacao.sql,
 * provado em supabase/tests/13-aditivo-apresentacao.sql) e da API
 * (web/api/_lib/__testes__/documentos-da-obra.test.cjs). Aqui é a tela.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { avisoDoDocumento, nomeDoAditivo, nomeDaApresentacao, aplicarGravacao } from "../lib/documentosDaObra.js";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const ler = (...p) => fs.readFileSync(path.join(aqui, "..", ...p), "utf8");
const app = ler("App.jsx");
const apresentacaoTela = ler("Apresentacao.jsx");
const libAditivos = ler("lib", "aditivos.js");
const libApresentacao = ler("lib", "apresentacao.js");

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(70)} ${String(o).padEnd(8)} ${ok ? "" : "esperava " + e}`); };
const entre = (texto, a, b) => {
  const i = texto.indexOf(a);
  if (i === -1) throw new Error(`não achei: ${a}`);
  const j = texto.indexOf(b, i + a.length);
  return texto.slice(i, j === -1 ? undefined : j);
};
const semComentarios = (texto) => texto
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

/* ---------- 1. o que a tela diz ---------- */
const agora = 1_000_000;
const erro = avisoDoDocumento({ estado: "erro", proximaEm: agora + 8000, erro: { message: "O servidor não respondeu." } },
  { documento: "o aditivo 2405/1", agora });
conf("falha temporária avisa e tenta de novo", erro.acao, "tentar");
conf("... dizendo em quantos segundos", /em 8 s/.test(erro.descricao), true);
conf("... e nomeando o documento", /aditivo 2405\/1/.test(erro.titulo), true);

const conflito = avisoDoDocumento({
  estado: "conflito",
  erro: { detalhe: { motivo: "versao", atualizadoPor: "ana@groupws.com.br", atualizadoEm: "2026-09-22T13:05:00Z" } },
}, { documento: nomeDaApresentacao({ rev: "01" }), agora });
conf("conflito manda recarregar, não tentar de novo", conflito.acao, "recarregar");
conf("... diz quem alterou", /ana@groupws\.com\.br/.test(conflito.descricao), true);
conf("... e garante que nada foi gravado por cima", /nada desta tela foi gravado por cima/.test(conflito.descricao), true);
conf("recusado pede uma decisão de quem está editando",
  avisoDoDocumento({ estado: "recusado", erro: { message: "não" } }, { documento: "o aditivo 1" }).acao, "tentar");
conf("gravação em dia não vira aviso", avisoDoDocumento({ estado: "salvo", em: agora }), null);

const todosOsTextos = [erro, conflito,
  avisoDoDocumento({ estado: "recusado", erro: { message: "não" } }, { documento: "o aditivo 1" })]
  .map((a) => `${a.titulo} ${a.descricao}`).join(" ");
conf("nenhuma mensagem manda dar F5", /F5|[Rr]ecarregue a página/.test(todosOsTextos), false);
conf("o nome do aditivo sai do número", nomeDoAditivo({ numero: "2405/3" }), "o aditivo 2405/3");

/* ---------- 2. o que a lista mostra depois de gravar ---------- */
const antes = {
  id: "a1", numero: "2405/1", descricao: "Antes", status: "rascunho", versao: 3,
  doc: { observacao: "velha", data: "2026-09-01" }, totalAdicao: 0, totalSupressao: 0,
  resumo: { observacao: "velha", data: "2026-09-01", pipefy: null },
};
const depois = aplicarGravacao(antes, {
  versao: 4,
  campos: { status: "aprovado", dados: { observacao: "nova", data: "2026-09-01", pipefy: { em: "2026-09-22", por: "ana" } }, total_adicao: 1200 },
});
conf("a versão nova fica na linha da lista", depois.versao, 4);
conf("... com o que mudou", depois.status, "aprovado");
conf("... o que não foi não se perde", depois.descricao, "Antes");
conf("... e o resumo acompanha o documento", depois.resumo.observacao, "nova");
conf("... inclusive a marca do Pipefy", depois.resumo.pipefy.por, "ana");
conf("o total gravado vale para a lista", depois.totalAdicao, 1200);

/* ---------- 3. a tela do aditivo ---------- */
const editor = entre(app, "function EditorAditivo({ aditivo, obra, usuario, doExecutivo, onVoltar, onSalvo }) {", "\nfunction ");
conf("abrir o aditivo carrega o documento do banco", editor.includes("carregarAditivo(aditivo.obraCodigo, aditivo.id)"), true);
conf("... e guarda a versão que veio com ele", editor.includes("versaoRef.current = a.versao;"), true);
conf("o aditivo grava sozinho, pela fila", editor.includes("criarFilaDeGravacao({"), true);
conf("... sempre com a versão que a tela leu",
  editor.includes("salvarAditivo(aditivo.obraCodigo, aditivo.id, versaoRef.current, atual)"), true);
conf("... e guarda a versão nova que o banco devolve", editor.includes("versaoRef.current = r.versao;"), true);
conf("digitar a descrição marca a fila", editor.includes("setDescricao(e.target.value); filaDoAditivo.alterou();"), true);
conf("mudar a fase também", /function mudarStatus\(novo\) \{\s*\n\s*setStatus\(novo\);\s*\n\s*filaDoAditivo\.alterou\(\);/.test(editor), true);
conf("sair para a lista grava antes", /async function voltar\(\) \{[\s\S]*await filaDoAditivo\.descarregar\(\);/.test(editor), true);
conf("... e só desiste se a pessoa mandar", /titulo: "Sair sem gravar\?"/.test(editor), true);
conf("fechar a aba com trabalho por gravar pergunta", editor.includes('window.addEventListener("beforeunload", aoSair);'), true);
conf("o conflito tem saída: recarregar o aditivo", editor.includes("Recarregar o aditivo"), true);
conf("... que pergunta antes de descartar", /titulo: "Recarregar o aditivo\?"/.test(editor), true);
conf("a situação da gravação fica à vista", editor.includes("<SituacaoDaGravacao situacao={gravacaoDoAditivo}"), true);
conf("o botão não é mais a única forma de gravar", /disabled=\{salvando \|\| !sujo\}/.test(editor), false);

const linha = entre(app, "function LinhaAditivo({", "\nfunction ");
conf("gravar da lista relê o aditivo antes", linha.includes("const atual = await carregarAditivo(a.obraCodigo, a.id);"), true);
conf("... e usa a versão de agora", linha.includes("salvarAditivo(a.obraCodigo, a.id, atual.versao, mudar(atual))"), true);
conf("a lista lê o resumo, não o documento", /a\.doc\b/.test(semComentarios(linha)), false);

/* ---------- 4. a tela da apresentação ---------- */
conf("a revisão aberta vem do banco, por id", apresentacaoTela.includes("await carregarApresentacao(obraCod, l[0].id)"), true);
conf("a apresentação grava pela fila", apresentacaoTela.includes("criarFilaDeGravacao({"), true);
conf("... com a versão lida", apresentacaoTela.includes("salvarApresentacao(obraCod, atual.id, versaoRef.current, comIdioma)"), true);
conf("a trava que engolia a edição saiu", /salvandoRef/.test(apresentacaoTela), false);
conf("gerar o PDF grava tudo antes", apresentacaoTela.includes("const salvo = await garantirGravado();"), true);
conf("fechar a tela grava antes", /async function fechar\(\) \{[\s\S]*await fila\.descarregar\(\);/.test(apresentacaoTela), true);
conf("o conflito tem saída: recarregar a apresentação", apresentacaoTela.includes("Recarregar a apresentação"), true);
conf("abrir outra revisão grava a atual antes", /onAbrir=\{async \(r\) => \{[\s\S]*await garantirGravado\(\);/.test(apresentacaoTela), true);

/* ---------- 5. nada do front fala direto com o banco ---------- */
for (const [nome, texto] of [["aditivos.js", libAditivos], ["apresentacao.js", libApresentacao]]) {
  conf(`${nome} não chama o Supabase direto`, /supabase\.(from|rpc|storage|channel)\(/.test(texto), false);
  conf(`${nome} fala com a API`, /apiFetch\(/.test(texto), true);
}
conf("a imagem do ambiente é reduzida antes de subir", libApresentacao.includes("const { tipo, bytes } = await reduzirImagem(file);"), true);
conf("... e sobe pelo balde da obra, pela API", libApresentacao.includes("`${daObra(obraCodigo)}/ambientes`"), true);
conf("o endereço para ver a imagem vem assinado da API", libApresentacao.includes("/ambientes/links"), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
