/* O documento de aditivo.
 *
 * Roda com: node web/src/__testes__/aditivos.test.mjs
 *
 * Este documento vai pro CLIENTE. Um total errado aqui não é um número
 * torto numa tela interna: é uma proposta assinada no valor errado, e a
 * conversa pra desfazer isso é com quem paga.
 */
import { parseNum, totalItem, totalGrupo, totalSecao, totaisDoDocumento,
  rotuloSaldo, numeroAditivo, proximaSeq, novoDocumento, novoGrupo, novoItem,
  CONDICOES_PADRAO, linkPipefy, pipefyPendente } from "../lib/aditivoDoc.js";

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(56)} ${String(o).padEnd(14)} ${ok ? "" : "esperava " + e}`); };

/* ---- 1. A VÍRGULA decide quem é decimal ----
   Apagar todos os pontos sem olhar transforma 3.333,33 em 333333. Foi
   exatamente assim que três parcelas de um contrato de dez mil viraram
   um milhão, e é o erro mais caro que este arquivo pode repetir. */
conf("milhar com ponto, decimal com vírgula", parseNum("1.234,56"), 1234.56);
conf("três mil e trezentos", parseNum("3.333,33"), 3333.33);
conf("ponto do teclado numérico é decimal", parseNum("1234.56"), 1234.56);
conf("só dígitos", parseNum("1500"), 1500);
conf("com R$ e espaço", parseNum("R$ 1.500,00"), 1500);
conf("negativo", parseNum("-250,50"), -250.5);
conf("vazio é zero", parseNum(""), 0);
conf("lixo é zero", parseNum("abc"), 0);
conf("número passa direto", parseNum(1234.56), 1234.56);

/* ---- 2. Item, grupo, seção ----
   O PDF original só trazia total por grupo; o preço unitário por item é
   o que permite conferir a linha em vez de acreditar no bloco. */
const it = (qtd, valor) => ({ ...novoItem(), qtd, valor });
conf("total do item é qtd × unitário", totalItem(it("2,00", "1.500,00")), 3000);
/* 9,60 x 414,00 da' 3974.3999999999996 em ponto flutuante. Arredondado
   no item, que e' a linha que o cliente confere na mao. */
conf("quantidade fracionária fecha em centavos", totalItem(it("9,60", "414,00")), 3974.4);

/* Cinquenta linhas com sobra de ponto flutuante somariam um total
   diferente da soma das linhas impressas. */
const cinquenta = { ...novoGrupo(1), itens: Array.from({ length: 50 }, () => it("9,60", "414,00")) };
conf("cinquenta linhas somam exato", totalGrupo(cinquenta), 198720);
conf("item sem valor não soma", totalItem(it("1,00", "")), 0);

const g = { ...novoGrupo(1), itens: [it("2,00", "1.500,00"), it("1,00", "500,00")] };
conf("grupo soma seus itens", totalGrupo(g), 3500);
conf("seção soma seus grupos", totalSecao([g, { ...novoGrupo(2), itens: [it("1,00", "100,00")] }]), 3600);
conf("seção vazia é zero", totalSecao([]), 0);
conf("seção indefinida é zero", totalSecao(undefined), 0);

/* ---- 3. Saldo = adição − supressão ----
   Os números do PDF modelo da 2405: 218.017,90 suprimido, 212.960,64
   adicionado, e o documento fecha com "Crédito gerado do aditivo". */
const doc = {
  supressao: [{ ...novoGrupo(1), itens: [it("1,00", "218.017,90")] }],
  adicao: [{ ...novoGrupo(1), itens: [it("1,00", "212.960,64")] }],
};
const t = totaisDoDocumento(doc);
conf("total suprimido", t.supressao, 218017.9);
conf("total adicionado", t.adicao, 212960.64);
conf("saldo negativo, como no modelo", t.saldo.toFixed(2), "-5057.26");

/* Positivo o cliente paga; negativo ele recebe de volta. Chamar os dois
   de "saldo" deixaria a linha mais importante do documento ambígua bem
   na hora em que ela é lida. */
conf("saldo positivo é valor do aditivo", rotuloSaldo(5000), "Valor do aditivo");
conf("saldo negativo é crédito", rotuloSaldo(-5000), "Crédito gerado do aditivo");
conf("zero é saldo", rotuloSaldo(0), "Saldo do aditivo");

/* ---- 4. Numeração ----
   Centro de custo da obra + sequência. */
conf("número é obra/seq", numeroAditivo("2405", 3), "2405/3");
conf("primeiro aditivo da obra", proximaSeq([]), 1);
conf("continua de onde parou", proximaSeq([{ seq: 1 }, { seq: 2 }]), 3);

/* MAIOR + 1, e não quantidade + 1: aditivo excluído abre um buraco na
   contagem, e reaproveitar o número criaria dois documentos diferentes
   com o mesmo "2405/3" — um deles já na mão do cliente. */
conf("buraco na contagem não é reaproveitado", proximaSeq([{ seq: 1 }, { seq: 5 }]), 6);
conf("fora de ordem não engana", proximaSeq([{ seq: 7 }, { seq: 2 }, { seq: 4 }]), 8);

/* ---- 5. Documento novo ---- */
const novo = novoDocumento({ codigo: "2405", nome: "Brisa do Mar, 701" });
conf("nasce com o nome da obra", novo.cliente, "Brisa do Mar, 701");
conf("e com o centro de custo na proposta", novo.proposta, "2405");
conf("já vem com as condições padrão", novo.cond, CONDICOES_PADRAO);
conf("e com um grupo em cada seção", novo.supressao.length + novo.adicao.length, 2);
// Dois grupos criados na mesma linha não podem compartilhar id: a tela
// inteira é indexada por ele.
conf("ids não colidem", new Set([novoGrupo(1).id, novoGrupo(1).id, novoItem().id]).size, 3);

/* ---- Pipefy ----
   Aditivo aprovado obriga abrir a "Solicitação de contrato". O app não
   envia sozinho — o formulário tem captcha, e metade dos campos
   obrigatórios ele não sabe — mas leva o tipo e o valor prontos. */
conf("o link marca que é aditivo",
  /parab_ns_pelo_fechamento_o_que_fechado=Aditivo/.test(linkPipefy(1070)), true);
conf("e leva o valor", /qual_o_valor_fechado=1070/.test(linkPipefy(1070)), true);
conf("centavos vão junto", /qual_o_valor_fechado=1070\.5/.test(linkPipefy(1070.5)), true);

/* Saldo negativo é crédito PRO CLIENTE, e o campo do Pipefy é "valor
   fechado" — mandar negativo ali confundiria o comercial. Vai vazio. */
conf("crédito não preenche o valor", /qual_o_valor_fechado/.test(linkPipefy(-5057.26)), false);
conf("mas o link continua abrindo", /public\/form\/9dreYs1N/.test(linkPipefy(-5057.26)), true);

// Só o aprovado cobra: rascunho e reprovado não viram card nenhum.
conf("aprovado sem Pipefy é pendência", pipefyPendente({ status: "aprovado", doc: {} }), true);
conf("aprovado com Pipefy não cobra", pipefyPendente({ status: "aprovado", doc: { pipefy: { em: "2026-08-29" } } }), false);
conf("rascunho não cobra", pipefyPendente({ status: "rascunho", doc: {} }), false);
conf("reprovado não cobra", pipefyPendente({ status: "reprovado", doc: {} }), false);
conf("indefinido não quebra", pipefyPendente(undefined), false);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
