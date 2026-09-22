/**
 * O espelho do Sienge no nosso banco — as obras do ERP e o rastro dos envios.
 * -----------------------------------------------------------
 * GET  /api/sienge-obras                         -> o espelho estatico das obras (com os pinos do mapa)
 * PUT  /api/sienge-obras/:codigo/status          { status }  -> a marcacao manual ativa/finalizada
 *
 * POST /api/sienge-solicitacoes                  { ... }     -> abre o registro ANTES do envio -> { id }
 * PUT  /api/sienge-solicitacoes/:id              { ... }     -> fecha com o que o Sienge respondeu
 * PUT  /api/sienge-solicitacoes/:id/reconciliar  { ... }     -> encerra um pendente depois de conferir
 * GET  /api/sienge-solicitacoes?obra=&limite=                -> o historico de envios da obra
 * GET  /api/sienge-solicitacoes/pendentes?obra=              -> os envios que ficaram sem resposta
 * GET  /api/sienge-solicitacoes/mesmo-conteudo?obra=&assinatura=  -> o envio anterior igual, ou null
 *
 * Ate' 09/2026 o navegador falava com estas duas tabelas direto. Mudou o
 * CAMINHO (navegador -> API -> banco, VH-02), nao o comportamento: mesma
 * lista, mesmas frases, mesmo silencio. As decisoes que dependem do codigo
 * de erro do Postgres vieram junto, porque quem fala com o banco e' quem
 * pode toma'-las: a coluna que ainda nao existe (42703) e a chave de
 * idempotencia repetida (23505).
 *
 * O namespace e' `sienge-obras` / `sienge-solicitacoes` de proposito:
 * `/api/sienge/...` e' o do mondayApp.js, que fala com o ERP de verdade.
 * Aqui nada sai para o Sienge — so' o nosso registro.
 *
 * Molde das rotas de dados: valida -> autoriza -> fala com o banco com o
 * client do usuario (RLS) -> responde, com o erro do banco traduzido.
 */

const express = require("express");
const { exigirLogin, exigirMembro, exigirObra, exigirEdicaoDeObra, podeEditarObra } = require("../auth.js");
const { zValidator, z, esquemas } = require("../validacao.js");
const { erroDoBanco } = require("../erroDoBanco.js");

/* ---------- o que pode chegar ---------- */

// Mesmo formato do codigo de obra do resto da API (esquemas.paramCodigoObra).
const codigoDeObra = z.string().trim().min(1).max(40).regex(/^[0-9A-Za-z._-]+$/);
const inteiroPositivo = z.number().int().positive();
// O uuid da TENTATIVA, gerado no navegador. A coluna e' uuid: formato
// errado nao chega a virar pedido ao banco.
const chaveDeIdempotencia = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
// O status da linha, na mesma lista que o check do banco aceita
// (supabase/sienge_solicitacao.sql).
const statusDoEnvio = z.enum(["enviando", "concluido", "parcial", "falhou", "abandonado"]);
/* O payload enviado e a resposta recebida sao o RASTRO: valem como
   vieram, e o que esta' dentro deles e' conferido por quem manda pro
   Sienge (esquemas.solicitacaoDeCompra, na rota /api/sienge/solicitacao).
   Conferir de novo aqui trocaria "o registro nasce antes do envio" por
   "o registro nasce se este arquivo concordar com o formato". */
const objetoJson = z.record(z.string(), z.unknown());

const corpoDoStatusManual = z.object({
  status: z.enum(["ativa", "finalizada"]).nullable(),
}).strict();

const corpoDaAbertura = z.object({
  obraCodigo: codigoDeObra,
  buildingId: inteiroPositivo,
  payload: objetoJson,
  chave: chaveDeIdempotencia,
  assinatura: z.string().trim().min(1).max(120),
  solicitacaoId: inteiroPositivo.nullish(),
}).strict();

const corpoDoFechamento = z.object({
  solicitacaoId: inteiroPositivo.nullish(),
  resposta: objetoJson,
  status: statusDoEnvio,
  ok: z.boolean(),
}).strict();

