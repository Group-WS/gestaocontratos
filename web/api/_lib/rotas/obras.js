/**
 * Ciclo de vida das obras — o que o time decidiu acompanhar.
 * -----------------------------------------------------------
 * GET   /api/obras                    -> as obras do banco (o que sobrevive a recarregar)
 * POST  /api/obras                    -> "Dar start": passa a existir por conta propria
 * PATCH /api/obras/:codigo/situacao   -> concluir (vai pro Arquivo) ou reabrir
 * PATCH /api/obras/:codigo/papel      -> GC, Taylor Made e Executivo (Equipe da obra)
 * PATCH /api/obras/:codigo/endereco   -> o endereco corrigido a' mao
 *
 * O Monday lista tudo que existe; a tabela `obra` guarda o que o time
 * decidiu acompanhar. Obra do Monday que ninguem iniciou e' so' uma
 * sugestao — aparece em "Novas obras" e mais nada.
 *
 * Antes era o NAVEGADOR que falava com a tabela (VH-02). Mudou o CAMINHO,
 * nao a regra: o que a tela recebe, inclusive o silencio e a frase de cada
 * erro, e' o mesmo de quando ela mesma consultava o banco. A decisao que
 * dependia do CODIGO do erro do Postgres (a coluna que ainda nao existe)
 * mora aqui agora, e a tela recebe a lista ja' resolvida.
 *
 * Molde das rotas de dados: valida -> autoriza -> fala com o banco com o
 * client do usuario (RLS) -> responde, com o erro do banco traduzido.
 */

const express = require("express");
const { exigirLogin, exigirMembro, exigirPerfilDeEdicao, exigirEdicaoDeObra } = require("../auth.js");
const { zValidator, z, esquemas } = require("../validacao.js");
const { erroDoBanco } = require("../erroDoBanco.js");

/* Tudo que descreve a obra, e nao so' a situacao.
   Obra cadastrada a' mao nao existe no Monday: se a leitura do banco
   devolvesse so' `situacao`, nao haveria como remonta-la, e ela sumiria a
   cada recarregada — que foi exatamente o que aconteceu com a 2517.
   Nunca `select("*")`: as colunas vao listadas (SQL-32). */
const COLUNAS_OBRA = "codigo, nome, squad, situacao, iniciada_em, concluida_em, cliente, endereco, gc, board_id, valor_vendido";
const COLUNAS_NOVAS = `${COLUNAS_OBRA}, tailor_made, responsavel_executivo`;
/* O "Dar start" e o concluir/reabrir sempre devolveram so' isto — a tela
   guarda a linha inteira que vier, entao o recorte fica igual ao de antes. */
const COLUNAS_DA_SITUACAO = "codigo, nome, squad, situacao, iniciada_em, concluida_em";

/* Coluna nova (tailor_made, responsavel_executivo) que ainda nao existe
   no banco nao pode derrubar a lista de obras INTEIRA.

   Entre o deploy do app e alguem rodar a migracao existe uma janela em
   que o Postgres rejeita a leitura inteira por causa de uma coluna
   desconhecida — e como e' ESTA rota que preenche `registro` (de onde
   sai "essa obra esta' ativa?"), o efeito era o pior possivel: toda obra
   ativa virava invisivel, como se tivesse sumido. Aconteceu de verdade
   em 2026-09-05, com as colunas de Equipe da obra. */
const faltaColuna = (error) => !!error && (
  error.code === "42703" || error.code === "PGRST204"
  || /column .* does not exist|Could not find the/i.test(error.message || ""));

/* ---------- o que cada rota aceita (VH-06) ---------- */

// A mesma grafia de codigo que as outras rotas de obra ja' usam.
const codigoDeObra = esquemas.paramCodigoObra.shape.codigo;
const texto = (max) => z.string().max(max);

/* O objeto da obra como o app o monta (a mesma sidebar), nos nomes do
   front; quem traduz pros nomes das colunas e' esta rota. */
