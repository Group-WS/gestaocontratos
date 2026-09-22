import { supabaseConfigurado } from "./supabase";
import { apiJson } from "./api";
import { urlPublica, enviarAssinado } from "./storage";

/**
 * A equipe.
 *
 * Existe pra que atribuir o GC de uma obra seja ESCOLHER de uma lista, e
 * nao digitar um e-mail: e-mail digitado erra, e um caractere trocado faz
 * a obra ficar sem dono sem ninguem perceber.
 *
 * O CAMINHO ATE' O BANCO MUDOU (VH-02): quem fala com a tabela `pessoa` e'
 * a API (web/api/_lib/rotas/pessoas.js), e esta lib fala com a API. O que
 * decide quem ve e quem grava continua sendo o RLS de `pessoa`, porque a
 * rota consulta com o client do proprio usuario. `supabaseConfigurado`
 * segue aqui: e' so' uma bandeira ("ha banco configurado?"), nao acesso a
 * dado, e e' ela que mantem o app util sem Supabase nenhum.
 *
 * O que NAO mudou de lugar: a traducao da linha do banco pro objeto da
 * tela (`paraApp`) e todas as funcoes puras de acesso (quem ve o que).
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
  /* O canal de compra que esta pessoa acompanha. So' vale com o perfil
     "canal"; nos outros perfis fica guardado e nao decide nada. */
  canal: l.canal || null,
  entrouEm: l.entrou_em || null, liberadoEm: l.liberado_em || null, liberadoPor: l.liberado_por || null,
  // undefined = a coluna ainda nao existe (falta o ultimo-acesso.sql); null = nunca acessou.
  ultimoAcesso: l.ultimo_acesso === undefined ? undefined : (l.ultimo_acesso || null),
  admin: !!l.admin,
  /* Caminho da foto DENTRO do balde, nunca a URL — guardar a URL amarraria
     o banco ao dominio do Storage, que nao e' nosso. undefined = a coluna
     ainda nao existe (falta o foto-perfil.sql); null = sem foto, iniciais. */
  foto: l.foto === undefined ? undefined : (l.foto || null),
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

/* A INSTRUCAO DE MIGRACAO, de volta em forma de `erro.migracao`.
 *
 * Quem le' o codigo do erro do Postgres (42703 e companhia) agora e' a
 * rota — e' la' que o banco responde. O que a API devolve e' a frase
 * pronta e `code: "migracao"`; aqui isso volta a ser a propriedade que a
 * tela sempre consultou (`e.migracao`), pra ela continuar dizendo o que
 * falta rodar em vez de "deu erro". */
async function comMigracao(pedir) {
  try {
    return await pedir();
  } catch (e) {
    if (e?.code === "migracao") e.migracao = true;
    throw e;
  }
}

/* Pergunta pela coluna, nao pela linha.

   `select("*")` NAO da erro quando `perfil` nao existe — ele devolve as
   colunas que ha. Foi assim que a deteccao anterior falhou: sem erro,
   ninguem tinha perfil, e o portao mandou todo mundo pra sala de espera.
   Perguntar pela coluna especifica e' o unico jeito de saber — e quem
   pergunta e' a rota, que e' quem fala com o banco.

   Pedido que nao chega conta como "a coluna existe": era o que acontecia
   quando o erro do banco nao era "falta a coluna", e e' o lado seguro —
   ligar o aviso por engano desligaria o controle de acesso inteiro. */
export async function migracaoDePerfilFeita() {
  if (!supabaseConfigurado) return true;
  try {
    const r = await apiJson("/api/pessoas/banco-disponivel");
    return r?.feita !== false;
  } catch {
    return true;
  }
}

export async function listarPessoas() {
  if (!supabaseConfigurado) return [];
  const linhas = await comMigracao(() => apiJson("/api/pessoas"));
  return (linhas || []).map(paraApp);
}

