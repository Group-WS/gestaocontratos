/**
 * Pessoas, acessos e foto de perfil — quem entra no sistema.
 * -----------------------------------------------------------
 * GET    /api/pessoas                  -> a equipe inteira (as linhas cruas de `pessoa`)
 * PUT    /api/pessoas                  -> grava uma pessoa (upsert por e-mail)
 * DELETE /api/pessoas/:email           -> tira a pessoa da equipe
 * POST   /api/pessoas/entrada          -> a linha que nasce no primeiro login
 * POST   /api/acessos/registrar        -> marca o ultimo acesso de quem chamou
 * POST   /api/pessoas/foto/envio       -> assina a subida da foto: { caminho, token }
 * PUT    /api/pessoas/foto             -> grava o caminho da foto na PROPRIA linha
 * GET    /api/pessoas/banco-disponivel -> a coluna `perfil` ja' existe no banco?
 *
 * Ate' aqui o navegador falava com a tabela `pessoa` direto. Agora fala com
 * estas rotas (VH-02); quem decide continua sendo o RLS de `pessoa`
 * (supabase/rls-perfis.sql e pessoa-escrita-restrita.sql), porque e' o
 * mesmo client do usuario que consulta (`req.supabase`, VH-08) — nada foi
 * afrouxado nem apertado na mudanca de caminho.
 *
 * A TELA NAO E' TRADUZIDA AQUI: as rotas devolvem a LINHA crua do banco
 * (`email`, `ultimo_acesso`, `foto`…), e o `paraApp` de web/src/lib/pessoas.js
 * segue sendo quem monta o objeto da tela. E' de proposito: e' la' que mora
 * o significado de cada campo, inclusive o de coluna AUSENTE (veja CAMADAS).
 *
 * POR QUE SO' `exigirLogin`, e nao `exigirMembro`
 * -----------------------------------------------------------
 * `pessoa` e' justamente a tabela que DIZ quem e' do time. Exigir ser do
 * time para ler ou criar a propria linha trancaria a porta de entrada: a
 * primeira entrada (`/api/pessoas/entrada`), a sondagem da coluna e a
 * leitura da equipe sao chamadas por quem ainda esta' na sala de espera,
 * sem perfil. Era assim quando o navegador falava com o banco e continua
 * sendo: o corte quem faz e' a policy ("leio a minha linha", "admin le
 * todas", "master escreve todas", "entro na fila").
 *
 * ONDE ESTE ROUTER PRECISA SER MONTADO  ⚠️
 * -----------------------------------------------------------
 * ANTES do `app.use(exigirMembro)` global do mondayApp.js — logo depois do
 * `app.use(exigirLogin)`. Montado depois dele, ninguem novo entra no
 * sistema nunca mais: quem chega sem perfil leva 403 antes de conseguir
 * criar a propria linha na fila, e a sala de espera nunca se preenche.
 *
 * Como ali em cima o leitor de JSON global ainda nao rodou, este router
 * traz o proprio (`express.json`) — que se cala quando o corpo ja' foi
 * lido, entao vale nas duas posicoes.
 */

const express = require("express");
const { exigirLogin } = require("../auth.js");
const { zValidator, z } = require("../validacao.js");
const { erroDoBanco } = require("../erroDoBanco.js");
const { assinarEnvio, erroDoStorage } = require("../storage.js");

/* AS COLUNAS DE `pessoa`, na ordem em que os SQLs as criaram.
 *
 * O front lia com `select("*")`, que devolve as colunas QUE EXISTEM e nao
 * reclama das que faltam — e a tela conta com isso: `ultimo_acesso` e
 * `foto` AUSENTES (undefined) querem dizer "o SQL ainda nao rodou", e nao
 * "nunca acessou" / "sem foto"; sao coisas diferentes na tela.
 *
 * Listar as colunas (SQL-32) tira essa tolerancia: coluna que falta vira
 * erro 42703, e a equipe inteira sumiria da tela por causa de uma migracao
 * pendente. Por isso a leitura desce um degrau de cada vez: tenta com
 * tudo, e a cada "coluna nao existe" tira a camada mais nova e tenta de
 * novo. O que chega na tela e' exatamente o que o `select("*")` daria
 * naquele banco.
 */
