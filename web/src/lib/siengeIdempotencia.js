/* Identidade de um envio ao Sienge — o que impede duplicar e perder.
 *
 * Fica separado de `siengeSolicitacoes.js` porque ali mora o Supabase, e
 * isto aqui é conta pura: sem banco, sem rede, testável direto
 * (src/__testes__/sienge-idempotencia.test.mjs). É o mesmo corte que
 * existe entre `lib/sienge.js` e `lib/insumos.js`.
 */

/* A assinatura do CONTEÚDO de um envio.
 *
 * Duas tentativas do mesmo lote têm chaves de idempotência diferentes (a
 * chave é da tentativa) e a MESMA assinatura. É ela que deixa a tela
 * dizer "este mesmo conjunto já foi enviado na solicitação 23488" em vez
 * de criar a segunda calada.
 *
 * Entra o que define o pedido — obra, insumo, quantidade e apropriação.
 * Fica de fora o preço estimado: corrigir um custo na planilha não faz
 * daquilo um pedido diferente.
 */
export function assinaturaDoEnvio({ buildingId, itens }) {
  const partes = (itens || [])
    .map((i) => [i.productId, i.quantity, i.unitySymbol, i.costEstimationItemReference, i.buildingUnitId].join(":"))
    .sort();
  const texto = `${buildingId}|${partes.join("|")}`;
  // FNV-1a, o mesmo hash estável de `auxiliarEstavel` em lib/sienge.js.
  // Não é criptografia: serve pra reconhecer repetição, e colidir aqui
  // custa um aviso a mais, nunca um envio a menos.
  let h = 2166136261;
  for (const ch of texto) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return `${(h >>> 0).toString(16)}-${(itens || []).length}`;
}

/** Uma chave por TENTATIVA de envio. É ela que barra o duplo clique. */
export function novaChaveIdempotencia() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  // Navegador antigo ou contexto sem crypto: o formato é o que importa,
  // porque a coluna é uuid.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
