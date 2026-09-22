/**
 * Aditivos de obra — supressao, adicao e o saldo entre as duas.
 * -----------------------------------------------------------
 * GET    /api/aditivos?obra=2450   -> as linhas de aditivo (todas, ou so' as da obra)
 * POST   /api/aditivos             -> cria o aditivo da obra, com o numero ja' pronto
 * PATCH  /api/aditivos/:id         -> altera descricao, status e/ou o documento
 * DELETE /api/aditivos/:id         -> exclui (quem pode e' o BANCO que decide)
 *
 * Ate' 22/09/2026 o navegador falava com a tabela direto (VH-02). Mudou o
 * CAMINHO, nao a regra: quem soma o documento continua sendo o front
 * (lib/aditivoDoc.js, onde o teste alcanca sem navegador), e esta rota
 * GRAVA O QUE RECEBE. Nenhuma conta muda de lado nem de formula aqui —
 * aditivo e' dinheiro de contrato, e conta que migra de arquivo e' conta
 * que ninguem confere de novo.
 *
 * Quem ve, quem cria, quem altera e quem exclui continua sendo o RLS
 * (supabase/rls-perfis.sql e supabase/aditivo-exclusao.sql, com a regra
 * "so' o criador ou um administrador apaga"). Por isso aqui basta
 * `exigirMembro` — a mesma porta de antes, nem mais larga nem mais estreita.
 *
 * ATENCAO, pra quem vier endurecer isto: NAO existe barreira por obra, nem
 * aqui nem no banco. As policies de `aditivo` sao `using (true)` /
 * `with check (true)` (supabase/aditivo-exclusao.sql), entao qualquer pessoa
 * ativa — inclusive o perfil `mehoo`, que nao edita nada — pode criar ou
 * alterar aditivo de qualquer obra. Era assim antes da migracao e continua
 * sendo; mudar isso e' uma decisao de acesso, e pede as duas pontas:
 * `exigirEdicaoDeObra` nesta rota e um `with check` por obra no SQL.
 *
 * Molde das rotas de dados: valida -> autoriza -> fala com o banco com o
 * client do usuario (RLS) -> responde, com o erro do banco traduzido.
 */

const express = require("express");
const { exigirLogin, exigirMembro } = require("../auth.js");
const { zValidator, z } = require("../validacao.js");
const { erroDoBanco } = require("../erroDoBanco.js");

/* As colunas que a tela le' (web/src/lib/aditivos.js, `paraApp`). Listadas
   uma a uma, e nao `*`: coluna nova no banco nao vaza pra tela sem alguem
   decidir (SQL-32). */
const COLUNAS = [
  "id", "obra_codigo", "seq", "numero", "descricao", "status", "dados",
  "total_supressao", "total_adicao",
  "criado_em", "criado_por", "atualizado_em", "atualizado_por",
].join(", ");

/* As quatro fases do documento, como o banco as conhece (supabase/aditivos.sql
   e supabase/aditivo-aguardando.sql). Sao as mesmas de STATUS_ADITIVO no
   front — fase nova entra nos tres lugares. */
const STATUS = ["rascunho", "aguardando", "aprovado", "reprovado"];

const codigoDeObra = z.string().trim().min(1).max(40).regex(/^[0-9A-Za-z._-]+$/);
// O id e' `uuid` no banco (gen_random_uuid). Regex, e nao `uuid()`: o que
// interessa e' o formato que a tabela guarda, em qualquer versao do zod.
const idDeAditivo = z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);
/* O documento inteiro: cabecalho, grupos, itens, condicoes. O formato de
   dentro e' do app (aditivoDoc.js), e e' la' que ele e' conferido; aqui vale
   o que a coluna `dados` guarda — um objeto JSON. */
const documento = z.record(z.string(), z.unknown());
const dinheiro = z.number().finite();

const paramId = z.object({ id: idDeAditivo }).strict();
const queryLista = z.object({ obra: codigoDeObra.optional() }).strict();

const corpoCriar = z.object({
  obraCodigo: codigoDeObra,
  seq: z.number().int().positive(),
  numero: z.string().trim().min(1).max(120),
  descricao: z.string().max(20000),
  doc: documento,
  totalSupressao: dinheiro,
  totalAdicao: dinheiro,
}).strict();

