import { supabase, supabaseConfigurado } from "./supabase";

/**
 * A equipe.
 *
 * Existe pra que atribuir o GC de uma obra seja ESCOLHER de uma lista, e
 * nao digitar um e-mail: e-mail digitado erra, e um caractere trocado faz
 * a obra ficar sem dono sem ninguem perceber.
 */

/* Sugestoes, nao camisa de forca: o campo aceita qualquer texto, porque
   cargo de empresa muda e ninguem quer abrir codigo pra criar um. */
export const CARGOS = [
  "GC", "Coordenação", "Comercial", "Compras", "Projetos", "Financeiro", "Administrativo",
];

const lista = (v) => (Array.isArray(v) ? v : []);

const paraApp = (l) => ({
  email: l.email, nome: l.nome, cargo: l.cargo || "", ativo: l.ativo !== false,
  perfil: l.perfil || null,
  entrouEm: l.entrou_em || null, liberadoEm: l.liberado_em || null, liberadoPor: l.liberado_por || null,
  admin: !!l.admin,
  /* Lista VAZIA quer dizer TODOS, e nao "nenhum". Quem foi cadastrado
     antes destas colunas existirem perderia o app inteiro no instante em
     que a migracao rodasse. */
  modulos: lista(l.modulos),
  obrasRegra: l.obras_regra || "todas",
  obras: lista(l.obras).map(String),
  criadoEm: l.criado_em, criadoPor: l.criado_por,
});

/* O nome sai do e-mail quando ninguem cadastrou ainda:
   "priscila.wayhs@..." vira "Priscila Wayhs". Melhor um palpite legivel
   que um e-mail cru no meio de uma lista de obras. */
export function nomeDoEmail(email) {
  const antes = String(email || "").split("@")[0];
  if (!antes) return "";
  return antes.split(/[._-]+/).filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

/* Coluna que ainda nao existe no banco NAO pode trancar todo mundo.

   Entre o deploy e a migracao existe uma janela em que `perfil` nao
   existe. Se a leitura falhasse ali, ninguem teria perfil — e o portao
   novo mandaria a empresa inteira pra sala de espera, inclusive quem
   rodaria o SQL. O app volta a se comportar como antes ate a coluna
   existir, e diz isso na tela.

   Mesma logica que `salvarDadosObra` ja usava: o trabalho continua, e o
   que falta e' anunciado. */
export const MIGRACAO_PENDENTE = "migracao-pendente";

function faltaColuna(error) {
  return error && (error.code === "42703" || error.code === "PGRST204"
    || /column .* does not exist|Could not find the/i.test(error.message || ""));
}

/* Pergunta pela coluna, nao pela linha.

   `select("*")` NAO da erro quando `perfil` nao existe — ele devolve as
   colunas que ha. Foi assim que a deteccao anterior falhou: sem erro,
   ninguem tinha perfil, e o portao mandou todo mundo pra sala de espera.
   Perguntar pela coluna especifica e' o unico jeito de saber. */
export async function migracaoDePerfilFeita() {
  if (!supabaseConfigurado) return true;
  const { error } = await supabase.from("pessoa").select("perfil").limit(1);
  return !faltaColuna(error);
}

export async function listarPessoas() {
  if (!supabaseConfigurado) return [];
  const { data, error } = await supabase.from("pessoa").select("*").order("nome");
  if (error) {
    if (faltaColuna(error)) { const e = new Error(MIGRACAO_PENDENTE); e.migracao = true; throw e; }
    throw error;
  }
  return (data || []).map(paraApp);
}

export async function salvarPessoa({ email, nome, cargo, ativo = true, admin, perfil, modulos, obrasRegra, obras, por }) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  const e = String(email || "").trim().toLowerCase();
  if (!e) throw new Error("O e-mail é obrigatório.");
  const campos = {
    email: e,
    nome: String(nome || "").trim() || nomeDoEmail(e),
    cargo: cargo || null,
    ativo,
    criado_por: por || null,
  };
  /* So' manda o que veio. Um upsert que sempre escreve `admin: false`
     apagaria o admin de alguem so' porque quem editou o nome nao mexeu
     nessa parte da tela. */
  if (admin !== undefined) campos.admin = !!admin;
  if (perfil !== undefined) {
    campos.perfil = perfil || null;
    /* Quem liberou e quando. So' na hora de DAR o perfil — reescrever
       isso a cada edicao de nome apagaria o registro de quem deu o
       acesso, que e' a unica coisa que responde "quem deixou entrar". */
    if (perfil) { campos.liberado_em = new Date().toISOString(); campos.liberado_por = por || null; }
  }
  if (modulos !== undefined) campos.modulos = lista(modulos);
  if (obrasRegra !== undefined) campos.obras_regra = obrasRegra;
  if (obras !== undefined) campos.obras = lista(obras).map(String);

  const { data, error } = await supabase.from("pessoa").upsert(campos, { onConflict: "email" }).select().single();
  /* Erro do Postgres na cara de quem so' queria dar um perfil nao ajuda
     ninguem: diz o que quebrou, nao o que fazer. Aqui vira instrucao. */
  if (faltaColuna(error)) {
    const e2 = new Error("Falta rodar supabase/perfis.sql no Supabase — as colunas de perfil ainda não existem no banco. Até lá dá pra cadastrar nome e cargo, mas não atribuir perfil.");
    e2.migracao = true;
    throw e2;
  }
  if (error) throw error;
  return paraApp(data);
}