const obraNova = z.object({
  codigo: codigoDeObra,
  nome: texto(400).nullish(),
  squad: texto(120).nullish(),
  boardId: texto(40).nullish(),
  cliente: texto(400).nullish(),
  endereco: texto(500).nullish(),
  gc: texto(200).nullish(),
  valorVendido: z.number().finite().nullish(),
}).strict();

const corpoSituacao = z.object({ situacao: z.enum(["ativa", "concluida"]) }).strict();
const corpoPapel = z.object({
  papel: z.enum(["gc", "tailor_made", "responsavel_executivo"]),
  email: texto(200).nullish(),
}).strict();
const corpoEndereco = z.object({ endereco: texto(500).nullish() }).strict();

/* Sem a migracao rodada nao tem como salvar o papel de jeito nenhum (e' o
   proprio UPDATE que toca a coluna nova), entao o erro precisa dizer isso
   com todas as letras em vez de estourar cru na tela. Texto palavra por
   palavra igual ao que a tela ja' mostrava. */
const FALTA_A_MIGRACAO = {
  tailor_made: "Falta rodar supabase/equipe-da-obra.sql — a coluna de Taylor Made ainda não existe.",
  responsavel_executivo: "Falta rodar supabase/equipe-da-obra.sql — a coluna de Executivo ainda não existe.",
};

const codigoDoPedido = (req) => req.valido.param.codigo;

/** A obra relida sem as colunas novas — a segunda tentativa do `faltaColuna`. */
async function semAsColunasNovas(req, res, codigo) {
  const retry = await req.supabase.from("obra").select(COLUNAS_OBRA).eq("codigo", codigo).single();
  if (retry.error) return erroDoBanco(res, retry.error);
  return res.json(retry.data);
}

const rotas = express.Router();
rotas.use(exigirLogin, exigirMembro);

/* Quem o time ja' iniciou. Quais obras aparecem aqui quem decide e' o RLS
   (`public.minhas_obras()`), como ja' era quando o navegador consultava. */
rotas.get("/api/obras", async (req, res) => {
  const { data, error } = await req.supabase.from("obra").select(COLUNAS_NOVAS);
  if (!error) return res.json(data || []);
  if (!faltaColuna(error)) return erroDoBanco(res, error);

  const retry = await req.supabase.from("obra").select(COLUNAS_OBRA);
  if (retry.error) return erroDoBanco(res, retry.error);
  return res.json(retry.data || []);
});

/**
 * Registra a obra no banco — e' o "Dar start". A partir daqui ela passa a
 * existir por conta propria: some do Monday e ela continua aqui.
 *
 * Aqui a barreira e' `exigirPerfilDeEdicao`, e nao `exigirEdicaoDeObra`
 * como nas outras: a obra esta' sendo CRIADA, ainda nao existe linha
 * nenhuma para conferir — a barreira de obra devolveria 404 em toda
 * criacao. Quem pode criar e' quem edita (master, admin, geral, gc), e o
 * `with check` das obras no banco continua sendo a ultima palavra.
 */
rotas.post("/api/obras",
  zValidator("json", obraNova),
  exigirPerfilDeEdicao,
  async (req, res) => {
    const obra = req.valido.json;
    /* GRAVA E SO' DEPOIS LE (23/09/2026). O `insert ... select` devolvia
       42501 para TODO perfil, master inclusive: com RETURNING, a linha nova
       precisa passar na policy de LEITURA ("obra: ler" = codigo in
       minhas_obras()), e minhas_obras() consulta a propria tabela obra com
       o retrato de antes do insert — a linha recem-criada nao esta' la'.
       Separados, o insert passa pelo `with check` de criar e a leitura
       seguinte ja' enxerga a obra. */
    const { error } = await req.supabase
      .from("obra")
      .insert({
        codigo: obra.codigo,
        nome: obra.nome,
        squad: obra.squad,
        board_id: obra.boardId || null,
        cliente: obra.cliente,
        endereco: obra.endereco,
        gc: obra.gc,
        valor_vendido: obra.valorVendido || null,
        situacao: "ativa",
      });
    if (error) return erroDoBanco(res, error);
    const { data, error: erroLeitura } = await req.supabase
      .from("obra")
      .select(COLUNAS_DA_SITUACAO)
      .eq("codigo", obra.codigo)
      .maybeSingle();
    if (erroLeitura) return erroDoBanco(res, erroLeitura);
    // O GC que cria obra de outro GC nao a enxerga: criou, mas nao le.
    return res.json(data || { codigo: obra.codigo, nome: obra.nome, squad: obra.squad, situacao: "ativa", iniciada_em: null, concluida_em: null });
  });