/* Os totais VIAJAM COM O DOCUMENTO, sempre os dois. Gravar `dados` novo
   deixando `total_supressao`/`total_adicao` velhos faria o Dashboard, o CMV
   e o Plano de Compras lerem um valor que nao existe mais em documento
   nenhum — e ninguem olha duas colunas numericas pra desconfiar. */
const corpoAlterar = z.object({
  descricao: z.string().max(20000).optional(),
  status: z.enum(STATUS).optional(),
  doc: documento.optional(),
  totalSupressao: dinheiro.optional(),
  totalAdicao: dinheiro.optional(),
}).strict().refine(
  (c) => (c.doc === undefined) === (c.totalSupressao === undefined)
      && (c.doc === undefined) === (c.totalAdicao === undefined),
  { path: ["doc"] },
);

const rotas = express.Router();
rotas.use(exigirLogin, exigirMembro);

rotas.get("/api/aditivos",
  zValidator("query", queryLista),
  async (req, res) => {
    const { obra } = req.valido.query;
    let q = req.supabase.from("aditivo").select(COLUNAS).order("obra_codigo").order("seq", { ascending: false });
    // Sem obra no pedido = TODOS os que a pessoa enxerga: e' assim que a
    // tela de Aditivos e o painel do Inicio abrem.
    if (obra) q = q.eq("obra_codigo", obra);
    const { data, error } = await q;
    if (error) return erroDoBanco(res, error);
    res.json(data || []);
  });

rotas.post("/api/aditivos",
  zValidator("json", corpoCriar),
  async (req, res) => {
    const c = req.valido.json;
    const { data, error } = await req.supabase.from("aditivo").insert({
      obra_codigo: c.obraCodigo,
      seq: c.seq,
      numero: c.numero,
      descricao: c.descricao,
      dados: c.doc,
      total_supressao: c.totalSupressao,
      total_adicao: c.totalAdicao,
      // Quem criou vem do LOGIN, nunca do pedido (SEG-13): e' esse e-mail
      // que a politica de exclusao compara pra dizer quem pode apagar.
      criado_por: req.usuario.email,
      atualizado_por: req.usuario.email,
    }).select(COLUNAS).single();
    if (error) return erroDoBanco(res, error);
    res.json(data);
  });

rotas.patch("/api/aditivos/:id",
  zValidator("param", paramId),
  zValidator("json", corpoAlterar),
  async (req, res) => {
    const c = req.valido.json;
    const campos = { atualizado_em: new Date().toISOString(), atualizado_por: req.usuario.email };
    if (c.descricao !== undefined) campos.descricao = c.descricao;
    if (c.status !== undefined) campos.status = c.status;
    if (c.doc !== undefined) {
      campos.dados = c.doc;
      campos.total_supressao = c.totalSupressao;
      campos.total_adicao = c.totalAdicao;
    }
    const { data, error } = await req.supabase
      .from("aditivo").update(campos).eq("id", req.valido.param.id).select(COLUNAS).single();

    /* A fase "Aguardando cliente" so' existe no banco depois do SQL: antes
       disso o Postgres recusa a linha com um erro que nao diz o que fazer
       ("violates check constraint"), e a pessoa fica achando que o app
       quebrou. */
    if (error?.code === "23514" && /status/i.test(error.message || "")) {
      return res.status(422).json({
        error: "O banco ainda não conhece a fase “Aguardando cliente”: falta rodar supabase/aditivo-aguardando.sql no Supabase (SQL Editor).",
        code: error.code,
      });
    }
    if (error) return erroDoBanco(res, error);
    res.json(data);
  });

rotas.delete("/api/aditivos/:id",
  zValidator("param", paramId),
  async (req, res) => {
    /* Sem conferir se apagou alguma coisa, de proposito: quem pode apagar e'
       a politica do banco (criador ou administrador), e ela responde
       apagando ZERO linhas — exatamente como respondia quando o navegador
       chamava o banco direto. A tela ja' confere antes, e o recado de
       "so' quem criou" e' dela. */
    const { error } = await req.supabase.from("aditivo").delete().eq("id", req.valido.param.id);
    if (error) return erroDoBanco(res, error);
    res.status(204).end();
  });

module.exports = { rotasDeAditivos: rotas };