export async function excluirPessoa(email) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  const { error } = await supabase.from("pessoa").delete().eq("email", email);
  if (error) throw error;
}

/* ---------- QUEM VE O QUE ----------
 *
 * Ver docs/SPEC-acessos.md. Estas funcoes moram aqui, sem React e sem
 * supabase, porque errar nelas nao produz um numero torto: produz
 * alguem trancado fora do proprio sistema, ou vendo o que nao devia.
 * As duas falhas sao silenciosas.
 */

/* Um perfil por pessoa, e so' um. NULO e' a sala de espera.

   `modulos: null` quer dizer TODOS. Lista explicita quer dizer
   exatamente esses -- e lista VAZIA quer dizer nenhum, que e' o
   pendente. Sao tres estados diferentes de proposito. */
export const PERFIS = [
  {
    id: "admin", nome: "Administrador",
    resumo: "Vê tudo, edita tudo e é quem libera o acesso das outras pessoas.",
    modulos: null, obras: "todas", edita: true, gerenciaPessoas: true,
  },
  {
    id: "geral", nome: "Geral",
    resumo: "Vê e trabalha em todas as obras. Não configura usuários.",
    modulos: null, obras: "todas", edita: true, gerenciaPessoas: false,
  },
  {
    id: "gc", nome: "GC",
    resumo: "Trabalha normalmente, só nas obras em que é o responsável.",
    modulos: null, obras: "minhas", edita: true, gerenciaPessoas: false,
  },
  {
    id: "mehoo", nome: "Mehoo",
    resumo: "Só o painel da Mehoo, nas obras que têm item do canal. Não edita.",
    modulos: ["mehoo"], obras: "canal-mehoo", edita: false, gerenciaPessoas: false,
  },
];

export const perfilDe = (p) => PERFIS.find((x) => x.id === p?.perfil) || null;

/* Pendente e' quem entrou e ainda nao foi liberado. Pessoa DESATIVADA
   tambem nao entra -- mas por outro motivo, e a tela diz coisas
   diferentes: uma esta esperando, a outra foi suspensa. */
export const estaPendente = (p) => !!p && p.ativo !== false && !perfilDe(p);
export const estaSuspenso = (p) => !!p && p.ativo === false;
export const temAcesso = (p) => !!perfilDe(p) && p?.ativo !== false;

/* Quem NAO tem linha em `pessoa` tambem nao entra. E' o oposto do que
   valia antes desta versao, e e' o ponto inteiro da mudanca: acesso
   deixou de ser concedido por omissao. */
export const podeEntrar = (p) => temAcesso(p);

export function podeVerModulo(pessoa, moduloId) {
  const perfil = perfilDe(pessoa);
  if (!perfil || pessoa?.ativo === false) return false;
  return perfil.modulos === null || perfil.modulos.includes(moduloId);
}

