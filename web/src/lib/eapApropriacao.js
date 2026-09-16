import { supabase, supabaseConfigurado } from "./supabase";

/**
 * A EAP do Sienge e o mapa verba → folha.
 *
 * Não confundir com `lib/eap.js`, que é a EAP DA CASA (as 35 verbas de
 * `eap_grupo`, usadas na planilha e no depara). Esta aqui é a do Sienge,
 * e existe por um motivo só: apropriar a compra no orçamento certo.
 *
 * O que a leitura da planilha produz (lib/eapSienge.js) chega aqui pra
 * virar cadastro. Duas regras moram neste arquivo:
 *
 * 1. Importar SEMPRE cria uma versão nova. Nada é sobrescrito — uma
 *    solicitação enviada mês passado precisa continuar explicável pela
 *    EAP que valia naquele dia.
 * 2. O mapa da versão anterior é HERDADO pelos códigos que continuam
 *    existindo. Sem isso, cada importação zeraria o trabalho de ligar as
 *    35 verbas do GC às folhas do Sienge — e o time voltaria a digitar
 *    código de apropriação à mão.
 *
 * Sem Supabase configurado (modo local), tudo devolve vazio em silêncio,
 * no mesmo espírito de lib/insumos.js: o app abre, só não tem EAP.
 */

/** As versões, da mais recente pra mais antiga. A padrão é a que a tela abre. */
export async function listarVersoesEap() {
  if (!supabaseConfigurado) return [];
  const { data, error } = await supabase
    .from("sienge_eap_versao")
    .select("id, nome, unidade_id, obra_modelo, versao_orcamento, data_base, padrao, importado_por, importado_em")
    .order("importado_em", { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Uma versão inteira: os itens da árvore e o mapa das verbas. */
export async function carregarEap(versaoId) {
  if (!supabaseConfigurado || !versaoId) return { itens: [], mapa: {} };
  const [itens, mapa] = await Promise.all([
    supabase.from("sienge_eap_item")
      .select("codigo, descricao, nivel, unidade, folha")
      .eq("versao_id", versaoId)
      .order("codigo"),
    supabase.from("sienge_eap_mapa")
      .select("verba_num, codigo, definido_por, definido_em")
      .eq("versao_id", versaoId),
  ]);
  if (itens.error) throw itens.error;
  if (mapa.error) throw mapa.error;
  const porVerba = {};
  (mapa.data || []).forEach((m) => { porVerba[m.verba_num] = m.codigo; });
  return { itens: itens.data || [], mapa: porVerba };
}

/**
 * Grava uma planilha lida como versão nova.
 *
 * `herdarDe` é o id da versão anterior — o mapa dela é copiado pros
 * códigos que ainda existem. O que perdeu par volta em `orfaos`, pra tela
 * poder dizer quais verbas ficaram sem folha em vez de deixar a pessoa
 * descobrir na hora de enviar uma solicitação.
 */
export async function importarEap({ versao, itens }, { por, herdarDe = null } = {}) {
  if (!supabaseConfigurado) throw new Error("Sem banco configurado — a EAP não teria onde ficar guardada.");
  if (!versao?.unidadeId) throw new Error("A planilha não traz a unidade construtiva — sem ela não dá pra apropriar.");
  if (!itens?.some((i) => i.folha)) throw new Error("A planilha não tem item apropriável (nível 4).");

  const { data: nova, error: erroVersao } = await supabase
    .from("sienge_eap_versao")
    .insert({
      nome: versao.nome,
      unidade_id: versao.unidadeId,
      obra_modelo: versao.obraModelo,
      versao_orcamento: versao.versaoOrcamento,
      data_base: versao.dataBase,
      importado_por: por,
    })
    .select("id")
    .single();
  if (erroVersao) throw erroVersao;

  /* Em blocos: a EAP tem ~130 linhas hoje, mas o relatório de uma obra
     grande passa de mil, e o PostgREST rejeita payload muito grande de
     uma vez — o mesmo motivo do bloco em lib/insumos.js. */
  const BLOCO = 500;
  for (let i = 0; i < itens.length; i += BLOCO) {
    const { error } = await supabase.from("sienge_eap_item").insert(
      itens.slice(i, i + BLOCO).map((it) => ({
        versao_id: nova.id,
        codigo: it.codigo,
        descricao: it.descricao,
        nivel: it.nivel,
        unidade: it.unidade,
        folha: it.folha,
      })));
    if (error) throw error;
  }

  const orfaos = [];
  if (herdarDe) {
    const { mapa } = await carregarEap(herdarDe);
    const existe = new Set(itens.filter((i) => i.folha).map((i) => i.codigo));
    const herdado = [];
    Object.entries(mapa).forEach(([verba, codigo]) => {
      if (existe.has(codigo)) herdado.push({ versao_id: nova.id, verba_num: verba, codigo, definido_por: por });
      else orfaos.push({ verba, codigo });
    });
    if (herdado.length) {
      const { error } = await supabase.from("sienge_eap_mapa").insert(herdado);
      if (error) throw error;
    }
  }

  return { id: nova.id, orfaos };
}

/* Uma padrão por vez — é o que o índice único parcial da tabela garante.
   Tirar a antiga ANTES de pôr a nova, senão o insert esbarra nele. */
export async function definirVersaoPadrao(versaoId) {
  if (!supabaseConfigurado) throw new Error("Sem banco configurado.");
  const { error: limpar } = await supabase
    .from("sienge_eap_versao").update({ padrao: false }).eq("padrao", true);
  if (limpar) throw limpar;
  const { error } = await supabase
    .from("sienge_eap_versao").update({ padrao: true }).eq("id", versaoId);
  if (error) throw error;
}

/** Liga (ou desliga, com `codigo` nulo) uma verba do GC a uma folha da EAP. */
export async function definirMapaVerba(versaoId, verbaNum, codigo, por) {
  if (!supabaseConfigurado) throw new Error("Sem banco configurado.");
  if (!codigo) {
    const { error } = await supabase
      .from("sienge_eap_mapa").delete().eq("versao_id", versaoId).eq("verba_num", verbaNum);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("sienge_eap_mapa").upsert({
    versao_id: versaoId, verba_num: verbaNum, codigo, definido_por: por, definido_em: new Date().toISOString(),
  }, { onConflict: "versao_id,verba_num" });
  if (error) throw error;
}
