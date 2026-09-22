/* A FILA DE GRAVAÇÃO DE UMA OBRA.
 *
 * Antes, cada pausa de 1,2 s na digitação disparava uma gravação por conta
 * própria, sem olhar se a anterior tinha terminado. Com a obra grande, uma
 * gravação lenta chegava ao banco DEPOIS da seguinte e desfazia o que ela
 * tinha gravado — e a tela dizia "salvo". Quando a gravação falhava, o aviso
 * aparecia uma vez e ninguém tentava de novo: se a pessoa não mexesse em mais
 * nada, o trabalho ficava só no navegador.
 *
 * As regras desta fila:
 *   1. UMA GRAVAÇÃO POR VEZ. Alteração que chega durante a gravação espera a
 *      vez dela, e a próxima rodada lê o estado mais recente da tela — nunca
 *      um retrato antigo.
 *   2. ESPERA A MÃO PARAR. Subir uma planilha dispara dezenas de mudanças
 *      seguidas; a gravação sai 1,2 s depois da última.
 *   3. FALHOU, TENTA DE NOVO SOZINHA, esperando cada vez mais (2 s, 5 s, 10 s…
 *      até 1 min). Enquanto isso o estado é "erro" e a tela mostra.
 *   4. O QUE NÃO ADIANTA REPETIR PARA. "Conflito" (a obra mudou no banco, ou
 *      a trava é de outra pessoa) não é repetido nunca: repetir gravaria por
 *      cima do trabalho de alguém. "Recusado" (o servidor disse não a ESTE
 *      conteúdo) só volta a tentar com uma alteração nova, ou quando a pessoa
 *      pede.
 *
 * Quem grava de verdade é `gravar()`, de quem cria a fila: ela lê a obra na
 * hora e lança um erro com `tipo` ("conflito", "recusado" ou "temporario")
 * quando não grava. Erro sem tipo conta como temporário.
 *
 * Função pura, sem React e sem rede: o relógio vem de fora, e o teste o
 * controla (web/src/__testes__/fila-de-gravacao.test.mjs).
 */

export const ESPERA_DIGITACAO_MS = 1200;
export const ESPERAS_NOVA_TENTATIVA_MS = [2000, 5000, 10000, 20000, 30000, 60000];

// Os estados em que existe trabalho desta obra que o banco ainda não tem.
const COM_PENDENCIA = new Set(["pendente", "salvando", "erro", "recusado", "conflito"]);

const relogioDoNavegador = {
  agora: () => Date.now(),
  agendar: (fn, ms) => setTimeout(fn, ms),
  cancelar: (id) => clearTimeout(id),
};

