/**
 * Registro dos arquivos da obra — quem anexou, trocou ou removeu, e quando.
 * -----------------------------------------------------------
 * GET  /api/obras/:codigo/arquivos-eventos  -> { eventos: [...] } (ou { semTabela: true, eventos: [] })
 * POST /api/obras/:codigo/arquivos-eventos  -> registra um evento e devolve a linha
 *
 * Mesmo molde de rotas/importacoes.js (23/09/2026). A tabela e'
 * supabase/obra-arquivo-evento.sql e so' cresce. O AUTOR vem do login
 * (SEG-13). Quem decide que so' administrador le e registra o CONTRATO e' o
 * banco (a policy); aqui a rota so' repassa.
 *
 * Tabela ainda nao criada nao quebra nada: a leitura devolve lista vazia com
 * `semTabela`, e o registro devolve 503 com o nome do SQL que falta.
 */

const express = require("express");
const { exigirLogin, exigirMembro, exigirObra, exigirEdicaoDeObra } = require("../auth.js");
const { zValidator, z } = require("../validacao.js");
const { erroDoBanco } = require("../erroDoBanco.js");

const semTabela = (erro) => erro?.code === "42P01" || erro?.code === "PGRST205";

/* As colunas que a tela le'. Uma a uma, nunca `*` (SQL-32). */
const COLUNAS = "id, acao, tipo, titulo, arquivo_nome, arquivo_anterior, caminho, autor, criado_em";
const LIMITE = 200;

const ACOES = ["anexou", "trocou", "removeu"];
const TIPOS = ["criativo", "especificacao", "marcenaria", "projeto", "contrato", "apresentacao", "assinatura", "avulso"];

const codigoDeObra = z.string().trim().min(1).max(40).regex(/^[0-9A-Za-z._-]+$/);
const paramObra = z.object({ codigo: codigoDeObra }).strict();

const corpoNovo = z.object({
  acao: z.enum(ACOES),
  tipo: z.enum(TIPOS),
  titulo: z.string().trim().min(1).max(255),
  arquivoNome: z.string().trim().min(1).max(255),
  arquivoAnterior: z.string().trim().max(255).nullish(),
  caminho: z.string().trim().max(1024).nullish(),
}).strict();

const codigoDoPedido = (req) => req.valido.param.codigo;

const rotas = express.Router();
rotas.use(exigirLogin, exigirMembro);

rotas.get("/api/obras/:codigo/arquivos-eventos",
  zValidator("param", paramObra),
  exigirObra(codigoDoPedido),
  async (req, res) => {
    const { data, error } = await req.supabase
      .from("obra_arquivo_evento")
      .select(COLUNAS)
      .eq("obra_codigo", codigoDoPedido(req))
      .order("criado_em", { ascending: false })
      .limit(LIMITE);

    if (error) {
      if (semTabela(error)) return res.json({ semTabela: true, eventos: [] });
      return erroDoBanco(res, error);
    }
    res.json({ eventos: data || [] });
  });

rotas.post("/api/obras/:codigo/arquivos-eventos",
  zValidator("param", paramObra),
  exigirEdicaoDeObra(codigoDoPedido),
  zValidator("json", corpoNovo),
  async (req, res) => {
    const c = req.valido.json;
    const { data, error } = await req.supabase
      .from("obra_arquivo_evento")
      .insert({
        obra_codigo: codigoDoPedido(req),
        acao: c.acao,
        tipo: c.tipo,
        titulo: c.titulo,
        arquivo_nome: c.arquivoNome,
        arquivo_anterior: c.arquivoAnterior || null,
        caminho: c.caminho || null,
        // O autor vem do LOGIN, nunca do corpo do pedido (SEG-13).
        autor: req.usuario.email,
      })
      .select(COLUNAS)
      .single();

    if (error) {
      if (semTabela(error)) {
        return res.status(503).json({
          error: "O registro de arquivos ainda não foi criado no banco — falta rodar supabase/obra-arquivo-evento.sql.",
          code: error.code,
        });
      }
      return erroDoBanco(res, error);
    }
    res.json(data);
  });

module.exports = { rotasDeArquivoEventos: rotas };
