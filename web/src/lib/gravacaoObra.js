/* O QUE A GRAVAÇÃO DA OBRA MANDA, E COMO LER O QUE VOLTA.
 *
 * Funções puras, sem rede: quem grava é `dadosObra.js`, pela API
 * (`/api/obras/:codigo/gravar`), e quem decide é o banco
 * (supabase/salvar-obra.sql) — só grava com a trava de quem grava e com a
 * versão que a tela leu. O resto deste arquivo é traduzir a resposta para
 * a tela dizer, sem jargão, o que aconteceu e o que fazer.
 */

/* Os campos da obra, na tela, que vão para o banco — e a coluna de cada um.
   É a mesma lista que a API confere (web/api/_lib/validacao.js,
   `conteudoDaObra`): campo novo entra nos dois lugares. */
export const COLUNA_DO_CAMPO = {
  categorias: "categorias",
  cadernos: "cadernos",
  arquivos: "arquivos",
  aprovacoes: "aprovacoes",
  escopos: "escopos",
  etapasConcluidas: "etapas_concluidas",
  deparaAprovado: "depara_aprovado",
  executivoLiberadoDireto: "executivo_liberado_direto",
  comprasLiberadas: "compras_liberadas",
  clienteAssinouEm: "cliente_assinou_em",
  clienteAssinaturaPor: "cliente_assinatura_por",
  clienteAssinaturaArq: "cliente_assinatura_arq",
  clienteAssinaturaObs: "cliente_assinatura_obs",
  compraSemAssinaturaPor: "compra_sem_assinatura_por",
  compraSemAssinaturaEm: "compra_sem_assinatura_em",
  compraSemAssinaturaJust: "compra_sem_assinatura_just",
  cmvLiberado: "cmv_liberado",
  cmvLiberadoEm: "cmv_liberado_em",
  cmvLiberadoPor: "cmv_liberado_por",
  dataEntrega: "data_entrega",
};

