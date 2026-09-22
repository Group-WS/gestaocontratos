import { gzipSync, strToU8 } from "fflate";
import { supabase, supabaseConfigurado } from "./supabase";
import { apiFetch } from "./api";
import { linhaParaGravar, erroDaResposta, ErroDeGravacao, bytesParaBase64 } from "./gravacaoObra";

/* A coluna `arquivos` ja existia em obra_dados guardando `{}` — objeto,
   nao lista. `{} || []` devolve o objeto, e `.forEach` num objeto derruba
   a tela inteira. Nao adianta so trocar o default no banco: as linhas
   antigas continuam com `{}` gravado.

   Entao a leitura decide a forma, sempre. Coluna compartilhada com uma
   versao anterior nunca chega no formato que a versao nova espera. */
const listaDeArquivos = (v) => (Array.isArray(v) ? v : []);

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
export function travaViva(desde) {
  if (!desde) return false;
  const quando = new Date(desde).getTime();
  return Number.isFinite(quando) && Date.now() - quando < MINUTOS_ATE_TRAVA_EXPIRAR * 60_000;
}

export async function carregarDadosObra(codigo) {
  if (!supabaseConfigurado) return null;
  const { data, error } = await supabase
    .from("obra_dados")
    .select("*")
    .eq("obra_codigo", String(codigo))
    .maybeSingle();
  if (error) throw error;
  return data ? paraApp(data) : null;
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
  if (antes.editandoPor && antes.editandoPor !== email) throw trava(antes.editandoPor, antes.editandoDesde);

  // A trava já era desta pessoa (outra aba dela): fica. Senão, volta ao fim.
  const eraMinha = antes.editandoPor === email;
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
 */
export async function garantirObraDados(codigo) {
  if (!supabaseConfigurado) return;
  await supabase.from("obra_dados").upsert(
    { obra_codigo: String(codigo) },
    { onConflict: "obra_codigo", ignoreDuplicates: true }
  );
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
 */
export async function pegarEdicao(codigo, email) {
  if (!supabaseConfigurado) return { ok: true, local: true };

  const limite = new Date(Date.now() - MINUTOS_ATE_TRAVA_EXPIRAR * 60_000).toISOString();
  const agora = new Date().toISOString();

  await garantirObraDados(codigo);

  const { data, error } = await supabase
    .from("obra_dados")
    .update({ editando_por: email, editando_desde: agora })
    .eq("obra_codigo", String(codigo))
    .or(`editando_por.is.null,editando_por.eq.${email},editando_desde.lt.${limite}`)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (data) return { ok: true, dados: paraApp(data) };

  // não conseguiu: alguém está com ela
  const atual = await carregarDadosObra(codigo);
  return { ok: false, por: atual?.editandoPor, desde: atual?.editandoDesde };
}

/** Devolve a obra pros outros — some a trava, o conteúdo fica. */
export async function liberarEdicao(codigo, email) {
  if (!supabaseConfigurado) return;
  await supabase
    .from("obra_dados")
    .update({ editando_por: null, editando_desde: null })
    .eq("obra_codigo", String(codigo))
    .eq("editando_por", email);
}

/** Quem está editando cada obra — pra sidebar mostrar o cadeado. */
export async function listarTravas() {
  if (!supabaseConfigurado) return new Map();
  const limite = new Date(Date.now() - MINUTOS_ATE_TRAVA_EXPIRAR * 60_000).toISOString();
  const { data, error } = await supabase
    .from("obra_dados")
    .select("obra_codigo, editando_por, editando_desde")
    .not("editando_por", "is", null)
    .gte("editando_desde", limite);
  if (error) throw error;
  return new Map((data || []).map((d) => [String(d.obra_codigo), { por: d.editando_por, desde: d.editando_desde }]));
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
    const { data, error } = await supabase
      .from("obra_dados")
      /* `cliente_assinou_em` entra pra contagem de pendencias do Inicio:
         sem ele, obra com assinatura geral do cliente apareceria com TODOS
         os itens "esperando o cliente" — o oposto da verdade. */
      .select("obra_codigo, categorias, data_entrega, compras_liberadas, cadernos, depara_aprovado, cmv_liberado, cliente_assinou_em")
      .in("obra_codigo", fatia);
    if (error) throw error;
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
