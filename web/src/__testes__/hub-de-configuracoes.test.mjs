/* ADR-009 · o catálogo de Configurações (formato SettingsNavArea do DS) e
 * quem vê cada atalho.
 *
 * Roda com: node web/src/__testes__/hub-de-configuracoes.test.mjs
 */
import {
  AREAS_DE_CONFIGURACOES, MODULOS_DE_CONFIGURACOES, ENDERECO_DO_HUB, moduloDoAtalho, areasVisiveis,
} from "../features/configuracoes/atalhos.js";

let falhas = 0;
const conf = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome.padEnd(70)} ${ok ? "" : `obtido ${JSON.stringify(obtido)} · esperado ${JSON.stringify(esperado)}`}`);
};
const ids = (areas) => areas.map((a) => `${a.id}:${a.itens.map((i) => i.modulo).join(",")}`);

conf("as duas áreas, na ordem da ADR", ids(AREAS_DE_CONFIGURACOES), ["acesso:equipe", "sienge:precos,eap,insumos"]);
conf("os quatro módulos do hub", MODULOS_DE_CONFIGURACOES, ["equipe", "precos", "eap", "insumos"]);
conf("cores de sinal do DS: settings e orçamentos", AREAS_DE_CONFIGURACOES.map((a) => a.accent), ["var(--mod-settings)", "var(--mod-orcamentos)"]);
conf("todo item mora abaixo do hub", AREAS_DE_CONFIGURACOES.every((a) => a.itens.every((i) => i.to === `${ENDERECO_DO_HUB}/${i.modulo}`)), true);
conf("todo item e toda área têm ícone", AREAS_DE_CONFIGURACOES.every((a) => a.Icon && a.itens.every((i) => i.Icon)), true);
conf("o endereço leva ao módulo", moduloDoAtalho("/configuracoes/insumos"), "insumos");
conf("endereço fora do catálogo leva ao hub", moduloDoAtalho("/configuracoes/xyz"), "configuracoes");

// Cada um vê o que já podia ver: o hub só esconde o que o podeVerModulo nega.
const soPode = (...permitidos) => (id) => permitidos.includes(id);
const doHub = (podeVer) => ids(areasVisiveis(AREAS_DE_CONFIGURACOES, podeVer));
conf("quem vê tudo, vê as duas áreas", doHub(soPode(...MODULOS_DE_CONFIGURACOES)), ["acesso:equipe", "sienge:precos,eap,insumos"]);
conf("sem Equipe, a área Acesso some", doHub(soPode("precos", "eap", "insumos")), ["sienge:precos,eap,insumos"]);
conf("sem Insumos (RN-086), só Preços e EAP", doHub(soPode("precos", "eap")), ["sienge:precos,eap"]);
conf("quem não vê nada, hub vazio", doHub(soPode()), []);

console.log(falhas === 0 ? "\nOK — catálogo de Configurações conforme a ADR-009" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
