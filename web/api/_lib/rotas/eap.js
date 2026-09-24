/**
 * EAP — a da casa (`eap_grupo`) e a do Sienge (`sienge_eap_*`).
 * -----------------------------------------------------------
 * GET  /api/eap/grupos                -> os grupos ativos da EAP DA CASA, na ordem
 * PUT  /api/eap/grupos/:num/apelidos { apelido } -> ensina um nome de grupo a' verba
 * GET  /api/eap/versoes               -> as versoes da EAP do Sienge, da mais nova pra mais velha
 * GET  /api/eap/versoes/:id           -> { itens, mapa } de uma versao
 * POST /api/eap/versoes               { versao }   -> { id } (so' a linha da versao)
 * POST /api/eap/versoes/:id/itens     { itens }    -> { inseridos } (um bloco da arvore)
 * POST /api/eap/versoes/:id/herdar    { herdarDe } -> { orfaos } (copia o mapa da anterior)
 * PUT  /api/eap/versoes/:id/padrao                 -> { id, padrao } (desmarca a anterior, marca esta)
 * PUT  /api/eap/mapa                  { versaoId, verbaNum, codigo } -> liga/desliga uma verba
 * POST /api/eap/versoes/:id/registro  { nItens, nFolhas, herdadas, orfaos } -> fecha o registro da importacao
 * DELETE /api/eap/versoes/:id                      -> exclui uma versao (so' administrador, nunca a padrao)
 * GET  /api/eap/eventos               -> o registro de quem mexeu (so' administrador)
 *
 * QUEM MEXEU (23/09/2026). O cadastro guardava so' o estado de hoje: trocar
 * a folha de uma verba apagava o autor anterior, desligar a verba apagava a
 * linha, e "Tornar padrao" — que decide a EAP com que toda solicitacao sai —
 * nao deixava carimbo. Agora cada gesto tambem vira uma linha em
 * `sienge_eap_evento` (supabase/sienge-eap-evento.sql), que so' cresce e so'
 * administrador le'.
 *
 * O registro nunca derruba o gesto: a gravacao principal ja' aconteceu, e
 * uma falha ao registrar volta na resposta como `registro: "falhou"` (e no
 * log do servidor), em vez de virar erro pra quem clicou.
 *
 * Antes o navegador falava com estas tabelas direto (VH-02). O caminho
 * mudou — navegador -> API -> banco —, o que acontece nao: sao os mesmos
 * comandos, na mesma ordem, agora do lado do servidor.
 *
 * Duas coisas que so' fazem sentido juntas, por isso moram no mesmo arquivo:
 * a EAP da casa (as 35 verbas de `eap_grupo`, usadas na planilha e no
 * depara) e a EAP do Sienge (a arvore de apropriacao importada do relatorio
 * de orcamento, com o mapa verba -> folha). Ver supabase/eap.sql e
 * supabase/sienge_eap.sql.
 *
 * A importacao chega FATIADA de proposito: a versao nasce numa chamada, os
 * itens entram em blocos (o `express.json` do app corta o corpo em 1 MB, e
 * o PostgREST tambem nao gosta de payload grande) e a heranca do mapa e' a
 * ultima chamada. E' o mesmo fatiamento que o navegador ja' fazia.
 *
 * Molde das rotas de dados: valida -> autoriza -> fala com o banco com o
 * client do usuario (RLS) -> responde, com o erro do banco traduzido. Quem
 * importou e quem definiu o mapa vem do LOGIN, nunca do pedido (SEG-13).
 */

const express = require("express");
const { exigirLogin, exigirMembro, exigirAdministrador } = require("../auth.js");
const { zValidator, z } = require("../validacao.js");
const { erroDoBanco } = require("../erroDoBanco.js");

/* ---------- o que pode entrar ---------- */

const idDeVersao = z.coerce.number().int().positive();
const paramVersao = z.object({ id: idDeVersao }).strict();

