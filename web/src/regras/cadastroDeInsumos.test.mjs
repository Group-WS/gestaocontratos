/* RN-086 a RN-089 · Cadastro de Insumos.
 *
 * Roda com: node web/src/regras/cadastroDeInsumos.test.mjs
 *
 * Os exemplos das fichas (docs/regras-de-negocio/RN-086 a RN-089), um por
 * um, mais os limites: pessoa desativada, sem perfil, solicitação sem
 * número, texto com espaço sobrando, unidade com caixa e espaço.
 */
import {
  podeManterCadastroDeInsumos, STATUS_QUE_CONTAM_COMO_ENVIADA, itensEnviadosAoSienge,
  usosDoInsumo, podeApagarInsumo, conferirTabela, tabelaPermiteImportar, unidadeEmVb, entraNoCadastro,
} from "./cadastroDeInsumos.js";

let falhas = 0;
const conf = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome.padEnd(78)} ${ok ? "" : `obtido ${JSON.stringify(obtido)} · esperado ${JSON.stringify(esperado)}`}`);
};

// ---------- RN-086 · quem mantém o cadastro ----------
conf("RN-086 · administrador mantém", podeManterCadastroDeInsumos({ perfil: "admin", ativo: true }), true);
conf("RN-086 · master mantém", podeManterCadastroDeInsumos({ perfil: "master", ativo: true }), true);
conf("RN-086 · geral não mantém", podeManterCadastroDeInsumos({ perfil: "geral", ativo: true }), false);
conf("RN-086 · GC não mantém", podeManterCadastroDeInsumos({ perfil: "gc", ativo: true }), false);
conf("RN-086 · Mehoo não mantém", podeManterCadastroDeInsumos({ perfil: "mehoo", ativo: true }), false);
conf("RN-086 · administrador desativado não mantém", podeManterCadastroDeInsumos({ perfil: "admin", ativo: false }), false);
conf("RN-086 · quem está na fila (sem perfil) não mantém", podeManterCadastroDeInsumos({ perfil: null, ativo: true }), false);
conf("RN-086 · sem pessoa, não", podeManterCadastroDeInsumos(null), false);

// ---------- RN-087 · em uso no Sienge ----------
const solicitacao = (status, itens, extra = {}) => ({
  status, obra_codigo: "2450", solicitacao_id: 23488, enviado_em: "2026-09-20T14:00:00Z", payload: { itens }, ...extra,
});
const EIFFEL = "MOBILIA SOLTA - CADEIRA / TOK STOK / CADEIRA EIFFEL BRANCA";
const enviados = itensEnviadosAoSienge([
  solicitacao("concluido", [{ productId: 406, notes: EIFFEL }]),
  solicitacao("parcial", [{ productId: 275, notes: "AR CONDICIONADO / LG / SPLIT 9.000 BTUS" }]),
  solicitacao("falhou", [{ productId: 3065, notes: "PENDENTE BELMONTE" }]),
  solicitacao("abandonado", [{ productId: 3066, notes: "PENDENTE X" }]),
  solicitacao("enviando", [{ productId: 3067, notes: "PENDENTE Y" }]),
]);

conf("RN-087 · só concluída e parcial contam", STATUS_QUE_CONTAM_COMO_ENVIADA, ["concluido", "parcial"]);
conf("RN-087 · os itens enviados vêm da concluída e da parcial", enviados.map((i) => i.codigo), ["406", "275"]);
conf("RN-087 · o código vira texto, igual ao cadastro", typeof enviados[0].codigo, "string");
conf("RN-087 · o item leva de onde veio (obra e número)", [enviados[0].obraCodigo, enviados[0].solicitacaoId], ["2450", 23488]);

conf("RN-087 · mesmo código e mesmo texto está em uso",
  podeApagarInsumo({ codigo: "406", descricao: EIFFEL }, enviados), false);
conf("RN-087 · mesmo código, outro texto, pode apagar",
  podeApagarInsumo({ codigo: "406", descricao: "MOBILIA SOLTA - CADEIRA / ETEL / CADEIRA PAULISTANO" }, enviados), true);
conf("RN-087 · o nome puro da mãe não fica preso pela variante",
  podeApagarInsumo({ codigo: "406", descricao: "MOBILIA SOLTA - CADEIRA" }, enviados), true);
conf("RN-087 · texto com um espaço a mais é outro texto",
  podeApagarInsumo({ codigo: "406", descricao: `${EIFFEL} ` }, enviados), true);
conf("RN-087 · pedido que falhou não prende o insumo",
  podeApagarInsumo({ codigo: "3065", descricao: "PENDENTE BELMONTE" }, enviados), true);
conf("RN-087 · pedido abandonado não prende", podeApagarInsumo({ codigo: "3066", descricao: "PENDENTE X" }, enviados), true);
conf("RN-087 · pedido ainda sem resposta não prende", podeApagarInsumo({ codigo: "3067", descricao: "PENDENTE Y" }, enviados), true);
conf("RN-087 · os usos dizem onde foi pedido",
  usosDoInsumo({ codigo: "406", descricao: EIFFEL }, enviados).map((u) => `${u.obraCodigo}/${u.solicitacaoId}`), ["2450/23488"]);
conf("RN-087 · código numérico no cadastro também casa",
  podeApagarInsumo({ codigo: 275, descricao: "AR CONDICIONADO / LG / SPLIT 9.000 BTUS" }, enviados), false);
conf("RN-087 · solicitação sem itens não quebra", itensEnviadosAoSienge([solicitacao("concluido", undefined)]), []);
conf("RN-087 · item sem productId é ignorado",
  itensEnviadosAoSienge([solicitacao("concluido", [{ notes: "sem código" }])]), []);
conf("RN-087 · lista vazia, nada em uso", podeApagarInsumo({ codigo: "1", descricao: "X" }, []), true);

// ---------- RN-088 · tabela ativa ----------
const ATIVA = { codigo: "1", nome: "TABELA WS BUILDING" };
conf("RN-088 · mesmo código e nome confere", conferirTabela({ codigo: "1", nome: "TABELA WS BUILDING" }, ATIVA), "confere");
conf("RN-088 · caixa e espaço sobrando no nome não contam",
  conferirTabela({ codigo: " 1 ", nome: "tabela  ws building " }, ATIVA), "confere");
conf("RN-088 · mesmo código, nome novo: pede confirmação",
  conferirTabela({ codigo: "1", nome: "TABELA WS BUILDING 2026" }, ATIVA), "so_o_nome_mudou");
conf("RN-088 · outro código é outra tabela", conferirTabela({ codigo: "2", nome: "TABELA WS BUILDING" }, ATIVA), "outra");
conf("RN-088 · relatório sem tabela", conferirTabela({ codigo: "", nome: "" }, ATIVA), "sem_tabela");
conf("RN-088 · sem tabela ativa configurada", conferirTabela({ codigo: "1", nome: "X" }, null), "sem_tabela");
conf("RN-088 · confere segue", tabelaPermiteImportar("confere"), true);
conf("RN-088 · nome mudou sem confirmar, não segue", tabelaPermiteImportar("so_o_nome_mudou"), false);
conf("RN-088 · nome mudou e o admin confirmou, segue", tabelaPermiteImportar("so_o_nome_mudou", { confirmouNome: true }), true);
conf("RN-088 · outra tabela nunca segue", tabelaPermiteImportar("outra", { confirmouNome: true }), false);
conf("RN-088 · sem tabela nunca segue", tabelaPermiteImportar("sem_tabela", { confirmouNome: true }), false);

// ---------- RN-089 · vb fica fora ----------
conf("RN-089 · IPTU em vb fica fora", entraNoCadastro({ codigo: "5", descricao: "IPTU", unidade: "vb" }), false);
conf("RN-089 · VB em maiúsculas e com espaço também", unidadeEmVb(" VB "), true);
conf("RN-089 · un entra", entraNoCadastro({ codigo: "406", descricao: "CADEIRA", unidade: "un" }), true);
conf("RN-089 · m2 entra", entraNoCadastro({ codigo: "12", descricao: "PISO", unidade: "m2" }), true);
conf("RN-089 · 'vbx' não é vb", unidadeEmVb("vbx"), false);
conf("RN-089 · sem linha, não entra", entraNoCadastro(null), false);

console.log(falhas === 0 ? "\nOK — RN-086 a RN-089 conforme as fichas" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