/* `por` (quem esta' salvando) nao viaja mais no corpo: a rota pega o
   e-mail de quem chamou do LOGIN (SEG-13). A tela pode continuar
   passando — e passa —, que aqui ele so' nao e' reenviado. */
export async function salvarPessoa({ email, nome, cargo, ativo = true, admin, perfil, canal, modulos, obrasRegra, obras }) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  const e = String(email || "").trim().toLowerCase();
  if (!e) throw new Error("O e-mail é obrigatório.");
  const campos = {
    email: e,
    nome: String(nome || "").trim() || nomeDoEmail(e),
    cargo: cargo || null,
    ativo,
  };
  /* So' manda o que veio. Um upsert que sempre escreve `admin: false`
     apagaria o admin de alguem so' porque quem editou o nome nao mexeu
     nessa parte da tela. Campo ausente no JSON chega `undefined` na rota,
     que e' exatamente o "nao mexi nisso" que ela espera. */
  if (admin !== undefined) campos.admin = !!admin;
  /* O canal segue a mesma regra dos outros campos: so' viaja quando veio.
     Mandar `null` sempre apagaria o canal de quem so' teve o nome corrigido. */
  if (canal !== undefined) campos.canal = canal || null;
  /* Quem liberou e quando sao carimbados na rota, junto do perfil — ver
     web/api/_lib/rotas/pessoas.js. */
  if (perfil !== undefined) campos.perfil = perfil || null;
  if (modulos !== undefined) campos.modulos = lista(modulos);
  if (obrasRegra !== undefined) campos.obrasRegra = obrasRegra;
  if (obras !== undefined) campos.obras = lista(obras).map(String);

  const linha = await comMigracao(() => apiJson("/api/pessoas", { metodo: "PUT", corpo: campos }));
  return paraApp(linha);
}

export async function excluirPessoa(email) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  await apiJson(`/api/pessoas/${encodeURIComponent(email)}`, { metodo: "DELETE" });
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
/* OS TRES PAPEIS DE UMA OBRA.
 *
 * `gc` existe desde sempre; `tailor_made` e `responsavel_executivo` foram
 * criados em supabase/equipe-da-obra.sql com o comentario certo: "mesma
 * ideia de gc, guarda o e-mail de quem responde". Cada um em coluna
 * propria porque uma obra pode ter os tres ao mesmo tempo, e nenhum e'
 * obrigatorio.
 *
 * So' que "minhas obras" nunca soube deles: ela testava `o.gc` e mais
 * nada, entao uma Taylor Made jamais caia no recorte das proprias obras.
 * Daqui pra frente os tres contam.
 *
 * A grafia: a coluna do banco e' `tailor_made`, em ingles. Na tela e'
 * "Taylor Made", que e' como a casa escreve. Renomear coluna e' migracao;
 * o rotulo fica aqui, num lugar so'. */
export const PAPEIS_DA_OBRA = [
  { chave: "gc", campos: ["gc"], rotulo: "GC" },
  { chave: "tailorMade", campos: ["tailorMade", "tailor_made"], rotulo: "Taylor Made" },
  { chave: "executivo", campos: ["responsavelExecutivo", "responsavel_executivo"], rotulo: "Executivo" },
];

const mesmo = (a, b) => !!a && !!b && String(a).toLowerCase() === String(b).toLowerCase();

/* QUAL papel a pessoa ocupa na obra, ou null. Aceita as duas grafias do
   campo porque a obra chega ora do estado do app (tailorMade), ora crua
   do banco (tailor_made). */
export function papelNaObra(obra, email) {
  if (!obra || !email) return null;
  return PAPEIS_DA_OBRA.find((p) => p.campos.some((c) => mesmo(obra[c], email))) || null;
}

/* A obra e' dela, em qualquer um dos tres papeis. */
export const obraDaPessoa = (obra, email) => !!papelNaObra(obra, email);