/* O cabecalho do relatorio, como lib/eapSienge.js o entrega. `nome` pode
   vir nulo numa planilha capenga: quem recusa e' o `not null` da tabela,
   como era antes. */
const corpoDaVersao = z.object({
  versao: z.object({
    nome: z.string().max(400).nullish(),
    unidadeId: z.number().int().positive(),
    obraModelo: z.string().max(400).nullish(),
    versaoOrcamento: z.string().max(400).nullish(),
    dataBase: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).max(40).nullish(),
  }).strict(),
}).strict();

/* Um item da arvore. O bloco tem o tamanho do que o front fatia (500). */
const itemDaEap = z.object({
  codigo: z.string().min(1).max(200),
  descricao: z.string().max(4000),
  nivel: z.number().int().min(1).max(4),
  unidade: z.string().max(200).nullish(),
  folha: z.boolean(),
}).strict();
const corpoDosItens = z.object({ itens: z.array(itemDaEap).min(1).max(500) }).strict();

const corpoDaHeranca = z.object({ herdarDe: idDeVersao }).strict();

/* O numero da verba e' texto na tabela ("20"), mas a tela tira de um campo
   da obra: numero tambem passa, e vira texto, como o PostgREST ja' fazia. */
const numeroDeVerba = z.union([z.string().min(1).max(40), z.number().int().nonnegative()]).transform(String);

const corpoDoMapa = z.object({
  versaoId: idDeVersao,
  verbaNum: numeroDeVerba,
  // Nulo e' "desliga esta verba" — o front ja' manda nulo no lugar de "".
  codigo: z.string().min(1).max(200).nullish(),
}).strict();

/* De onde veio o gesto: nulo e' a tela /eap, preenchido e' o envio da
   solicitacao de compra dentro daquela obra. */
const codigoDeObra = z.string().trim().min(1).max(40).regex(/^[0-9A-Za-z._-]+$/);

const corpoDoMapaComOrigem = corpoDoMapa.extend({ obraCodigo: codigoDeObra.nullish() });

const corpoDoRegistro = z.object({
  nItens: z.number().int().nonnegative(),
  nFolhas: z.number().int().nonnegative(),
  herdadas: z.number().int().nonnegative().default(0),
  orfaos: z.array(z.string().max(200)).max(200).default([]),
  herdouDe: idDeVersao.nullish(),
}).strict();

const semTabela = (erro) => erro?.code === "42P01" || erro?.code === "PGRST205";

/* Quantos eventos o painel pede de uma vez (SQL-33). */
const LIMITE_DE_EVENTOS = 100;
const COLUNAS_DO_EVENTO =
  "id, acao, versao_id, versao_nome, verba_num, codigo, codigo_anterior, obra_codigo, detalhe, autor, criado_em";

/**
 * Uma linha no registro. NUNCA derruba o gesto que a chamou: o que
 * importava ja' foi gravado, e perder o rastro nao pode virar erro na cara
 * de quem clicou. Devolve `true` se registrou.
 *
 * O autor vem do LOGIN, nunca do pedido (SEG-13) — o `with check` do banco
 * recusa assinar por outro.
 */
async function registrar(req, linha) {
  const { error } = await req.supabase.from("sienge_eap_evento").insert({
    acao: linha.acao,
    versao_id: linha.versaoId ?? null,
    versao_nome: linha.versaoNome ?? null,
    verba_num: linha.verbaNum ?? null,
    codigo: linha.codigo ?? null,
    codigo_anterior: linha.codigoAnterior ?? null,
    obra_codigo: linha.obraCodigo ?? null,
    detalhe: linha.detalhe ?? null,
    autor: req.usuario.email,
  });
  if (!error) return true;
  console.error(JSON.stringify({
    level: "error",
    event: semTabela(error) ? "eap_registro_sem_tabela" : "eap_registro_falhou",
    acao: linha.acao,
    codigo: error.code || null,
  }));
  return false;
}

