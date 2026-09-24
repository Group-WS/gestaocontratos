/* RN-030 · o grupo que a EAP não reconhece passa pela escolha da pessoa.
 *
 * Roda com: node web/src/__testes__/grupos-fora-da-eap.test.mjs
 *
 * Na 2594 o grupo PAISAGISMO caía "fora do padrão da EAP", embora a verba
 * 17 (Parede Verde) seja exatamente isso. Agora a importação pergunta, e a
 * resposta vira apelido — por isso o apelido precisa sair na forma que o
 * depara compara.
 */
import { apelidoDoGrupo, gruposForaDoPadrao, aplicarEscolhaDeVerbas } from "../lib/gruposForaDaEap.js";

let falhas = 0;
const conf = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome.padEnd(56)} ${JSON.stringify(obtido)}${ok ? "" : ` esperava ${JSON.stringify(esperado)}`}`);
};

conf("o apelido é o nome comprimido", apelidoDoGrupo("PAISAGISMO"), "paisagismo");
conf("sem o número que o arquivo põe na frente", apelidoDoGrupo("15 PAISAGISMO"), "paisagismo");
conf("sem acento, espaço nem pontuação", apelidoDoGrupo("Automação - Control 4"), "automacaocontrol4");
conf("nome curto demais não vira apelido", apelidoDoGrupo("7 A"), "");

const itens = [
  { num: "15", desc: "Buxinho", foraDoPadrao: true, grupoOriginal: "PAISAGISMO" },
  { num: "15", desc: "Vaso", foraDoPadrao: true, grupoOriginal: "PAISAGISMO" },
  { num: "33", desc: "Controle", foraDoPadrao: true, grupoOriginal: "AUTOMAÇÃO X" },
  { num: "18", desc: "Tinta" },
];
conf("lista cada grupo uma vez, com a contagem", gruposForaDoPadrao(itens),
  [{ nome: "PAISAGISMO", itens: 2 }, { nome: "AUTOMAÇÃO X", itens: 1 }]);

const escolhas = new Map([["PAISAGISMO", "17"], ["AUTOMAÇÃO X", null]]);
const depois = aplicarEscolhaDeVerbas(itens, escolhas);
conf("o grupo escolhido vai para a verba", depois[0], { num: "17", desc: "Buxinho" });
conf("manter fora do padrão deixa como veio", depois[2], itens[2]);
conf("item de verba reconhecida não muda", depois[3], itens[3]);

if (falhas) { console.log(`\n${falhas} falha(s)`); process.exit(1); }
console.log("\nok");
