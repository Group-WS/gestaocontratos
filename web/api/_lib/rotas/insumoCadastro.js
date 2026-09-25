/**
 * Cadastro de Insumos — Configuracoes, so' administrador (ADR-008).
 * -----------------------------------------------------------
 * GET    /api/insumo-cadastro                         ?busca&ativo&unidade&de&passo -> { itens, total }
 * GET    /api/insumo-cadastro/unidades                -> [unidade]
 * GET    /api/insumo-cadastro/tabela-ativa            -> { codigo, nome, atualizado_em, atualizado_por }
 * PUT    /api/insumo-cadastro/tabela-ativa            { codigo, nome }
 * GET    /api/insumo-cadastro/importacoes             -> [as importacoes recentes]
 * POST   /api/insumo-cadastro/importacoes             { nome } -> { id, assinatura }
 * POST   /api/insumo-cadastro/importacoes/:id/previa  -> { resumo, listas }
 * POST   /api/insumo-cadastro/importacoes/:id/aplicar { caminho, conflitos, confirmouNome } -> { status, ... }
 * POST   /api/insumo-cadastro                         { codigo, descricao, unidade } -> o insumo
 * PATCH  /api/insumo-cadastro/:id                     { codigo?, descricao?, unidade?, ativo? } -> o insumo
 * GET    /api/insumo-cadastro/:id/usos                -> { usos } (RN-087: onde foi pedido ao Sienge)
 * GET    /api/insumo-cadastro/:id/historico           -> [mudancas]
 * DELETE /api/insumo-cadastro/:id                     -> { ok } | 409 { usos }
 *
 * O time le o cadastro e a tabela ativa; o resto e' do administrador
 * (RN-086). A rota orquestra: valida -> confere quem e' (RN-086) -> chama
 * as regras (web/src/regras/cadastroDeInsumos.js) e o leitor do relatorio
 * (web/src/lib/relatorioDeInsumos.js) -> grava com o client do usuario
 * (RLS) -> responde. O banco repete as garantias (supabase/insumo-cadastro.sql).
 *
 * A importacao, em tres passos:
 *   1. a tela pede um endereco assinado e sobe o xlsx direto para o balde
 *      `insumo-importacao` (a funcao da Vercel para em 4,5 MB);
 *   2. a PREVIA le o arquivo DO BALDE, confere o modelo e a tabela ativa
 *      (RN-088), tira o "vb" (RN-089) e monta o plano contra o cadastro de
 *      hoje — nada e' gravado;
 *   3. o APLICAR refaz o plano (o cadastro pode ter mudado), grava em blocos
 *      (cada bloco numa transacao, pela funcao `insumo_cadastro_gravar`) e,
 *      no caminho "apagar", apaga por ultimo. Cada chamada trabalha por
 *      alguns segundos e devolve o progresso; a tela chama de novo ate'
 *      terminar. Se falhar no meio, fica o que entrou e a importacao fica
 *      "incompleta": o "continuar" e' so' chamar o aplicar de novo — o plano
 *      refeito reconhece o que ja' entrou.
 */

const express = require("express");
const XLSX = require("xlsx");
const { exigirLogin, exigirMembro, pessoaDoPedido } = require("../auth.js");
const { zValidator, z } = require("../validacao.js");
const { erroDoBanco } = require("../erroDoBanco.js");
const { assinarEnvio, erroDoStorage } = require("../storage.js");
const { filtroDeBusca } = require("./insumos.js");

const BALDE = "insumo-importacao";
// Os arquivos guardados: so' os 12 ultimos (item 8 da ADR-008).
const ARQUIVOS_GUARDADOS = 12;
const LIMITE_DO_ARQUIVO = 10 * 1024 * 1024;
// Teto de linhas lidas do xlsx: o relatorio de hoje tem 14.398; o teto impede
// um arquivo feito para ocupar a funcao.
const LINHAS_MAX = 60000;
const TAMANHO_DO_BLOCO = 500;
// Quanto cada chamada do "aplicar" trabalha antes de devolver o progresso.
const ORCAMENTO_MS = 8000;

