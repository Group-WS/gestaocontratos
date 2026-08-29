/**
 * Aditivos de obra: supressao, adicao e o saldo entre as duas.
 *
 * O modelo do documento e o mesmo da ferramenta avulsa que a Priscila ja
 * usava; o que muda aqui e' que ele deixa de viver no localStorage de um
 * navegador so e passa a ficar guardado por obra, com numero e status.
 */

export const STATUS_ADITIVO = [
  { id: "rascunho", nome: "Rascunho", cor: "var(--ink-3)" },
  { id: "aprovado", nome: "Aprovado", cor: "var(--green)" },
  { id: "reprovado", nome: "Reprovado", cor: "var(--red)" },
];

export const CONDICOES_PADRAO = "Esta proposta é válida por 10 dias.";

const uid = () => Math.random().toString(36).slice(2, 9);

export const novoItem = () => ({ id: uid(), descricao: "", ambiente: "", qtd: "1,00", unidade: "un", valor: "" });
export const novoGrupo = (n) => ({ id: uid(), num: String(n), nome: "", itens: [novoItem()] });

export function novoDocumento(obra) {
  return {
    cliente: obra?.nome || "",
    proposta: obra?.codigo || "",
    data: new Date().toISOString().slice(0, 10),
    cond: CONDICOES_PADRAO,
    supressao: [novoGrupo(1)],
    adicao: [novoGrupo(1)],
  };
}

/**
 * Numero em texto -> numero.
 *
 * A VIRGULA decide quem e' decimal. "1.234,56" tem ponto de milhar;
 * "1234.56" veio do teclado numerico e o ponto e' decimal. Apagar todos
 * os pontos sem olhar transformaria 3.333,33 em 333333 — foi exatamente
 * assim que tres parcelas de um contrato de dez mil viraram um milhao.
 */
export function parseNum(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = String(v ?? "").replace(/[^\d.,-]/g, "").trim();
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/* Soma em CENTAVOS INTEIROS, e arredonda no item — que e' a linha
   impressa.

   9,60 m² x R$ 414,00 da' 3974.3999999999996 em ponto flutuante. Na tela
   isso vira "R$ 3.974,40" e ninguem ve o problema; somando cinquenta
   linhas assim, o total do documento fecha centavos diferente da soma
   das linhas que o cliente consegue conferir na mao — e a conversa sobre
   esses centavos custa mais que os centavos.

   Arredondar so no fim nao resolveria: o erro ja teria entrado por cada
   linha. E somar float arredondado tambem nao — 3974.4 nao existe exato
   em binario, e cinquenta somas dele erram de novo. Inteiro soma exato,
   e a divisao acontece uma vez so. */
const cent = (n) => Math.round(n * 100);
const centItem = (i) => cent(parseNum(i.qtd) * parseNum(i.valor));
const centGrupo = (g) => (g.itens || []).reduce((a, i) => a + centItem(i), 0);
const centSecao = (grupos) => (grupos || []).reduce((a, g) => a + centGrupo(g), 0);

export const totalItem = (i) => centItem(i) / 100;
export const totalGrupo = (g) => centGrupo(g) / 100;
export const totalSecao = (grupos) => centSecao(grupos) / 100;

export function totaisDoDocumento(doc) {
  const s = centSecao(doc?.supressao);
  const a = centSecao(doc?.adicao);
  return { supressao: s / 100, adicao: a / 100, saldo: (a - s) / 100 };
}

/* Positivo o cliente paga; negativo ele recebe de volta. Chamar os dois
   de "saldo" deixaria a linha mais importante do documento ambigua bem
   na hora em que ela e' lida. */
export function rotuloSaldo(s) {
  if (s > 0) return "Valor do aditivo";
  if (s < 0) return "Crédito gerado do aditivo";
  return "Saldo do aditivo";
}

/* O numero que a obra ve: centro de custo + sequencia. */
export const numeroAditivo = (codigo, seq) => `${codigo}/${seq}`;

/* Proxima sequencia = maior ja usada + 1, e nao "quantidade + 1".
   Aditivo excluido abre um buraco na contagem, e reaproveitar o numero
   dele criaria dois documentos diferentes com o mesmo "2405/3" — um deles
   ja na mao do cliente. */
export function proximaSeq(existentes) {
  const maior = (existentes || []).reduce((a, x) => Math.max(a, Number(x.seq) || 0), 0);
  return maior + 1;
}
