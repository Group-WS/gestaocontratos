import { supabase, supabaseConfigurado } from "./supabase";

/**
 * Banco de preços por insumo.
 *
 * Vem do relatório de pedidos de compra do Sienge — é o que foi
 * realmente pago, não preço de tabela. Serve de referência quando o time
 * lança item na mão no Executivo.
 *
 * Sem Supabase configurado (modo local), tudo aqui devolve vazio em
 * silêncio: o app continua abrindo, só não tem referência de preço.
 */

// O Supabase rejeita payload muito grande de uma vez, e a base tem
// milhares de linhas — sobe em blocos.
const TAMANHO_BLOCO = 500;

export async function listarPrecos({ busca = "", limite = 200 } = {}) {
  if (!supabaseConfigurado) return [];
  let q = supabase
    .from("insumo_preco")
    .select("codigo, descricao, unidade, custo_unitario, data_ref, fornecedor")
    .order("data_ref", { ascending: false })
    .limit(limite);

  const termo = busca.trim();
  if (termo) {
    // busca no código OU na descrição — quem procura às vezes sabe o
    // código, às vezes só lembra do nome
    q = q.or(`codigo.ilike.%${termo}%,descricao.ilike.%${termo}%`);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function contarPrecos() {
  if (!supabaseConfigurado) return 0;
  const { count, error } = await supabase
    .from("insumo_preco")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count || 0;
}

/**
 * Grava a base importada. Cada (código + descrição + unidade) tem uma
 * linha só — reimportar atualiza o preço em vez de duplicar, então dá
 * pra subir um relatório novo do Sienge por cima do antigo sem limpar
 * nada antes.
 *
 * `onProgresso` recebe quantas linhas já subiram, pra tela não parecer
 * travada num arquivo de milhares de itens.
 */
export async function salvarPrecos(precos, onProgresso) {
  if (!supabaseConfigurado) throw new Error("Banco de dados não configurado.");

  const linhas = (precos || []).map((p) => ({
    codigo: String(p.codigo),
    descricao: p.descricao,
    unidade: p.unidade || "",
    custo_unitario: p.custoUnitario,
    data_ref: p.dataRef,
    fornecedor: p.fornecedor || null,
  }));

  let gravadas = 0;
  for (let i = 0; i < linhas.length; i += TAMANHO_BLOCO) {
    const bloco = linhas.slice(i, i + TAMANHO_BLOCO);
    const { error } = await supabase
      .from("insumo_preco")
      .upsert(bloco, { onConflict: "codigo,descricao,unidade" });
    if (error) throw error;
    gravadas += bloco.length;
    if (onProgresso) onProgresso(gravadas, linhas.length);
  }
  return gravadas;
}

/**
 * Procura preços de referência parecidos com a descrição de um item.
 *
 * Devolve candidatos pra PESSOA escolher — de propósito não preenche
 * nada sozinho. O mesmo código do Sienge cobre faixas enormes
 * ("DECORATIVOS OBRAS" vai de R$ 15 a R$ 3.845), então um número
 * escolhido automaticamente seria um chute com cara de certeza. Vendo as
 * últimas compras com data e fornecedor, quem decide enxerga a faixa —
 * e percebe quando uma delas está fora da curva.
 */
export async function sugerirPrecos(descricao, limite = 6) {
  if (!supabaseConfigurado || !descricao) return [];

  // as duas palavras mais longas costumam ser as que identificam o
  // produto ("arandela", "embutido"); palavra curta traz ruído
  const palavras = String(descricao)
    .split(/[\s/|,;.-]+/)
    .filter((p) => p.length >= 4)
    .sort((a, b) => b.length - a.length)
    .slice(0, 2);
  if (palavras.length === 0) return [];

  const { data, error } = await supabase
    .from("insumo_preco")
    .select("codigo, descricao, unidade, custo_unitario, data_ref, fornecedor")
    .or(palavras.map((p) => `descricao.ilike.%${p}%`).join(","))
    .order("data_ref", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data || [];
}

export async function limparPrecos() {
  if (!supabaseConfigurado) throw new Error("Banco de dados não configurado.");
  const { error } = await supabase.from("insumo_preco").delete().gte("id", 0);
  if (error) throw error;
}