/* As regras e o leitor sao ES Modules (web/src); esta API e' CommonJS. */
let moduloDasRegras;
let moduloDoRelatorio;
const regras = () => (moduloDasRegras ||= import("../../../src/regras/cadastroDeInsumos.js"));
const relatorio = () => (moduloDoRelatorio ||= import("../../../src/lib/relatorioDeInsumos.js"));

const COLUNAS = "id, codigo, descricao, unidade, ativo, origem, sienge_codigo, sienge_descricao, sienge_unidade, atualizado_em, atualizado_por";
const COLUNAS_DO_PLANO = "id, codigo, descricao, unidade, ativo, origem, sienge_codigo, sienge_descricao, sienge_unidade";
const COLUNAS_DA_IMPORTACAO = "id, arquivo_nome, arquivo_caminho, tabela_codigo, tabela_nome, relatorio_gerado_em, caminho, conflitos, confirmou_nome, status, resumo, gravadas, apagados, por, criado_em, concluida_em";

/* A tabela ainda nao existe (o SQL nao rodou): a tela avisa em vez de quebrar. */
const faltaTabela = (e) => !!e && (e.code === "42P01" || e.code === "PGRST205");
const AVISO_SEM_SQL = "O Cadastro de Insumos ainda não existe no banco: falta rodar o supabase/insumo-cadastro.sql.";

/* O balde que falta tambem e' deste SQL — nao do arquivos.sql, que o erro
   generico do Storage cita. */
function erroDoBalde(res, error) {
  if (/bucket not found/i.test(String(error?.message || ""))) return res.status(503).json({ error: AVISO_SEM_SQL });
  return erroDoStorage(res, error);
}

const rotas = express.Router();
rotas.use(exigirLogin, exigirMembro);

/** RN-086 — so' quem mantem o cadastro passa. O banco repete a regra (RLS). */
async function exigirQuemMantemOCadastro(req, res, next) {
  const { podeManterCadastroDeInsumos } = await regras();
  if (podeManterCadastroDeInsumos(await pessoaDoPedido(req))) return next();
  res.status(403).json({ error: "RN-086: só o administrador mantém o cadastro de insumos." });
}

/** Marca o que foi editado na tela depois de vir do Sienge (a tela mostra). */
function paraATela(r) {
  const editado = r.origem === "sienge" && (
    r.codigo !== r.sienge_codigo || r.descricao !== r.sienge_descricao || r.unidade !== r.sienge_unidade);
  return {
    id: r.id, codigo: r.codigo, descricao: r.descricao, unidade: r.unidade, ativo: r.ativo,
    origem: r.origem, editado, atualizadoEm: r.atualizado_em, atualizadoPor: r.atualizado_por,
  };
}

/* ---------- o que pode chegar de fora (VH-06) ---------- */

const PASSOS = [20, 50, 100];
const queryLista = z.object({
  busca: z.string().trim().max(200).optional(),
  ativo: z.enum(["todos", "sim", "nao"]).default("todos"),
  unidade: z.string().trim().max(20).optional(),
  de: z.coerce.number().int().min(0).max(1_000_000).default(0),
  passo: z.coerce.number().int().refine((n) => PASSOS.includes(n)).default(50),
}).strict();

const codigoDoInsumo = z.string().trim().regex(/^\d{1,10}$/);
// Na tela, o texto e' digitado: as pontas saem. O do relatorio fica como veio.
const descricaoDoInsumo = z.string().trim().min(1).max(1000);
const unidadeDoInsumo = z.string().trim().min(1).max(20);

const corpoDoInsumo = z.object({
  codigo: codigoDoInsumo,
  descricao: descricaoDoInsumo,
  unidade: unidadeDoInsumo,
}).strict();

const corpoDaEdicao = z.object({
  codigo: codigoDoInsumo.optional(),
  descricao: descricaoDoInsumo.optional(),
  unidade: unidadeDoInsumo.optional(),
  ativo: z.boolean().optional(),
}).strict().refine((c) => Object.keys(c).length > 0);

const paramId = z.object({ id: z.coerce.number().int().positive() }).strict();

const corpoDaTabela = z.object({
  codigo: z.string().trim().regex(/^\d{1,10}$/),
  nome: z.string().trim().min(1).max(200),
}).strict();