/** O nome da versao, congelado na linha do registro. */
async function nomeDaVersao(req, versaoId) {
  const { data } = await req.supabase
    .from("sienge_eap_versao").select("nome").eq("id", versaoId).maybeSingle();
  return data?.nome ?? null;
}

const rotas = express.Router();
rotas.use(exigirLogin, exigirMembro);

/* ---------- a EAP da casa ---------- */

/**
 * Os grupos ativos, na ordem do cadastro. A tela decide o que fazer com
 * lista vazia (lib/eap.js mantem a EAP do codigo em vez de ficar sem
 * nenhuma).
 */
rotas.get("/api/eap/grupos", async (req, res) => {
  const { data, error } = await req.supabase
    .from("eap_grupo")
    .select("num, nome, apelidos, analisar, motivo_na")
    .eq("ativo", true)
    .order("ordem");
  if (error) return erroDoBanco(res, error);
  res.json(data || []);
});

/**
 * Ensina a EAP um nome de grupo que ela nao reconhecia (23/09/2026).
 *
 * Na importacao, o grupo do arquivo que nao casa com nenhuma verba aparece
 * para a pessoa escolher a verba certa (RN-030). A escolha nao vale so'
 * para aquela obra: o nome vira apelido da verba, e o proximo arquivo com
 * o mesmo grupo ja' entra no lugar.
 *
 * O apelido chega COMPRIMIDO pela tela (sem acento, espaco, pontuacao nem
 * o numero do grupo), que e' a forma com que o depara compara. Quem pode
 * gravar e' o RLS de `eap_grupo` (master, admin, geral e gc, os mesmos que
 * importam): a policy recusa em silencio, por isso a rota confere se a
 * linha voltou.
 */
const paramDoGrupo = z.object({ num: z.string().regex(/^\d{2}$/) }).strict();
const corpoDoApelido = z.object({ apelido: z.string().regex(/^[a-z0-9]{3,80}$/) }).strict();

rotas.put("/api/eap/grupos/:num/apelidos",
  zValidator("param", paramDoGrupo),
  zValidator("json", corpoDoApelido),
  async (req, res) => {
    const { num } = req.valido.param;
    const { apelido } = req.valido.json;
    const { data: grupo, error: erroLeitura } = await req.supabase
      .from("eap_grupo").select("num, apelidos").eq("num", num).maybeSingle();
    if (erroLeitura) return erroDoBanco(res, erroLeitura);
    if (!grupo) return res.status(404).json({ error: "Essa verba não existe na EAP." });

    const apelidos = Array.isArray(grupo.apelidos) ? grupo.apelidos : [];
    if (apelidos.includes(apelido)) return res.json({ num, apelidos });

    const novos = [...apelidos, apelido];
    const { data: gravou, error } = await req.supabase
      .from("eap_grupo").update({ apelidos: novos }).eq("num", num).select("num");
    if (error) return erroDoBanco(res, error);
    if (!gravou || gravou.length === 0) {
      return res.status(403).json({ error: "Você não tem acesso a esta área. Fale com o administrador da sua organização." });
    }
    res.json({ num, apelidos: novos });
  });

/* ---------- a EAP do Sienge ---------- */

rotas.get("/api/eap/versoes", async (req, res) => {
  const { data, error } = await req.supabase
    .from("sienge_eap_versao")
    .select("id, nome, unidade_id, obra_modelo, versao_orcamento, data_base, padrao, importado_por, importado_em")
    .order("importado_em", { ascending: false });
  if (error) return erroDoBanco(res, error);
  res.json(data || []);
});

