/**
 * Registro das importacoes da obra — o arquivo, quem subiu, quando.
 * -----------------------------------------------------------
 * GET  /api/obras/:codigo/importacoes  -> { importacoes: [...] } (ou { semTabela: true, importacoes: [] })
 * POST /api/obras/:codigo/importacoes  -> registra uma importacao e devolve a linha
 *
 * Subir o Vendido Contrato, o Vendido Planilha ou a Planilha Executivo nao
 * deixava rastro (23/09/2026): nem o nome do arquivo, nem quem, nem quando.
 * A tabela e' supabase/obra-importacao.sql, e so' cresce — nao ha' rota de
 * editar nem de apagar, e o banco tambem nao deixa.
 *
 * O AUTOR vem do login (`req.usuario.email`), nunca do pedido (SEG-13); o
 * `with check` do banco recusa assinar por outro.
 *
 * Registrar exige `exigirEdicaoDeObra`: so' importa quem edita. Ler exige
 * `exigirObra`: quem enxerga a obra ve de onde vieram os dados dela.
 *
 * Tabela ainda nao criada (42P01 / PGRST205) nao quebra a importacao: a
 * leitura devolve lista vazia com `semTabela`, e o registro devolve 503 com
 * o nome do SQL que falta. A tela segue importando — so' o rastro nao grava.
 */

const express = require("express");
const { exigirLogin, exigirMembro, exigirObra, exigirEdicaoDeObra } = require("../auth.js");
const { zValidator, z } = require("../validacao.js");
const { erroDoBanco } = require("../erroDoBanco.js");

const semTabela = (erro) => erro?.code === "42P01" || erro?.code === "PGRST205";

/* As colunas que a tela le'. Uma a uma, nunca `*` (SQL-32). */
const COLUNAS = "id, documento, arquivo_nome, arquivo_tamanho, n_itens, verbas_trocadas, verbas_mantidas, autor, criado_em";

/* Quantas a tela pede de uma vez. O historico de uma obra e' curto (uma
   linha por arquivo subido), mas a leitura nasce limitada (SQL-33). */
const LIMITE = 50;

const DOCUMENTOS = ["vendido_contrato", "vendido_planilha", "planilha_executivo"];

const codigoDeObra = z.string().trim().min(1).max(40).regex(/^[0-9A-Za-z._-]+$/);
const paramObra = z.object({ codigo: codigoDeObra }).strict();

// Numero de verba da EAP ("02") ou o "—" dos grupos fora do padrao.
const numDeVerba = z.string().trim().min(1).max(20);

const corpoNovo = z.object({
  documento: z.enum(DOCUMENTOS),
  arquivoNome: z.string().trim().min(1).max(255),
  arquivoTamanho: z.number().int().nonnegative().nullish(),
  nItens: z.number().int().nonnegative(),
  verbasTrocadas: z.array(numDeVerba).max(200).default([]),
  verbasMantidas: z.array(numDeVerba).max(200).default([]),
}).strict();

const codigoDoPedido = (req) => req.valido.param.codigo;

const rotas = express.Router();
rotas.use(exigirLogin, exigirMembro);

rotas.get("/api/obras/:codigo/importacoes",
  zValidator("param", paramObra),
  exigirObra(codigoDoPedido),
  async (req, res) => {
    const { data, error } = await req.supabase
      .from("obra_importacao")
      .select(COLUNAS)
      .eq("obra_codigo", codigoDoPedido(req))
      .order("criado_em", { ascending: false })
      .limit(LIMITE);

    if (error) {
      if (semTabela(error)) return res.json({ semTabela: true, importacoes: [] });
      return erroDoBanco(res, error);
    }
    res.json({ importacoes: data || [] });
  });

rotas.post("/api/obras/:codigo/importacoes",
  zValidator("param", paramObra),
  exigirEdicaoDeObra(codigoDoPedido),
  zValidator("json", corpoNovo),
  async (req, res) => {
    const c = req.valido.json;
    const { data, error } = await req.supabase
      .from("obra_importacao")
      .insert({
        obra_codigo: codigoDoPedido(req),
        documento: c.documento,
        arquivo_nome: c.arquivoNome,
        arquivo_tamanho: c.arquivoTamanho ?? null,
        n_itens: c.nItens,
        verbas_trocadas: c.verbasTrocadas,
        verbas_mantidas: c.verbasMantidas,
        // O autor vem do LOGIN, nunca do corpo do pedido (SEG-13).
        autor: req.usuario.email,
      })
      .select(COLUNAS)
      .single();

    if (error) {
      if (semTabela(error)) {
        return res.status(503).json({
          error: "O registro de importações ainda não foi criado no banco — falta rodar supabase/obra-importacao.sql.",
          code: error.code,
        });
      }
      return erroDoBanco(res, error);
    }
    res.json(data);
  });

module.exports = { rotasDeImportacoes: rotas };