const corpoDoEnvio = z.object({
  nome: z.string().trim().min(1).max(200).refine((n) => /\.xlsx$/i.test(n)),
}).strict();

const corpoDoAplicar = z.object({
  caminho: z.enum(["apagar", "manter"]),
  conflitos: z.record(z.string().regex(/^\d{1,18}$/), z.enum(["relatorio", "edicao"])).default({}),
  confirmouNome: z.boolean().default(false),
}).strict();

const MSG_DUPLICADO = "Já existe um insumo com este código e esta descrição.";
const duplicado = (res) => res.status(409).json({ error: MSG_DUPLICADO, code: "23505", campos: ["descricao"] });

/* ---------- a lista (o time le) ---------- */

/* QUANTOS DETALHES CADA INSUMO DA PAGINA TEM (25/09/2026): as linhas da
   base de precos (insumo_preco) com o mesmo codigo — a mesma conta do
   seletor da mae nas Compras. So' os codigos da pagina, de mil em mil (o
   teto de linhas do Supabase). Se falhar, a lista sai sem a contagem. */
const LEITURA_DA_BASE = 1000;
async function detalhesPorCodigo(supabase, codigos) {
  const conta = new Map();
  if (!codigos.length) return conta;
  for (let de = 0; ; de += LEITURA_DA_BASE) {
    const { data, error } = await supabase.from("insumo_preco").select("codigo").in("codigo", codigos)
      .order("id", { ascending: true }).range(de, de + LEITURA_DA_BASE - 1);
    if (error) return null;
    (data || []).forEach((l) => conta.set(l.codigo, (conta.get(l.codigo) || 0) + 1));
    if (!data || data.length < LEITURA_DA_BASE) return conta;
  }
}

rotas.get("/api/insumo-cadastro",
  zValidator("query", queryLista),
  async (req, res) => {
    const { busca, ativo, unidade, de, passo } = req.valido.query;
    let q = req.supabase.from("insumo_cadastro").select(COLUNAS, { count: "exact" });
    // Busca no servidor so' a partir de 2 letras (TELA-11).
    if (busca && busca.length >= 2) q = q.or(filtroDeBusca(busca, ["codigo", "descricao"]));
    if (ativo !== "todos") q = q.eq("ativo", ativo === "sim");
    if (unidade) q = q.eq("unidade", unidade);
    const { data, error, count } = await q
      .order("codigo_num", { ascending: true })
      .order("descricao", { ascending: true })
      .range(de, de + passo - 1);
    if (error) {
      if (faltaTabela(error)) return res.json({ itens: [], total: 0, faltaTabela: true, aviso: AVISO_SEM_SQL });
      return erroDoBanco(res, error);
    }
    const itens = (data || []).map(paraATela);
    const conta = await detalhesPorCodigo(req.supabase, [...new Set(itens.map((i) => i.codigo))]);
    res.json({ itens: itens.map((i) => ({ ...i, detalhes: conta ? (conta.get(i.codigo) || 0) : null })), total: count || 0 });
  });

rotas.get("/api/insumo-cadastro/unidades", async (req, res) => {
  const { data, error } = await req.supabase.rpc("insumo_cadastro_unidades");
  if (error) {
    if (faltaTabela(error) || error.code === "PGRST202") return res.json([]);
    return erroDoBanco(res, error);
  }
  res.json((data || []).map((u) => (typeof u === "string" ? u : u?.insumo_cadastro_unidades)).filter(Boolean));
});

/* ---------- a tabela ativa (RN-088) ---------- */

async function lerTabelaAtiva(supabase) {
  const { data, error } = await supabase
    .from("insumo_tabela_ativa")
    .select("codigo, nome, atualizado_em, atualizado_por")
    .eq("id", true)
    .maybeSingle();
  return { tabela: data || null, error };
}

rotas.get("/api/insumo-cadastro/tabela-ativa", async (req, res) => {
  const { tabela, error } = await lerTabelaAtiva(req.supabase);
  if (error) {
    if (faltaTabela(error)) return res.json({ tabela: null, faltaTabela: true, aviso: AVISO_SEM_SQL });
    return erroDoBanco(res, error);
  }
  res.json({ tabela });
});