/** Uma versao inteira: os itens da arvore e as linhas do mapa. */
rotas.get("/api/eap/versoes/:id",
  zValidator("param", paramVersao),
  async (req, res) => {
    const versaoId = req.valido.param.id;
    const [itens, mapa] = await Promise.all([
      req.supabase.from("sienge_eap_item")
        .select("codigo, descricao, nivel, unidade, folha")
        .eq("versao_id", versaoId)
        .order("codigo"),
      req.supabase.from("sienge_eap_mapa")
        .select("verba_num, codigo, definido_por, definido_em")
        .eq("versao_id", versaoId),
    ]);
    if (itens.error) return erroDoBanco(res, itens.error);
    if (mapa.error) return erroDoBanco(res, mapa.error);
    res.json({ itens: itens.data || [], mapa: mapa.data || [] });
  });

/**
 * A linha da versao nova. Importar SEMPRE cria versao — nada e'
 * sobrescrito, porque uma solicitacao enviada mes passado precisa
 * continuar explicavel pela EAP que valia naquele dia.
 */
rotas.post("/api/eap/versoes",
  zValidator("json", corpoDaVersao),
  async (req, res) => {
    const v = req.valido.json.versao;
    const { data, error } = await req.supabase
      .from("sienge_eap_versao")
      .insert({
        nome: v.nome,
        unidade_id: v.unidadeId,
        obra_modelo: v.obraModelo,
        versao_orcamento: v.versaoOrcamento,
        data_base: v.dataBase,
        importado_por: req.usuario.email,
      })
      .select("id")
      .single();
    if (error) return erroDoBanco(res, error);
    res.json({ id: data.id });
  });

/** Um bloco da arvore. O front manda quantos blocos forem precisos. */
rotas.post("/api/eap/versoes/:id/itens",
  zValidator("param", paramVersao),
  zValidator("json", corpoDosItens),
  async (req, res) => {
    const versaoId = req.valido.param.id;
    const { itens } = req.valido.json;
    const { error } = await req.supabase.from("sienge_eap_item").insert(
      itens.map((it) => ({
        versao_id: versaoId,
        codigo: it.codigo,
        descricao: it.descricao,
        nivel: it.nivel,
        unidade: it.unidade,
        folha: it.folha,
      })));
    if (error) return erroDoBanco(res, error);
    res.json({ inseridos: itens.length });
  });

/**
 * O mapa da versao anterior, copiado pros codigos que continuam existindo.
 *
 * Sem isso, cada importacao zeraria o trabalho de ligar as 35 verbas do GC
 * as folhas do Sienge. O que perdeu par volta em `orfaos`, pra tela poder
 * dizer quais verbas ficaram sem folha em vez de deixar a pessoa descobrir
 * na hora de enviar uma solicitacao.
 *
 * As folhas da versao nova sao lidas do banco (os itens acabaram de entrar
 * pela rota de cima) — e' o mesmo conjunto que o navegador tinha em maos.
 */
rotas.post("/api/eap/versoes/:id/herdar",
  zValidator("param", paramVersao),
  zValidator("json", corpoDaHeranca),
  async (req, res) => {
    const versaoId = req.valido.param.id;
    const { herdarDe } = req.valido.json;

    const { data: mapa, error: erroMapa } = await req.supabase
      .from("sienge_eap_mapa")
      .select("verba_num, codigo")
      .eq("versao_id", herdarDe);
    if (erroMapa) return erroDoBanco(res, erroMapa);

    const { data: folhas, error: erroFolhas } = await req.supabase
      .from("sienge_eap_item")
      .select("codigo")
      .eq("versao_id", versaoId)
      .eq("folha", true);
    if (erroFolhas) return erroDoBanco(res, erroFolhas);

    const existe = new Set((folhas || []).map((f) => f.codigo));
    const herdado = [];
    const orfaos = [];
    (mapa || []).forEach((m) => {
      if (existe.has(m.codigo)) {
        herdado.push({ versao_id: versaoId, verba_num: m.verba_num, codigo: m.codigo, definido_por: req.usuario.email });
      } else {
        orfaos.push({ verba: m.verba_num, codigo: m.codigo });
      }
    });

    if (herdado.length) {
      const { error } = await req.supabase.from("sienge_eap_mapa").insert(herdado);
      if (error) return erroDoBanco(res, error);
    }
    res.json({ orfaos });
  });

