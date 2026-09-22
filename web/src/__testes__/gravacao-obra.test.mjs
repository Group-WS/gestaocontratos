/* O que a gravação da obra manda, e o que a tela diz quando o banco diz não.
 *
 * Roda com: node web/src/__testes__/gravacao-obra.test.mjs
 *
 * Três coisas não podem quebrar:
 *   1. o conteúdo que o front monta é exatamente o que a API aceita — se um
 *      lado ganha um campo e o outro não, a obra inteira para de gravar;
 *   2. cada resposta de erro vira o tipo certo: conflito NUNCA é repetido
 *      (repetir gravaria por cima de alguém), temporário é repetido sozinho;
 *   3. nenhuma mensagem manda recarregar a página antes de o dado estar
 *      gravado — recarregar é justamente o jeito de perder o que falta.
 */
import { createRequire } from "node:module";
import {
  linhaParaGravar, mesmoConteudo, erroDaResposta, ErroDeGravacao, bytesParaBase64,
  resumoDaGravacao, avisoDaGravacao, COLUNA_DO_CAMPO,
} from "../lib/gravacaoObra.js";

const require = createRequire(import.meta.url);
const { esquemas } = require("../../api/_lib/validacao.js");

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(70)} ${String(o).slice(0, 40).padEnd(12)} ${ok ? "" : "esperava " + e}`); };

/* ---------- 1. o conteúdo ---------- */
const obra = {
  id: "2519", codigo: "2519", nome: "Obra de teste", aditivos: [{ id: 1 }], totalVendido: 1000,
  categorias: [{ num: "05", itens: [{ codigo: "5.1", desc: "Spot" }] }],
  cadernos: { executivo: { nome: "caderno.pdf" } },
  arquivos: {}, // o formato antigo da coluna, que já derrubou a tela uma vez
  aprovacoes: new Set(["05|5.1"]),
  deparaAprovado: true, executivoLiberadoDireto: false, comprasLiberadas: false,
  etapasConcluidas: { criativo: { em: "2026-09-10T10:00:00Z", por: "gc@groupws.com.br" } },
  clienteAssinouEm: "2026-09-15", clienteAssinaturaPor: "gc@groupws.com.br",
  clienteAssinaturaArq: { nome: "assinado.pdf", tamanho: 1234, url: "obras/2519/assinado.pdf" },
  clienteAssinaturaObs: "", compraSemAssinaturaPor: null, compraSemAssinaturaEm: undefined, compraSemAssinaturaJust: null,
  cmvLiberado: "632000.50", cmvLiberadoEm: "2026-09-20T10:00:00.000Z", cmvLiberadoPor: "gc@groupws.com.br",
  dataEntrega: "2026-12-18", escopos: [{ id: "e1" }],
  editandoPor: "gc@groupws.com.br", atualizadoPor: "gc@groupws.com.br",
};
const linha = linhaParaGravar(obra);
const aceito = esquemas.conteudoDaObra.safeParse(linha);
conf("o conteúdo que o front monta é o que a API aceita", aceito.success, true);
if (!aceito.success) console.log(aceito.error.issues);
conf("... com as mesmas colunas, nem uma a mais", Object.keys(linha).sort().join(","),
  Object.keys(esquemas.conteudoDaObra.shape).sort().join(","));
conf("... e uma coluna para cada campo da tela", Object.values(COLUNA_DO_CAMPO).sort().join(","), Object.keys(linha).sort().join(","));
conf("a obra mínima (recém-criada) também passa",
  esquemas.conteudoDaObra.safeParse(linhaParaGravar({ categorias: [] })).success, true);
conf("arquivos no formato antigo ({}) viram lista", Array.isArray(linha.arquivos), true);
conf("as aprovações (Set) viram lista", JSON.stringify(linha.aprovacoes), '["05|5.1"]');
conf("o CMV em texto vira número", linha.cmv_liberado, 632000.5);
conf("CMV zero continua zero", linhaParaGravar({ cmvLiberado: 0 }).cmv_liberado, 0);
conf("texto vazio vira nulo", linha.cliente_assinatura_obs, null);
conf("a trava não vai no conteúdo (quem grava é o login)", "editando_por" in linha || "editandoPor" in linha, false);
conf("... nem o carimbo de quem gravou", "atualizado_por" in linha, false);

/* ---------- 2. o que é mudança ---------- */
conf("a mesma obra é o mesmo conteúdo", mesmoConteudo(obra, obra), true);
conf("chegar aditivo não é alteração de ninguém", mesmoConteudo(obra, { ...obra, aditivos: [] }), true);
conf("refazer os totais também não", mesmoConteudo(obra, { ...obra, totalVendido: 2000 }), true);
conf("mexer num item é", mesmoConteudo(obra, { ...obra, categorias: [...obra.categorias] }), false);
conf("mudar a data de entrega é", mesmoConteudo(obra, { ...obra, dataEntrega: "2027-01-10" }), false);
conf("sem a obra anterior, não dá para dizer que é igual", mesmoConteudo(null, obra), false);

/* ---------- 3. o erro certo para cada resposta ---------- */
const versao = erroDaResposta(409, { error: "A obra foi alterada depois que esta tela a leu.", motivo: "versao", versao: 9, atualizadoPor: "admin@groupws.com.br" });
conf("409 é conflito — nunca repetido", versao.tipo, "conflito");
conf("... é um ErroDeGravacao", versao instanceof ErroDeGravacao, true);
conf("... com o motivo, a versão e quem alterou", `${versao.detalhe.motivo}|${versao.detalhe.versao}|${versao.detalhe.atualizadoPor}`, "versao|9|admin@groupws.com.br");
conf("409 de trava diz com quem está", erroDaResposta(409, { motivo: "trava", por: "ana@x" }).detalhe.por, "ana@x");
conf("503 (banco sem a função) é temporário", erroDaResposta(503, {}).tipo, "temporario");
conf("500 é temporário", erroDaResposta(500, {}).tipo, "temporario");
conf("sem resposta (rede) é temporário", erroDaResposta(0, null).tipo, "temporario");
conf("sessão renovando (401) é temporário", erroDaResposta(401, {}).tipo, "temporario");
conf("RN-001 (403) é recusado", erroDaResposta(403, { error: "RN-001: só o administrador libera a compra." }).tipo, "recusado");
conf("... com a mensagem da regra", erroDaResposta(403, { error: "RN-001: só o administrador libera a compra." }).message, "RN-001: só o administrador libera a compra.");
conf("formato (400) é recusado", erroDaResposta(400, {}).tipo, "recusado");
conf("grande demais (413) é recusado", erroDaResposta(413, {}).tipo, "recusado");

/* ---------- 4. base64 do gzip ---------- */
const bytes = new Uint8Array(200_000).map((_, i) => (i * 7) % 256);
conf("bytes viram base64 e voltam iguais (sem estourar a pilha)",
  Buffer.from(bytesParaBase64(bytes), "base64").equals(Buffer.from(bytes)), true);

/* ---------- 5. o que a tela diz ---------- */
const agora = Date.parse("2026-09-22T12:00:00Z");
conf("pendente", resumoDaGravacao({ estado: "pendente" })?.texto, "alterações por gravar…");
conf("salvando", resumoDaGravacao({ estado: "salvando" })?.texto, "salvando…");
conf("salvo", resumoDaGravacao({ estado: "salvo", em: agora })?.texto, "salvo");
conf("recém-aberta (nada gravado nesta tela) não diz nada", resumoDaGravacao({ estado: "salvo", em: null }), null);
conf("erro mostra a contagem até a próxima tentativa",
  resumoDaGravacao({ estado: "erro", proximaEm: agora + 7400 }, agora)?.texto, "não salvo — nova tentativa em 8 s");
conf("... em tom de aviso", resumoDaGravacao({ estado: "erro", proximaEm: agora + 7400 }, agora)?.tom, "warning");
conf("conflito é perigo", resumoDaGravacao({ estado: "conflito" })?.tom, "danger");

const avisoVersao = avisoDaGravacao({ estado: "conflito", erro: versao }, { obra: "2519", agora });
conf("o aviso do conflito diz quem alterou", /admin@groupws\.com\.br/.test(avisoVersao.descricao), true);
conf("... que nada foi gravado por cima", /nada desta tela foi gravado por cima/.test(avisoVersao.descricao), true);
conf("... e a saída é recarregar a obra", avisoVersao.acao, "recarregar");
const avisoTrava = avisoDaGravacao({ estado: "conflito", erro: erroDaResposta(409, { motivo: "trava", por: "ana@groupws.com.br" }) }, { obra: "2519" });
conf("o aviso da trava diz com quem está a edição", /ana@groupws\.com\.br está com a edição/.test(avisoTrava.descricao), true);
const avisoVazia = avisoDaGravacao({ estado: "conflito", erro: erroDaResposta(409, { motivo: "vazia" }) }, { obra: "2519" });
conf("o aviso da obra vazia explica o porquê", /apagaria o trabalho de todo mundo/.test(avisoVazia.descricao), true);
const avisoErro = avisoDaGravacao({ estado: "erro", erro: erroDaResposta(0), proximaEm: agora + 5000 }, { obra: "2519", agora });
conf("o aviso da falha temporária pede para manter a aba aberta", /Mantenha esta aba aberta/.test(avisoErro.descricao), true);
conf("... e oferece tentar agora", avisoErro.acao, "tentar");
const avisoRecusa = avisoDaGravacao({ estado: "recusado", erro: erroDaResposta(403, { error: "RN-001: só o administrador libera a compra." }) }, { obra: "2519" });
conf("o aviso da recusa traz a mensagem do servidor", /RN-001/.test(avisoRecusa.descricao), true);
conf("salvo não tem aviso", avisoDaGravacao({ estado: "salvo", em: agora }), null);

const todas = [avisoVersao, avisoTrava, avisoVazia, avisoErro, avisoRecusa]
  .flatMap((a) => [a.titulo, a.descricao])
  .concat(["pendente", "salvando", "erro", "recusado", "conflito"].map((estado) => resumoDaGravacao({ estado, proximaEm: agora }, agora)?.texto || ""));
conf("nenhuma mensagem manda dar F5 ou recarregar a página",
  todas.some((t) => /F5|recarregue a página|recarregar a página/i.test(t)), false);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
