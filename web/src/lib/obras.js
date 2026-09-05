import { supabase, supabaseConfigurado } from "./supabase";

/**
 * Ciclo de vida das obras.
 *
 * O Monday lista tudo que existe; esta tabela guarda o que o time
 * decidiu acompanhar. Uma obra do Monday que ninguém iniciou é só uma
 * sugestão — aparece em "Novas obras" e mais nada.
 *
 * Sem Supabase configurado (modo local, sem .env), tudo aqui vira
 * conversa fiada silenciosa: devolve vazio e não grava. O app continua
 * abrindo, só não persiste — que é o comportamento antigo.
 */

/* A obra que só existe no NOSSO banco.
 *
 * A barra lateral se alimenta do Monday. Obra cadastrada à mão não está
 * lá — e sem esta conta ela aparece no instante em que é criada e some
 * ao recarregar: viva no banco, invisível na tela. Aconteceu com a 2517.
 *
 * Casa por CÓDIGO, que é a chave de verdade da obra nos dois mundos. O
 * `id` não serve: no Monday ele cai pro boardId quando a obra não tem
 * código, e aí duas coisas iguais teriam nomes diferentes.
 */
export function faltandoNaTela(linhas, obras) {
  const naTela = new Set((obras || []).map((o) => String(o.codigo)));
  return (linhas || []).filter((l) => l && l.codigo && !naTela.has(String(l.codigo)));
}

const COLUNAS_OBRA = "codigo, nome, squad, situacao, iniciada_em, concluida_em, cliente, endereco, gc, board_id, valor_vendido";

/* Coluna nova (tailor_made, responsavel_executivo) que ainda não existe
   no banco não pode derrubar a lista de obras INTEIRA.

   Entre o deploy do app e alguém rodar a migração existe uma janela em
   que o Postgres rejeita a leitura inteira por causa de uma coluna
   desconhecida — e como é ESTA função que preenche `registro` (de onde
   sai "essa obra está ativa?"), o efeito era o pior possível: toda obra
   ativa virava invisível, como se tivesse sumido. Aconteceu de verdade
   em 2026-09-05, com as colunas de Equipe da obra. */
const faltaColuna = (error) => !!error && (
  error.code === "42703" || error.code === "PGRST204"
  || /column .* does not exist|Could not find the/i.test(error.message || ""));

export async function listarObras() {
  if (!supabaseConfigurado) return [];
  /* Traz TUDO que descreve a obra, e não só a situação.
     Obra cadastrada à mão não existe no Monday: se a leitura do banco
     devolvesse só `situacao`, não haveria como remontá-la, e ela
     sumiria a cada recarregada — que foi exatamente o que aconteceu
     com a 2517. */
  const { data, error } = await supabase
    .from("obra")
    .select(`${COLUNAS_OBRA}, tailor_made, responsavel_executivo`);
  if (!error) return data || [];
  if (!faltaColuna(error)) throw error;

  const retry = await supabase.from("obra").select(COLUNAS_OBRA);
  if (retry.error) throw retry.error;
  return retry.data || [];
}

/**
 * Registra a obra no banco — é o "Dar start". A partir daqui ela passa
 * a existir por conta própria: some do Monday e ela continua aqui.
 *
 * `obra` é o objeto do app (o mesmo que a sidebar usa).
 */
export async function iniciarObra(obra) {
  if (!supabaseConfigurado) throw new Error("Supabase não configurado.");
  const { data, error } = await supabase
    .from("obra")
    .insert({
      codigo: String(obra.codigo),
      nome: obra.nome,
      squad: obra.squad,
      board_id: obra.boardId ? String(obra.boardId) : null,
      cliente: obra.cliente,
      endereco: obra.endereco,
      gc: obra.gc,
      valor_vendido: obra.valorVendido || null,
      situacao: "ativa",
    })
    .select("codigo, nome, squad, situacao, iniciada_em, concluida_em")
    .single();
  if (error) throw error;
  return data;
}

/** Tira da sidebar e manda pro Arquivo (só leitura). */
export async function concluirObra(codigo) {
  if (!supabaseConfigurado) throw new Error("Supabase não configurado.");
  const { data, error } = await supabase
    .from("obra")
    .update({ situacao: "concluida", concluida_em: new Date().toISOString() })
    .eq("codigo", String(codigo))
    .select("codigo, nome, squad, situacao, iniciada_em, concluida_em")
    .single();
  if (error) throw error;
  return data;
}

/** Volta pra sidebar — pra quando alguém concluir sem querer. */
export async function reabrirObra(codigo) {
  if (!supabaseConfigurado) throw new Error("Supabase não configurado.");
  const { data, error } = await supabase
    .from("obra")
    .update({ situacao: "ativa", concluida_em: null })
    .eq("codigo", String(codigo))
    .select("codigo, nome, squad, situacao, iniciada_em, concluida_em")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Quem responde pela obra.
 *
 * Guarda o E-MAIL, nao o nome: e' a identidade que o login ja da', e e'
 * o unico jeito de "as minhas obras" saber quais sao as minhas sem
 * alguem manter uma tabela de nomes em dia. O nome bonito sai do proprio
 * e-mail na hora de mostrar.
 */
export async function definirGC(codigo, email) {
  if (!supabaseConfigurado) throw new Error("Supabase não configurado.");
  const { data, error } = await supabase
    .from("obra")
    .update({ gc: email || null })
    .eq("codigo", String(codigo))
    .select(`${COLUNAS_OBRA}, tailor_made, responsavel_executivo`)
    .single();
  if (!error) return data;
  // O UPDATE em si (só a coluna `gc`) sempre funciona; só o SELECT de
  // retorno pode pedir uma coluna que ainda não existe.
  if (!faltaColuna(error)) throw error;
  const retry = await supabase.from("obra").select(COLUNAS_OBRA).eq("codigo", String(codigo)).single();
  if (retry.error) throw retry.error;
  return retry.data;
}

/* Os outros dois papéis de "Equipe da obra" — mesmo padrão do GC, cada
   um em coluna própria porque uma obra pode ter os três ao mesmo tempo.

   Aqui, diferente do GC, é o próprio UPDATE que toca a coluna nova —
   sem migração rodada não tem como salvar de jeito nenhum, então o
   erro precisa dizer isso claramente em vez de estourar cru na tela. */
export async function definirTailorMade(codigo, email) {
  if (!supabaseConfigurado) throw new Error("Supabase não configurado.");
  const { data, error } = await supabase
    .from("obra")
    .update({ tailor_made: email || null })
    .eq("codigo", String(codigo))
    .select(`${COLUNAS_OBRA}, tailor_made, responsavel_executivo`)
    .single();
  if (error) {
    if (faltaColuna(error)) throw new Error("Falta rodar supabase/equipe-da-obra.sql — a coluna de Tailor Made ainda não existe.");
    throw error;
  }
  return data;
}

export async function definirResponsavelExecutivo(codigo, email) {
  if (!supabaseConfigurado) throw new Error("Supabase não configurado.");
  const { data, error } = await supabase
    .from("obra")
    .update({ responsavel_executivo: email || null })
    .eq("codigo", String(codigo))
    .select(`${COLUNAS_OBRA}, tailor_made, responsavel_executivo`)
    .single();
  if (error) {
    if (faltaColuna(error)) throw new Error("Falta rodar supabase/equipe-da-obra.sql — a coluna de Executivo ainda não existe.");
    throw error;
  }
  return data;
}
