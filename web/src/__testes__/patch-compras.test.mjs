/* Gravar só o que mudou — fatias 1 e 2 do ADR-004.
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
  ${src.slice(src.indexOf("const CAMPOS_POR_PATCH ="), src.indexOf("]);", src.indexOf("const CAMPOS_POR_PATCH =")) + 3)}
  ${bloco("function podeIrPorPatch(")}
  return { podeIrPorPatch, CAMPOS_POR_PATCH };
})()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(58)} ${String(o).padEnd(10)} ${ok ? "" : "esperava " + e}`); };

/* ---- 1. O que vai por patch ---- */
conf("marcar comprado vai por patch", M.podeIrPorPatch({ comprado: true, compradoEm: "x" }), true);
conf("marcar solicitado vai por patch", M.podeIrPorPatch({ solicitado: true, solicitadoEm: "x" }), true);
conf("escolher canal vai por patch", M.podeIrPorPatch({ canalCompra: "sienge" }), true);
conf("desmarcar também vai", M.podeIrPorPatch({ comprado: false, compradoEm: null }), true);

/* Um campo de fora e o salvamento inteiro leva tudo: patch pela metade
   deixaria a outra alteração sem gravar, calada. */
conf("editar quantidade NÃO vai por patch", M.podeIrPorPatch({ qtdExecutivo: 5 }), false);
conf("compra mais quantidade juntas NÃO vão", M.podeIrPorPatch({ comprado: true, qtdExecutivo: 5 }), false);
/* Fatia 2: aprovações e liberações item a item. Carimbo inteiro, gravado ou
   apagado de uma vez. */
conf("aprovação do cliente vai por patch", M.podeIrPorPatch({ aprovadoCliente: { em: "x", por: "y" } }), true);
conf("liberar para compra vai por patch", M.podeIrPorPatch({ liberadoCompra: { em: "x", por: "y" } }), true);
conf("desfazer a liberação também vai", M.podeIrPorPatch({ liberadoCompra: null }), true);
conf("conferir o alerta vai por patch", M.podeIrPorPatch({ alertaConferido: { em: "x", por: "y" } }), true);
conf("liberar sem cliente vai por patch", M.podeIrPorPatch({ liberadoSemCliente: { em: "x" }, liberadoCompra: { em: "x" } }), true);
conf("troca NÃO vai (muda a lista)", M.podeIrPorPatch({ troca: { em: "x" } }), false);
conf("patch vazio não vai", M.podeIrPorPatch({}), false);
conf("undefined não quebra", M.podeIrPorPatch(undefined), false);
conf("a lista tem os 5 da fatia 1 e os 4 da fatia 2", M.CAMPOS_POR_PATCH.size, 9);
/* O que NÃO migrou ainda, de propósito. Se algum destes entrar sem a fatia
   dele, este teste cai — e é pra cair. */
["qtdExecutivo", "custo", "desc", "troca", "excluido", "alocacaoManual"].forEach((c) => {
  conf(`${c} continua fora do patch`, M.CAMPOS_POR_PATCH.has(c), false);
});

/* ---- 2. A fila, no App ---- */
conf("mudar um item enfileira pelo mesmo caminho das ações em massa",
  src.includes("if (podeIrPorPatch(patch)) enfileirarEmVarios([{ catIdx, itemIdx }], patch);"), true);
conf("e manda o código e a descrição pra conferir",
  src.includes("confCodigo: it.codigo") && src.includes("confDesc: it.desc"), true);
conf("campo fora da lista pede salvamento inteiro",
  src.includes("else precisaSalvarTudo();"), true);
conf("o patch leva a posição da verba e do item",
  src.includes("verba: catIdx, item: itemIdx, campos,"), true);
/* A fila se descarta quando a obra muda por outro caminho: é o que faz
   nenhum dos outros 43 caminhos de gravação precisar avisar nada. */
conf("mudança de fora descarta a fila",
  /if \(nEnfileirados\.current !== nVistos\.current\) \{ nVistos\.current = nEnfileirados\.current; return; \}\s*\n\s*filaPatch\.current = null;/.test(src), true);
conf("a compra de aditivo vai por patch de mapa", src.includes('mapa: "comprasAditivo", chave: itemId'), true);

/* Liberar ou aprovar uma verba inteira são dezenas de linhas: cada uma vira
   um patch, pelo mesmo enfileirador. */
