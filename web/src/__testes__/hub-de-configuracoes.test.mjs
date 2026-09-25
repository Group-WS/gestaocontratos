/* ADR-009 · o hub de Configurações: catálogo, quem vê e a busca.
 *
 * Roda com: node web/src/__testes__/hub-de-configuracoes.test.mjs
 */
import { AREAS_DE_CONFIGURACOES, MODULOS_DE_CONFIGURACOES, areasVisiveis, filtrarAtalhos } from "../features/configuracoes/atalhos.js";

let falhas = 0;
const conf = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome.padEnd(70)} ${ok ? "" : `obtido ${JSON.stringify(obtido)} · esperado ${JSON.stringify(esperado)}`}`);
};
const ids = (areas) => areas.map((a) => `${a.id}:${a.itens.map((i) => i.id).join(",")}`);

conf("as duas áreas, na ordem da ADR", ids(AREAS_DE_CONFIGURACOES), ["acesso:equipe", "sienge:precos,eap,insumos"]);
conf("os quatro módulos do hub", MODULOS_DE_CONFIGURACOES, ["equipe", "precos", "eap", "insumos"]);

// Cada um vê o que já podia ver: o hub só esconde o que o podeVerModulo nega.
const soPode = (...permitidos) => (id) => permitidos.includes(id);
const doHub = (podeVer) => ids(areasVisiveis(AREAS_DE_CONFIGURACOES, podeVer));
conf("quem vê tudo, vê as duas áreas", doHub(soPode(...MODULOS_DE_CONFIGURACOES)), ["acesso:equipe", "sienge:precos,eap,insumos"]);
conf("sem Equipe, a área Acesso some", doHub(soPode("precos", "eap", "insumos")), ["sienge:precos,eap,insumos"]);
conf("sem Insumos (RN-086), só Preços e EAP", doHub(soPode("precos", "eap")), ["sienge:precos,eap"]);
conf("quem não vê nada, hub vazio", doHub(soPode()), []);

// Busca
conf("busca vazia devolve tudo", ids(filtrarAtalhos(AREAS_DE_CONFIGURACOES, "  ")), ids(AREAS_DE_CONFIGURACOES));
conf("pelo nome, sem acento e sem caixa", ids(filtrarAtalhos(AREAS_DE_CONFIGURACOES, "PRECOS")), ["sienge:precos"]);
conf("por sinônimo", ids(filtrarAtalhos(AREAS_DE_CONFIGURACOES, "material")), ["sienge:insumos"]);
conf("pelo nome da área devolve a área inteira", ids(filtrarAtalhos(AREAS_DE_CONFIGURACOES, "sienge")), ["sienge:precos,eap,insumos"]);
conf("sem resultado", filtrarAtalhos(AREAS_DE_CONFIGURACOES, "xyz"), []);

console.log(falhas === 0 ? "\nOK — hub de Configurações conforme a ADR-009" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
