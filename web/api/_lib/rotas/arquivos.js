/**
 * Arquivos da obra — o deposito privado, aberto so' pelo servidor.
 * -----------------------------------------------------------
 * POST /api/arquivos/envio    -> assina a subida: { caminho, token }
 * POST /api/arquivos/link     -> endereco temporario pra ver ou baixar: { url }
 * POST /api/arquivos/remover  -> apaga o arquivo trocado
 *
 * O balde `obra-arquivos` e' PRIVADO: contrato e documento assinado de
 * cliente nao ficam num endereco que qualquer um abre. Por isso nao existe
 * URL publica aqui — cada leitura pede um endereco temporario.
 *
 * Antes o navegador falava direto com o Storage. Agora ele pede aqui, e
 * quem monta o caminho e' o servidor: obra + chave + carimbo de tempo. O
 * navegador manda o NOME do arquivo, nunca onde ele vai ser gravado.
 *
 * O arquivo em si nao passa por esta funcao (a Vercel corta o corpo em
 * 4,5 MB e o balde aceita 50 MB): a rota assina, o navegador sobe pelo
 * endereco assinado. Ver web/src/lib/storage.js.
 *
 * Tudo com `req.supabase`, o client do proprio usuario: as policies de
 * `storage.objects` continuam valendo — inclusive a do CONTRATO, que so'
 * o administrador abre (supabase/contrato-restrito.sql).
 */

const express = require("express");
const { exigirLogin, exigirMembro } = require("../auth.js");
const { zValidator, z } = require("../validacao.js");
const { assinarEnvio, assinarLeitura, erroDoStorage } = require("../storage.js");

const BALDE = "obra-arquivos";

/* O endereco temporario some sozinho depois de uma hora — o tempo de uma
   janela de trabalho, nao mais que isso. */
const MINUTOS_DO_LINK = 60;

const FORMATO = "Os dados enviados não estão no formato esperado.";

const codigoDeObra = z.string().trim().min(1).max(40).regex(/^[0-9A-Za-z._-]+$/);
/* A gaveta dentro da obra: `especificacao`, `contrato`, `assinatura-cliente`,
   `avulso`… E' ela que a policy do contrato le (a segunda pasta do caminho),
   entao nao pode aceitar barra nem ponto-ponto. */
const chaveDoArquivo = z.string().trim().min(1).max(40).regex(/^[a-z][a-z0-9-]*$/);
/* O nome ja' chega saneado pelo navegador (`nomeSeguro`, em
   web/src/lib/arquivos.js): o Storage so' aceita este subconjunto de
   caracteres no caminho. Aqui se confere que chegou assim mesmo. */
const nomeNoCaminho = z.string().min(1).max(80).regex(/^[A-Za-z0-9._-]+$/);
const caminhoNoBalde = z.string().trim().min(1).max(400);

const corpoDoEnvio = z.object({
  obraCodigo: codigoDeObra,
  chave: chaveDoArquivo,
  nome: nomeNoCaminho,
}).strict();

/* `baixar: true` manda o navegador SALVAR; sem ele, ele ABRE o PDF na aba.
   Sao duas coisas diferentes e as duas sao pedidas: quem vai conferir uma
   prancha quer ver, quem vai mandar pro fornecedor quer o arquivo. Mesmo
   link assinado, uma opcao a mais. */
const corpoDoLink = z.object({
  caminho: caminhoNoBalde,
  baixar: z.boolean().optional(),
}).strict();

const corpoDaRemocao = z.object({ caminho: caminhoNoBalde }).strict();

const rotas = express.Router();
rotas.use(exigirLogin, exigirMembro);

/**
 * Assina a subida de UM arquivo.
 *
 * O caminho leva a hora do envio, entao trocar um caderno nunca sobrescreve
 * o anterior no meio de um download em andamento — quem chama apaga o
 * antigo depois, por `/api/arquivos/remover`. Por isso `upsert: false`:
 * caminho novo a cada envio, nada por cima de nada.
 */
rotas.post("/api/arquivos/envio",
  zValidator("json", corpoDoEnvio),
  async (req, res) => {
    const { obraCodigo, chave, nome } = req.valido.json;
    const alvo = `${obraCodigo}/${chave}/${Date.now()}-${nome}`;
    const { erroDeCaminho, error, caminho, token } = await assinarEnvio(req.supabase, BALDE, alvo, { upsert: false });
    if (erroDeCaminho) return res.status(400).json({ error: FORMATO, campos: ["nome"] });
    if (error) return erroDoStorage(res, error);
    res.json({ caminho, token });
  });

/** Endereco temporario pra ver ou baixar. Some sozinho depois de uma hora. */
rotas.post("/api/arquivos/link",
  zValidator("json", corpoDoLink),
  async (req, res) => {
    const { caminho, baixar = true } = req.valido.json;
    const { erroDeCaminho, error, url } = await assinarLeitura(req.supabase, BALDE, caminho, {
      segundos: MINUTOS_DO_LINK * 60,
      baixar,
    });
    if (erroDeCaminho) return res.status(400).json({ error: FORMATO, campos: ["caminho"] });
    if (error) return erroDoStorage(res, error);
    res.json({ url });
  });

/**
 * Apaga o arquivo trocado. E' faxina: quem chama nao mostra erro na tela,
 * porque o arquivo novo ja' esta' guardado e o antigo so' ocupa espaco.
 */
rotas.post("/api/arquivos/remover",
  zValidator("json", corpoDaRemocao),
  async (req, res) => {
    const { error } = await req.supabase.storage.from(BALDE).remove([req.valido.json.caminho]);
    if (error) return erroDoStorage(res, error);
    res.json({ ok: true });
  });

module.exports = { rotasDeArquivos: rotas };
