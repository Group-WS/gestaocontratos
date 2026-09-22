import { gzipSync, strToU8, gunzipSync, strFromU8 } from "fflate";
import { supabaseConfigurado } from "./supabase";
import { apiFetch, apiJson } from "./api";
import { linhaParaGravar, erroDaResposta, ErroDeGravacao, bytesParaBase64 } from "./gravacaoObra";

/* A coluna `arquivos` ja existia em obra_dados guardando `{}` — objeto,
   nao lista. `{} || []` devolve o objeto, e `.forEach` num objeto derruba
   a tela inteira. Nao adianta so trocar o default no banco: as linhas
   antigas continuam com `{}` gravado.

   Entao a leitura decide a forma, sempre. Coluna compartilhada com uma
   versao anterior nunca chega no formato que a versao nova espera. */
const listaDeArquivos = (v) => (Array.isArray(v) ? v : []);

/* O QUE VEM DA API, DESCOMPRIMIDO — o caminho inverso do que a gravação faz.
 *
 * A função da Vercel corta o corpo em 4,5 MB, nos dois sentidos. É por isso
 * que `salvarDadosObra` SOBE comprimida, e a leitura da obra tem o mesmo
 * teto e a mesma carga: o `categorias` de uma obra grande sozinho passa de
 * 1 MB em JSON. Então a obra inteira e os lotes do painel voltam em
 * `{ gzip: "<base64>" }` (web/api/_lib/rotas/obraConteudo.js) e são abertos
 * aqui, com o mesmo `fflate` que comprime na ida. */
function doGzip(base64) {
  const bruto = atob(base64);
  const bytes = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i += 1) bytes[i] = bruto.charCodeAt(i);
  return JSON.parse(strFromU8(gunzipSync(bytes)));
}

/**
 * O conteúdo de uma obra: o que os uploads produziram, as aprovações do
 * depara e o estado das liberações.
 *
 * Guardado como documento (JSON), no mesmo formato que o app usa na
 * tela. O mesmo item existe nas três fontes — contrato, planilha,
 * executivo — e comparar as três é justamente o que o depara faz; uma
 * tabela com um item por linha não comportaria isso sem inventar
 * chaves.
 */

/* Depois deste tempo SEM ALTERAÇÃO, a trava de edição é considerada
   abandonada: outra pessoa pode assumir, o cadeado sai da lista e a própria
   tela de quem abriu volta pro modo leitura.

   Era 30 minutos — meia manhã de trabalho parada, e foi o que ela viu
   acontecer duas vezes. Passou a 5 a pedido dela em 17/09/2026, contados
   desde a última alteração: quem está trabalhando reinicia o relógio a cada
   mexida e não é interrompido.

   O relógio do banco é o `editando_desde`, que o salvamento automático
   atualiza a cada gravação. Quem segura a trava sem mexer em nada não grava,
   então não renova. */
export const MINUTOS_ATE_TRAVA_EXPIRAR = 5;

/* Trava vencida não é trava.
 *
 * O vencimento estava aplicado em dois lugares e faltando num terceiro:
 * `pegarEdicao` deixa assumir uma trava velha, `listarTravas` não manda o
 * cadeado pra barra lateral — mas a leitura da obra devolvia `editando_por`
 * cru. O resultado é que a tarja dentro da obra anunciava alguém editando
 * horas depois de a trava ter morrido.
 *
 * Aconteceu em 17/09/2026: a tarja dizia "editando desde 10:47" às 13:02,
 * 136 minutos depois, com o cadeado da lista lateral já apagado. Quem olhava
 * a obra achava que não podia mexer, e podia.
 */
/* MESMA PESSOA, INDEPENDENTE DA CAIXA.
 *
 * Quem grava a trava agora e' o servidor, com o e-mail do LOGIN (SEG-13), e
 * a portaria o normaliza em minusculas. A tela compara com o `usuario` como
 * o `supabase.auth` o devolveu — que pode vir com maiuscula. Comparar cru
 * fazia quem acabou de pegar a trava ver a tarja "está editando esta obra"
 * apontando para si mesmo, sem conseguir habilitar a edição. */
