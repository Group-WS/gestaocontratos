/* Gravar só o que mudou — fatia 1 do ADR-004.
 *
 * Roda com: node web/src/__testes__/patch-compras.test.mjs
 *
 * O app gravava a obra INTEIRA a cada 1,2 s. Duas pessoas na mesma obra
 * gravariam o documento completo cada uma, e a última apagaria o trabalho da
 * outra em silêncio — é por isso que a trava é da obra inteira. A fatia 1
 * troca isso pelo estado de compra: canal, solicitado e comprado passam a
 * gravar "só este campo deste item".
 *
 * Três coisas aqui não podem quebrar:
 *   1. só campo de COMPRA vai por patch. Um campo de fora na mesma alteração
 *      e o salvamento inteiro tem que levar tudo junto;
 *   2. qualquer falha cai no salvamento de sempre. O pior resultado possível
 *      é gravar como antes;
 *   3. o patch vai com o código e a descrição que a tela viu, porque ele
 *      endereça o item por POSIÇÃO.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const src = fs.readFileSync(path.join(raiz, "web", "src", "App.jsx"), "utf8");
const lib = fs.readFileSync(path.join(raiz, "web", "src", "lib", "dadosObra.js"), "utf8");
const sql = fs.readFileSync(path.join(raiz, "supabase", "patch-obra.sql"), "utf8");
const bloco = (assinatura, fim = "\n}\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei no App.jsx: ${assinatura}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};
const linha = (comeco) => {
  const i = src.indexOf(comeco);
  if (i === -1) throw new Error(`não achei no App.jsx: ${comeco}`);
  return src.slice(i, src.indexOf("\n", i) + 1);
};

const M = eval(`(function () {
  ${linha("const CAMPOS_DE_COMPRA =")}
  ${bloco("function patchSoDeCompra(")}
  return { patchSoDeCompra, CAMPOS_DE_COMPRA };
})()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(58)} ${String(o).padEnd(10)} ${ok ? "" : "esperava " + e}`); };

/* ---- 1. O que vai por patch ---- */
conf("marcar comprado vai por patch", M.patchSoDeCompra({ comprado: true, compradoEm: "x" }), true);
conf("marcar solicitado vai por patch", M.patchSoDeCompra({ solicitado: true, solicitadoEm: "x" }), true);
conf("escolher canal vai por patch", M.patchSoDeCompra({ canalCompra: "sienge" }), true);
conf("desmarcar também vai", M.patchSoDeCompra({ comprado: false, compradoEm: null }), true);

/* Um campo de fora e o salvamento inteiro leva tudo: patch pela metade
   deixaria a outra alteração sem gravar, calada. */
conf("editar quantidade NÃO vai por patch", M.patchSoDeCompra({ qtdExecutivo: 5 }), false);
conf("compra mais quantidade juntas NÃO vão", M.patchSoDeCompra({ comprado: true, qtdExecutivo: 5 }), false);
conf("aprovação do cliente NÃO vai (fatia 2)", M.patchSoDeCompra({ aprovadoCliente: { em: "x" } }), false);
conf("troca NÃO vai (muda a lista)", M.patchSoDeCompra({ troca: { em: "x" } }), false);
conf("patch vazio não vai", M.patchSoDeCompra({}), false);
conf("undefined não quebra", M.patchSoDeCompra(undefined), false);
conf("a lista da fatia 1 tem 5 campos", M.CAMPOS_DE_COMPRA.size, 5);

/* ---- 2. A fila, no App ---- */
conf("o item enfileira com verba e posição", /enfileirarPatch\(\{\s*\n?\s*verba: catIdx, item: itemIdx, campos: patch,/.test(src), true);
conf("e manda o código e a descrição pra conferir",
  src.includes("confCodigo: it.codigo") && src.includes("confDesc: it.desc"), true);
conf("o que não é compra pede salvamento inteiro", src.includes("      precisaSalvarTudo();"), true);
/* A fila se descarta quando a obra muda por outro caminho: é o que faz
   nenhum dos outros 43 caminhos de gravação precisar avisar nada. */
conf("mudança de fora descarta a fila",
  /if \(nEnfileirados\.current !== nVistos\.current\) \{ nVistos\.current = nEnfileirados\.current; return; \}\s*\n\s*filaPatch\.current = null;/.test(src), true);
conf("a compra de aditivo vai por patch de mapa", src.includes('mapa: "comprasAditivo", chave: itemId'), true);

/* ---- 3. Falha sempre cai no salvamento de sempre ---- */
conf("o salvamento tenta o patch primeiro", /const p = await aplicarPatchObra\(obra\.codigo, fila\);/.test(src), true);
conf("patch recusado não é tratado como sucesso", src.includes("p?.ok && !(p.recusados && p.recusados.length)"), true);
conf("e depois dele vem o salvamento inteiro",
  src.indexOf("await aplicarPatchObra(") < src.indexOf("const r = await salvarDadosObra(obra.codigo, obra, usuario);"), true);
conf("sem a função no banco, o lib avisa em vez de estourar", lib.includes("return { semFuncao: true };"), true);
conf("e reconhece os dois códigos de erro", lib.includes('error.code === "42883"') && lib.includes('error.code === "PGRST202"'), true);

/* ---- 4. A função no banco ---- */
conf("segura a linha enquanto grava", /select categorias[\s\S]*for update/.test(sql), true);
conf("confere o código antes de escrever", sql.includes("coalesce(alvo->>'codigo', '') <> coalesce(p->>'confCodigo', '')"), true);
conf("confere a descrição antes de escrever", sql.includes("coalesce(alvo->>'desc', '')   <> coalesce(p->>'confDesc', '')"), true);
conf("recusa em vez de gravar na linha errada", sql.includes("recusados := recusados || jsonb_build_array(p)"), true);
conf("respeita a trava de outra pessoa", sql.includes("'trava de outra pessoa'"), true);
conf("renova a trava de quem está gravando", /editando_desde = now\(\)/.test(sql), true);
conf("e é liberada pra quem está logado", sql.includes("grant execute on function public.aplicar_patch_obra(text, jsonb) to authenticated"), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