/**
 * A versao que a tela abre.
 *
 * Uma padrao por vez — e' o que o indice unico parcial da tabela garante.
 * Tirar a antiga ANTES de por a nova, senao o update esbarra nele. Os dois
 * comandos ficam na mesma rota, nesta ordem: se o primeiro falhar, o
 * segundo nao roda.
 */
rotas.put("/api/eap/versoes/:id/padrao",
  zValidator("param", paramVersao),
  async (req, res) => {
    const versaoId = req.valido.param.id;
    const { error: limpar } = await req.supabase
      .from("sienge_eap_versao").update({ padrao: false }).eq("padrao", true);
    if (limpar) return erroDoBanco(res, limpar);
    const { error } = await req.supabase
      .from("sienge_eap_versao").update({ padrao: true }).eq("id", versaoId);
    if (error) return erroDoBanco(res, error);

    const registrou = await registrar(req, {
      acao: "tornou_padrao",
      versaoId,
      versaoNome: await nomeDaVersao(req, versaoId),
    });
    res.json({ id: versaoId, padrao: true, registro: registrou ? "ok" : "falhou" });
  });

/** Liga (ou desliga, com `codigo` nulo) uma verba do GC a uma folha da EAP. */
rotas.put("/api/eap/mapa",
  zValidator("json", corpoDoMapaComOrigem),
  async (req, res) => {
    const { versaoId, verbaNum, codigo, obraCodigo } = req.valido.json;

    /* O que a verba apontava ANTES — lido antes de escrever, porque e' isso
       que faz a diferenca entre "ligou" e "trocou", e e' a unica chance de
       guardar o codigo que sai. */
    const { data: antes } = await req.supabase
      .from("sienge_eap_mapa").select("codigo")
      .eq("versao_id", versaoId).eq("verba_num", verbaNum).maybeSingle();
    const codigoAnterior = antes?.codigo ?? null;

    const comum = { versaoId, verbaNum, codigoAnterior, obraCodigo: obraCodigo ?? null };

    if (!codigo) {
      const { error } = await req.supabase
        .from("sienge_eap_mapa").delete().eq("versao_id", versaoId).eq("verba_num", verbaNum);
      if (error) return erroDoBanco(res, error);
      // Desligar o que ja' estava desligado nao e' gesto: nao vira linha.
      const registrou = codigoAnterior
        ? await registrar(req, { ...comum, acao: "desligou", codigo: null })
        : true;
      return res.json({ versaoId, verbaNum, codigo: null, registro: registrou ? "ok" : "falhou" });
    }

    const { error } = await req.supabase.from("sienge_eap_mapa").upsert({
      versao_id: versaoId, verba_num: verbaNum, codigo, definido_por: req.usuario.email, definido_em: new Date().toISOString(),
    }, { onConflict: "versao_id,verba_num" });
    if (error) return erroDoBanco(res, error);

    const registrou = codigoAnterior === codigo
      ? true // reconfirmar a mesma folha nao muda nada
      : await registrar(req, { ...comum, acao: codigoAnterior ? "trocou" : "ligou", codigo });
    res.json({ versaoId, verbaNum, codigo, registro: registrou ? "ok" : "falhou" });
  });

/**
 * A ultima chamada da importacao: fecha o registro com os numeros do que
 * entrou (itens, folhas, verbas herdadas e as que ficaram orfas).
 *
 * Uma linha so' por importacao, de proposito: 35 linhas de heranca
 * afogariam o painel. As orfas vao no detalhe porque sao o que alguem
 * precisa refazer.
 *
 * Os numeros descrevem o ARQUIVO, e vem do navegador, que o leu; o AUTOR
 * vem do login (SEG-13).
 */
