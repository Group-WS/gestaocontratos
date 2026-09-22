/**
 * EAP — a da casa (`eap_grupo`) e a do Sienge (`sienge_eap_*`).
 * -----------------------------------------------------------
 * GET  /api/eap/grupos                -> os grupos ativos da EAP DA CASA, na ordem
 * GET  /api/eap/versoes               -> as versoes da EAP do Sienge, da mais nova pra mais velha
 * GET  /api/eap/versoes/:id           -> { itens, mapa } de uma versao
 * POST /api/eap/versoes               { versao }   -> { id } (so' a linha da versao)
 * POST /api/eap/versoes/:id/itens     { itens }    -> { inseridos } (um bloco da arvore)
 * POST /api/eap/versoes/:id/herdar    { herdarDe } -> { orfaos } (copia o mapa da anterior)
 * PUT  /api/eap/versoes/:id/padrao                 -> { id, padrao } (desmarca a anterior, marca esta)
 * PUT  /api/eap/mapa                  { versaoId, verbaNum, codigo } -> liga/desliga uma verba
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
const { exigirLogin, exigirMembro } = require("../auth.js");
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
    res.json({ id: versaoId, padrao: true });
  });

/** Liga (ou desliga, com `codigo` nulo) uma verba do GC a uma folha da EAP. */
rotas.put("/api/eap/mapa",
  zValidator("json", corpoDoMapa),
  async (req, res) => {
    const { versaoId, verbaNum, codigo } = req.valido.json;
    if (!codigo) {
      const { error } = await req.supabase
        .from("sienge_eap_mapa").delete().eq("versao_id", versaoId).eq("verba_num", verbaNum);
      if (error) return erroDoBanco(res, error);
      return res.json({ versaoId, verbaNum, codigo: null });
    }
    const { error } = await req.supabase.from("sienge_eap_mapa").upsert({
      versao_id: versaoId, verba_num: verbaNum, codigo, definido_por: req.usuario.email, definido_em: new Date().toISOString(),
    }, { onConflict: "versao_id,verba_num" });
    if (error) return erroDoBanco(res, error);
    res.json({ versaoId, verbaNum, codigo });
  });

module.exports = { rotasDeEap: rotas };
