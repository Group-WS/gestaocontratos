/* Leitor do relatório de orçamento do Sienge — a EAP de apropriação.
 *
 * Roda com: node web/src/__testes__/eap-sienge.test.mjs
 *
 * A pergunta que isso responde: de onde sai o código que a solicitação de
 * compra manda em `costEstimationItemReference`, e a unidade construtiva
 * que vai junto. Errar aqui apropria produto na conta errada — e o Sienge
 * aceita calado, porque o código existe.
 *
 * As linhas abaixo reproduzem o relatório real (obra modelo, 15/04/2026):
 * cabeçalho com célula mesclada (o valor cai na coluna 4, não na 1), os
 * códigos com espaço no fim, e a folha separada em [MAT] e [MO].
 */
import { parseEapSienge, ehMaterial, folhasDaEap, porCodigo, sugerirFolha } from "../lib/eapSienge.js";

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(56)} ${String(o).padEnd(24)} ${ok ? "" : "esperava " + e}`); };

// Linha do corpo: código na 0, descrição na 2, unidade na 13.
const linha = (cod, desc, un) => { const r = []; r[0] = cod; r[2] = desc; if (un) r[13] = un; return r; };

const planilha = [
  [null, "Orçamento"],
  ["Obra", null, null, null, "15 - OBRA MODELO "],
  ["Unidade construtiva", null, null, null, "9 - EAP INICIAL - TKWS INTERIORES"],
  ["Tipo de obra", null, null, null, "1 - Construção Civil"],
  ["Versão do orçamento", null, null, null, "3 - 15/04/2026 - 11:29:20",
    null, null, null, null, null, null, "Data base", null, null, null, null,
    null, null, null, null, null, "15/04/2026"],
  ["Código", null, "Descrição", null, null, null, null, null, null, null, null,
    null, null, "Un.", null, null, "Quantidade orçada"],
  linha("04 ", "ACABAMENTOS"),
  linha("04.001 ", "CLIMATIZAÇÃO/ EXAUSTÃO"),
  linha("04.001.001 ", "CLIMATIZAÇÃO/ EXAUSTÃO"),
  linha("04.001.001.001 ", "Climatização, ventilação e exaustão [MAT]", "vb"),
  linha("04.001.001.002 ", "Climatização, ventilação e exaustão [MO]", "vb"),
  linha("04.002 ", "MARCENARIA"),
  linha("04.002.001 ", "MARCENARIA"),
  linha("04.002.001.001 ", "Marcenaria [MAT]", "vb"),
  ["Total da unidade construtiva"],
  ["15/09/2026 - 16:00:43", null, null, null, null, "SIENGE / STARIAN"],
];

const { versao, itens, avisos } = parseEapSienge(planilha);

console.log("\n— cabeçalho —");
conf("unidade construtiva (buildingUnitId)", versao.unidadeId, 9);
conf("nome da versão sem o id", versao.nome, "EAP INICIAL - TKWS INTERIORES");
conf("obra modelo", versao.obraModelo, "15 - OBRA MODELO");
conf("versão do orçamento", versao.versaoOrcamento, "3 - 15/04/2026 - 11:29:20");
// A data base não está na coluna A: o rótulo vive no meio da linha da versão.
conf("data base em ISO", versao.dataBase, "2026-04-15");

console.log("\n— corpo —");
conf("itens lidos (o rodapé não entra)", itens.length, 8);
conf("folhas", folhasDaEap(itens).length, 3);
conf("código sem o espaço do relatório", itens[0].codigo, "04");
conf("nível pela quantidade de segmentos", itens[3].nivel, 4);
conf("só o nível 4 é folha", itens[2].folha, "false");
conf("unidade do item", itens[3].unidade, "vb");
conf("total da unidade não virou item", itens.some((i) => /total/i.test(i.descricao)), "false");
conf("sem avisos numa planilha íntegra", avisos.length, 0);

console.log("\n— material x mão de obra —");
conf("[MAT] é material", ehMaterial("Climatização, ventilação e exaustão [MAT]"), "true");
conf("[MO] não é", ehMaterial("Climatização, ventilação e exaustão [MO]"), "false");
conf("[MAT/MO] é (é a única folha da família)", ehMaterial("Serviços Civis [MAT/MO]"), "true");
conf("índice por código acha a descrição", porCodigo(itens).get("04.002.001.001").descricao, "Marcenaria [MAT]");

console.log("\n— sugestão de folha pra uma verba da casa —");
// A EAP da casa chama "Climatização / Exaustão"; a do Sienge,
// "Climatização, ventilação e exaustão [MAT]". Nomes diferentes, mesma coisa.
conf("acha a folha pelo nome parecido", sugerirFolha("Climatização / Exaustão", itens)?.folha.codigo, "04.001.001.001");
conf("empate vai pra [MAT], não [MO]", ehMaterial(sugerirFolha("Climatização / Exaustão", itens).folha.descricao), "true");
conf("verba sem par não vira palpite", sugerirFolha("Adega Climatizada", itens), "null");
conf("nem com nome de outra família", sugerirFolha("Papel de Parede", itens), "null");

console.log("\n— planilha que não é a esperada —");
const outra = parseEapSienge([["Relatório de outra coisa"], ["nada", "aqui"]]);
conf("avisa que não há item apropriável", outra.avisos.some((a) => /nível 4/.test(a)), "true");
conf("avisa que falta a unidade construtiva", outra.avisos.some((a) => /unidade construtiva/.test(a)), "true");
conf("não inventa itens", outra.itens.length, 0);

console.log("\n— planilha suja —");
const suja = parseEapSienge([
  ["Unidade construtiva", null, "9 - X"],
  linha("04.001.001.001 ", "Uma folha", "vb"),
  linha("04.001.001.001 ", "A mesma folha de novo", "vb"),
  linha("07.001.001.001 ", "Folha sem os grupos de cima", "vb"),
]);
conf("código repetido entra uma vez só", suja.itens.filter((i) => i.codigo === "04.001.001.001").length, 1);
conf("fica a primeira ocorrência", porCodigo(suja.itens).get("04.001.001.001").descricao, "Uma folha");
conf("avisa o repetido", suja.avisos.some((a) => /repetido/.test(a)), "true");
conf("avisa a folha órfã", suja.avisos.some((a) => /07\.001\.001 na planilha|não tem o grupo 07\.001\.001/.test(a)), "true");

console.log(f ? `\n${f} falharam` : "\ntodos passaram");
process.exit(f ? 1 : 0);