rotas.put("/api/insumo-cadastro/tabela-ativa",
  exigirQuemMantemOCadastro,
  zValidator("json", corpoDaTabela),
  async (req, res) => {
    const { codigo, nome } = req.valido.json;
    const { data, error } = await req.supabase
      .from("insumo_tabela_ativa")
      .update({ codigo, nome, atualizado_em: new Date().toISOString(), atualizado_por: req.usuario.email })
      .eq("id", true)
      .select("codigo, nome, atualizado_em, atualizado_por")
      .maybeSingle();
    if (error) return erroDoBanco(res, error);
    if (!data) return res.status(404).json({ error: "Registro não encontrado." });
    res.json({ tabela: data });
  });

/* ---------- as importacoes ---------- */

rotas.get("/api/insumo-cadastro/importacoes", exigirQuemMantemOCadastro, async (req, res) => {
  const { data, error } = await req.supabase
    .from("insumo_cadastro_importacao")
    .select(COLUNAS_DA_IMPORTACAO)
    .order("criado_em", { ascending: false })
    .range(0, 19);
  if (error) {
    if (faltaTabela(error)) return res.json({ lista: [], faltaTabela: true, aviso: AVISO_SEM_SQL });
    return erroDoBanco(res, error);
  }
  // As escolhas dos conflitos vão junto: o "Continuar" repete a mesma decisão.
  res.json({ lista: (data || []).map((i) => ({ ...i, guardado: !!i.arquivo_caminho })) });
});

/* Registra a importacao e assina a subida do arquivo. O caminho no balde e'
   gerado aqui, nunca o nome original (SEG-34). */
rotas.post("/api/insumo-cadastro/importacoes",
  exigirQuemMantemOCadastro,
  zValidator("json", corpoDoEnvio),
  async (req, res) => {
    const { nome } = req.valido.json;
    const { data, error } = await req.supabase
      .from("insumo_cadastro_importacao")
      .insert({ arquivo_nome: nome, por: req.usuario.email })
      .select("id")
      .single();
    if (error) {
      if (faltaTabela(error)) return res.status(503).json({ error: AVISO_SEM_SQL, code: error.code });
      return erroDoBanco(res, error);
    }
    const caminho = `importacoes/${data.id}.xlsx`;
    const assinatura = await assinarEnvio(req.supabase, BALDE, caminho, { upsert: true });
    if (assinatura.error) return erroDoBalde(res, assinatura.error);
    const { error: erroCaminho } = await req.supabase
      .from("insumo_cadastro_importacao")
      .update({ arquivo_caminho: caminho, atualizado_em: new Date().toISOString() })
      .eq("id", data.id);
    if (erroCaminho) return erroDoBanco(res, erroCaminho);
    res.json({ id: data.id, assinatura: { caminho: assinatura.caminho, token: assinatura.token } });
  });

async function lerImportacao(supabase, id) {
  return supabase.from("insumo_cadastro_importacao").select(COLUNAS_DA_IMPORTACAO).eq("id", id).maybeSingle();
}

/* O relatorio lido do balde. Guardado em memoria enquanto a funcao estiver
   quente: o "aplicar" relê o mesmo arquivo a cada chamada. So' economia —
   sem ele, le de novo. */
const lidos = new Map();

async function lerDoBalde(supabase, importacao) {
  const guardado = lidos.get(importacao.id);
  if (guardado && guardado.caminho === importacao.arquivo_caminho) return { leitura: guardado.leitura };
  if (!importacao.arquivo_caminho) return { erro: "O arquivo desta importação não está mais guardado. Envie o relatório de novo." };
  const { data, error } = await supabase.storage.from(BALDE).download(importacao.arquivo_caminho);
  if (error) return { erroDoStorage: error };
  const buffer = Buffer.from(await data.arrayBuffer());
  if (!buffer.length) return { erro: "O arquivo chegou vazio. Envie o relatório de novo." };
  if (buffer.length > LIMITE_DO_ARQUIVO) return { erro: "O arquivo passa do limite de 10 MB." };
  let linhas;
  try {
    const wb = XLSX.read(buffer, { type: "buffer", sheetRows: LINHAS_MAX, cellFormula: false, cellHTML: false, cellStyles: false });
    const aba = wb.Sheets[wb.SheetNames[0]];
    linhas = XLSX.utils.sheet_to_json(aba, { header: 1, raw: true, defval: null, blankrows: true });
  } catch {
    return { erro: "Não foi possível ler o arquivo. Confira se é o relatório em Excel (.xlsx) gerado pelo Sienge." };
  }
  const { lerRelatorioDeInsumos } = await relatorio();
  const leitura = lerRelatorioDeInsumos(linhas);
  lidos.set(importacao.id, { caminho: importacao.arquivo_caminho, leitura });
  if (lidos.size > 20) lidos.delete(lidos.keys().next().value);
  return { leitura };
}

