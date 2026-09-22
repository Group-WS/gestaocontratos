/* A fila de gravação da obra: uma por vez, o estado mais recente, e nunca
 * desistir calada.
 *
 * Roda com: node web/src/__testes__/fila-de-gravacao.test.mjs
 *
 * O relógio é falso: o teste anda o tempo e vê o que a fila fez. `gravar`
 * também é controlado — cada chamada fica pendurada até o teste dizer se
 * gravou ou falhou, que é como se prova "nunca duas ao mesmo tempo".
 */
import { criarFilaDeGravacao, ESPERAS_NOVA_TENTATIVA_MS } from "../lib/filaDeGravacao.js";

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(70)} ${String(o).padEnd(12)} ${ok ? "" : "esperava " + e}`); };

const esvaziar = () => new Promise((r) => setImmediate(r));

function relogioFalso() {
  let agora = 0;
  let seq = 0;
  const timers = new Map();
  return {
    agora: () => agora,
    agendar: (fn, ms) => { const id = ++seq; timers.set(id, { fn, quando: agora + ms }); return id; },
    cancelar: (id) => { timers.delete(id); },
    async andar(ms) {
      const alvo = agora + ms;
      for (;;) {
        const prox = [...timers.entries()].filter(([, t]) => t.quando <= alvo).sort((a, b) => a[1].quando - b[1].quando)[0];
        if (!prox) break;
        timers.delete(prox[0]);
        agora = prox[1].quando;
        prox[1].fn();
        await esvaziar();
      }
      agora = alvo;
      await esvaziar();
    },
    timers: () => timers.size,
  };
}

/* Um `gravar` que registra o que leu e espera o teste decidir. */
function gravadorControlado(ler) {
  const chamadas = [];
  let noAr = 0;
  let picoNoAr = 0;
  const gravar = () => new Promise((resolve, reject) => {
    noAr += 1;
    picoNoAr = Math.max(picoNoAr, noAr);
    chamadas.push({
      leu: ler(),
      gravou: () => { noAr -= 1; resolve(); },
      falhou: (erro) => { noAr -= 1; reject(erro); },
    });
  });
  return { gravar, chamadas, pico: () => picoNoAr };
}

const temporario = (m = "sem rede") => Object.assign(new Error(m), { tipo: "temporario" });
const conflito = () => Object.assign(new Error("a obra mudou"), { tipo: "conflito", detalhe: { motivo: "versao" } });
const recusado = () => Object.assign(new Error("RN-001: só o administrador libera a compra."), { tipo: "recusado" });

function montar() {
  const relogio = relogioFalso();
  let tela = "v0";
  const estados = [];
  const g = gravadorControlado(() => tela);
  const fila = criarFilaDeGravacao({ gravar: g.gravar, aoMudar: (s) => estados.push(s.estado), relogio });
  return { relogio, fila, g, estados, digitar: (v) => { tela = v; fila.alterou(); } };
}

/* ---------- 1. espera a mão parar ---------- */
{
  const { relogio, fila, g, digitar } = montar();
  digitar("v1"); await relogio.andar(500);
  digitar("v2"); await relogio.andar(500);
  digitar("v3");
  conf("durante a digitação, nada é gravado", g.chamadas.length, 0);
  conf("... e a tela sabe que há alteração por gravar", fila.situacao().estado, "pendente");
  conf("... o que conta como pendência", fila.temPendencia(), true);
  await relogio.andar(1200);
  conf("1,2 s depois da última tecla, UMA gravação", g.chamadas.length, 1);
  conf("... com o que está na tela agora", g.chamadas[0].leu, "v3");
  conf("... e o estado é 'salvando'", fila.situacao().estado, "salvando");
  g.chamadas[0].gravou(); await esvaziar();
  conf("gravou: 'salvo'", fila.situacao().estado, "salvo");
  conf("... e sem pendência", fila.temPendencia(), false);
}

/* ---------- 2. uma por vez, sempre o estado mais recente ---------- */
{
  const { relogio, fila, g, digitar } = montar();
  digitar("v1"); await relogio.andar(1200);
  conf("a primeira gravação saiu", g.chamadas.length, 1);
  digitar("v2"); await relogio.andar(1200);
  digitar("v3"); await relogio.andar(1200);
  conf("com a primeira no ar, nenhuma outra sai", g.chamadas.length, 1);
  g.chamadas[0].gravou(); await esvaziar();
  conf("terminada a primeira, a tela ainda tem alteração: 'pendente'", fila.situacao().estado, "pendente");
  await relogio.andar(1200);
  conf("a segunda sai depois", g.chamadas.length, 2);
  conf("... e leva o estado mais recente (v3, não v2)", g.chamadas[1].leu, "v3");
  g.chamadas[1].gravou(); await esvaziar();
  conf("nunca houve duas gravações ao mesmo tempo", g.pico(), 1);
  conf("... e ficou tudo gravado", fila.situacao().estado, "salvo");
}

/* ---------- 3. falhou: tenta de novo, esperando cada vez mais ---------- */
{
  const { relogio, fila, g, digitar } = montar();
  digitar("v1"); await relogio.andar(1200);
  g.chamadas[0].falhou(temporario()); await esvaziar();
  conf("falha temporária: estado 'erro'", fila.situacao().estado, "erro");
  conf("... avisando quando vem a próxima tentativa", fila.situacao().proximaEm, relogio.agora() + ESPERAS_NOVA_TENTATIVA_MS[0]);
  conf("... e a pendência continua", fila.temPendencia(), true);
  digitar("v2");
  await relogio.andar(1200);
  conf("alteração durante o erro não fura a espera", g.chamadas.length, 1);
  await relogio.andar(ESPERAS_NOVA_TENTATIVA_MS[0] - 1200);
  conf("passada a espera, tenta de novo sozinha", g.chamadas.length, 2);
  conf("... com o estado mais recente", g.chamadas[1].leu, "v2");
  g.chamadas[1].falhou(temporario()); await esvaziar();
  conf("falhou de novo: a espera cresce", fila.situacao().proximaEm - relogio.agora(), ESPERAS_NOVA_TENTATIVA_MS[1]);
  conf("... e conta as tentativas", fila.situacao().tentativas, 2);
  await relogio.andar(ESPERAS_NOVA_TENTATIVA_MS[1]);
  g.chamadas[2].gravou(); await esvaziar();
  conf("a rede voltou: 'salvo'", fila.situacao().estado, "salvo");
  digitar("v3"); await relogio.andar(1200);
  g.chamadas[3].falhou(temporario()); await esvaziar();
  conf("depois de gravar, a espera volta ao começo", fila.situacao().proximaEm - relogio.agora(), ESPERAS_NOVA_TENTATIVA_MS[0]);
  fila.tentarAgora(); await esvaziar();
  conf("'tentar agora' não espera o relógio", g.chamadas.length, 5);
}

/* ---------- 3b. a espera não passa do teto ---------- */
{
  const { relogio, fila, g, digitar } = montar();
  digitar("v1"); await relogio.andar(1200);
  for (let i = 0; i < ESPERAS_NOVA_TENTATIVA_MS.length + 3; i++) {
    g.chamadas.at(-1).falhou(temporario()); await esvaziar();
    await relogio.andar(fila.situacao().proximaEm - relogio.agora());
  }
  conf("depois de muitas falhas, continua tentando", g.chamadas.length, ESPERAS_NOVA_TENTATIVA_MS.length + 4);
  g.chamadas.at(-1).falhou(temporario()); await esvaziar();
  conf("... a cada minuto, no máximo", fila.situacao().proximaEm - relogio.agora(), ESPERAS_NOVA_TENTATIVA_MS.at(-1));
}

/* ---------- 4. conflito: para, e não grava por cima de ninguém ---------- */
{
  const { relogio, fila, g, digitar } = montar();
  digitar("v1"); await relogio.andar(1200);
  g.chamadas[0].falhou(conflito()); await esvaziar();
  conf("a obra mudou no banco: estado 'conflito'", fila.situacao().estado, "conflito");
  conf("... sem nova tentativa marcada", relogio.timers(), 0);
  digitar("v2"); await relogio.andar(60_000);
  conf("alteração depois do conflito não grava", g.chamadas.length, 1);
  fila.gravarAgora(); fila.tentarAgora(); await esvaziar();
  conf("... nem pedindo", g.chamadas.length, 1);
  conf("... e a tela sabe que há trabalho não gravado", fila.temPendencia(), true);
  let rejeitou = null;
  await fila.descarregar().catch((e) => { rejeitou = e; });
  conf("esperar a fila esvaziar devolve o conflito", rejeitou?.tipo, "conflito");
  fila.descartar();
  conf("recarregar a obra (descartar) zera a fila", `${fila.situacao().estado}|${fila.temPendencia()}`, "salvo|false");
  digitar("v3"); await relogio.andar(1200);
  conf("... e a próxima alteração volta a gravar", g.chamadas.length, 2);
}

/* ---------- 5. recusado: só volta com alteração nova ou a pedido ---------- */
{
  const { relogio, fila, g, digitar } = montar();
  digitar("v1"); await relogio.andar(1200);
  g.chamadas[0].falhou(recusado()); await esvaziar();
  conf("o servidor recusou este conteúdo: 'recusado'", fila.situacao().estado, "recusado");
  await relogio.andar(120_000);
  conf("... e não repete sozinho o mesmo pedido", g.chamadas.length, 1);
  digitar("v2"); await relogio.andar(1200);
  conf("uma alteração nova tenta de novo", g.chamadas.length, 2);
  conf("... com ela", g.chamadas[1].leu, "v2");
  g.chamadas[1].falhou(recusado()); await esvaziar();
  fila.tentarAgora(); await esvaziar();
  conf("e a pessoa pode pedir de novo", g.chamadas.length, 3);
}

/* ---------- 6. descarregar: sair da tela espera gravar ---------- */
{
  const { relogio, fila, g, digitar } = montar();
  digitar("v1");
  let pronto = false;
  const espera = fila.descarregar().then(() => { pronto = true; });
  await esvaziar();
  conf("descarregar não espera a mão parar", g.chamadas.length, 1);
  g.chamadas[0].falhou(temporario()); await esvaziar();
  conf("falha temporária: continua esperando", pronto, false);
  await relogio.andar(ESPERAS_NOVA_TENTATIVA_MS[0]);
  g.chamadas[1].gravou(); await espera;
  conf("... e termina quando grava", pronto, true);
  let semNada = false;
  await fila.descarregar().then(() => { semNada = true; });
  conf("sem nada pendente, termina na hora", semNada, true);
}

/* ---------- 7. descartar com gravação no ar ---------- */
{
  const { relogio, fila, g, digitar } = montar();
  digitar("v1"); await relogio.andar(1200);
  fila.descartar();
  g.chamadas[0].falhou(temporario()); await esvaziar();
  conf("a gravação que estava no ar não ressuscita a pendência", `${fila.situacao().estado}|${fila.temPendencia()}`, "salvo|false");
  conf("... nem marca nova tentativa", relogio.timers(), 0);
}

/* ---------- 8. gravar agora (aba escondida, fechando a página) ---------- */
{
  const { fila, g, digitar } = montar();
  await fila.gravarAgora();
  conf("sem pendência, gravar agora não chama o banco", g.chamadas.length, 0);
  digitar("v1");
  fila.gravarAgora(); await esvaziar();
  conf("com pendência, grava sem esperar a mão parar", g.chamadas.length, 1);
  digitar("v2");
  g.chamadas[0].gravou(); await esvaziar();
  conf("... e o que chegou durante a gravação sai logo em seguida", g.chamadas.length, 2);
}

/* ---------- 9. erro sem tipo conta como temporário ---------- */
{
  const { relogio, fila, g, digitar } = montar();
  digitar("v1"); await relogio.andar(1200);
  g.chamadas[0].falhou(new TypeError("Failed to fetch")); await esvaziar();
  conf("erro qualquer (rede) é temporário: tenta de novo", fila.situacao().estado, "erro");
}

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
