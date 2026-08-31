/**
 * A frase que abre o dia.
 *
 * O tom foi pedido assim: o que alguem como o Musk diria pra uma equipe
 * que coordena obra — trabalho sob pressao constante, prazo curto,
 * decisao rapida. First principles, apagar etapa em vez de otimizar,
 * questionar o requisito antes de cumprir, urgencia como habito.
 *
 * NAO SAO CITACOES. Nenhuma destas frases foi dita por ele; sao frases
 * escritas pro app, no espirito que ela pediu. Atribuir aspas a alguem
 * que nao falou seria inventar fala de pessoa real, e isso nao se faz nem
 * numa tela interna.
 */
export const MENSAGENS = [
  "vamos simplificar com inteligência!",
  "a melhor etapa é a que você conseguiu eliminar.",
  "questione o prazo antes de aceitá-lo — quase todo prazo tem gordura ou tem mentira.",
  "se o processo não dói em ninguém, provavelmente ninguém está usando ele.",
  "o pedido que você adia hoje é o atraso que aparece daqui a 75 dias.",
  "requisito sem dono é requisito que ninguém vai defender quando apertar.",
  "decida com 70% da informação — os outros 30% chegam depois da obra entregue.",
  "toda planilha esconde uma pergunta que ninguém fez.",
  "prazo de fornecedor é uma opinião até virar pedido assinado.",
  "conferir uma vez direito custa menos que refazer três vezes rápido.",
  "se dois sistemas discordam do mesmo número, os dois estão errados até prova em contrário.",
  "o problema não é o item que faltou — é o processo que deixou ele faltar.",
  "urgência não é pressa: é saber o que fazer primeiro.",
  "a obra não atrasa num dia. Ela atrasa em cinquenta decisões pequenas.",
  "quem controla o cronograma de compra controla a entrega.",
  "delete a etapa antes de tentar acelerá-la.",
  "orçamento aprovado não é dinheiro gasto — ainda dá tempo de fazer melhor.",
  "se ninguém reclamou do escopo, provavelmente ninguém leu o escopo.",
  "erro barato é o que aparece cedo. Erro caro é o que aparece na entrega.",
  "o fornecedor lembra de quem avisou com antecedência.",
  "número que você não confere é número que alguém vai confiar.",
  "não automatize um processo ruim — conserte ele, depois automatize.",
  "cada aditivo é uma conversa que podia ter acontecido antes.",
  "faça a pergunta difícil enquanto ela ainda é barata de responder.",
  "prazo apertado revela o processo. Prazo folgado esconde.",
  "o melhor retrabalho é o que não começou.",
  "obra bem coordenada parece fácil de fora. É esse o trabalho.",
  "se o alerta aparece todo dia e ninguém age, o alerta virou paisagem.",
  "peça o desconto antes do pedido, não depois da entrega.",
  "duas verdades sobre o mesmo número é o mesmo que nenhuma.",
  "planejar é decidir agora o que você não quer decidir correndo depois.",
];

/**
 * A mesma frase pra todo mundo, no mesmo dia, mudando a cada dia.
 *
 * Sorteio puro daria frase diferente a cada F5 — e frase que muda quando
 * a pessoa recarrega deixa de ser recado e vira ruido. O indice sai da
 * DATA, entao ela e' estavel dentro do dia e o time todo ve a mesma.
 */
export function mensagemDoDia(hoje = new Date()) {
  const dias = Math.floor(
    Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) / 86400000
  );
  return MENSAGENS[((dias % MENSAGENS.length) + MENSAGENS.length) % MENSAGENS.length];
}