/* Editar e' do perfil, nao da tela: o Mehoo consulta, os outros
   trabalham. A trava de edicao por obra continua existindo em cima
   disto -- ela resolve duas pessoas ao mesmo tempo, nao permissao. */
export const podeEditar = (pessoa) => !!perfilDe(pessoa)?.edita && pessoa?.ativo !== false;
export const podeGerenciarPessoas = (pessoa) => !!perfilDe(pessoa)?.gerenciaPessoas && pessoa?.ativo !== false;

/**
 * As obras que a pessoa enxerga.
 *
 * "minhas" se atualiza sozinha quando a obra troca de GC -- e' por isso
 * que ela existe em vez de a coordenacao remarcar uma lista a cada
 * troca. Obra SEM GC continua visivel: enquanto os vinculos nao estao
 * feitos, esconder o que nao tem dono deixaria obra viva fora da tela
 * de todo mundo.
 */
export function obrasPermitidas(pessoa, obras) {
  const perfil = perfilDe(pessoa);
  const todas = obras || [];
  if (!perfil || pessoa?.ativo === false) return [];
  if (perfil.obras === "todas") return todas;
  if (perfil.obras === "minhas") {
    const meu = String(pessoa.email || "").toLowerCase();
    return todas.filter((o) => !o.gc || String(o.gc).toLowerCase() === meu);
  }
  /* O canal da Mehoo: a obra aparece se tiver item marcado pra ela. Quem
     decide isso e' o proprio item, nao um cadastro a parte -- assim a
     lista acompanha a compra sem ninguem manter nada em dia. */
  if (perfil.obras === "canal-mehoo") {
    return todas.filter((o) => (o.categorias || [])
      .some((c) => (c.itens || []).some((it) => it.canalCompra === "mehoo")));
  }
  return [];
}

/* So' o dominio da empresa entra. A sala de espera ja protegeria os
   dados, mas sem este corte qualquer pessoa com o link viraria uma
   linha na fila -- e a tela de quem esta esperando viraria caixa de
   entrada de desconhecido. */
export const DOMINIOS = ["groupws.com.br"];
export const dominioPermitido = (email) =>
  DOMINIOS.some((d) => String(email || "").toLowerCase().endsWith("@" + d));

/**
 * A linha que nasce no primeiro login.
 *
 * E' isto que faz a pessoa aparecer na fila sem ninguem digitar o e-mail
 * dela: ela entra pelo link, o app garante a linha com perfil NULO, e o
 * administrador ve um pendente.
 *
 * `ignoreDuplicates` e nao upsert comum: quem ja tem perfil nao pode ser
 * reescrito por um login: seria zerar o acesso de alguem toda vez que
 * ele entrasse.
 */
export async function garantirPessoa(email) {
  if (!supabaseConfigurado || !email) return null;
  const e = String(email).toLowerCase();

  const { data: existe } = await supabase.from("pessoa").select("*").eq("email", e).maybeSingle();
  if (existe) return paraApp(existe);

  const { data, error } = await supabase.from("pessoa").insert({
    email: e, nome: nomeDoEmail(e), perfil: null, ativo: true,
    entrou_em: new Date().toISOString(),
  }).select().single();

  // Sem as colunas novas, nao ha fila pra entrar ainda.
  if (faltaColuna(error)) return null;

  /* Corrida entre duas abas abrindo ao mesmo tempo: a segunda recebe
     violacao de chave, e o certo e' ler o que a primeira gravou. */
  if (error) {
    const { data: agora } = await supabase.from("pessoa").select("*").eq("email", e).maybeSingle();
    return agora ? paraApp(agora) : null;
  }
  return paraApp(data);
}

/* Nunca pode haver zero administradores: sem admin ninguem mais entra, e
   a saida seria mexer no banco a mao. */
export const ehOUltimoAdmin = (pessoas, email) => {
  const admins = (pessoas || []).filter((p) => p.perfil === "admin" && p.ativo !== false);
  return admins.length === 1 && admins[0].email === String(email || "").toLowerCase();
};

export const pendentes = (pessoas) => (pessoas || []).filter(estaPendente);
