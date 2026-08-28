/* O template de importação de detalhes do Sienge.
 *
 * Roda com: node web/src/__testes__/template-sienge.test.mjs
 *
 * É o destino de todo o módulo: o arquivo que sobe no Sienge e cadastra
 * os detalhes dentro dos insumos. As regras da casa são explícitas —
 * UTF-8, separador ponto-e-vírgula, sem fórmulas nem máscaras, sem
 * alterar o nome das colunas nem acrescentar coluna.
 *
 * Um arquivo recusado lá não diz qual linha estava errada, então o que
 * este teste guarda é a FORMA: se ela sair torta, a pessoa descobre no
 * Sienge, sem pista.
 */
import { montarTemplateSienge, faltaNoTemplate, CABECALHO_TEMPLATE_SIENGE } from "../lib/sienge.js";

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(56)} ${String(o).padEnd(10)} ${ok ? "" : "esperava " + e}`); };

const linha = {
  maeCodigo: "405", maeNome: "MOBÍLIA SOLTA - POLTRONA",
  codigoDetalhe: "", codigoAuxDetalhe: "10228.B",
  descricaoDetalhe: "MACROSUL / MESA ENTRE 3,00X1,10", produtoFiscal: "",
};
const csv = montarTemplateSienge([linha]);
const linhas = csv.split("\r\n").filter(Boolean);

/* ---- 1. a forma que o Sienge espera ---- */
conf("cabeçalho idêntico ao template", linhas[0], CABECALHO_TEMPLATE_SIENGE);
conf("seis colunas no cabeçalho", linhas[0].split(";").length, 6);
conf("seis colunas na linha de dados", linhas[1].split(";").length, 6);
conf("separador é ponto-e-vírgula", linhas[1].includes(";"), true);
conf("quebra de linha CRLF", csv.includes("\r\n"), true);

// O BOM ajudaria o Excel, mas este arquivo não é pra ser aberto — é pra
// ser importado. Ele gruda um caractere invisível em "Código auxiliar do
// insumo*", e a regra diz pra não alterar o nome das colunas.
conf("sem BOM na frente", csv.charCodeAt(0) === 0xFEFF, false);
conf("o arquivo começa direto no C de Código", csv[0], "C");

/* ---- 2. nada pode deslocar as colunas ---- */
// A convenção de CSV poria o campo entre aspas. Só que um campo citado
// que o parser deles não entenda desloca as colunas EM SILÊNCIO, e a
// importação entra errada em vez de falhar.
const arriscada = montarTemplateSienge([{
  ...linha, descricaoDetalhe: 'MESA; COM ASPAS "DUPLAS" E; DOIS PONTOS-E-VÍRGULA',
}]).split("\r\n")[1];
conf("ponto-e-vírgula do texto não vira coluna", arriscada.split(";").length, 6);
conf("... ele virou vírgula", /MESA, COM ASPAS/.test(arriscada), true);
conf("aspas viraram apóstrofo", /'DUPLAS'/.test(arriscada), true);
conf("nenhuma aspa dupla sobrou", arriscada.includes('"'), false);
// Quebra de linha dentro de um campo partiria a linha em duas.
const comEnter = montarTemplateSienge([{ ...linha, descricaoDetalhe: "MESA\nBIPARTIDA" }]);
conf("quebra de linha no texto não cria linha nova", comEnter.split("\r\n").filter(Boolean).length, 2);

/* ---- 3. campo vazio sai vazio, não some ---- */
// Sem isso a coluna seguinte sobe uma posição e o arquivo inteiro entra
// deslocado.
conf("campo vazio mantém a posição", linhas[1].split(";")[2], "");
conf("última coluna vazia conta", linhas[1].split(";")[5], "");
conf("nenhuma linha para lista vazia", montarTemplateSienge([]).split("\r\n").filter(Boolean).length, 1);

/* ---- 4. o que falta pra linha ser aceita ---- */
// Dizer O QUE falta, e não só "inválida": o código do detalhe é o Sienge
// quem numera, e o gerador não tem como saber.
conf("aponta os campos obrigatórios vazios",
  faltaNoTemplate(linha).join(", "), "código do detalhe");
conf("linha completa não falta nada",
  faltaNoTemplate({ ...linha, codigoDetalhe: "1" }).length, 0);
conf("linha vazia falta os três", faltaNoTemplate({}).length, 4);
conf("espaço em branco não conta como preenchido",
  faltaNoTemplate({ ...linha, codigoDetalhe: "   " }).length, 1);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