const queryDaObra = z.object({ obra: codigoDeObra }).strict();
const queryDoHistorico = z.object({
  obra: codigoDeObra,
  limite: z.coerce.number().int().positive().max(500).optional(),
}).strict();
const queryDoMesmoConteudo = z.object({
  obra: codigoDeObra,
  assinatura: z.string().trim().min(1).max(120),
}).strict();

/* ---------- sienge_obra ---------- */

const COLUNAS = "codigo, nome, cidade, estado, status_manual, endereco_completo";
// O endereco completo tambem serve pra obra que nao tem um (o Monday nao
// traz a Localizacao). As coordenadas sao do mapa do Inicio.
const COLUNAS_COM_MAPA = `${COLUNAS}, lat, lng, geo_precisao`;

/* ---------- sienge_solicitacao ---------- */

const COLUNAS_PENDENTE = "id, solicitacao_id, enviado_por, enviado_em, payload, status";
const COLUNAS_MESMO_CONTEUDO = "id, solicitacao_id, enviado_em, enviado_por, status";
/* O payload vem junto no historico: e' ele que guarda o que foi pedido —
   insumo, quantidade, preco e apropriacao. Sem ele o historico diz que
   houve um envio, mas nao o que. */
const COLUNAS_HISTORICO = "id, solicitacao_id, enviado_por, enviado_em, ok, status, payload, resposta";
const LIMITE_PADRAO = 20;

/**
 * A migration desta funcionalidade ainda nao rodou neste banco — coluna
 * que o PostgREST nao acha (PGRST204, ou a mensagem dele sobre o schema
 * cache). E' migration pendente, nao falha passageira: sem distinguir, a
 * orientacao vira "tente de novo" — e tentar de novo nao cria coluna.
 */
const faltaMigration = (error) =>
  error?.code === "PGRST204" || /Could not find the .* column|schema cache/i.test(String(error?.message || ""));

/* A frase que a pessoa le' quando falta migration. O detalhe do PostgREST
   vai junto DE PROPOSITO: e' ele que nomeia a coluna que falta, e e'
   exatamente o que quem for rodar `supabase/sienge_solicitacao.sql`
   precisa ler — a tela mostra esta frase com essa orientacao. Nao e' pilha
   de erro nem texto de excecao: e' o unico detalhe que resolve o problema. */
function avisoDeMigracaoPendente(error) {
  const detalhe = String((error && error.message) || "");
  return `O banco de dados está desatualizado para esta funcionalidade: ${detalhe}`;
}

const rotas = express.Router();
rotas.use(exigirLogin, exigirMembro);

/**
 * O espelho estatico do Sienge: de onde saem nome, cidade e estado do
 * painel de localizacao e os pinos do mapa do Inicio.
 *
 * `sienge_obra` nao e' "uma obra do app": e' o historico inteiro da
 * empresa, com codigos que nunca entraram aqui. Por isso a barreira e' ser
 * do time — o resto quem decide e' o RLS da tabela (leitura liberada para
 * quem esta' logado), como ja' era quando o navegador lia direto.
 */
rotas.get("/api/sienge-obras", async (req, res) => {
  const comMapa = await req.supabase.from("sienge_obra").select(COLUNAS_COM_MAPA);
  if (!comMapa.error) return res.json(comMapa.data || []);
  /* Coluna que ainda nao existe (42703): supabase/sienge-obra-coordenadas.sql
     nao rodou neste banco. A tela segue sem os pinos, em vez de perder a
     lista inteira — o mapa mostra as obras no painel e os estados no mapa.
     Some quando a migration for aplicada em todo ambiente (SQL-03). */
  if (comMapa.error.code !== "42703") return erroDoBanco(res, comMapa.error);
  const { data, error } = await req.supabase.from("sienge_obra").select(COLUNAS);
  if (error) return erroDoBanco(res, error);
  res.json(data || []);
});

