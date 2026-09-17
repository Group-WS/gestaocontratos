/* Quem pode excluir um aditivo.
 *
 * Roda com: node web/src/__testes__/aditivo-exclusao.test.mjs
 *
 * Pedido dela em 17/09/2026: "só pode excluir o aditivo o criador do aditivo
 * ou um administrador."
 *
 * Aditivo é documento que vai pro cliente e mexe no dinheiro da obra, e
 * excluir não tem desfazer nem lixeira. Por isso a regra existe em dois
 * lugares, e os dois são conferidos aqui: a tela (botão e função) e o banco
 * (política de acesso). Só a tela não protege nada — a chamada ao banco não
 * passa pela tela.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const src = fs.readFileSync(path.join(raiz, "web", "src", "App.jsx"), "utf8");
const bloco = (assinatura, fim = "\n}\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei no App.jsx: ${assinatura}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};

const M = eval(`(function () {
  ${bloco("function podeExcluirAditivo(")}
  return { podeExcluirAditivo };
})()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(58)} ${String(o).padEnd(10)} ${ok ? "" : "esperava " + e}`); };

const meu = { numero: "2450/1", criadoPor: "loiana.zoboli@groupws.com.br" };
const eu = "loiana.zoboli@groupws.com.br";
const outra = "barbara.franco@groupws.com.br";

/* ---- 1. A regra ---- */
conf("quem criou pode excluir", M.podeExcluirAditivo(meu, eu, false), true);
conf("quem não criou, não pode", M.podeExcluirAditivo(meu, outra, false), false);
conf("administrador pode, mesmo sem ter criado", M.podeExcluirAditivo(meu, outra, true), true);

/* ---- 2. O e-mail casa sem caixa e sem espaço ---- */
conf("maiúscula não atrapalha", M.podeExcluirAditivo({ criadoPor: "Loiana.Zoboli@GroupWS.com.br" }, eu, false), true);
conf("espaço em volta não atrapalha", M.podeExcluirAditivo({ criadoPor: ` ${eu} ` }, eu, false), true);

/* ---- 3. Sem criador gravado, só administrador ----
   Aditivo antigo não tem `criado_por`. Se a comparação de dois vazios
   passasse, qualquer pessoa apagaria justamente os mais antigos. */
conf("aditivo sem criador: ninguém apaga", M.podeExcluirAditivo({ numero: "1" }, eu, false), false);
conf("aditivo sem criador: administrador apaga", M.podeExcluirAditivo({ numero: "1" }, eu, true), true);
conf("sem usuário identificado, não apaga", M.podeExcluirAditivo(meu, null, false), false);
conf("dois vazios não são a mesma pessoa", M.podeExcluirAditivo({ criadoPor: "" }, "", false), false);
conf("aditivo undefined não quebra", M.podeExcluirAditivo(undefined, eu, false), false);

/* ---- 4. A tela ---- */
conf("o botão só age quando pode", src.includes("onClick={podeApagar ? onExcluir : undefined}"), true);
conf("o botão aparece desabilitado, com o motivo", src.includes("disabled={!podeApagar}"), true);
conf("a função de excluir também confere", /if \(!podeExcluirAditivo\(a, usuario, souAdmin\)\) \{/.test(src), true);
conf("o App entrega quem é administrador", /<AditivosView [^>]*souAdmin=\{souAdmin\}/.test(src), true);

/* ---- 5. O banco ----
   Sem a política, o botão desabilitado é decoração: uma chamada direta à API
   apagaria o aditivo de qualquer um. */
const sql = fs.readFileSync(path.join(raiz, "supabase", "aditivo-exclusao.sql"), "utf8");
conf("o SQL cria a política de exclusão", sql.includes('create policy "aditivo: excluir (criador ou admin)" on aditivo'), true);
conf("e ela é só pra excluir", /for delete to authenticated/.test(sql), true);
conf("compara o criador com quem chamou", sql.includes(`lower(criado_por) = lower(auth.jwt() ->> 'email')`), true);
conf("e aceita o administrador", sql.includes("public.admin_do_time()"), true);
conf("a política que liberava tudo é removida", sql.includes(`drop policy if exists "acesso time (autenticados)" on aditivo`), true);
conf("ler, criar e alterar continuam existindo",
  ["aditivo: ler", "aditivo: criar", "aditivo: alterar"].every((p) => sql.includes(p)), true);

/* O rls-perfis.sql ainda não rodou. Se ele voltasse a criar uma política
   "for all" na tabela, reabriria a exclusão pra todo mundo. */
const perfis = fs.readFileSync(path.join(raiz, "supabase", "rls-perfis.sql"), "utf8");
const trechoAditivo = perfis.slice(perfis.indexOf("---------- aditivo ----------"), perfis.indexOf("---------- tabelas de referencia"));
conf("o rls-perfis não usa 'for all' no aditivo", /on aditivo for all/.test(trechoAditivo), false);
conf("e mantém a regra de exclusão", trechoAditivo.includes('"aditivo: excluir (criador ou admin)"'), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