/* Quem responde pela obra, com papel e e-mail — para a coluna Equipe.
   Papel vago entra como `email: null`, porque vaga vazia e' informacao:
   obra sem responsavel hoje so' aparece como alerta solto. */
export const equipeDaObra = (obra) =>
  PAPEIS_DA_OBRA.map((p) => ({
    chave: p.chave,
    rotulo: p.rotulo,
    email: p.campos.map((c) => obra?.[c]).find(Boolean) || null,
  }));

export const PERFIS = [
  /* Admin master (pedido de 15/09/2026): so' ele ve e mexe na Equipe e nos
     acessos. O Administrador continua com todo o resto -- contrato da obra
     e compradores inclusive (`administra`). */
  {
    id: "master", nome: "Admin master",
    resumo: "Tudo do Administrador e, só ele, a Equipe e os acessos: libera, muda e tira o acesso das outras pessoas.",
    modulos: null, obras: "todas", edita: true, administra: true, gerenciaPessoas: true, abreObras: true,
  },
  {
    id: "admin", nome: "Administrador",
    resumo: "Vê tudo e edita tudo, inclusive o contrato da obra e os compradores. Não vê a Equipe nem os acessos.",
    modulos: null, obras: "todas", edita: true, administra: true, gerenciaPessoas: false, abreObras: true,
  },
  {
    id: "geral", nome: "Geral",
    resumo: "Vê e trabalha em todas as obras. Não configura usuários.",
    modulos: null, obras: "todas", edita: true, gerenciaPessoas: false, abreObras: true,
  },
  {
    id: "gc", nome: "GC",
    resumo: "Trabalha normalmente, só nas obras em que é o responsável.",
    modulos: null, obras: "minhas", edita: true, gerenciaPessoas: false, abreObras: true,
  },
  {
    id: "taylor", nome: "Taylor Made",
    resumo: "Acompanha as obras em que é a Taylor Made. Vê tudo delas, e não altera nada.",
    /* Irmao do GC: mesmo recorte de obras, sem a edicao. A Taylor acompanha
       o andamento e cobra quem executa — nao libera compra nem fecha
       caderno, e por isso `edita: false`. */
    modulos: null, obras: "minhas", edita: false, gerenciaPessoas: false, abreObras: true,
  },
  {
    id: "mehoo", nome: "Mehoo",
    resumo: "Só o painel da Mehoo, com as informações de todas as obras. Não edita.",
    /* Todas as obras, mas so' dentro do painel: a Mehoo nao abre obra
       (sem lista na barra) e entra direto no painel dela. Antes eram so'
       as obras com item do canal — e como o item so' e' conhecido depois
       que a obra carrega, o painel nascia vazio. */
    modulos: ["mehoo"], obras: "todas", edita: false, gerenciaPessoas: false, abreObras: false,
  },
  {
    id: "canal", nome: "Canal de compra",
    resumo: "Só o painel de UM canal de compra, com as informações de todas as obras. Não edita.",
    /* Irmao do perfil Mehoo, e pelo mesmo motivo: a pessoa entra direto no
       painel do canal dela e nao abre obra nenhuma. A diferenca e' que QUAL
       canal vem da ficha (`pessoa.canal`), e nao do perfil — senao cada canal
       novo exigiria um perfil novo, e sao seis hoje. */
    modulos: ["painel_canal"], obras: "todas", edita: false, gerenciaPessoas: false, abreObras: false,
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

/* Equipe e acessos e' de quem libera acesso: so' o Admin master ve (ou o
   Administrador, enquanto ninguem e' master -- ver podeGerenciarPessoas).
   Os outros perfis veem "todos os modulos" menos este. */
const SO_QUEM_GERENCIA = new Set(["equipe"]);

export function podeVerModulo(pessoa, moduloId, pessoas) {
  const perfil = perfilDe(pessoa);
  if (!perfil || pessoa?.ativo === false) return false;
  if (SO_QUEM_GERENCIA.has(moduloId)) return podeGerenciarPessoas(pessoa, pessoas);
  return perfil.modulos === null || perfil.modulos.includes(moduloId);
}

/* Editar e' do perfil, nao da tela: o Mehoo consulta, os outros
   trabalham. A trava de edicao por obra continua existindo em cima
   disto -- ela resolve duas pessoas ao mesmo tempo, nao permissao. */
export const podeEditar = (pessoa) => !!perfilDe(pessoa)?.edita && pessoa?.ativo !== false;
/* Quem cuida da Equipe e dos acessos: o Admin master. Enquanto ninguem tem
   esse perfil (entre publicar e alguem virar master), o Administrador segue
   cuidando -- senao ninguem cuidaria. Sem a lista do time nao da pra saber,
   e vale a regra estrita. */
export const temMaster = (pessoas) => (pessoas || []).some((p) => p.perfil === "master" && p.ativo !== false);
export const podeGerenciarPessoas = (pessoa, pessoas) => {
  const perfil = perfilDe(pessoa);
  if (!perfil || pessoa?.ativo === false) return false;
  if (perfil.gerenciaPessoas) return true;
  return perfil.id === "admin" && Array.isArray(pessoas) && !temMaster(pessoas);
};
// Contrato da obra e compradores: o Administrador e o Admin master.
export const ehAdministrador = (pessoa) => !!perfilDe(pessoa)?.administra && pessoa?.ativo !== false;
// Abrir obra (a lista da barra lateral e a tela da obra). A Mehoo nao abre.
export const podeAbrirObras = (pessoa) => !!perfilDe(pessoa)?.abreObras && pessoa?.ativo !== false;

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
    /* Os TRES papeis contam, nao so' o GC: quem e' Taylor Made de uma obra
       precisa ver essa obra sem depender de quem e' o GC dela.

       A regra e' ESTRITAMENTE ADITIVA — "obra sem GC todo mundo ve"
       continua valendo, palavra por palavra. Cheguei a trocar por "obra
       sem nenhum dos tres responsaveis", que le' melhor, e estava errado:
       uma obra com Taylor e sem GC sumiria da tela de todos os GCs, e
       ninguem poderia trabalhar nela. Mudanca de permissao que TIRA acesso
       precisa ser pedida, nao cair de bonus. */
    return todas.filter((o) => !o.gc || obraDaPessoa(o, pessoa.email));
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
 * Le a linha antes de inserir, e nao um upsert: quem ja tem perfil nao
 * pode ser reescrito por um login — seria zerar o acesso de alguem toda
 * vez que ele entrasse. Isso tudo acontece na rota; aqui so' fica o que a
 * tela precisa saber.
 *
 * O `email` continua na assinatura porque e' a tela que sabe se ha alguem
 * logado (sem isso nao ha fila a garantir), mas ele NAO viaja: qual e' o
 * e-mail de quem esta entrando quem diz e' o login, no servidor (SEG-13).
 * Mandar o e-mail no corpo seria deixar qualquer um criar fila com o
 * e-mail de outro.
 */
export async function garantirPessoa(email) {
  if (!supabaseConfigurado || !email) return null;
  const linha = await apiJson("/api/pessoas/entrada", { metodo: "POST", corpo: {} });
  return linha ? paraApp(linha) : null;
}

/* Nunca pode faltar quem cuide da Equipe: sem essa pessoa ninguem mais
   libera acesso, e a saida seria mexer no banco a mao. Com admin master no
   time, quem cuida e' o master; antes do primeiro, o Administrador. */
export const nivelQueCuida = (pessoas) => (temMaster(pessoas) ? "master" : "admin");
export const ehOUltimoGestor = (pessoas, email) => {
  const nivel = nivelQueCuida(pessoas);
  const quem = (pessoas || []).filter((p) => p.perfil === nivel && p.ativo !== false);
  return quem.length === 1 && quem[0].email === String(email || "").toLowerCase();
};

export const pendentes = (pessoas) => (pessoas || []).filter(estaPendente);

/* ---------- ULTIMO ACESSO E ONLINE ----------
 *
 * A pessoa marca a PROPRIA linha ao abrir o app e de tempos em tempos
 * enquanto ele esta aberto (supabase/ultimo-acesso.sql). "Online" e' quem
 * marcou ha pouco — nao ha outro jeito de saber sem manter uma conexao
 * aberta com cada um.
 */
export const MINUTOS_ONLINE = 3;

export async function registrarAcesso() {
  if (!supabaseConfigurado) return false;
  // Sem o SQL rodado a funcao nao existe: falha calada, o app segue igual.
  // A rota ja' responde `ok: false` nesse caso; o try guarda o resto
  // (pedido que nao chega), que antes tambem nao aparecia pra ninguem.
  try {
    const r = await apiJson("/api/acessos/registrar", { metodo: "POST", corpo: {} });
    return !!r?.ok;
  } catch {
    return false;
  }
}

export const estaOnline = (pessoa, agora = Date.now()) => {
  if (!pessoa?.ultimoAcesso) return false;
  const quando = new Date(pessoa.ultimoAcesso).getTime();
  return Number.isFinite(quando) && agora - quando < MINUTOS_ONLINE * 60 * 1000;
};

// "hoje às 14:32", "ontem às 09:10", "10/09/2026 às 08:05".
export function quandoFoi(iso, agora = new Date()) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((dia(agora) - dia(d)) / 86400000);
  if (dias === 0) return `hoje às ${hora}`;
  if (dias === 1) return `ontem às ${hora}`;
  return `${d.toLocaleDateString("pt-BR")} às ${hora}`;
}

/* ============================================================
   FOTO DE PERFIL
   ------------------------------------------------------------
   A imagem vai pro balde publico `catalogo`, numa pasta propria — o
   mesmo caminho que a Apresentacao ja escolheu pros ambientes: "um balde
   so', um conjunto de permissoes so'". Balde novo seria o dobro de
   politica pra manter e nenhuma vantagem.

   Publico de proposito: avatar aparece em dezenas de lugares na mesma
   tela, e link assinado expira — cada avatar viraria um pedido async com
   estado proprio. O caminho tem carimbo de tempo, entao nao e'
   adivinhavel, e o conteudo e' foto de cracha de equipe interna.
   ============================================================ */

const BALDE_FOTO = "catalogo";
/* A pasta dentro do balde, so' como documentacao: quem monta o caminho da
   foto e' a API (web/api/_lib/rotas/pessoas.js), a partir do e-mail do
   login. `urlDaFoto` usa o caminho inteiro que veio do banco, entao esta
   constante nao entra em nenhum endereco — mudar so' aqui nao muda nada. */
export const PASTA_FOTO = "pessoas";

/* Um circulo de 40px nao precisa dos 4 MB da camera do celular.

   Nenhum upload do app reduzia imagem ate' aqui, e o balde `catalogo` nao
   tem limite de tamanho nem de tipo no SQL — a foto crua subia inteira e
   era baixada inteira a cada tela. 256px cobre o maior avatar em tela
   retina com folga. */
const LADO_FOTO = 256;

function quadradoDe(file, recorte) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      /* O RECORTE vem de quem enquadrou.

         Antes daqui so' existia o quadrado central, e foto de corpo
         inteiro — ou qualquer retrato com o rosto fora do meio — saia
         cortada no lugar errado, sem o que fazer alem de trocar a foto e
         torcer. Agora o recortador passa `sx`, `sy` e `lado`.

         Sem recorte, segue o centro: e' o caminho de quando o recortador
         nao pode rodar. Esticar pra caber um retrato em pe' num quadrado
         nunca foi opcao — deforma a pessoa. */
      const lado = recorte?.lado || Math.min(img.width, img.height);
      const sx = recorte ? recorte.sx : (img.width - lado) / 2;
      const sy = recorte ? recorte.sy : (img.height - lado) / 2;
      const tela = document.createElement("canvas");
      tela.width = LADO_FOTO;
      tela.height = LADO_FOTO;
      const ctx = tela.getContext("2d");
      ctx.drawImage(img, sx, sy, lado, lado, 0, 0, LADO_FOTO, LADO_FOTO);
      tela.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Não consegui preparar a imagem."))),
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não consegui abrir essa imagem. Tente um JPG ou PNG."));
    };
    img.src = url;
  });
}

