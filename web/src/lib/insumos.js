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

/* Toda a base, pra casar item por item sem ida e volta ao banco.
 *
 * O casamento compara CADA item da obra contra a base inteira — 200 itens
 * contra 2.700 insumos. Fazer isso por consulta seria 200 chamadas e uma
 * tela travada; a base cabe na memória e cabe de sobra.
 *
 * Pagina de mil em mil porque o PostgREST corta em 1.000 por padrão, e
 * uma base cortada casa de vermelho o que existe — o pior erro possível
 * aqui, porque manda cadastrar duplicado.
 */
export async function carregarTodosInsumos() {
  if (!supabaseConfigurado) return [];
  const todos = [];
  const passo = 1000;
  for (let de = 0; ; de += passo) {
    const { data, error } = await supabase
      .from("insumo_preco")
      .select("codigo, descricao, unidade, custo_unitario")
      .range(de, de + passo - 1);
    if (error) throw error;
    todos.push(...(data || []));
    if (!data || data.length < passo) break;
  }
  return todos.map((i) => ({
    codigo: i.codigo, descricao: i.descricao, unidade: i.unidade, custoUnitario: i.custo_unitario,
  }));
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

// A chave de um insumo na base — a mesma do `unique` da tabela.
export function chaveDoInsumo(p) {
  return `${String(p.codigo)}|${p.descricao}|${p.unidade || ""}`;
}

/* Só o que ainda não está na base.
 *
 * É assim que o cadastro de insumos do Sienge entra: ele acrescenta o que
 * falta e não toca no que já está lá. A base guarda o preço das compras;
 * o cadastro traz preço de tabela, e a maioria zerado — escrever por cima
 * trocaria o preço pago por zero.
 */
export function soOsNovos(precos, chavesExistentes) {
  const existentes = new Set(chavesExistentes || []);
  const vistos = new Set();
  const novos = [];
  let jaExistiam = 0;
  (precos || []).forEach((p) => {
    const k = chaveDoInsumo(p);
    if (vistos.has(k)) return; // repetido no próprio arquivo
    vistos.add(k);
    if (existentes.has(k)) jaExistiam += 1;
    else novos.push(p);
  });
  return { novos, jaExistiam };
}

// As chaves de tudo que já está na base, de mil em mil (ver carregarTodosInsumos).
export async function chavesDaBase() {
  if (!supabaseConfigurado) return new Set();
  const chaves = new Set();
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase
      .from("insumo_preco")
      .select("codigo, descricao, unidade")
      .range(de, de + 999);
    if (error) throw error;
    (data || []).forEach((r) => chaves.add(chaveDoInsumo(r)));
    if (!data || data.length < 1000) break;
  }
  return chaves;
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
    // Preço zero é insumo do cadastro sem preço de tabela: não é referência.
    .gt("custo_unitario", 0)
    .order("data_ref", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data || [];
}

/* ============================================================
   O CADASTRO DE INSUMOS ATIVOS DO SIENGE (17/09/2026)

   Pedido dela: "atualize o banco de dados de insumos ativos do sienge para
   fazer a associacao corretamente. ex, mesa de centro nao ta ativo, n pode
   mostrar oque esta inativo."

   Por que uma tabela separada da base de precos:

   `insumo_preco` guarda UMA LINHA POR COMPRA — 10.507 linhas, muitas com o
   nome que o insumo tinha na epoca. O codigo 411 e o exemplo dela: continua
   ativo no Sienge, mas hoje se chama "MOBILIA SOLTA - MESAS AUXILIARES", e
   a associacao mostrava "MESA DE CENTRO/LATERAL" porque esse era o nome
   mais repetido nas compras antigas.

   Entao o que faltava nao era esconder preco: era ter a lista do que o
   Sienge chama de insumo HOJE. Esta tabela e' essa lista, e o relatorio de
   Insumos e' a fonte dela.

   Precisa do `supabase/insumo-sienge.sql`. Enquanto a tabela nao existir ou
   estiver vazia, tudo aqui devolve vazio em silencio e o app se comporta
   como antes — importar cadastro e' o que liga a regra.
   ============================================================ */

const semTabelaCadastro = (e) => e?.code === "42P01" || /insumo_sienge/.test(e?.message || "");

/** O cadastro inteiro: { codigo, descricao, unidade }. Vazio = regra desligada. */
export async function carregarCadastroSienge() {
  if (!supabaseConfigurado) return [];
  const todos = [];
  const passo = 1000;
  for (let de = 0; ; de += passo) {
    const { data, error } = await supabase
      .from("insumo_sienge")
      .select("codigo, descricao, unidade")
      .range(de, de + passo - 1);
    // Tabela ainda nao criada: nao e' erro de tela, e' regra desligada.
    if (error) { if (semTabelaCadastro(error)) return []; throw error; }
    todos.push(...(data || []));
    if (!data || data.length < passo) break;
  }
  return todos;
}

/**
 * Grava o cadastro lido do relatorio: o que existe atualiza o nome, o que
 * nao veio no relatorio SAI da tabela.
 *
 * Sair da tabela e' o unico jeito de o insumo desativado parar de ser
 * oferecido, e e' seguro: aqui nao mora preco pago nenhum — isso fica em
 * `insumo_preco`, que esta funcao nao encosta.
 */
export async function salvarCadastroSienge(insumos, usuario, onProgresso) {
  if (!supabaseConfigurado) throw new Error("Banco de dados não configurado.");
  const lista = (insumos || [])
    .map((i) => ({
      codigo: String(i.codigo || "").trim(),
      descricao: String(i.descricao || "").replace(/\s+/g, " ").trim(),
      unidade: String(i.unidade || "").trim(),
      preco_tabela: Number.isFinite(i.precoTabela) ? i.precoTabela : null,
      importado_por: usuario || null,
    }))
    .filter((i) => i.codigo && i.descricao);
  // Relatorio vazio nao apaga o cadastro do time: arquivo lido errado
  // chegaria exatamente assim.
  if (!lista.length) return { gravados: 0, removidos: 0 };

  const vistos = new Set();
  const unicos = lista.filter((i) => (vistos.has(i.codigo) ? false : vistos.add(i.codigo)));

  let gravados = 0;
  for (let i = 0; i < unicos.length; i += TAMANHO_BLOCO) {
    const bloco = unicos.slice(i, i + TAMANHO_BLOCO);
    const { error } = await supabase.from("insumo_sienge").upsert(bloco, { onConflict: "codigo" });
    if (error) { if (semTabelaCadastro(error)) return { gravados: 0, removidos: 0, semTabela: true }; throw error; }
    gravados += bloco.length;
    if (onProgresso) onProgresso(gravados, unicos.length);
  }

  // O que saiu do cadastro. Em blocos porque a lista de codigos vai na URL.
  const antigos = await carregarCadastroSienge();
  const sairam = antigos.map((a) => String(a.codigo)).filter((c) => !vistos.has(c));
  let removidos = 0;
  for (let i = 0; i < sairam.length; i += 150) {
    const bloco = sairam.slice(i, i + 150);
    const { error } = await supabase.from("insumo_sienge").delete().in("codigo", bloco);
    if (error) throw error;
    removidos += bloco.length;
  }
  return { gravados, removidos };
}

export async function limparPrecos() {
  if (!supabaseConfigurado) throw new Error("Banco de dados não configurado.");
  const { error } = await supabase.from("insumo_preco").delete().gte("id", 0);
  if (error) throw error;
}