export function criarFilaDeGravacao({
  gravar,
  aoMudar = () => {},
  esperaDigitacao = ESPERA_DIGITACAO_MS,
  esperas = ESPERAS_NOVA_TENTATIVA_MS,
  relogio = relogioDoNavegador,
}) {
  let sujo = false;          // há alteração que ainda não foi mandada ao banco
  let emVoo = null;          // a gravação em andamento
  let pressa = false;        // alguém espera a fila esvaziar: sem esperar a mão parar
  let tentativas = 0;
  let timerDigitacao = null;
  let timerTentativa = null;
  let geracao = 0;           // `descartar` invalida a gravação que ainda estiver no ar
  let esperando = [];        // quem chamou `descarregar`
  let situacao = { estado: "salvo", em: null };

  const mudar = (nova) => { situacao = nova; aoMudar(nova); };
  const parar = (timer) => { if (timer != null) relogio.cancelar(timer); return null; };

  function avisarQuemEspera(erro) {
    const lista = esperando;
    esperando = [];
    lista.forEach((e) => (erro ? e.reject(erro) : e.resolve()));
  }

  function agendarDigitacao() {
    timerDigitacao = parar(timerDigitacao);
    timerDigitacao = relogio.agendar(() => { timerDigitacao = null; rodar(); }, esperaDigitacao);
  }

  function falhou(erro) {
    const tipo = erro?.tipo;
    if (tipo === "conflito" || tipo === "recusado") {
      pressa = false;
      mudar({ estado: tipo, erro });
      avisarQuemEspera(erro);
      return;
    }
    const espera = esperas[Math.min(tentativas, esperas.length - 1)];
    tentativas += 1;
    mudar({ estado: "erro", erro, tentativas, proximaEm: relogio.agora() + espera });
    timerTentativa = parar(timerTentativa);
    timerTentativa = relogio.agendar(() => { timerTentativa = null; rodar(); }, espera);
  }

  function rodar() {
    timerDigitacao = parar(timerDigitacao);
    if (situacao.estado === "conflito") return Promise.resolve();
    if (emVoo) return emVoo; // quem chegou durante a gravação: `sujo` garante a próxima rodada
    if (!sujo) {
      avisarQuemEspera();
      return Promise.resolve();
    }
    timerTentativa = parar(timerTentativa);
    sujo = false;
    const minha = geracao;
    mudar({ estado: "salvando" });

    emVoo = Promise.resolve()
      .then(() => gravar())
      .then(
        () => {
          if (minha !== geracao) return undefined;
          emVoo = null;
          tentativas = 0;
          if (sujo) {
            // Chegou alteração durante a gravação: ela é a próxima.
            mudar({ estado: "pendente" });
            if (pressa) return rodar();
            if (timerDigitacao == null) agendarDigitacao();
            return undefined;
          }
          pressa = false;
          mudar({ estado: "salvo", em: relogio.agora() });
          avisarQuemEspera();
          return undefined;
        },
        (erro) => {
          if (minha !== geracao) return;
          emVoo = null;
          sujo = true; // o que ia nesta rodada não chegou ao banco
          falhou(erro);
        },
      );
    return emVoo;
  }

  const temPendencia = () => sujo || !!emVoo || COM_PENDENCIA.has(situacao.estado);

  return {
    /** A obra mudou na tela. */
    alterou() {
      sujo = true;
      // Parada: nada grava por cima; a alteração fica na tela até a pessoa decidir.
      if (situacao.estado === "conflito") return;
      // A nova tentativa já marcada leva esta alteração junto.
      if (situacao.estado === "erro") return;
      if (!emVoo && situacao.estado !== "pendente") mudar({ estado: "pendente" });
      agendarDigitacao();
    },

    /** Grava já, sem esperar a mão parar (aba escondida, fechando a página). */
    gravarAgora() {
      if (!temPendencia()) return Promise.resolve();
      pressa = true;
      return rodar();
    },

    /** A pessoa pediu: tenta de novo agora, inclusive o que foi recusado. */
    tentarAgora() {
      if (situacao.estado === "recusado") sujo = true;
      return rodar();
    },

    /**
     * Espera tudo desta obra chegar ao banco. Resolve quando grava; rejeita
     * com o erro quando para em "conflito" ou "recusado". Nas falhas
     * temporárias ela continua esperando — as novas tentativas seguem.
     */
    descarregar() {
      return new Promise((resolve, reject) => {
        if (!temPendencia()) { resolve(); return; }
        if (situacao.estado === "conflito" || situacao.estado === "recusado") { reject(situacao.erro); return; }
        esperando.push({ resolve, reject });
        pressa = true;
        rodar();
      });
    },

    /**
     * Esquece o que não foi gravado — só quando a pessoa decide recarregar a
     * obra do banco. Quem esperava a fila é liberado: não sobrou nada a gravar.
     */
    descartar() {
      geracao += 1;
      timerDigitacao = parar(timerDigitacao);
      timerTentativa = parar(timerTentativa);
      sujo = false;
      emVoo = null;
      pressa = false;
      tentativas = 0;
      mudar({ estado: "salvo", em: null });
      avisarQuemEspera();
    },

    temPendencia,
    situacao: () => situacao,
  };
}
