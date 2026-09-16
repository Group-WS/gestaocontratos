/* As garantias do envio ao Sienge: não duplicar e não perder.
 *
 * Roda com: node web/src/__testes__/sienge-idempotencia.test.mjs
 *
 * Este arquivo existe por causa de um par de falhas que só aparece em
 * produção, tarde, e é caro desfazer:
 *
 *  - DUPLICAR. Duplo clique, F5 no meio do envio, ou reenviar depois de
 *    uma resposta perdida. O resultado é uma segunda solicitação de
 *    compra no ERP, que alguém vai ter que cancelar na mão.
 *  - PERDER. O envio sai, a resposta não volta, e nada fica registrado.
 *    Ninguém sabe que aconteceu — nem pra conferir, nem pra retomar.
 *
 * As duas se resolvem com identidade: a CHAVE identifica a tentativa (e
 * o índice único do banco recusa a segunda gravação dela), e a
 * ASSINATURA identifica o conteúdo (e permite avisar "isto já foi
 * enviado" mesmo numa tentativa nova).
 */
import { assinaturaDoEnvio, novaChaveIdempotencia } from "../lib/siengeIdempotencia.js";

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(58)} ${String(o).padEnd(22)} ${ok ? "" : "esperava " + e}`); };

const item = (over = {}) => ({
  productId: 275, quantity: 2, unitySymbol: "un", estimatedPrice: 18259.49,
  costEstimationItemReference: "04.001.001.001", buildingUnitId: 9, ...over,
});
const envio = (over = {}) => ({ buildingId: 2519, itens: [item()], ...over });

console.log("\n— a chave identifica a TENTATIVA —");
{
  const a = novaChaveIdempotencia();
  const b = novaChaveIdempotencia();
  conf("nunca se repete", a === b, "false");
  // A coluna no Postgres é uuid: formato errado derruba a gravação
  // justamente no passo que existe pra proteger o envio.
  conf("tem formato de uuid", /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(a), "true");
}

console.log("\n— a assinatura identifica o CONTEÚDO —");
{
  conf("o mesmo lote assina igual", assinaturaDoEnvio(envio()), assinaturaDoEnvio(envio()));
  // É isso que deixa avisar "este mesmo conjunto já foi enviado": duas
  // tentativas diferentes do mesmo pedido têm a mesma assinatura.
  conf("a ordem dos itens não muda a assinatura",
    assinaturaDoEnvio(envio({ itens: [item(), item({ productId: 300 })] })),
    assinaturaDoEnvio(envio({ itens: [item({ productId: 300 }), item()] })));
}
{
  const base = assinaturaDoEnvio(envio());
  const difere = (over, nome) =>
    conf(nome, assinaturaDoEnvio(envio(over)) === base, "false");
  difere({ buildingId: 2045 }, "outra obra é outro pedido");
  difere({ itens: [item({ productId: 300 })] }, "outro insumo é outro pedido");
  difere({ itens: [item({ quantity: 3 })] }, "outra quantidade é outro pedido");
  difere({ itens: [item({ costEstimationItemReference: "04.009.001.001" })] }, "outra apropriação é outro pedido");
  difere({ itens: [item({ buildingUnitId: 1 })] }, "outra unidade construtiva é outro pedido");
  difere({ itens: [item(), item({ productId: 300 })] }, "um item a mais é outro pedido");
}
{
  /* O preço é a exceção deliberada: corrigir um custo na planilha não
     faz do pedido um pedido diferente — e se contasse, a assinatura
     mudaria à toa e o aviso de repetição nunca dispararia. */
  conf("corrigir o preço não muda o pedido",
    assinaturaDoEnvio(envio({ itens: [item({ estimatedPrice: 1 })] })),
    assinaturaDoEnvio(envio()));
  // A observação também não: mexer no texto não muda o que se está pedindo.
  conf("mudar a observação não muda o pedido",
    assinaturaDoEnvio(envio({ itens: [item({ notes: "outro texto" })] })),
    assinaturaDoEnvio(envio()));
}

console.log("\n— casos de borda —");
{
  conf("envio vazio não explode", typeof assinaturaDoEnvio({ buildingId: 1, itens: [] }), "string");
  conf("sem itens declarados também não", typeof assinaturaDoEnvio({ buildingId: 1 }), "string");
  // Dois itens do mesmo insumo em quantidades diferentes não podem
  // colapsar num só: são linhas distintas do pedido.
  conf("itens repetidos contam separado",
    assinaturaDoEnvio(envio({ itens: [item(), item({ quantity: 5 })] })) ===
    assinaturaDoEnvio(envio({ itens: [item()] })), "false");
  // A contagem entra na assinatura, então listas de tamanhos diferentes
  // nunca colidem por acaso no hash.
  conf("o tamanho do lote entra na assinatura",
    assinaturaDoEnvio(envio({ itens: [item(), item({ productId: 300 })] })).endsWith("-2"), "true");
}

console.log(f ? `\n${f} falharam` : "\ntodos passaram");
process.exit(f ? 1 : 0);
