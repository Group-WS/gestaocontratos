import { supabaseConfigurado } from "./supabase";
import { apiJson } from "./api";
import { assinaturaDoEnvio, novaChaveIdempotencia } from "./siengeIdempotencia.js";

/**
 * O rastro dos envios ao Sienge (tabela `sienge_solicitacao`).
 *
 * A regra que organiza este arquivo: **o registro nasce antes do envio**.
 *
 * Gravar depois parece natural e tem um buraco fatal — se o navegador
 * fecha, a aba trava ou a resposta se perde no caminho de volta, a
 * solicitação existe no Sienge e não existe aqui. A pessoa não tem como
 * saber, reenvia, e agora são duas. Por isso:
 *
 *   1. `abrirEnvio()`   grava `status='enviando'` ANTES da primeira chamada
 *   2. o envio acontece
 *   3. `fecharEnvio()`  grava o que voltou
 *
 * Linha que ficou em 'enviando' é a pergunta "será que entrou?" — e
 * `enviosPendentes()` é quem a faz na abertura da tela.
 *
 * A gravação é feita pela API (web/api/_lib/rotas/siengeBanco.js), não
 * mais pelo navegador. A ordem acima não muda com isso: o que muda é o
 * caminho até o banco.
 */

/**
 * Abre o registro ANTES de falar com o Sienge.
 *
 * Devolve `{ id, chave }`. Sem Supabase configurado devolve `id: null` e o
 * envio segue — modo local não tem onde guardar, e travar o envio por
 * causa do histórico seria pior que ficar sem ele.
 *
 * `por` continua no pedido de quem chama, mas não vai no corpo: quem
 * enviou a API lê do login, nunca do que o navegador diz (SEG-13).
 */
export async function abrirEnvio({ obraCodigo, buildingId, por, payload, chave, assinatura, solicitacaoId = null }) {
  if (!supabaseConfigurado) return { id: null, chave };
  try {
    const { id } = await apiJson("/api/sienge-solicitacoes", {
      metodo: "POST",
      corpo: {
        obraCodigo: String(obraCodigo),
        buildingId: Number(buildingId),
        payload,
        chave,
        assinatura,
        solicitacaoId,
      },
    });
    return { id, chave };
  } catch (e) {
    /* Os dois casos que a tela trata de um jeito próprio. Quem os
       RECONHECE é a API — é ela que vê o erro do Postgres —, e o código
       vem junto da resposta justamente pra esta decisão continuar
       possível aqui, com a mesma frase de antes.

       23505: esta MESMA tentativa já está registrada, ou seja, o envio já
       saiu. Tentar de novo criaria a segunda solicitação. */
    if (e.code === "23505") e.jaEnviado = true;
    /* Coluna que o banco ainda não tem: é migration pendente, não falha
       passageira. Sem distinguir isso, a orientação vira "tente de novo"
       — e tentar de novo não cria coluna nenhuma. */
    if (e.code === "PGRST204") e.migracaoPendente = true;
    throw e;
  }
}

/** Fecha o registro com o que o Sienge respondeu. */
export async function fecharEnvio(id, { solicitacaoId, resposta, status, ok }) {
  if (!supabaseConfigurado || !id) return;
  await apiJson(`/api/sienge-solicitacoes/${encodeURIComponent(String(id))}`, {
    metodo: "PUT",
    corpo: { solicitacaoId: solicitacaoId ?? null, resposta, status, ok: !!ok },
  });
}

/** Os envios desta obra que ficaram sem resposta. */
export async function enviosPendentes(obraCodigo) {
  if (!supabaseConfigurado) return [];
  return apiJson(`/api/sienge-solicitacoes/pendentes?obra=${encodeURIComponent(String(obraCodigo))}`);
}

/** Um envio anterior com o mesmo conteúdo, pra tela poder avisar. */
export async function envioComMesmoConteudo(obraCodigo, assinatura) {
  if (!supabaseConfigurado || !assinatura) return null;
  return apiJson("/api/sienge-solicitacoes/mesmo-conteudo"
    + `?obra=${encodeURIComponent(String(obraCodigo))}`
    + `&assinatura=${encodeURIComponent(assinatura)}`);
}

/**
 * Encerra um pendente depois de conferir o que o Sienge realmente tem.
 *
 * `por` continua no pedido de quem chama, mas não vai no corpo: quem
 * reconciliou a API lê do login (SEG-13).
 */
export async function reconciliarEnvio(id, { solicitacaoId, resposta, status, ok, por }) {
  if (!supabaseConfigurado || !id) return;
  await apiJson(`/api/sienge-solicitacoes/${encodeURIComponent(String(id))}/reconciliar`, {
    metodo: "PUT",
    corpo: { solicitacaoId: solicitacaoId ?? null, resposta, status, ok: !!ok },
  });
}

/** O histórico de envios de uma obra, do mais recente pro mais antigo. */
export async function listarEnviosSienge(obraCodigo, limite = 20) {
  if (!supabaseConfigurado) return [];
  return apiJson(`/api/sienge-solicitacoes?obra=${encodeURIComponent(String(obraCodigo))}&limite=${limite}`);
}

/* Reexportadas por conveniência de quem já importa deste arquivo — a
   implementação mora em `siengeIdempotencia.js`, sem Supabase junto. */
export { assinaturaDoEnvio, novaChaveIdempotencia };