export const mesmaPessoa = (a, b) =>
  !!a && !!b && String(a).toLowerCase() === String(b).toLowerCase();

export function travaViva(desde) {
  if (!desde) return false;
  const quando = new Date(desde).getTime();
  return Number.isFinite(quando) && Date.now() - quando < MINUTOS_ATE_TRAVA_EXPIRAR * 60_000;
}

/**
 * A obra como está no banco — pela API, que devolve a linha comprimida.
 *
 * Era um `select("*")` feito daqui; agora a rota lista as colunas (as mesmas
 * que `paraApp` lê) e o navegador só descomprime e traduz. Obra sem linha no
 * banco continua devolvendo null.
 */
export async function carregarDadosObra(codigo) {
  if (!supabaseConfigurado) return null;
  let resposta;
  try {
    resposta = await apiJson(`/api/obras/${encodeURIComponent(String(codigo))}/conteudo`);
  } catch (e) {
    /* 404 É AUSÊNCIA, NÃO FALHA.
     *
     * A rota responde "Obra não encontrada" tanto para a obra que não existe
     * quanto para a que esta pessoa não enxerga — de propósito, para não
     * confirmar que ela existe (SEG-14). Quando o navegador lia a tabela, o
     * RLS simplesmente não devolvia linha e isto aqui era `null`: a obra
     * abria vazia. Tratar como erro poria uma tarja vermelha no lugar de uma
     * tela em branco, que é o que a pessoa já esperava ver. */
    if (e?.status === 404) return null;
    throw e;
  }
  const linha = doGzip(resposta.gzip);
  return linha ? paraApp(linha) : null;
}

/* Uma chamada de gravação à API. Resposta de erro vira ErroDeGravacao, com o
   tipo que diz à fila o que fazer (repetir, parar, esperar alteração nova);
   sem resposta nenhuma (rede) é temporário. */
