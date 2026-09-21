/* O botão de remover a planilha aparece sempre que há o que remover.
 *
 * Roda com: node web/src/__testes__/remover-importacao.test.mjs
 *
 * Relato dela em 19/09/2026, no Vendido Planilha: "caso eu queira remover
 * essa planilha, eu não estou conseguindo. Depois que eu importo, ela entra
 * ali, mas se eu quiser retirar essa planilha e deixar ela zerada, eu não
 * estou conseguindo. A única opção é só se eu subir novamente uma outra
 * planilha."
 *
 * O botão existia. Ele só não APARECIA: estava atrás de `!congelado`, então
 * sumia no modo leitura e na etapa congelada pelo Plano de Compras. E botão
 * que some não se procura — se conclui que não existe, que foi exatamente o
 * que aconteceu.
 *
 * Agora ele aparece sempre que há conteúdo, desabilitado quando não dá, com
 * o motivo na dica. A regra vale para os três cartões de importação (Vendido
 * Contrato, Vendido Planilha e Planilha Executivo), porque o componente é o
 * mesmo.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(aqui, "..", "App.jsx"), "utf8");

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(62)} ${String(o).padEnd(8)} ${ok ? "" : "esperava " + e}`); };

/* ---- 1. Aparece quando há conteúdo, e NÃO depende mais de `congelado` ---- */
conf("o botão aparece sempre que há o que remover",
  src.includes("{onLimpar && temConteudo && ("), true);
conf("... e não some mais quando a etapa está congelada",
  src.includes("{onLimpar && temConteudo && !congelado && ("), false);
conf("é o congelamento que DESABILITA, não que esconde",
  /<Button variant="[a-z]+"(?: className="[^"]*")? disabled=\{carregando \|\| congelado\}/.test(src), true);

/* ---- 2. E diz POR QUE não dá ---- */
/* Sem o motivo, o botão desabilitado é só uma frustração mais visível. */
conf("modo leitura: manda habilitar a edição",
  src.includes("Habilite a edição desta obra (no alto da página) para remover."), true);
conf("etapa congelada: manda reabrir as etapas",
  src.includes('Use \\"Reabrir etapas\\" antes de remover.'), true);
conf("quando dá, a dica diz o que vai sair",
  src.includes("`Remover ${oQueLimpa || \"os dados importados\"} desta obra`"), true);

/* ---- 3. A confirmação continua avisando o que some ---- */
/* Remover é irreversível no app (só o histórico de versões, no banco, tem
   volta), então a pergunta tem que dizer o tamanho do que sai. */
conf("a confirmação diz que some tudo do documento",
  src.includes("Some tudo que veio deste documento nesta obra"), true);
conf("... e que as outras etapas não são tocadas",
  src.includes("As outras etapas não são tocadas."), true);

/* ---- 4. Cada tela limpa o SEU campo, e só ele ---- */
/* Limpar demais aqui apagaria trabalho de outra etapa sem ninguém pedir. */
conf("o Vendido Planilha limpa só os itens dele",
  src.includes('onLimpar={() => limparImportacao(["itensPlanilha"])}'), true);
conf("o Executivo limpa a planilha dele e a lista de trabalho",
  src.includes('onLimparExecutivo={() => limparImportacao(["itensPlanilhaExecutivo", "itens"])}'), true);
conf("e o Vendido Contrato zera o valor vendido junto",
  src.includes('if (campos.includes("itensContrato")) limpo.vendido = 0;'), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
