import { supabase, supabaseConfigurado } from "./supabase";

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

// Depois deste tempo sem salvar, a trava de edição é considerada
// abandonada e outra pessoa pode assumir. Sem isso, um navegador
// fechado no meio da edição travaria a obra para sempre.
export const MINUTOS_ATE_TRAVA_EXPIRAR = 30;

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

/**
 * Grava o conteúdo da obra. Só quem está com a trava consegue —
 * o `eq("editando_por", email)` é o que garante isso no próprio banco,
 * e não só na tela: se dois navegadores tentarem, um deles não grava.
 */
export async function salvarDadosObra(codigo, conteudo, email) {
  if (!supabaseConfigurado) throw new Error("Banco de dados não configurado.");

  const linha = {
    obra_codigo: String(codigo),
    categorias: conteudo.categorias || [],
    cadernos: conteudo.cadernos || {},
    arquivos: listaDeArquivos(conteudo.arquivos),
    aprovacoes: Array.from(conteudo.aprovacoes || []),
    depara_aprovado: !!conteudo.deparaAprovado,
    // Executivo destravado sem passar pelo Depara — obra sem Vendido pra
    // comparar. Separado de depara_aprovado de proposito: o Depara
    // continua "nao concluido" no Planejamento, porque nao foi feito.
    executivo_liberado_direto: !!conteudo.executivoLiberadoDireto,
    compras_liberadas: !!conteudo.comprasLiberadas,
    // Esteira: quem concluiu cada etapa, e o portão da assinatura do
    // cliente que segura a liberação de compras.
    etapas_concluidas: conteudo.etapasConcluidas || {},
    cliente_assinou_em: conteudo.clienteAssinouEm || null,
    cliente_assinatura_por: conteudo.clienteAssinaturaPor || null,
    cliente_assinatura_arq: conteudo.clienteAssinaturaArq || null,
    cliente_assinatura_obs: conteudo.clienteAssinaturaObs || null,
    compra_sem_assinatura_por: conteudo.compraSemAssinaturaPor || null,
    compra_sem_assinatura_em: conteudo.compraSemAssinaturaEm || null,
    compra_sem_assinatura_just: conteudo.compraSemAssinaturaJust || null,
    // O CMV liberado é o teto com que a equipe trabalha daqui pra frente.
    // Ficava só na memória do navegador: ao recarregar, o resumo do topo
    // e o fechamento do rodapé do Executivo sumiam sem dizer nada.
    // A data de entrega comanda o prazo de compra de todos os grupos.
    data_entrega: conteudo.dataEntrega || null,
    // Escopos de contratacao: o texto do modelo vem copiado dentro de
    // cada um, entao o documento nao muda quando o modelo muda.
    escopos: conteudo.escopos || [],
    cmv_liberado: conteudo.cmvLiberado ?? null,
    cmv_liberado_em: conteudo.cmvLiberadoEm || null,
    cmv_liberado_por: conteudo.cmvLiberadoPor || null,
    atualizado_por: email || null,
    editando_por: email || null,
    editando_desde: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("obra_dados")
    .upsert(linha, { onConflict: "obra_codigo" })
    .select()
    .single();

  /* Coluna que ainda não existe no banco não pode derrubar o salvamento
     inteiro.

     Quando o app ganha um campo novo, a coluna correspondente só passa a
     existir depois que alguém roda a migração — e entre o deploy e o SQL
     existe uma janela em que o Postgres rejeita o UPSERT todo por causa
     de uma coluna desconhecida. O efeito era o pior possível: a pessoa
     continuava trabalhando e NADA era gravado, com um aviso genérico no
     topo.

     Aqui a gente tira os campos que o banco não conhece e grava o resto.
     O trabalho é salvo; só os campos novos ficam de fora até a migração
     rodar — e o aviso diz exatamente isso, em vez de "não consegui". */
  if (error && (error.code === "PGRST204" || /column .* does not exist|Could not find the/i.test(error.message || ""))) {
    const desconhecida = (error.message || "").match(/'([^']+)'/)?.[1];
    const opcionais = [
      "etapas_concluidas", "cliente_assinou_em", "cliente_assinatura_por",
      "cliente_assinatura_arq", "cliente_assinatura_obs",
      "compra_sem_assinatura_por", "compra_sem_assinatura_em", "compra_sem_assinatura_just",
      "cmv_liberado", "cmv_liberado_em", "cmv_liberado_por",
      "data_entrega", "escopos", "arquivos", "executivo_liberado_direto",
    ];
    const reduzida = { ...linha };
    opcionais.forEach((c) => { delete reduzida[c]; });

    const retry = await supabase
      .from("obra_dados")
      .upsert(reduzida, { onConflict: "obra_codigo" })
      .select()
      .single();
    if (retry.error) throw retry.error;

    const app = paraApp(retry.data);
    app.migracaoPendente = desconhecida
      ? `A coluna "${desconhecida}" ainda não existe no banco. Salvei o resto — rode o SQL que falta (supabase/etapas.sql ou supabase/prazos.sql).`
      : "Faltam colunas novas no banco. Salvei o resto — rode os SQL de supabase/.";
    return app;
  }

  if (error) throw error;
  return paraApp(data);
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
 * Devolve { ok: true } quando conseguiu, ou { ok: false, por, desde }
 * quando outra pessoa está com ela. A trava só é tomada se estiver livre
 * ou vencida — a condição vai no UPDATE, então quem chegar em segundo
 * lugar simplesmente não atualiza nenhuma linha e descobre isso.
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
  if (data) return { ok: true };

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
    editandoPor: linha.editando_por || null,
    editandoDesde: linha.editando_desde || null,
    atualizadoEm: linha.atualizado_em || null,
    atualizadoPor: linha.atualizado_por || null,
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
      .select("obra_codigo, categorias, data_entrega, compras_liberadas, cadernos, depara_aprovado, cmv_liberado")
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
    }));
    // Mapa novo a cada lote: o React so re-renderiza se a referencia mudar.
    if (onParcial) onParcial(new Map(tudo));
  }
  return tudo;
}