const CAMADAS = [
  ["email", "nome", "cargo", "ativo", "criado_em", "criado_por"], // equipe.sql
  ["perfil", "entrou_em", "liberado_em", "liberado_por"],         // perfis.sql
  ["admin", "modulos", "obras_regra", "obras"],                   // acessos.sql
  ["canal"],                                                      // pessoa-canal.sql
  ["ultimo_acesso"],                                              // ultimo-acesso.sql
  ["foto"],                                                       // foto-perfil.sql
];

const colunasAte = (n) => CAMADAS.slice(0, n).flat().join(", ");

/* A mesma leitura de erro que o front fazia: coluna que ainda nao existe
   no banco (entre o deploy e a migracao) nao e' defeito de quem usa. */
function faltaColuna(error) {
  return !!error && (error.code === "42703" || error.code === "PGRST204"
    || /column .* does not exist|Could not find the/i.test(error.message || ""));
}

const OBRIGATORIAS = CAMADAS[0];
const OPCIONAIS = CAMADAS.slice(1).flat();

/* QUAL coluna o banco recusou. O Postgres diz "column pessoa.foto does not
   exist"; o PostgREST, "Could not find the 'foto' column of 'pessoa'". */
function colunaRecusada(error) {
  const m = String(error?.message || "");
  const pg = /column\s+(?:[\w"]+\.)?["']?([a-z_]+)["']?\s+does not exist/i.exec(m);
  if (pg) return pg[1];
  const postgrest = /Could not find the ['"]([a-z_]+)['"] column/i.exec(m);
  return postgrest ? postgrest[1] : null;
}

/** O ultimo recurso: desce um degrau de CAMADAS por vez. */
async function descendoAsCamadas(executar) {
  let r;
  for (let n = CAMADAS.length; n >= 1; n--) {
    r = await executar(colunasAte(n));
    if (!faltaColuna(r.error)) return r;
  }
  return r; // nem as colunas do equipe.sql existem: o erro fala por si
}

/**
 * Roda a consulta com a maior lista de colunas que o banco aceitar.
 *
 * Tira SO' a coluna que o banco citou, e tenta de novo. Descer por camada
 * era mais simples e errado: os SQL sao rodados a mao, na ordem que der, e
 * um banco com `foto-perfil.sql` rodado e `ultimo-acesso.sql` nao perdia as
 * duas — todos os avatares voltavam pras iniciais com a foto gravada no
 * banco. O `select("*")` de antes devolvia cada coluna existente,
 * independentemente da ordem em que as migrations tinham rodado, e e' isso
 * que precisa continuar acontecendo.
 *
 * Se o erro nao disser qual coluna e', ai' sim desce por camada.
 */
async function comAsColunasQueExistem(executar) {
  const faltando = new Set();
  for (let tentativa = 0; tentativa <= OPCIONAIS.length; tentativa += 1) {
    const colunas = [...OBRIGATORIAS, ...OPCIONAIS.filter((c) => !faltando.has(c))].join(", ");
    const r = await executar(colunas);
    if (!faltaColuna(r.error)) return r;
    const recusada = colunaRecusada(r.error);
    if (!recusada || faltando.has(recusada) || !OPCIONAIS.includes(recusada)) {
      return descendoAsCamadas(executar);
    }
    faltando.add(recusada);
  }
  return descendoAsCamadas(executar);
}

/* A tela decide por este codigo: e' o que vira `err.migracao` no front e
   troca "deu erro" por "falta rodar tal SQL". */
const MIGRACAO = "migracao";
const MIGRACAO_PENDENTE = "migracao-pendente";

/* O nome sai do e-mail de quem esta' entrando. COPIA da funcao pura de
   web/src/lib/pessoas.js (`nomeDoEmail`), e nao um import: o e-mail de
   quem entra vem do LOGIN (SEG-13), entao o nome tambem precisa ser
   calculado aqui, no servidor. Se uma das duas mudar, a outra muda junto
   — o teste de acessos vigia as duas. */
function nomeDoEmail(email) {
  const antes = String(email || "").split("@")[0];
  if (!antes) return "";
  return antes.split(/[._-]+/).filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

const lista = (v) => (Array.isArray(v) ? v : []);

/* ---------- o que pode chegar de fora (VH-06) ---------- */

const email = z.string().trim().min(1).max(320);
const texto = (max) => z.string().max(max);

const corpoDaPessoa = z.object({
  email,
  nome: texto(200),
  cargo: texto(120).nullish(),
  ativo: z.boolean(),
  /* Os campos abaixo so' viajam QUANDO VIERAM: um upsert que sempre
     escreve `admin: false` apagaria o admin de alguem so' porque quem
     editou o nome nao mexeu nessa parte da tela. `undefined` aqui nao e'
     "vazio", e' "nao mexi nisso" — e o JSON preserva isso, porque chave
     indefinida nao e' enviada. */
  admin: z.boolean().optional(),
  perfil: texto(40).nullish(),
  canal: texto(60).nullish(),
  modulos: z.array(texto(60)).max(100).nullish(),
  obrasRegra: texto(40).optional(),
  obras: z.array(z.union([texto(60), z.number()])).max(5000).nullish(),
}).strict();

const paramEmail = z.object({ email }).strict();
const semCorpo = z.object({}).strict();
const corpoDaFoto = z.object({ caminho: texto(500).nullable() }).strict();

const FORMATO = "Os dados enviados não estão no formato esperado.";

const rotas = express.Router();
/* O leitor de JSON proprio: este router e' montado antes do global (veja o
   cabecalho). `express.json` nao le' duas vezes — se o corpo ja' foi lido,
   ele passa adiante. */
rotas.use(exigirLogin, express.json({ limit: "1mb" }));

/* ---------- A EQUIPE ---------- */

rotas.get("/api/pessoas", async (req, res) => {
  const r = await comAsColunasQueExistem((colunas) =>
    req.supabase.from("pessoa").select(colunas).order("nome"));
  if (r.error) {
    if (faltaColuna(r.error)) return res.status(503).json({ error: MIGRACAO_PENDENTE, code: MIGRACAO });
    return erroDoBanco(res, r.error);
  }
  res.json(r.data || []);
});

rotas.put("/api/pessoas", zValidator("json", corpoDaPessoa), async (req, res) => {
  const b = req.valido.json;
  const campos = {
    email: b.email,
    nome: b.nome,
    cargo: b.cargo || null,
    ativo: b.ativo,
    /* Quem cadastrou vem do LOGIN, nunca do corpo (SEG-13). */
    criado_por: req.usuario.email,
  };
  if (b.admin !== undefined) campos.admin = !!b.admin;
  /* O canal segue a mesma regra dos outros campos: so' viaja quando veio.
     Mandar `null` sempre apagaria o canal de quem so' teve o nome corrigido. */
  if (b.canal !== undefined) campos.canal = b.canal || null;
  if (b.perfil !== undefined) {
    campos.perfil = b.perfil || null;
    /* Quem liberou e quando. So' na hora de DAR o perfil — reescrever isso
       a cada edicao de nome apagaria o registro de quem deu o acesso, que
       e' a unica coisa que responde "quem deixou entrar". */
    if (b.perfil) { campos.liberado_em = new Date().toISOString(); campos.liberado_por = req.usuario.email; }
  }
  if (b.modulos !== undefined) campos.modulos = lista(b.modulos);
  if (b.obrasRegra !== undefined) campos.obras_regra = b.obrasRegra;
  if (b.obras !== undefined) campos.obras = lista(b.obras).map(String);

  const r = await comAsColunasQueExistem((colunas) =>
    req.supabase.from("pessoa").upsert(campos, { onConflict: "email" }).select(colunas).single());

  /* Erro do Postgres na cara de quem so' queria dar um perfil nao ajuda
     ninguem: diz o que quebrou, nao o que fazer. Aqui vira instrucao. */
  if (faltaColuna(r.error)) {
    return res.status(503).json({
      error: "Falta rodar supabase/perfis.sql no Supabase — as colunas de perfil ainda não existem no banco. Até lá dá pra cadastrar nome e cargo, mas não atribuir perfil.",
      code: MIGRACAO,
    });
  }
  /* O perfil Admin master so' existe no banco depois do SQL: antes disso o
     Postgres recusa a linha com um erro que nao diz o que fazer. */
  if (r.error?.code === "23514" && /perfil/i.test(r.error.message || "")) {
    return res.status(422).json({ error: "O banco ainda não conhece o perfil Admin master: falta rodar supabase/admin-master.sql no Supabase (SQL Editor)." });
  }
  if (r.error) return erroDoBanco(res, r.error);
  res.json(r.data);
});

rotas.delete("/api/pessoas/:email", zValidator("param", paramEmail), async (req, res) => {
  const { error } = await req.supabase.from("pessoa").delete().eq("email", req.valido.param.email);
  if (error) return erroDoBanco(res, error);
  res.json({ ok: true });
});

/**
 * A linha que nasce no primeiro login.
 *
 * E' isto que faz a pessoa aparecer na fila sem ninguem digitar o e-mail
 * dela: ela entra pelo link, a rota garante a linha com perfil NULO, e o
 * administrador ve um pendente.
 *
 * O e-mail e o nome saem do LOGIN (SEG-13) — o corpo do pedido nao entra
 * nisto, senao qualquer um criaria fila com o e-mail de outro. `perfil:
 * null` vai explicito porque e' o que a policy "entro na fila" exige:
 * pode-se entrar na fila, nao se pode entrar liberado.
 */
rotas.post("/api/pessoas/entrada", zValidator("json", semCorpo), async (req, res) => {
  const e = req.usuario.email;

  const existe = await comAsColunasQueExistem((colunas) =>
    req.supabase.from("pessoa").select(colunas).eq("email", e).maybeSingle());
  if (existe.data) return res.json(existe.data);

  const r = await comAsColunasQueExistem((colunas) =>
    req.supabase.from("pessoa").insert({
      email: e, nome: nomeDoEmail(e), perfil: null, ativo: true,
      entrou_em: new Date().toISOString(),
    }).select(colunas).single());

  // Sem as colunas novas, nao ha fila pra entrar ainda.
  if (faltaColuna(r.error)) return res.json(null);

  /* Corrida entre duas abas abrindo ao mesmo tempo: a segunda recebe
     violacao de chave, e o certo e' ler o que a primeira gravou. */
  if (r.error) {
    const agora = await comAsColunasQueExistem((colunas) =>
      req.supabase.from("pessoa").select(colunas).eq("email", e).maybeSingle());
    return res.json(agora.data || null);
  }
  res.json(r.data);
});

/**
 * A coluna `perfil` ja' existe?
 *
 * Pergunta pela COLUNA, nao pela linha: `select("*")` nao da erro quando
 * `perfil` falta — devolve as colunas que ha. Foi assim que a deteccao
 * anterior falhou: sem erro, ninguem tinha perfil, e o portao mandou a
 * empresa inteira pra sala de espera, inclusive quem rodaria o SQL.
 *
 * Nunca recusa: qualquer outro erro conta como "a coluna existe", que e'
 * o comportamento normal do app. Desligar o portao por um erro de leitura
 * seria abrir o app; liga-lo por engano trancaria todo mundo.
 */
rotas.get("/api/pessoas/banco-disponivel", async (req, res) => {
  const { error } = await req.supabase.from("pessoa").select("perfil").limit(1);
  res.json({ feita: !faltaColuna(error) });
});

/* ---------- ULTIMO ACESSO ---------- */

/* A pessoa marca a PROPRIA linha ao abrir o app e de tempos em tempos
   enquanto ele esta aberto (supabase/ultimo-acesso.sql). Sem o SQL rodado
   a funcao nao existe: falha CALADA, o app segue igual — por isso a rota
   responde 200 com `ok: false` em vez de erro. */
rotas.post("/api/acessos/registrar", zValidator("json", semCorpo), async (req, res) => {
  const { error } = await req.supabase.rpc("registrar_acesso");
  res.json({ ok: !error });
});

/* ---------- FOTO DE PERFIL ---------- */

/* A imagem vai pro balde publico `catalogo`, numa pasta propria — o mesmo
   balde que a Apresentacao ja' escolheu pros ambientes: "um balde so', um
   conjunto de permissoes so'". */
const BALDE_FOTO = "catalogo";
const PASTA_FOTO = "pessoas";

/**
 * Assina a subida da foto. O CAMINHO e' escolhido aqui.
 *
 * A pasta sai do e-mail do LOGIN (SEG-13): assim ninguem sobe uma imagem
 * na pasta de outra pessoa, e o caminho sempre casa com o `pessoas/%` que
 * a funcao `definir_foto` exige.
 *
 * Carimbo de tempo no nome: reusar o caminho faria o navegador seguir
 * mostrando a foto velha do cache depois da troca.
 */
rotas.post("/api/pessoas/foto/envio", zValidator("json", semCorpo), async (req, res) => {
  const quem = String(req.usuario.email).trim().toLowerCase().replace(/[^a-z0-9._-]/g, "-");
  const caminho = `${PASTA_FOTO}/${quem}/${Date.now()}.jpg`;

  const r = await assinarEnvio(req.supabase, BALDE_FOTO, caminho, { upsert: true });
  if (r.erroDeCaminho) return res.status(400).json({ error: FORMATO });
  if (r.error) return erroDoStorage(res, r.error);
  res.json({ caminho: r.caminho, token: r.token });
});

/**
 * Grava a foto na PROPRIA linha, pela funcao do banco.
 *
 * Nao passa pelo upsert de `/api/pessoas` de proposito: a foto e' a unica
 * coisa que a pessoa muda em si mesma, e o RLS de perfis nao deixa ninguem
 * escrever direto na propria linha. A funcao `definir_foto` e' o mesmo
 * desenho de `registrar_acesso`: mexe so' nesta coluna, so' na linha de
 * quem chamou, e o e-mail vem do login.
 *
 * `caminho` vazio apaga a foto e devolve as iniciais.
 */
rotas.put("/api/pessoas/foto", zValidator("json", corpoDaFoto), async (req, res) => {
  const { error } = await req.supabase.rpc("definir_foto", { caminho: req.valido.json.caminho || "" });
  if (!error) return res.json({ ok: true });
  /* Sem o SQL rodado a funcao nao existe, e o erro do Postgres nao diz o
     que fazer. Aqui vira instrucao, como no resto do arquivo. */
  if (/function .*definir_foto.* does not exist|PGRST202/i.test(`${error.message} ${error.code || ""}`)) {
    return res.status(503).json({
      error: "Falta rodar supabase/foto-perfil.sql no Supabase (SQL Editor) — a foto ainda não tem onde ser guardada.",
      code: MIGRACAO,
    });
  }
  return erroDoBanco(res, error);
});

module.exports = { rotasDePessoas: rotas, CAMADAS, MIGRACAO, MIGRACAO_PENDENTE };