const lista = (v) => (Array.isArray(v) ? v : []);
const objeto = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const objetoOuNulo = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);
const textoOuNulo = (v) => (typeof v === "string" && v !== "" ? v : null);
function numeroOuNulo(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * A obra da tela no formato das colunas de `obra_dados`.
 *
 * Cada campo sai no formato da coluna, sempre: a coluna `arquivos` já
 * guardou `{}` em obra antiga, e uma lista que chega como objeto não pode
 * derrubar a gravação inteira. A trava e o carimbo de quem gravou NÃO vão:
 * quem grava é o login, no banco.
 */
export function linhaParaGravar(conteudo) {
  const c = conteudo || {};
  return {
    categorias: lista(c.categorias),
    cadernos: objeto(c.cadernos),
    arquivos: lista(c.arquivos),
    aprovacoes: Array.from(c.aprovacoes || []),
    escopos: lista(c.escopos),
    etapas_concluidas: objeto(c.etapasConcluidas),
    depara_aprovado: !!c.deparaAprovado,
    // Executivo destravado sem passar pelo Depara (obra sem Vendido): o Depara
    // continua "não concluído" no Planejamento, porque não foi feito.
    executivo_liberado_direto: !!c.executivoLiberadoDireto,
    compras_liberadas: !!c.comprasLiberadas,
    cliente_assinou_em: textoOuNulo(c.clienteAssinouEm),
    cliente_assinatura_por: textoOuNulo(c.clienteAssinaturaPor),
    cliente_assinatura_arq: objetoOuNulo(c.clienteAssinaturaArq),
    cliente_assinatura_obs: textoOuNulo(c.clienteAssinaturaObs),
    compra_sem_assinatura_por: textoOuNulo(c.compraSemAssinaturaPor),
    compra_sem_assinatura_em: textoOuNulo(c.compraSemAssinaturaEm),
    compra_sem_assinatura_just: textoOuNulo(c.compraSemAssinaturaJust),
    // O CMV liberado é o teto com que a equipe trabalha daqui pra frente.
    cmv_liberado: numeroOuNulo(c.cmvLiberado),
    cmv_liberado_em: textoOuNulo(c.cmvLiberadoEm),
    cmv_liberado_por: textoOuNulo(c.cmvLiberadoPor),
    // A data de entrega comanda o prazo de compra de todos os grupos.
    data_entrega: textoOuNulo(c.dataEntrega),
  };
}

/**
 * Nada do que se grava mudou entre as duas versões da obra na tela?
 *
 * Compara por referência, campo a campo: toda alteração do app cria um objeto
 * novo para o campo que mudou. É o que separa trabalho de alguém de uma
 * mudança que não vai ao banco (os aditivos que chegam, os totais refeitos).
 */
export function mesmoConteudo(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return Object.keys(COLUNA_DO_CAMPO).every((campo) => Object.is(a[campo], b[campo]));
}

/**
 * Erro de gravação, com o que a fila precisa para decidir o que fazer:
 *   conflito   — a obra mudou no banco, ou a trava é de outra pessoa. Repetir
 *                gravaria por cima do trabalho de alguém: para.
 *   recusado   — o servidor disse não a ESTE conteúdo. Só uma alteração nova
 *                (ou a pessoa pedindo) tenta de novo.
 *   temporario — rede, servidor fora, sessão renovando. Tenta de novo sozinho.
 */
export class ErroDeGravacao extends Error {
  constructor(mensagem, { tipo = "temporario", status = null, detalhe = {} } = {}) {
    super(mensagem);
    this.name = "ErroDeGravacao";
    this.tipo = tipo;
    this.status = status;
    this.detalhe = detalhe;
  }
}

/** A resposta de erro da API (status e corpo) virando ErroDeGravacao. */
export function erroDaResposta(status, dados) {
  const d = dados || {};
  const mensagem = typeof d.error === "string" && d.error ? d.error : null;
  if (status === 409) {
    return new ErroDeGravacao(mensagem || "A obra mudou no banco.", {
      tipo: "conflito",
      status,
      detalhe: {
        motivo: d.motivo || "versao",
        por: d.por || null,
        desde: d.desde || null,
        versao: d.versao ?? null,
        atualizadoPor: d.atualizadoPor || null,
        atualizadoEm: d.atualizadoEm || null,
      },
    });
  }
  // Sem resposta, sessão renovando, servidor fora ou sobrecarregado: passa.
  if (!status || status === 401 || status === 408 || status === 429 || status >= 500) {
    return new ErroDeGravacao(mensagem || "O servidor não respondeu.", { tipo: "temporario", status: status || null });
  }
  // 400, 403, 404, 413: o mesmo pedido vai ouvir o mesmo não.
  return new ErroDeGravacao(mensagem || "O servidor recusou a gravação.", { tipo: "recusado", status });
}

/** Bytes (o gzip do conteúdo) em base64, sem estourar a pilha com obra grande. */
export function bytesParaBase64(bytes) {
  let texto = "";
  const PASSO = 0x8000;
  for (let i = 0; i < bytes.length; i += PASSO) {
    texto += String.fromCharCode.apply(null, bytes.subarray(i, i + PASSO));
  }
  return btoa(texto);
}

/* ---------- o que a tela diz ---------- */

function hora(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? ` às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
    : "";
}

const segundosAte = (quando, agora) => Math.max(0, Math.ceil(((quando || 0) - agora) / 1000));

/** O texto curto da barra da obra, ou null quando não há nada a dizer. */
export function resumoDaGravacao(situacao, agora = Date.now()) {
  switch (situacao?.estado) {
    case "pendente": return { tom: "mute", texto: "alterações por gravar…" };
    case "salvando": return { tom: "mute", texto: "salvando…" };
    case "salvo": return situacao.em ? { tom: "mute", texto: "salvo" } : null;
    case "erro": {
      const s = segundosAte(situacao.proximaEm, agora);
      return { tom: "warning", texto: s > 0 ? `não salvo — nova tentativa em ${s} s` : "não salvo — tentando de novo…" };
    }
    case "recusado": return { tom: "danger", texto: "não salvo — a gravação foi recusada" };
    case "conflito": return { tom: "danger", texto: "não salvo — a obra mudou no banco" };
    default: return null;
  }
}

/**
 * O aviso com a explicação e a saída, para quando a pessoa precisa saber ou
 * agir. `acao`: "tentar" (tentar agora) ou "recarregar" (trazer a obra do
 * banco, descartando o que não foi gravado — sempre com confirmação).
 */
export function avisoDaGravacao(situacao, { obra = "", agora = Date.now() } = {}) {
  const e = situacao?.erro;
  const d = e?.detalhe || {};
  const daObra = obra ? ` da obra ${obra}` : "";
  const naObra = obra ? ` na obra ${obra}` : "";

  if (situacao?.estado === "erro") {
    const s = segundosAte(situacao.proximaEm, agora);
    return {
      tom: "warning",
      titulo: `As alterações${daObra} ainda não foram gravadas`,
      descricao: `${e?.message || "O servidor não respondeu."} Uma nova tentativa sai ${s > 0 ? `em ${s} s` : "agora"}, e outras depois dela. Mantenha esta aba aberta até aparecer "salvo".`,
      acao: "tentar",
    };
  }
  if (situacao?.estado === "recusado") {
    return {
      tom: "danger",
      titulo: `Não foi possível gravar as alterações${daObra}`,
      descricao: `${e?.message || "O servidor recusou a gravação."} O que foi alterado desde a última gravação está só nesta tela. Desfaça a alteração recusada para o resto ser gravado.`,
      acao: "tentar",
    };
  }
  if (situacao?.estado === "conflito") {
    const titulo = `Suas últimas alterações${naObra} não foram gravadas`;
    if (d.motivo === "trava") {
      return {
        tom: "danger",
        titulo,
        descricao: `${d.por ? `${d.por} está com a edição desta obra` : "A edição desta obra está com outra pessoa"}${hora(d.desde)}. Para não gravar por cima do trabalho dela, nada desta tela foi gravado. Recarregue a obra para ver o que está no banco — o que você alterou desde a última gravação fica só nesta tela até lá.`,
        acao: "recarregar",
      };
    }
    if (d.motivo === "vazia") {
      return {
        tom: "danger",
        titulo,
        descricao: "Esta tela está sem os itens da obra, mas a obra no banco tem itens. Gravar assim apagaria o trabalho de todo mundo, então nada foi gravado. Recarregue a obra para trazer os itens do banco.",
        acao: "recarregar",
      };
    }
    return {
      tom: "danger",
      titulo,
      descricao: `A obra foi alterada no banco${d.atualizadoPor ? ` por ${d.atualizadoPor}` : ""}${hora(d.atualizadoEm)}, depois que esta tela a leu. Para não apagar esse trabalho, nada desta tela foi gravado por cima. Recarregue a obra para ver a versão atual — o que você alterou desde a última gravação fica só nesta tela até lá.`,
      acao: "recarregar",
    };
  }
  return null;
}