rotas.post("/api/eap/versoes/:id/registro",
  zValidator("param", paramVersao),
  zValidator("json", corpoDoRegistro),
  async (req, res) => {
    const versaoId = req.valido.param.id;
    const r = req.valido.json;
    const registrou = await registrar(req, {
      acao: "importou",
      versaoId,
      versaoNome: await nomeDaVersao(req, versaoId),
      detalhe: {
        nItens: r.nItens,
        nFolhas: r.nFolhas,
        herdadas: r.herdadas,
        orfaos: r.orfaos,
        herdouDe: r.herdouDe ?? null,
      },
    });
    res.json({ registro: registrou ? "ok" : "falhou" });
  });

/**
 * Excluir uma versao da EAP.
 *
 * So' administrador, e NUNCA a padrao: a padrao e' a EAP com que toda
 * solicitacao de compra sai, e apagar a de baixo do pe' de quem esta
 * enviando seria o pior jeito de descobrir isso. Pra trocar, torne outra
 * padrao antes.
 *
 * Os itens e o mapa vao junto (o `on delete cascade` da tabela). O registro
 * NAO vai — ele nao tem FK pra versao, de proposito: e' a unica memoria do
 * que existia. Por isso a linha da exclusao e' gravada ANTES do delete,
 * com o nome da versao e o que ia junto.
 */
rotas.delete("/api/eap/versoes/:id",
  exigirAdministrador,
  zValidator("param", paramVersao),
  async (req, res) => {
    const versaoId = req.valido.param.id;

    const { data: versao, error: erroVersao } = await req.supabase
      .from("sienge_eap_versao").select("id, nome, padrao").eq("id", versaoId).maybeSingle();
    if (erroVersao) return erroDoBanco(res, erroVersao);
    if (!versao) return res.status(404).json({ erro: "Versão não encontrada." });
    if (versao.padrao) {
      return res.status(409).json({
        erro: "Esta é a versão padrão — é com ela que as solicitações de compra saem. Torne outra padrão antes de excluir.",
      });
    }

    const [{ count: nItens }, { count: nMapa }] = await Promise.all([
      req.supabase.from("sienge_eap_item").select("codigo", { count: "exact", head: true }).eq("versao_id", versaoId),
      req.supabase.from("sienge_eap_mapa").select("verba_num", { count: "exact", head: true }).eq("versao_id", versaoId),
    ]);

    const registrou = await registrar(req, {
      acao: "excluiu",
      versaoId,
      versaoNome: versao.nome,
      detalhe: { nItens: nItens ?? null, nVerbasLigadas: nMapa ?? null },
    });

    const { error } = await req.supabase.from("sienge_eap_versao").delete().eq("id", versaoId);
    if (error) return erroDoBanco(res, error);
    res.json({ id: versaoId, excluida: true, registro: registrou ? "ok" : "falhou" });
  });

/**
 * O registro: quem mexeu no EAP, do mais novo pro mais antigo.
 *
 * So' administrador — a barreira de verdade e' o RLS da tabela; aqui a
 * rota responde 403 em vez de devolver lista vazia. Tabela ainda nao
 * criada devolve lista vazia com `semTabela`, pra tela dizer o que falta
 * em vez de quebrar.
 */
rotas.get("/api/eap/eventos", exigirAdministrador, async (req, res) => {
  const { data, error } = await req.supabase
    .from("sienge_eap_evento")
    .select(COLUNAS_DO_EVENTO)
    .order("criado_em", { ascending: false })
    .limit(LIMITE_DE_EVENTOS);
  if (error) {
    if (semTabela(error)) return res.json({ semTabela: true, eventos: [] });
    return erroDoBanco(res, error);
  }
  res.json({ eventos: data || [] });
});

module.exports = { rotasDeEap: rotas };