async function postarGravacao(caminho, corpo) {
  let res;
  try {
    res = await apiFetch(caminho, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new ErroDeGravacao("Sem conexão com o servidor.", { tipo: "temporario" });
  }
  let dados = null;
  try { dados = await res.json(); } catch { /* resposta sem corpo */ }
  if (!res.ok) throw erroDaResposta(res.status, dados);
  return dados || {};
}

/**
 * Grava o conteúdo inteiro da obra — pela API, e quem decide é o banco.
 *
 * Era um UPSERT da linha inteira feito daqui, e o comentário dizia que só
 * quem estava com a trava conseguia gravar; o UPSERT não conferia nada. Uma
 * cópia velha da obra ia por cima do trabalho de outra pessoa sem ninguém
 * saber. Agora a função `salvar_obra` (supabase/salvar-obra.sql) só grava com
 * a trava de quem grava e com a `versao` que esta tela leu — e o cinto da
 * obra 2450 (obra vazia não grava por cima de obra cheia) mora lá, na mesma
 * transação.
 *
 * O conteúdo vai comprimido: a obra inteira passa de 1 MB, e a função da
 * Vercel corta o corpo em 4,5 MB.
 *
 * Devolve `{ versao }`, a versão nova — é com ela que a próxima gravação
 * desta tela vai se apresentar. Não gravou, lança ErroDeGravacao.
 */
export async function salvarDadosObra(codigo, conteudo, versao) {
  if (!supabaseConfigurado) throw new Error("Banco de dados não configurado.");
  const gzip = bytesParaBase64(gzipSync(strToU8(JSON.stringify(linhaParaGravar(conteudo)))));
  const r = await postarGravacao(`/api/obras/${encodeURIComponent(String(codigo))}/gravar`, { versao, gzip });
  return { versao: r.versao };
}

/**
 * Grava SÓ o que mudou, em vez da obra inteira (ADR-004).
 *
 * Cada patch é um de três formatos:
 *   { verba, item, campos, confCodigo?, confDesc? }  — um campo de um item
 *   { verba, mapa, chave, campos }                   — um mapa da verba
 *   { coluna, valor }                                — uma marca da obra
 *
 * `verba` e `item` são POSIÇÕES, e posição muda quando alguém insere ou apaga
 * linha: por isso vão junto o código e a descrição que a tela viu. O banco
 * confere antes de escrever e recusa o que não bater. Trava e versão são
 * conferidas como na gravação inteira.
 *
 * Devolve `{ versao, aplicados, recusados }`.
 */
export async function aplicarPatchObra(codigo, patches, versao) {
  if (!supabaseConfigurado) throw new Error("Banco de dados não configurado.");
  return postarGravacao(`/api/obras/${encodeURIComponent(String(codigo))}/patch`, { versao, patches });
}

/* A obra aberta para edição NESTA aba, se houver: quem a registra é a tela
   (App.jsx), que sabe aplicar uma mudança no que está na memória e deixar a
   fila de gravação dela levar junto. */
let edicaoNestaAba = null;
export function definirEdicaoNestaAba(fn) { edicaoNestaAba = fn; }

/**
 * Uma alteração avulsa da obra, fora da tela de edição — o Catálogo mandando
 * produtos para o Executivo, a Apresentação guardando o PDF em Arquivos da
 * obra. `mudar(obra)` recebe a obra e devolve a obra alterada.
 *
 * Antes, cada uma lia a obra, mudava e gravava a linha inteira de volta: se
 * alguém gravasse no meio, a gravação avulsa apagava esse trabalho — e ainda
 * deixava a trava presa no nome de quem nem estava editando. Agora:
 *   - obra em edição nesta aba: a mudança entra pela tela, e a fila de
 *     gravação da tela a leva (gravar por fora brigaria com ela pela versão);
 *   - senão: pega a trava (a obra volta junto, como está no banco agora),
 *     muda, grava com a versão lida e devolve a trava.
 *
 * Devolve null quando a obra ainda não tem linha no banco. Obra em edição
 * por outra pessoa lança ErroDeGravacao com `detalhe.motivo = "trava"`.
 */
export async function alterarObra(codigo, email, mudar) {
  const chave = String(codigo);
  if (edicaoNestaAba && edicaoNestaAba(chave, mudar)) return { naTela: true };

  const antes = await carregarDadosObra(chave);
  if (!antes) return null;
  const trava = (por, desde) => new ErroDeGravacao(`${por || "Outra pessoa"} está editando esta obra agora.`,
    { tipo: "conflito", detalhe: { motivo: "trava", por: por || null, desde: desde || null } });
  if (antes.editandoPor && !mesmaPessoa(antes.editandoPor, email)) throw trava(antes.editandoPor, antes.editandoDesde);

  // A trava já era desta pessoa (outra aba dela): fica. Senão, volta ao fim.
  const eraMinha = mesmaPessoa(antes.editandoPor, email);
  const r = await pegarEdicao(chave, email);
  if (!r.ok) throw trava(r.por, r.desde);
  try {
    await salvarDadosObra(chave, mudar(r.dados), r.dados.versao);
  } finally {
    if (!eraMinha) {
      await liberarEdicao(chave, email).catch((e) => console.warn(`[obra ${chave}] trava não devolvida (vence sozinha):`, e?.message || e));
    }
  }
  return { naTela: false };
}

/**
 * Só garante que a linha da obra existe no banco — sem mexer em nada que
 * já esteja lá, nem trava de edição, nem conteúdo (`ignoreDuplicates`
 * faz o upsert não tocar em nada quando a linha já existe).
 *
 * Uma obra cadastrada na mão (fora do fluxo normal de upload de
 * planilha) nunca ganha essa linha sozinha, e sem ela "Arquivos da obra"
 * não tem onde guardar nada — quem descobria isso era a geração de PDF
 * da apresentação, no meio do processo, tarde demais.
 *
 * Quem faz o upsert é a API; o `ignoreDuplicates` continua lá. Falha aqui
 * segue sem voz, como sempre foi: o upsert daqui nunca reclamou, e quem
 * chama (a Apresentação, ao abrir) não tem o que fazer com o aviso — quem
 * precisa mesmo da linha é a gravação, que falaria por si.
 */
export async function garantirObraDados(codigo) {
  if (!supabaseConfigurado) return;
  await apiJson(`/api/obras/${encodeURIComponent(String(codigo))}/conteudo`, { metodo: "POST" }).catch(() => {});
}

/**
 * Tenta pegar a obra pra editar.
 *
 * Devolve { ok: true, dados } quando conseguiu, ou { ok: false, por, desde }
 * quando outra pessoa está com ela. A trava só é tomada se estiver livre
 * ou vencida — a condição vai no UPDATE, então quem chegar em segundo
 * lugar simplesmente não atualiza nenhuma linha e descobre isso.
 *
 * `dados` é a obra como está no banco NO INSTANTE em que a trava foi pega —
 * a mesma linha que o UPDATE devolve. É ela que a tela passa a editar: a
 * cópia que estava aberta pode ser de antes da última gravação de outra
 * pessoa, e editar a partir dela apagaria esse trabalho.
 *
 * O UPDATE com a condição dentro é o que garante isso, e ele mora na rota
 * (web/api/_lib/rotas/obraConteudo.js) — junto com o `garantirObraDados`,
 * que passou a ser feito lá, na mesma ida. O `email` continua na assinatura
 * porque é o de quem está logado nesta aba; quem o servidor grava na trava é
 * o do LOGIN (SEG-13), que é o mesmo.
 */
export async function pegarEdicao(codigo, email) {
  if (!supabaseConfigurado) return { ok: true, local: true };

  const r = await apiJson(`/api/obras/${encodeURIComponent(String(codigo))}/edicao`, { metodo: "POST" });
  if (r.ok) return { ok: true, dados: paraApp(doGzip(r.gzip)) };

  /* Não conseguiu: alguém está com ela. A trava vem como está no banco, e a
     régua do vencimento é aplicada aqui — a mesma de `paraApp`, para a tarja
     nunca anunciar trava que já morreu. */
  return {
    ok: false,
    por: travaViva(r.desde) ? r.por || null : null,
    desde: travaViva(r.desde) ? r.desde || null : null,
  };
}

/**
 * Devolve a obra pros outros — some a trava, o conteúdo fica.
 *
 * Só a própria trava sai: a rota confere o e-mail de quem chamou, como o
 * `.eq("editando_por", email)` daqui fazia. Falha continua sem voz — este
 * caminho nunca reclamou, e a trava que fica vence sozinha em 5 minutos.
 */
export async function liberarEdicao(codigo, email) {
  if (!supabaseConfigurado) return;
  await apiJson(`/api/obras/${encodeURIComponent(String(codigo))}/edicao`, { metodo: "DELETE" }).catch(() => {});
}

/** Quem está editando cada obra — pra sidebar mostrar o cadeado. */
export async function listarTravas() {
  if (!supabaseConfigurado) return new Map();
  /* O filtro por data (trava vencida não é trava) vai junto na rota: é a
     mesma régua do `travaViva` daqui, aplicada no banco. */
  const lista = await apiJson("/api/obras-travas");
  return new Map((lista || []).map((d) => [String(d.obra_codigo), { por: d.editando_por, desde: d.editando_desde }]));
}

function paraApp(linha) {
  return {
    categorias: linha.categorias || [],
    cadernos: linha.cadernos || {},
    arquivos: listaDeArquivos(linha.arquivos),
    aprovacoes: new Set(linha.aprovacoes || []),
    deparaAprovado: !!linha.depara_aprovado,
    executivoLiberadoDireto: !!linha.executivo_liberado_direto,
    comprasLiberadas: !!linha.compras_liberadas,
    etapasConcluidas: linha.etapas_concluidas || {},
    clienteAssinouEm: linha.cliente_assinou_em || null,
    clienteAssinaturaPor: linha.cliente_assinatura_por || null,
    clienteAssinaturaArq: linha.cliente_assinatura_arq || null,
    clienteAssinaturaObs: linha.cliente_assinatura_obs || null,
    compraSemAssinaturaPor: linha.compra_sem_assinatura_por || null,
    compraSemAssinaturaEm: linha.compra_sem_assinatura_em || null,
    compraSemAssinaturaJust: linha.compra_sem_assinatura_just || null,
    dataEntrega: linha.data_entrega || null,
    escopos: linha.escopos || [],
    cmvLiberado: linha.cmv_liberado ?? null,
    cmvLiberadoEm: linha.cmv_liberado_em || null,
    cmvLiberadoPor: linha.cmv_liberado_por || null,
    /* Só anuncia quem está editando se a trava ainda vale — a mesma régua
       que `listarTravas` usa pro cadeado da barra lateral. Sem isto os dois
       discordavam: cadeado apagado e tarja dizendo que a obra estava tomada. */
    editandoPor: travaViva(linha.editando_desde) ? linha.editando_por || null : null,
    editandoDesde: travaViva(linha.editando_desde) ? linha.editando_desde || null : null,
    atualizadoEm: linha.atualizado_em || null,
    atualizadoPor: linha.atualizado_por || null,
    /* A versão que esta leitura viu. A gravação a devolve ao banco, que só
       grava se ninguém tiver mudado a obra depois. Nula enquanto o
       supabase/salvar-obra.sql não rodou — e aí a tela não abre edição. */
    versao: linha.versao ?? null,
  };
}

/**
 * Carrega o essencial de VARIAS obras de uma vez.
 *
 * O painel geral compara obras entre si, e ate agora os dados de uma obra
 * so chegavam quando alguem abria aquela obra — entao o painel somava,
 * na pratica, uma obra so. Aqui vem tudo junto.
 *
 * Colunas escolhidas a dedo: `categorias` ja e' um JSONB gordo, e trazer
 * `cadernos`, `escopos` e o resto de dez obras encheria a memoria com o
 * que esta tela nao le.
 */
export async function carregarResumoDeVarias(codigos, onParcial) {
  if (!supabaseConfigurado || !codigos?.length) return new Map();

  /* Em lotes, e nao tudo numa consulta so. `categorias` e' um JSONB
     grande; com as quarenta e poucas obras que a empresa tem hoje, uma
     unica resposta passaria de varios MB e a tela ficaria em branco ate
     o fim dela. Em lotes o painel vai se preenchendo, e um lote que
     falha nao derruba os outros. */
  const LOTE = 12;
  const tudo = new Map();
  for (let i = 0; i < codigos.length; i += LOTE) {
    const fatia = codigos.slice(i, i + LOTE).map(String);
    /* Um lote por pedido. As colunas (as poucas que esta tela lê) e o filtro
       moram na rota; a resposta vem comprimida pelo mesmo motivo da obra
       inteira — `categorias` de doze obras não cabe no teto da Vercel. */
    const { gzip } = await apiJson("/api/obras-resumos", { metodo: "POST", corpo: { codigos: fatia } });
    const data = doGzip(gzip);
    (data || []).forEach((l) => tudo.set(String(l.obra_codigo), {
      categorias: l.categorias || [],
      dataEntrega: l.data_entrega || null,
      comprasLiberadas: !!l.compras_liberadas,
      // O painel da Mehoo entrega os cadernos do executivo pra baixar.
      cadernos: l.cadernos || {},
      // Pro painel geral saber em que fase cada obra está sem abrir uma
      // por uma — CMV liberado é um dos marcos que ele mostra.
      deparaAprovado: !!l.depara_aprovado,
      cmvLiberado: l.cmv_liberado ?? null,
      /* Assinatura geral do cliente: sem ela, a contagem de pendências do
         Início diria que a obra inteira está esperando o cliente que já
         assinou. */
      clienteAssinouEm: l.cliente_assinou_em || null,
    }));
    // Mapa novo a cada lote: o React so re-renderiza se a referencia mudar.
    if (onParcial) onParcial(new Map(tudo));
  }
  return tudo;
}