/* O cadastro de hoje, inteiro (a Data API corta em 1.000 por pedido). */
async function cadastroAtual(supabase) {
  const todos = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase
      .from("insumo_cadastro")
      .select(COLUNAS_DO_PLANO)
      .order("id", { ascending: true })
      .range(de, de + 999);
    if (error) return { error };
    todos.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return { atuais: todos };
}

/* Os itens pedidos ao Sienge, ja' no formato da regra (RN-087). */
async function itensPedidos(supabase, codigo = null) {
  const { STATUS_QUE_CONTAM_COMO_ENVIADA } = await regras();
  const { data, error } = await supabase.rpc("insumo_itens_pedidos", codigo ? { p_codigo: codigo } : {});
  if (error) return { error };
  const itens = (data || [])
    .filter((l) => STATUS_QUE_CONTAM_COMO_ENVIADA.includes(l.status))
    .map((l) => ({
      codigo: String(l.codigo ?? ""), texto: l.texto ?? "",
      obraCodigo: l.obra_codigo ?? null, solicitacaoId: l.solicitacao_id ?? null, enviadoEm: l.enviado_em ?? null,
    }));
  return { itens };
}

/* Recusa com motivo, e o registro fica marcado como recusado. */
async function recusar(res, supabase, id, status, error, detalhe = {}) {
  await supabase.from("insumo_cadastro_importacao")
    .update({ status: "recusado", resumo: { recusa: error, ...detalhe }, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  return res.status(status).json({ error, ...detalhe });
}

const MENSAGEM_DA_TABELA = {
  outra: (t, a) => `RN-088: o relatório é da tabela "${t?.texto || "?"}", e a tabela ativa é "${a.codigo} - ${a.nome}". Gere o relatório com a tabela ativa, ou troque a tabela ativa antes.`,
  sem_tabela: () => "RN-088: não há tabela de preços ativa configurada, ou o relatório não diz a tabela.",
};

/** Le, confere e planeja — o que a previa mostra e o que o aplicar grava. */
async function prepararImportacao(req, res, importacao, { caminho = null, conflitos = {} } = {}) {
  const { conferirTabela } = await regras();
  const { planejarImportacao } = await relatorio();

  const lido = await lerDoBalde(req.supabase, importacao);
  if (lido.erroDoStorage) return { resposta: erroDoBalde(res, lido.erroDoStorage) };
  if (lido.erro) return { resposta: await recusar(res, req.supabase, importacao.id, 422, lido.erro) };
  const { leitura } = lido;
  if (!leitura.ok) {
    return { resposta: await recusar(res, req.supabase, importacao.id, 422,
      "O arquivo não é o relatório de Insumos do Sienge no modelo esperado.", { erros: leitura.erros }) };
  }

  const { tabela: ativa, error: erroTabela } = await lerTabelaAtiva(req.supabase);
  if (erroTabela) return { resposta: erroDoBanco(res, erroTabela) };
  // RN-088 — so' o relatorio da tabela ativa.
  const tabelaConfere = conferirTabela(leitura.tabela, ativa);
  if (tabelaConfere === "outra" || tabelaConfere === "sem_tabela") {
    return { resposta: await recusar(res, req.supabase, importacao.id, 422,
      MENSAGEM_DA_TABELA[tabelaConfere](leitura.tabela, ativa || {}), { code: "RN-088" }) };
  }

  const { atuais, error: erroAtuais } = await cadastroAtual(req.supabase);
  if (erroAtuais) return { resposta: erroDoBanco(res, erroAtuais) };
  const { itens, error: erroItens } = await itensPedidos(req.supabase);
  if (erroItens) return { resposta: erroDoBanco(res, erroItens) };

  const plano = planejarImportacao({ registros: leitura.registros, atuais, itensEnviados: itens, caminho, conflitos });
  return { leitura, ativa, tabelaConfere, atuais, plano };
}

rotas.post("/api/insumo-cadastro/importacoes/:id/previa",
  exigirQuemMantemOCadastro,
  zValidator("param", paramId),
  async (req, res) => {
    const { data: importacao, error } = await lerImportacao(req.supabase, req.valido.param.id);
    if (error) return erroDoBanco(res, error);
    if (!importacao) return res.status(404).json({ error: "Registro não encontrado." });
    if (["gravando", "incompleta", "concluida"].includes(importacao.status)) {
      return res.status(409).json({ error: "Esta importação já foi gravada. Envie o relatório de novo para uma nova prévia." });
    }

    const preparo = await prepararImportacao(req, res, importacao);
    if (preparo.resposta) return preparo.resposta;
    const { leitura, ativa, tabelaConfere, atuais, plano } = preparo;
    const { cortar } = await relatorio();

    const resumo = {
      tabela: leitura.tabela, tabelaAtiva: ativa ? { codigo: ativa.codigo, nome: ativa.nome } : null, tabelaConfere,
      geradoEm: leitura.geradoEm,
      ...leitura.resumo,
      cadastroHoje: atuais.length,
      inserir: plano.inserir.length,
      atualizar: plano.atualizar.length,
      reativados: plano.reativados,
      semMudanca: plano.semMudanca,
      conflitos: plano.conflitos.length,
      jaExistem: plano.jaExistem.length,
      naoVieram: plano.naoVieram,
      sairiam: plano.apagar.length,
      ficamEmUso: plano.ficamEmUso.length,
    };
    const { error: erroResumo } = await req.supabase.from("insumo_cadastro_importacao").update({
      status: "previa", resumo,
      tabela_codigo: leitura.tabela.codigo, tabela_nome: leitura.tabela.nome,
      relatorio_gerado_em: leitura.geradoEm, atualizado_em: new Date().toISOString(),
    }).eq("id", importacao.id);
    if (erroResumo) return erroDoBanco(res, erroResumo);

    res.json({
      id: importacao.id,
      resumo,
      listas: {
        fora: cortar(leitura.listas.fora),
        repetidas: cortar(leitura.listas.repetidas),
        pares: cortar(leitura.listas.pares),
        // Os conflitos vão todos: gravar exige decidir cada um.
        conflitos: cortar(plano.conflitos, Number.MAX_SAFE_INTEGER),
        sairiam: cortar(plano.apagar),
        ficamEmUso: cortar(plano.ficamEmUso),
        jaExistem: cortar(plano.jaExistem),
      },
    });
  });

/* Os arquivos alem dos 12 ultimos saem do balde; o registro continua. */
async function podarArquivos(supabase) {
  const { data } = await supabase
    .from("insumo_cadastro_importacao")
    .select("id, arquivo_caminho")
    .not("arquivo_caminho", "is", null)
    .order("criado_em", { ascending: false })
    .range(ARQUIVOS_GUARDADOS, ARQUIVOS_GUARDADOS + 99);
  const velhos = (data || []).filter((i) => i.arquivo_caminho);
  if (!velhos.length) return;
  const { error } = await supabase.storage.from(BALDE).remove(velhos.map((i) => i.arquivo_caminho));
  if (error) {
    console.error(JSON.stringify({ level: "warn", event: "insumo_poda_falhou", quantos: velhos.length }));
    return;
  }
  await supabase.from("insumo_cadastro_importacao")
    .update({ arquivo_caminho: null })
    .in("id", velhos.map((i) => i.id));
}

rotas.post("/api/insumo-cadastro/importacoes/:id/aplicar",
  exigirQuemMantemOCadastro,
  zValidator("param", paramId),
  zValidator("json", corpoDoAplicar),
  async (req, res) => {
    const inicio = Date.now();
    const { caminho, conflitos, confirmouNome } = req.valido.json;
    const { data: importacao, error } = await lerImportacao(req.supabase, req.valido.param.id);
    if (error) return erroDoBanco(res, error);
    if (!importacao) return res.status(404).json({ error: "Registro não encontrado." });
    if (!["previa", "gravando", "incompleta"].includes(importacao.status)) {
      return res.status(409).json({ error: "Esta importação não está pronta para gravar. Refaça a prévia." });
    }

    const { tabelaPermiteImportar } = await regras();
    const preparo = await prepararImportacao(req, res, importacao, { caminho, conflitos });
    if (preparo.resposta) return preparo.resposta;
    const { tabelaConfere, plano } = preparo;

    // RN-088 — nome da tabela mudou: so' com a confirmacao do admin.
    if (!tabelaPermiteImportar(tabelaConfere, { confirmouNome })) {
      return res.status(422).json({ error: "RN-088: o nome da tabela mudou. Confirme que o relatório é da tabela ativa antes de gravar.", code: "RN-088" });
    }
    if (plano.conflitosSemEscolha > 0) {
      return res.status(422).json({ error: "Escolha o que fazer em cada conflito antes de gravar.", code: "CONFLITOS" });
    }

    const marcar = (campos) => req.supabase.from("insumo_cadastro_importacao")
      .update({ ...campos, atualizado_em: new Date().toISOString() }).eq("id", importacao.id);
    const { error: erroEscolhas } = await marcar({ caminho, conflitos, confirmou_nome: confirmouNome, status: "gravando" });
    if (erroEscolhas) return erroDoBanco(res, erroEscolhas);

    const pararNoMeio = async (e, etapa) => {
      await marcar({ status: "incompleta" });
      console.error(JSON.stringify({ level: "error", event: "insumo_importacao_parou", importacao: importacao.id, etapa, codigo: e?.code || null }));
      return res.status(500).json({
        error: "A gravação parou no meio. O que entrou fica; use Continuar para terminar.",
        code: "INCOMPLETA",
      });
    };

    // 1. Gravar primeiro (item 7): inserir e atualizar, em blocos.
    const escrever = [
      ...plano.inserir.map((l) => ({ tipo: "inserir", l })),
      ...plano.atualizar.map((l) => ({ tipo: "atualizar", l })),
    ];
    let escritas = 0;
    for (let i = 0; i < escrever.length; i += TAMANHO_DO_BLOCO) {
      if (Date.now() - inicio > ORCAMENTO_MS) {
        return res.json({ status: "gravando", restantes: escrever.length - escritas + plano.apagar.length });
      }
      const bloco = escrever.slice(i, i + TAMANHO_DO_BLOCO);
      const { error: erroBloco } = await req.supabase.rpc("insumo_cadastro_gravar", {
        p_importacao: importacao.id,
        p_inserir: bloco.filter((b) => b.tipo === "inserir").map((b) => b.l),
        p_atualizar: bloco.filter((b) => b.tipo === "atualizar").map((b) => b.l),
      });
      if (erroBloco) return pararNoMeio(erroBloco, "gravar");
      escritas += bloco.length;
    }

    // 2. Apagar por ultimo, so' no caminho "apagar" (o plano ja' tirou o que esta' em uso).
    const ids = plano.apagar.map((a) => a.id);
    for (let i = 0; i < ids.length; i += TAMANHO_DO_BLOCO) {
      if (Date.now() - inicio > ORCAMENTO_MS) {
        return res.json({ status: "gravando", restantes: ids.length - i });
      }
      const { error: erroApagar } = await req.supabase.rpc("insumo_cadastro_apagar", {
        p_importacao: importacao.id, p_ids: ids.slice(i, i + TAMANHO_DO_BLOCO),
      });
      if (erroApagar) return pararNoMeio(erroApagar, "apagar");
    }

    // 3. Concluida.
    const { data: final } = await lerImportacao(req.supabase, importacao.id);
    const resumo = {
      ...(final?.resumo || importacao.resumo || {}),
      resultado: {
        gravadas: final?.gravadas ?? null,
        apagados: final?.apagados ?? null,
        ficaramEmUso: plano.ficamEmUso.length,
        caminho,
      },
    };
    const { error: erroFim } = await marcar({ status: "concluida", concluida_em: new Date().toISOString(), resumo });
    if (erroFim) return erroDoBanco(res, erroFim);
    lidos.delete(importacao.id);
    await podarArquivos(req.supabase);
    res.json({ status: "concluida", resumo });
  });

/* ---------- o CRUD (RN-086) ---------- */

rotas.post("/api/insumo-cadastro",
  exigirQuemMantemOCadastro,
  zValidator("json", corpoDoInsumo),
  async (req, res) => {
    const { codigo, descricao, unidade } = req.valido.json;
    const { data, error } = await req.supabase
      .from("insumo_cadastro")
      // Autor e datas sao carimbados pelo banco, pelo login (SEG-13).
      .insert({ codigo, descricao, unidade, origem: "tela", criado_por: req.usuario.email, atualizado_por: req.usuario.email })
      .select(COLUNAS)
      .single();
    if (error) {
      if (error.code === "23505") return duplicado(res);
      return erroDoBanco(res, error);
    }
    res.json(paraATela(data));
  });

rotas.patch("/api/insumo-cadastro/:id",
  exigirQuemMantemOCadastro,
  zValidator("param", paramId),
  zValidator("json", corpoDaEdicao),
  async (req, res) => {
    const { data, error } = await req.supabase
      .from("insumo_cadastro")
      .update(req.valido.json)
      .eq("id", req.valido.param.id)
      .select(COLUNAS)
      .maybeSingle();
    if (error) {
      if (error.code === "23505") return duplicado(res);
      return erroDoBanco(res, error);
    }
    if (!data) return res.status(404).json({ error: "Registro não encontrado." });
    res.json(paraATela(data));
  });

async function insumoPorId(supabase, id) {
  return supabase.from("insumo_cadastro").select("id, codigo, descricao").eq("id", id).maybeSingle();
}

async function usosDe(supabase, insumo) {
  const { usosDoInsumo } = await regras();
  const { itens, error } = await itensPedidos(supabase, insumo.codigo);
  if (error) return { error };
  return { usos: usosDoInsumo(insumo, itens) };
}

rotas.get("/api/insumo-cadastro/:id/usos",
  exigirQuemMantemOCadastro,
  zValidator("param", paramId),
  async (req, res) => {
    const { data: insumo, error } = await insumoPorId(req.supabase, req.valido.param.id);
    if (error) return erroDoBanco(res, error);
    if (!insumo) return res.status(404).json({ error: "Registro não encontrado." });
    const { usos, error: erroUsos } = await usosDe(req.supabase, insumo);
    if (erroUsos) return erroDoBanco(res, erroUsos);
    res.json({ usos });
  });

rotas.get("/api/insumo-cadastro/:id/historico",
  exigirQuemMantemOCadastro,
  zValidator("param", paramId),
  async (req, res) => {
    const { data, error } = await req.supabase
      .from("insumo_cadastro_historico")
      .select("id, acao, codigo, descricao, antes, depois, importacao_id, autor, criado_em")
      .eq("insumo_id", req.valido.param.id)
      .order("criado_em", { ascending: false })
      .range(0, 99);
    if (error) return erroDoBanco(res, error);
    res.json(data || []);
  });

rotas.delete("/api/insumo-cadastro/:id",
  exigirQuemMantemOCadastro,
  zValidator("param", paramId),
  async (req, res) => {
    const { data: insumo, error } = await insumoPorId(req.supabase, req.valido.param.id);
    if (error) return erroDoBanco(res, error);
    if (!insumo) return res.status(404).json({ error: "Registro não encontrado." });
    // RN-087 — pedido ao Sienge nao se apaga; a tela mostra onde.
    const { usos, error: erroUsos } = await usosDe(req.supabase, insumo);
    if (erroUsos) return erroDoBanco(res, erroUsos);
    if (usos.length) {
      return res.status(409).json({ error: "RN-087: este insumo foi pedido ao Sienge e não pode ser apagado.", code: "EM_USO", usos });
    }
    const { error: erroApagar } = await req.supabase.from("insumo_cadastro").delete().eq("id", insumo.id);
    if (erroApagar) return erroDoBanco(res, erroApagar);
    res.json({ ok: true });
  });

module.exports = { rotasDeInsumoCadastro: rotas };