conf("liberar para compra enfileira item a item", src.includes("enfileirarEmVarios(alvos, { liberadoCompra: carimbo })"), true);
conf("aprovar pelo cliente enfileira item a item", src.includes("enfileirarEmVarios(alvos, { aprovadoCliente: carimbo })"), true);
conf("o enfileirador em massa também confere código e descrição",
  /const enfileirarEmVarios = \(alvos, campos\) => \{[\s\S]*confCodigo: it\.codigo[\s\S]*confDesc: it\.desc/.test(src), true);

/* ---- 2b. As marcas da OBRA (fatia 2) ----
   Etapas, assinatura do cliente e aprovação da linha não moram dentro dos
   itens: são colunas próprias. O app fala em camelo, o banco em underline, e
   as duas listas são fechadas. */
const mapa = eval("(" + src.slice(src.indexOf("const COLUNA_DA_MARCA = {") + "const COLUNA_DA_MARCA = ".length,
  src.indexOf("};", src.indexOf("const COLUNA_DA_MARCA = {")) + 1) + ")");
conf("a aprovação da linha tem coluna", mapa.aprovacoes, "aprovacoes");
conf("as etapas concluídas têm coluna", mapa.etapasConcluidas, "etapas_concluidas");
conf("a assinatura do cliente tem as quatro",
  [mapa.clienteAssinouEm, mapa.clienteAssinaturaPor, mapa.clienteAssinaturaObs, mapa.clienteAssinaturaArq].join(","),
  "cliente_assinou_em,cliente_assinatura_por,cliente_assinatura_obs,cliente_assinatura_arq");
conf("compras liberadas tem coluna", mapa.comprasLiberadas, "compras_liberadas");
/* Toda coluna que o app manda precisa estar na lista da função, senão ela
   recusa e o app grava a obra inteira à toa. */
const listaDoBanco = sql.slice(sql.indexOf("if col in ("), sql.indexOf(") then", sql.indexOf("if col in (")));
Object.values(mapa).forEach((col) => {
  conf(`a função no banco aceita ${col}`, listaDoBanco.includes(`'${col}'`), true);
});
conf("marca desconhecida cai no salvamento inteiro",
  /if \(!chaves\.length \|\| !chaves\.every\(\(k\) => COLUNA_DA_MARCA\[k\]\)\) \{ precisaSalvarTudo\(\); return; \}/.test(src), true);

/* Aprovar em massa são dezenas de chamadas no mesmo instante, e a tela só
   atualiza depois: sem olhar a fila, cada uma partiria do estado velho e só
   a última valeria. */
conf("aprovar linha parte do que já está na fila",
  src.includes('new Set(valorNaFila("aprovacoes", Array.from(obra?.aprovacoes || [])))'), true);
conf("concluir etapa também", src.includes('valorNaFila("etapas_concluidas", obra.etapasConcluidas)'), true);
conf("e só enfileira o que a tela aceitou", src.includes("if (obra && !bloqueioDaEtapa(id, obra)) {"), true);
conf("assinatura registra as quatro colunas de uma vez",
  /enfileirarMarcas\(\{\s*\n\s*clienteAssinouEm: data, clienteAssinaturaPor: usuario,/.test(src), true);
conf("e removê-la apaga as quatro", /clienteAssinouEm: null, clienteAssinaturaPor: null,/.test(src), true);
conf("reabrir compras vai por patch", src.includes("enfileirarMarcas({ comprasLiberadas: false })"), true);
/* `liberarCompras` reescreve `categorias` junto, então continua no
   salvamento inteiro — patch só do campo deixaria o resto para trás. */
conf("liberar compras NÃO vai por patch",
  src.slice(src.indexOf("function liberarCompras("), src.indexOf("function reabrirCompras(")).includes("enfileirarMarcas"), false);

/* ---- 3. Falha sempre cai no salvamento de sempre ---- */
conf("o salvamento tenta o patch primeiro", /const p = await aplicarPatchObra\(obra\.codigo, fila\);/.test(src), true);
conf("patch recusado não é tratado como sucesso", src.includes("p?.ok && !(p.recusados && p.recusados.length)"), true);
conf("e depois dele vem o salvamento inteiro",
  src.indexOf("await aplicarPatchObra(") < src.indexOf("const r = await salvarDadosObra(obra.codigo, obra, usuario);"), true);
conf("sem a função no banco, o lib avisa em vez de estourar", lib.includes("return { semFuncao: true };"), true);
conf("e reconhece os dois códigos de erro", lib.includes('error.code === "42883"') && lib.includes('error.code === "PGRST202"'), true);

/* ---- 4. A função no banco ---- */
conf("aprende a gravar coluna", sql.includes("elsif p ? 'coluna' then"), true);
conf("com lista fechada de colunas", /if col in \('aprovacoes'/.test(sql), true);
conf("cada marca só é escrita se veio na chamada", /case when marcas \? 'etapas_concluidas' then/.test(sql), true);
conf("e a função continua com a mesma assinatura",
  sql.includes("create or replace function public.aplicar_patch_obra(p_codigo text, p_patches jsonb)"), true);
conf("segura a linha enquanto grava", /select categorias[\s\S]*for update/.test(sql), true);
conf("confere o código antes de escrever", sql.includes("coalesce(alvo->>'codigo', '') <> coalesce(p->>'confCodigo', '')"), true);
conf("confere a descrição antes de escrever", sql.includes("coalesce(alvo->>'desc', '')   <> coalesce(p->>'confDesc', '')"), true);
conf("recusa em vez de gravar na linha errada", sql.includes("recusados := recusados || jsonb_build_array(p)"), true);
conf("respeita a trava de outra pessoa", sql.includes("'trava de outra pessoa'"), true);
conf("renova a trava de quem está gravando", /editando_desde = now\(\)/.test(sql), true);
conf("e é liberada pra quem está logado", sql.includes("grant execute on function public.aplicar_patch_obra(text, jsonb) to authenticated"), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