/**
 * Concluida tira da sidebar e manda pro Arquivo (so' leitura); ativa traz
 * de volta — pra quando alguem concluir sem querer.
 */
rotas.patch("/api/obras/:codigo/situacao",
  zValidator("param", esquemas.paramCodigoObra),
  zValidator("json", corpoSituacao),
  exigirEdicaoDeObra(codigoDoPedido),
  async (req, res) => {
    const campos = req.valido.json.situacao === "concluida"
      ? { situacao: "concluida", concluida_em: new Date().toISOString() }
      : { situacao: "ativa", concluida_em: null };
    const { data, error } = await req.supabase
      .from("obra")
      .update(campos)
      .eq("codigo", codigoDoPedido(req))
      .select(COLUNAS_DA_SITUACAO)
      .single();
    if (error) return erroDoBanco(res, error);
    return res.json(data);
  });

/**
 * Quem responde pela obra.
 *
 * Guarda o E-MAIL, nao o nome: e' a identidade que o login ja' da', e e' o
 * unico jeito de "as minhas obras" saber quais sao as minhas sem alguem
 * manter uma tabela de nomes em dia. O nome bonito sai do proprio e-mail
 * na hora de mostrar. Os tres papeis de "Equipe da obra" tem cada um a sua
 * coluna porque uma obra pode ter os tres ao mesmo tempo.
 *
 * O e-mail aqui e' o de QUEM VAI RESPONDER pela obra, escolhido na tela —
 * nao o de quem chamou (esse vem do login e nunca do corpo, SEG-13).
 */
rotas.patch("/api/obras/:codigo/papel",
  zValidator("param", esquemas.paramCodigoObra),
  zValidator("json", corpoPapel),
  exigirEdicaoDeObra(codigoDoPedido),
  async (req, res) => {
    const codigo = codigoDoPedido(req);
    const { papel, email } = req.valido.json;
    const { data, error } = await req.supabase
      .from("obra")
      .update({ [papel]: email || null })
      .eq("codigo", codigo)
      .select(COLUNAS_NOVAS)
      .single();
    if (!error) return res.json(data);
    if (!faltaColuna(error)) return erroDoBanco(res, error);

    /* No GC o UPDATE em si (so' a coluna `gc`) sempre funciona; so' o
       SELECT de retorno pode pedir uma coluna que ainda nao existe. Nos
       outros dois e' o proprio UPDATE que toca a coluna nova — ai nao tem
       o que reler, e a pessoa precisa saber qual SQL falta. */
    if (papel === "gc") return semAsColunasNovas(req, res, codigo);
    return res.status(503).json({ error: FALTA_A_MIGRACAO[papel], code: error.code || null });
  });

/* O endereco da obra, corrigido a' mao (so' administrador e admin master
   veem o botao). Vazio grava nulo, e a tela volta ao endereco do cadastro
   do Sienge. */
rotas.patch("/api/obras/:codigo/endereco",
  zValidator("param", esquemas.paramCodigoObra),
  zValidator("json", corpoEndereco),
  exigirEdicaoDeObra(codigoDoPedido),
  async (req, res) => {
    const codigo = codigoDoPedido(req);
    const { data, error } = await req.supabase
      .from("obra")
      .update({ endereco: String(req.valido.json.endereco || "").trim() || null })
      .eq("codigo", codigo)
      .select(COLUNAS_NOVAS)
      .single();
    if (!error) return res.json(data);
    // Como no GC: o UPDATE sempre funciona; so' o SELECT de volta pode pedir coluna que falta.
    if (!faltaColuna(error)) return erroDoBanco(res, error);
    return semAsColunasNovas(req, res, codigo);
  });

module.exports = { rotasDeObras: rotas };