/**
 * A marcacao manual — "eu sei que essa esta' finalizada/ativa" — manda mais
 * que qualquer regra automatica (ver `statusSienge` em App.jsx).
 * `status: null` volta a obra pro palpite automatico.
 */
rotas.put("/api/sienge-obras/:codigo/status",
  zValidator("param", esquemas.paramCodigoObra),
  zValidator("json", corpoDoStatusManual),
  async (req, res) => {
    const { codigo } = req.valido.param;
    const { status } = req.valido.json;
    const { error } = await req.supabase
      .from("sienge_obra")
      .update({ status_manual: status })
      .eq("codigo", String(codigo));
    if (error) return erroDoBanco(res, error);
    res.json({ codigo, status });
  });

/**
 * Abre o registro ANTES de falar com o Sienge.
 *
 * Criar solicitacao e' ESCREVER em nome da obra, e este registro e' o
 * primeiro passo desse envio: vale a mesma barreira do POST
 * /api/sienge/solicitacao — so' quem edita aquela obra.
 */
rotas.post("/api/sienge-solicitacoes",
  zValidator("json", corpoDaAbertura),
  exigirEdicaoDeObra((req) => req.valido.json.obraCodigo),
  async (req, res) => {
    const c = req.valido.json;
    const { data, error } = await req.supabase
      .from("sienge_solicitacao")
      .insert({
        obra_codigo: String(c.obraCodigo),
        building_id: Number(c.buildingId),
        solicitacao_id: c.solicitacaoId ?? null,
        // Quem enviou vem do LOGIN, nunca do corpo do pedido (SEG-13).
        enviado_por: req.usuario.email || null,
        payload: c.payload,
        resposta: {},
        ok: false,
        status: "enviando",
        idempotency_key: c.chave,
        assinatura: c.assinatura,
      })
      .select("id")
      .single();

    if (error) {
      /* 23505 = violacao de indice unico: esta MESMA tentativa ja' esta'
         registrada, ou seja, o envio ja' saiu. Deixar passar criaria a
         segunda solicitacao — que e' exatamente o que a chave existe pra
         impedir. O codigo vai na resposta porque e' por ele que a tela
         reconhece este caso (e nao pelo texto da frase). */
      if (error.code === "23505") {
        return res.status(409).json({ error: "Este envio já foi iniciado — não foi enviado de novo.", code: "23505" });
      }
      if (faltaMigration(error)) {
        console.error(JSON.stringify({
          level: "error", event: "sienge_solicitacao_migracao_pendente",
          usuario: req.usuario.id, codigo: error.code || null,
        }));
        return res.status(503).json({ error: avisoDeMigracaoPendente(error), code: "PGRST204" });
      }
      return erroDoBanco(res, error);
    }
    res.json({ id: data.id });
  });

/**
 * Fecha o registro com o que o Sienge respondeu.
 *
 * A linha e' encontrada pelo id, que so' quem abriu o envio tem. Nao ha'
 * checagem de existencia de proposito: id que nao existe nao e' erro,
 * e' o mesmo silencio de antes (o `update` simplesmente nao acha linha).
 * Quem alcanca a linha continua sendo o RLS da tabela, como quando o
 * navegador gravava direto.
 */
/**
 * A BARREIRA DE QUEM SO' TEM O ID.
 *
 * O `exigirEdicaoDeObra` precisa do codigo da obra, e estas duas rotas
 * recebem so' o id do envio — que e' bigint sequencial, ou seja, adivinhavel.
 * Sem isto, qualquer pessoa do time (inclusive o perfil `mehoo`, que nao
 * edita nada) marcava como "abandonado" o envio de uma obra que nao e' dela;
 * e "abandonado" e' exatamente o estado em que a tela de Compras convida a
 * enviar tudo de novo. Le' a obra da propria linha e aplica a mesma regua.
 *
 * "Nao encontrada", nao "proibida": nao confirmamos que o envio existe (SEG-14).
 */
