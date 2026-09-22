/* O QUE AS TELAS DO ADITIVO E DA APRESENTAÇÃO DIZEM SOBRE A GRAVAÇÃO.
 *
 * Funções puras, sem rede. Quem grava são `aditivos.js` e `apresentacao.js`,
 * pela API; quem decide é o banco (supabase/salvar-aditivo-apresentacao.sql),
 * que só grava com a versão que a tela leu.
 *
 * A obra tem os textos dela em `gravacaoObra.js` — lá a saída é "recarregar
 * a obra", e a trava aparece. Aqui não há trava, e a saída é recarregar o
 * documento: é o mesmo estado de fila, com outras palavras.
 */

/* O RESUMO e' o que a lista mostra de dentro do documento — a data, a
   observacao e a marca do Pipefy. Ele existe porque a lista de TODAS as
   obras nao traz o documento (seria um JSONB gordo por aditivo); na lista de
   uma obra so', que traz, ele sai do proprio documento.

   Quem GRAVA nunca parte do resumo: `carregarAditivo` traz o documento
   inteiro e a versao de agora, e e' esse que volta alterado. */
export const resumoDoDoc = (doc) => ({
  data: doc?.data ?? null,
  observacao: doc?.observacao ?? null,
  pipefy: doc?.pipefy ?? null,
});


/**
 * O aditivo da tela depois de uma gravacao: os campos que foram, mais a
 * versao nova. E' o que a lista mostra sem precisar reler tudo.
 */
export function aplicarGravacao(aditivo, { versao, campos }) {
  const doc = campos.dados !== undefined ? campos.dados : aditivo.doc;
  return {
    ...aditivo,
    descricao: campos.descricao !== undefined ? campos.descricao : aditivo.descricao,
    status: campos.status !== undefined ? campos.status : aditivo.status,
    doc,
    resumo: resumoDoDoc(doc),
    totalSupressao: campos.total_supressao !== undefined ? campos.total_supressao : aditivo.totalSupressao,
    totalAdicao: campos.total_adicao !== undefined ? campos.total_adicao : aditivo.totalAdicao,
    versao,
  };
}


/* Um nome para a pessoa reconhecer o documento no aviso: "o aditivo 2405/1",
   "a revisão 01 da apresentação". */
export const nomeDoAditivo = (a) => `o aditivo ${a?.numero || ""}`.trim();
export const nomeDaApresentacao = (d) => `a revisão ${d?.rev || d?.capa?.rev || "00"} da apresentação`;

function hora(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? ` às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
    : "";
}

const segundosAte = (quando, agora) => Math.max(0, Math.ceil(((quando || 0) - agora) / 1000));

/* "o aditivo 2405/1" -> "no aditivo 2405/1"; "a revisão 01 da apresentação"
   -> "na revisão 01 da apresentação". O nome do documento já vem com o
   artigo, que é o que diz o gênero; aqui ele só se junta à preposição. */
const em = (documento) => String(documento).replace(/^o /, "no ").replace(/^a /, "na ");

/**
 * O aviso com a explicação e a saída. `acao`: "tentar" (tentar agora) ou
 * "recarregar" (trazer do banco, descartando o que não foi gravado — sempre
 * com confirmação). Nenhum texto manda dar F5: recarregar a página antes de
 * o dado estar gravado é justamente o que se quer evitar.
 */
export function avisoDoDocumento(situacao, { documento = "este documento", agora = Date.now() } = {}) {
  const e = situacao?.erro;
  const d = e?.detalhe || {};

  if (situacao?.estado === "erro") {
    const s = segundosAte(situacao.proximaEm, agora);
    return {
      tom: "warning",
      titulo: `As alterações ${em(documento)} ainda não foram gravadas`,
      descricao: `${e?.message || "O servidor não respondeu."} Uma nova tentativa sai ${s > 0 ? `em ${s} s` : "agora"}, e outras depois dela. Mantenha esta aba aberta até aparecer "salvo".`,
      acao: "tentar",
    };
  }
  if (situacao?.estado === "recusado") {
    return {
      tom: "danger",
      titulo: `Não foi possível gravar ${documento}`,
      descricao: `${e?.message || "O servidor recusou a gravação."} O que foi alterado desde a última gravação está só nesta tela. Desfaça a alteração recusada para o resto ser gravado.`,
      acao: "tentar",
    };
  }
  if (situacao?.estado === "conflito") {
    return {
      tom: "danger",
      titulo: `Suas últimas alterações ${em(documento)} não foram gravadas`,
      descricao: `Outra pessoa alterou ${documento}${d.atualizadoPor ? `, ${d.atualizadoPor}` : ""}${hora(d.atualizadoEm)}, depois que esta tela o leu. Para não apagar esse trabalho, nada desta tela foi gravado por cima. Recarregue para ver como ele está agora — o que você alterou fica só nesta tela até lá.`,
      acao: "recarregar",
    };
  }
  return null;
}
