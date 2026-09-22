/**
 * Aditivos de obra — supressao, adicao e o saldo entre as duas.
 * -----------------------------------------------------------
 * GET    /api/aditivos?obra=2450                  -> as linhas de aditivo (todas, ou so' as da obra)
 * GET    /api/obras/:codigo/aditivos/:id          -> um aditivo, com o documento e a versao de agora
 * POST   /api/obras/:codigo/aditivos              -> cria; o numero ("2450/3") sai do BANCO
 * POST   /api/obras/:codigo/aditivos/:id/gravar   -> grava com a versao que a tela leu
 * DELETE /api/obras/:codigo/aditivos/:id          -> exclui (quem pode e' o BANCO que decide)
 *
 * Ate' 22/09/2026 o navegador falava com a tabela direto (VH-02), e gravava
 * o documento inteiro por `id` sem conferir nada: duas pessoas no mesmo
 * aditivo, e a segunda a gravar apagava o trabalho da primeira em silencio.
 * Agora quem decide e' o banco (supabase/salvar-aditivo-apresentacao.sql):
 * `salvar_aditivo` so' grava com a VERSAO que a tela leu, e o que nao bater
 * volta 409 com o motivo — a tela avisa, e nada e' escrito.
 *
 * Quem soma o documento continua sendo o front (lib/aditivoDoc.js, onde o
 * teste alcanca sem navegador), e esta rota GRAVA O QUE RECEBE: aditivo e'
 * dinheiro de contrato, e conta que migra de arquivo e' conta que ninguem
 * confere de novo.
 *
 * O que ENDURECEU junto: a autorizacao passou a ser por obra
 * (`exigirEdicaoDeObra`), do mesmo tamanho da policy de `aditivo` no
 * rls-reforco.sql — antes qualquer pessoa ativa criava ou alterava aditivo
 * de qualquer obra.
 *
 * Molde das rotas de dados: valida -> autoriza -> fala com o banco com o
 * client do usuario (RLS) -> responde, com o erro do banco traduzido.
 */

const express = require("express");
const { exigirLogin, exigirMembro, exigirObra, exigirEdicaoDeObra } = require("../auth.js");
const { zValidator, esquemas, LIMITE_DOCUMENTO_JSON } = require("../validacao.js");
const { erroDoBanco } = require("../erroDoBanco.js");
const { responderDaFuncao, erroDaFuncao } = require("../respostaDaFuncao.js");

const SQL = "supabase/salvar-aditivo-apresentacao.sql";

/* O documento de um aditivo grande passa do limite global de 1 MB. Estes
   caminhos tem leitor proprio — ver CAMINHOS_COM_LEITOR_PROPRIO no
   mondayApp.js. */
const CAMINHOS_DE_ADITIVO = [/^\/api\/obras\/[^/]+\/aditivos(\/[^/]+\/gravar)?$/];
const jsonDoDocumento = express.json({ limit: LIMITE_DOCUMENTO_JSON });

/* As colunas que a tela le' (web/src/lib/aditivos.js, `paraApp`). Listadas
   uma a uma, e nao `*`: coluna nova no banco nao vaza pra tela sem alguem
   decidir (SQL-32). */
const COLUNAS = "id, obra_codigo, seq, numero, descricao, status, total_supressao, total_adicao, criado_em, criado_por, atualizado_em, atualizado_por, versao";
const TETO_DA_LISTA = 2000;

const codigoDoPedido = (req) => req.valido.param.codigo;

const rotas = express.Router();
rotas.use(exigirLogin, exigirMembro);

/* Sem obra no pedido = TODOS os que a pessoa enxerga: e' assim que a tela de
   Aditivos e o painel do Inicio abrem. Quem recorta e' o RLS.
 *
 * A lista leva o documento (`dados`), e nao e' desperdicio: os aditivos
 * aprovados entram na conta do orcamento, do CMV e do Plano de Compras, e
 * essa conta le os grupos de dentro do documento. Para EDITAR, porem,
 * ninguem parte da lista: quem abre um aditivo o carrega por id, fresco. */
rotas.get("/api/aditivos",
  zValidator("query", esquemas.queryDaObra),
  async (req, res) => {
    let q = req.supabase.from("aditivo").select(`${COLUNAS}, dados`)
      .order("obra_codigo").order("seq", { ascending: false }).limit(TETO_DA_LISTA);
    if (req.valido.query.obra) q = q.eq("obra_codigo", req.valido.query.obra);
    const { data, error } = await q;
    if (error) return erroDoBanco(res, error);
    return res.json({ aditivos: data || [] });
  });

rotas.get("/api/obras/:codigo/aditivos/:id",
  zValidator("param", esquemas.paramDocumentoDaObra),
  exigirObra(codigoDoPedido),
  async (req, res) => {
    const { data, error } = await req.supabase.from("aditivo")
      .select(`${COLUNAS}, dados`)
      .eq("id", req.valido.param.id).eq("obra_codigo", codigoDoPedido(req)).maybeSingle();
    if (error) return erroDoBanco(res, error);
    if (!data) return res.status(404).json({ error: "Registro não encontrado." });
    return res.json({ aditivo: data });
  });

/* O numero e a sequencia saem do banco, com trava por obra: contados na
   tela, duas pessoas criando ao mesmo tempo pediam o mesmo "2450/3". */
rotas.post("/api/obras/:codigo/aditivos",
  jsonDoDocumento,
  zValidator("param", esquemas.paramCodigoObra),
  exigirEdicaoDeObra(codigoDoPedido),
  zValidator("json", esquemas.aditivoNovo),
  async (req, res) => {
    const { data, error } = await req.supabase.rpc("criar_aditivo", {
      p_obra: codigoDoPedido(req),
      p_campos: req.valido.json.campos,
    });
    if (error) return erroDaFuncao(res, error, SQL);
    return responderDaFuncao(res, data);
  });

rotas.post("/api/obras/:codigo/aditivos/:id/gravar",
  jsonDoDocumento,
  zValidator("param", esquemas.paramDocumentoDaObra),
  exigirEdicaoDeObra(codigoDoPedido),
  zValidator("json", esquemas.gravacaoDoAditivo),
  async (req, res) => {
    const { data, error } = await req.supabase.rpc("salvar_aditivo", {
      p_id: req.valido.param.id,
      p_versao: req.valido.json.versao,
      p_campos: req.valido.json.campos,
    });
    if (error) return erroDaFuncao(res, error, SQL);
    return responderDaFuncao(res, data);
  });

/* Apagar continua sendo do banco: so' quem criou, ou um administrador
   (policy do rls-reforco.sql). O `.select()` e' o que separa "apagou" de "o
   RLS recusou e voltaram zero linhas" — sem ele, a tela tirava o aditivo da
   lista e ele continuava no banco. */
rotas.delete("/api/obras/:codigo/aditivos/:id",
  zValidator("param", esquemas.paramDocumentoDaObra),
  exigirEdicaoDeObra(codigoDoPedido),
  async (req, res) => {
    const { data, error } = await req.supabase.from("aditivo").delete()
      .eq("id", req.valido.param.id).eq("obra_codigo", codigoDoPedido(req)).select("id");
    if (error) return erroDoBanco(res, error);
    if (!data?.length) return res.status(403).json({ error: "Só quem criou o aditivo, ou um administrador, pode excluí-lo." });
    return res.json({ apagado: true });
  });

module.exports = { rotasDeAditivos: rotas, CAMINHOS_DE_ADITIVO };
