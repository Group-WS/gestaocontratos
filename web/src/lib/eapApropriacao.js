import { supabaseConfigurado } from "./supabase";
import { apiJson } from "./api";

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
 * Quem fala com o banco agora é a API (`/api/eap/...`, em
 * web/api/_lib/rotas/eap.js): mudou o CAMINHO, não o que acontece — os
 * mesmos comandos, na mesma ordem, do lado do servidor (VH-02). Quem
 * importou e quem definiu o mapa saem do login, no servidor, e por isso
 * não viajam no corpo do pedido (SEG-13).
 *
 * QUEM MEXEU: cada gesto (importar, tornar padrão, ligar, trocar, desligar,
 * excluir) também vira uma linha no registro, gravada pelo servidor. Só
 * administrador lê (`listarEventosEap`). O registro nunca derruba o gesto:
 * se falhar, a resposta volta com `registro: "falhou"` e o gesto vale.
 *
 * Sem Supabase configurado (modo local), tudo devolve vazio em silêncio,
 * no mesmo espírito de lib/insumos.js: o app abre, só não tem EAP.
 */

/** As versões, da mais recente pra mais antiga. A padrão é a que a tela abre. */
export async function listarVersoesEap() {
  if (!supabaseConfigurado) return [];
  return await apiJson("/api/eap/versoes");
}

/** Uma versão inteira: os itens da árvore e o mapa das verbas. */
export async function carregarEap(versaoId) {
  if (!supabaseConfigurado || !versaoId) return { itens: [], mapa: {} };
  const { itens, mapa } = await apiJson(`/api/eap/versoes/${encodeURIComponent(versaoId)}`);
  // A tela quer o mapa por verba; a rota devolve as linhas como estão na
  // tabela.
  const porVerba = {};
  (mapa || []).forEach((m) => { porVerba[m.verba_num] = m.codigo; });
  return { itens: itens || [], mapa: porVerba };
}

/**
 * Grava uma planilha lida como versão nova.
 *
 * `herdarDe` é o id da versão anterior — o mapa dela é copiado pros
 * códigos que ainda existem. O que perdeu par volta em `orfaos`, pra tela
 * poder dizer quais verbas ficaram sem folha em vez de deixar a pessoa
 * descobrir na hora de enviar uma solicitação.
 *
 * `por` continua sendo aceito pra não mudar a chamada da tela, mas não vai
 * no pedido: quem importou é quem está logado, e isso o servidor sabe
 * sozinho (SEG-13).
 */
export async function importarEap({ versao, itens }, { herdarDe = null } = {}) {
  if (!supabaseConfigurado) throw new Error("Sem banco configurado — a EAP não teria onde ficar guardada.");
  if (!versao?.unidadeId) throw new Error("A planilha não traz a unidade construtiva — sem ela não dá pra apropriar.");
  if (!itens?.some((i) => i.folha)) throw new Error("A planilha não tem item apropriável (nível 4).");

  const { id } = await apiJson("/api/eap/versoes", { metodo: "POST", corpo: { versao } });

  /* Em blocos: a EAP tem ~130 linhas hoje, mas o relatório de uma obra
     grande passa de mil, e nem o leitor de JSON da API nem o PostgREST
     gostam de payload muito grande de uma vez — o mesmo motivo do bloco
     em lib/insumos.js. Uma chamada por bloco, na ordem. */
  const BLOCO = 500;
  for (let i = 0; i < itens.length; i += BLOCO) {
    await apiJson(`/api/eap/versoes/${encodeURIComponent(id)}/itens`, {
      metodo: "POST",
      corpo: { itens: itens.slice(i, i + BLOCO) },
    });
  }

  let orfaos = [];
  if (herdarDe) {
    ({ orfaos } = await apiJson(`/api/eap/versoes/${encodeURIComponent(id)}/herdar`, {
      metodo: "POST",
      corpo: { herdarDe },
    }));
  }

  /* Fecha o registro da importação: uma linha só, com os números do que
     entrou. Os números descrevem o ARQUIVO (o navegador acabou de lê-lo);
     quem importou sai do login, no servidor. Falhar aqui não desfaz a
     importação — ela já está gravada. */
  const folhas = itens.filter((i) => i.folha).length;
  const herdadas = herdarDe ? Math.max(0, (await mapaDaVersao(herdarDe)) - orfaos.length) : 0;
  try {
    await apiJson(`/api/eap/versoes/${encodeURIComponent(id)}/registro`, {
      metodo: "POST",
      corpo: {
        nItens: itens.length,
        nFolhas: folhas,
        herdadas,
        orfaos: orfaos.map((o) => String(o.verba)),
        herdouDe: herdarDe || null,
      },
    });
  } catch { /* o rastro é o que se perde, não a importação */ }

  return { id, orfaos };
}

/** Quantas verbas a versão tinha ligadas — só para contar o que foi herdado. */
async function mapaDaVersao(versaoId) {
  try {
    const { mapa } = await carregarEap(versaoId);
    return Object.keys(mapa || {}).length;
  } catch { return 0; }
}

/* Uma padrão por vez — é o que o índice único parcial da tabela garante.
   Tirar a antiga ANTES de pôr a nova, senão o update esbarra nele. Os dois
   comandos são um só pedido, e a ordem é do servidor (a rota). */
export async function definirVersaoPadrao(versaoId) {
  if (!supabaseConfigurado) throw new Error("Sem banco configurado.");
  await apiJson(`/api/eap/versoes/${encodeURIComponent(versaoId)}/padrao`, { metodo: "PUT" });
}

/**
 * Liga (ou desliga, com `codigo` nulo) uma verba do GC a uma folha da EAP.
 *
 * `obraCodigo` diz de ONDE veio o gesto: vazio é a tela EAP Sienge,
 * preenchido é o envio da solicitação de compra dentro daquela obra. O mapa
 * é o mesmo — o registro é que precisa saber a diferença.
 */
export async function definirMapaVerba(versaoId, verbaNum, codigo, { obraCodigo = null } = {}) {
  if (!supabaseConfigurado) throw new Error("Sem banco configurado.");
  // Código vazio e código nulo são a mesma coisa aqui: "desliga esta verba".
  await apiJson("/api/eap/mapa", {
    metodo: "PUT",
    corpo: { versaoId, verbaNum, codigo: codigo || null, obraCodigo: obraCodigo || null },
  });
}

/**
 * O registro do EAP: quem mexeu, do mais novo pro mais antigo.
 *
 * Só administrador lê — quem não for recebe 403 do servidor, e a tela nem
 * pergunta. `semTabela` é o SQL que ainda falta rodar, não um erro.
 */
export async function listarEventosEap() {
  if (!supabaseConfigurado) return { eventos: [] };
  return await apiJson("/api/eap/eventos");
}

/**
 * Exclui uma versão da EAP. Nunca a padrão — é com ela que as solicitações
 * saem; o servidor recusa e a tela mostra o motivo.
 */
export async function excluirVersaoEap(versaoId) {
  if (!supabaseConfigurado) throw new Error("Sem banco configurado.");
  await apiJson(`/api/eap/versoes/${encodeURIComponent(versaoId)}`, { metodo: "DELETE" });
}