async function exigirEdicaoDoEnvio(req, res, next) {
  const { data, error } = await req.supabase
    .from("sienge_solicitacao")
    .select("obra_codigo")
    .eq("id", req.valido.param.id)
    .maybeSingle();
  if (error) return erroDoBanco(res, error);
  if (data && await podeEditarObra(req, data.obra_codigo)) return next();
  res.status(404).json({ error: "Registro não encontrado." });
}

rotas.put("/api/sienge-solicitacoes/:id",
  zValidator("param", esquemas.paramSolicitacao),
  exigirEdicaoDoEnvio,
  zValidator("json", corpoDoFechamento),
  async (req, res) => {
    const c = req.valido.json;
    const { error } = await req.supabase
      .from("sienge_solicitacao")
      .update({
        solicitacao_id: c.solicitacaoId ?? null,
        resposta: c.resposta,
        status: c.status,
        ok: !!c.ok,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", req.valido.param.id);
    if (error) return erroDoBanco(res, error);
    res.json({ ok: true });
  });

/** Encerra um pendente depois de conferir o que o Sienge realmente tem. */
rotas.put("/api/sienge-solicitacoes/:id/reconciliar",
  zValidator("param", esquemas.paramSolicitacao),
  exigirEdicaoDoEnvio,
  zValidator("json", corpoDoFechamento),
  async (req, res) => {
    const c = req.valido.json;
    const agora = new Date().toISOString();
    const { error } = await req.supabase
      .from("sienge_solicitacao")
      .update({
        solicitacao_id: c.solicitacaoId ?? null,
        resposta: c.resposta,
        status: c.status,
        ok: !!c.ok,
        atualizado_em: agora,
        reconciliado_em: agora,
        // Quem conferiu vem do LOGIN, nunca do corpo do pedido (SEG-13).
        reconciliado_por: req.usuario.email || null,
      })
      .eq("id", req.valido.param.id);
    if (error) return erroDoBanco(res, error);
    res.json({ ok: true });
  });

/** O historico de envios de uma obra, do mais recente pro mais antigo. */
rotas.get("/api/sienge-solicitacoes",
  zValidator("query", queryDoHistorico),
  exigirObra((req) => req.valido.query.obra),
  async (req, res) => {
    const { obra, limite } = req.valido.query;
    const { data, error } = await req.supabase
      .from("sienge_solicitacao")
      .select(COLUNAS_HISTORICO)
      .eq("obra_codigo", String(obra))
      .order("enviado_em", { ascending: false })
      .limit(limite ?? LIMITE_PADRAO);
    if (error) return erroDoBanco(res, error);
    res.json(data || []);
  });

/** Os envios desta obra que ficaram sem resposta. */
rotas.get("/api/sienge-solicitacoes/pendentes",
  zValidator("query", queryDaObra),
  exigirObra((req) => req.valido.query.obra),
  async (req, res) => {
    const { data, error } = await req.supabase
      .from("sienge_solicitacao")
      .select(COLUNAS_PENDENTE)
      .eq("obra_codigo", String(req.valido.query.obra))
      .eq("status", "enviando")
      .order("enviado_em", { ascending: false });
    if (error) return erroDoBanco(res, error);
    res.json(data || []);
  });

/** Um envio anterior com o mesmo conteudo, pra tela poder avisar. */
rotas.get("/api/sienge-solicitacoes/mesmo-conteudo",
  zValidator("query", queryDoMesmoConteudo),
  exigirObra((req) => req.valido.query.obra),
  async (req, res) => {
    const { obra, assinatura } = req.valido.query;
    const { data, error } = await req.supabase
      .from("sienge_solicitacao")
      .select(COLUNAS_MESMO_CONTEUDO)
      .eq("obra_codigo", String(obra))
      .eq("assinatura", assinatura)
      .in("status", ["concluido", "parcial", "enviando"])
      .order("enviado_em", { ascending: false })
      .limit(1);
    if (error) return erroDoBanco(res, error);
    res.json(data?.[0] || null);
  });

module.exports = { rotasDeSiengeBanco: rotas };