/**
 * Sobe a foto e devolve o CAMINHO dela no balde. Não grava na pessoa.
 *
 * A imagem continua indo DIRETO pro Storage, e não pela API: o corpo da
 * função da Vercel para em 4,5 MB e quem autoriza é a rota, que assina o
 * endereço antes (web/src/lib/storage.js explica a decisão inteira).
 *
 * Quem escolhe o caminho agora é a rota — a pasta sai do e-mail do LOGIN
 * (SEG-13), com o mesmo carimbo de tempo que fura o cache do navegador. O
 * `email` segue na assinatura porque é a tela que sabe de quem é a foto;
 * conferir isso passou a ser do servidor.
 */
export async function subirFotoPerfil(file, email, recorte) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado — a foto não tem onde ficar guardada.");
  if (!file?.type?.startsWith("image/")) throw new Error("Escolha uma imagem (JPG, PNG ou WEBP).");

  const quadrado = await quadradoDe(file, recorte);
  try {
    const assinatura = await apiJson("/api/pessoas/foto/envio", { metodo: "POST", corpo: {} });
    return await enviarAssinado(BALDE_FOTO, assinatura, quadrado, { upsert: true });
  } catch (err) {
    /* `enviarAssinado` e a API já devolvem frase pronta ("Sua sessão expirou…",
       "Arquivo grande demais…"). Prefixar por cima gerava "Não consegui
       guardar a foto: Não consegui guardar o arquivo: …". O prefixo só entra
       quando o que veio não explica nada. */
    const m = String(err?.message || "");
    throw new Error(m && /[a-zç]\s/i.test(m) ? m : "Não consegui guardar a foto: " + m);
  }
}

