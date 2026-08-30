/* Os arquivos da obra.
 *
 * Roda com: node web/src/__testes__/arquivos-obra.test.mjs
 *
 * Este arquivo existe por causa de uma tela branca em produção: a coluna
 * `arquivos` já existia no banco guardando `{}` — objeto, não lista — e
 * `{} || []` devolve o objeto. O `.forEach` derrubou o app inteiro.
 *
 * A lição não é "arquivos": é que coluna compartilhada com uma versão
 * anterior nunca chega no formato que a versão nova espera.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "App.jsx"), "utf8");
const bloco = (assinatura, fim = "\n}\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei no App.jsx: ${assinatura}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};
const linha = (assinatura) => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei no App.jsx: ${assinatura}`);
  return src.slice(i, src.indexOf("\n", i) + 1);
};

const M = eval(`(function () {
  const CADERNOS_EXECUTIVO = ${JSON.stringify([
    { chave: "criativo", titulo: "Projeto Criativo" },
    { chave: "especificacao", titulo: "Caderno de Especificação" },
    { chave: "marcenaria", titulo: "Caderno de Marcenaria" },
    { chave: "projeto", titulo: "Caderno de Projeto Executivo" },
  ])};
  ${linha("const avulsosDaObra =")}
  ${bloco("function arquivosDaObra(")}
  return { arquivosDaObra, avulsosDaObra };
})()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(58)} ${String(o).padEnd(10)} ${ok ? "" : "esperava " + e}`); };

/* ---- 1. A forma que derrubou o app ----
   `{} || []` devolve `{}`, e `{}.forEach` não existe. */
conf("objeto vazio vira lista vazia", JSON.stringify(M.avulsosDaObra({ arquivos: {} })), "[]");
conf("objeto com chaves também", JSON.stringify(M.avulsosDaObra({ arquivos: { a: 1 } })), "[]");
conf("null vira lista vazia", JSON.stringify(M.avulsosDaObra({ arquivos: null })), "[]");
conf("ausente vira lista vazia", JSON.stringify(M.avulsosDaObra({})), "[]");
conf("obra indefinida não quebra", JSON.stringify(M.avulsosDaObra(undefined)), "[]");
conf("lista de verdade passa", M.avulsosDaObra({ arquivos: [{ id: "x" }] }).length, 1);
// O que importa de verdade: a tela não pode explodir com o dado velho.
conf("a tela não quebra com o dado velho", M.arquivosDaObra({ arquivos: {} }).length, 0);

/* ---- 2. Junta as três origens num lugar só ---- */
const obra = {
  cadernos: {
    criativo: { nome: "criativo.pdf", caminho: "2256/criativo/1.pdf", tamanhoKB: 900 },
    especificacao: { nome: "espec.pdf", caminho: "2256/especificacao/1.pdf" },
    // Anexo de antes de o app guardar arquivo: só o nome ficou.
    projeto: { nome: "projeto.pdf" },
  },
  clienteAssinaturaArq: { nome: "assinado.pdf", caminho: "2256/assinatura-cliente/1.pdf" },
  arquivos: [{ id: "a1", nome: "ART.pdf", caminho: "2256/avulso/1.pdf", titulo: "ART do engenheiro" }],
};
const todos = M.arquivosDaObra(obra);
conf("cadernos, assinatura e avulso juntos", todos.length, 5);
conf("o Projeto Criativo vem primeiro", todos[0].titulo, "Projeto Criativo");
conf("caderno é fase executivo", todos[0].fase, "executivo");
conf("assinatura é fase cliente", todos.find((a) => a.id === "assinatura-cliente").fase, "cliente");
conf("avulso sem fase cai em outros", todos.find((a) => a.id === "a1").fase, "outros");
// `fixo` é o que impede apagar caderno e assinatura por esta tela: eles
// têm dono na esteira, e sumir com eles deixaria a etapa de lá mentindo.
conf("caderno é fixo", !!todos[0].fixo, true);
conf("avulso não é fixo", !!todos.find((a) => a.id === "a1").fixo, false);
conf("caderno sem arquivo não vira linha", todos.some((a) => a.id === "caderno-marcenaria"), false);
conf("obra vazia não quebra", M.arquivosDaObra({}).length, 0);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