/** O endereço público da foto. Síncrona — entra direto no src do <img>. */
export function urlDaFoto(caminho) {
  if (!caminho || !supabaseConfigurado) return null;
  return urlPublica(BALDE_FOTO, caminho);
}

/**
 * Grava a foto na PRÓPRIA linha, pela função do banco.
 *
 * Não passa por `salvarPessoa` de propósito: a foto é a única coisa que a
 * pessoa muda em si mesma, e quando o RLS de perfis entrar (rls-perfis.sql)
 * nem ela poderá escrever direto na linha. A função `definir_foto` é o
 * mesmo desenho de `registrar_acesso`: mexe só nesta coluna, só na linha
 * de quem chamou, e o e-mail vem do login.
 *
 * `caminho` vazio apaga a foto e devolve as iniciais.
 */
export async function definirFotoPerfil(caminho) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  /* Quem chama `definir_foto` agora e' a rota (PUT /api/pessoas/foto): o
     e-mail sai do login la', e nao do que o navegador mandasse. A
     instrucao de "falta rodar o SQL" volta como `code: "migracao"`, que o
     `comMigracao` converte de novo em `erro.migracao` pra tela. */
  try {
    await comMigracao(() => apiJson("/api/pessoas/foto", { metodo: "PUT", corpo: { caminho: caminho || "" } }));
  } catch (e) {
    /* A instrução de migração já se explica sozinha e chega inteira; o resto
       vem genérico da API ("Você não tem permissão…") e, no meio da tela de
       perfil, não diz o que deixou de salvar. */
    if (e?.migracao) throw e;
    const nova = new Error("Não consegui salvar a foto: " + (e?.message || ""));
    nova.code = e?.code;
    throw nova;
  }
  return true;
}
