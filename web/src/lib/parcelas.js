/**
 * Rateio de parcelas e medições — a mesma lógica do Gerador de Escopos WS.
 *
 * Portado de propósito função a função, e não "melhorado": este é o
 * cálculo que já foi conferido contra contrato assinado. Um arredondamento
 * diferente daqui vira centavo a mais ou a menos numa parcela, e é o tipo
 * de diferença que o fornecedor cobra.
 *
 * A regra que atravessa tudo: **a última absorve o arredondamento**. As
 * primeiras são arredondadas normalmente e a última recebe o que sobrou,
 * então a soma fecha EXATO — nunca 99,99% nem R$ 0,01 a menos.
 */

/* Le numero nos dois formatos que circulam aqui.
 *
 * A pessoa digita "1.234,56"; o proprio rateio grava "1234.56" com
 * toFixed. Apagar todo ponto — como eu fazia — transformava 3333.33 em
 * 333333, e a soma de tres parcelas de um contrato de dez mil dava um
 * milhao. A virgula e quem decide: existindo virgula, ela e o decimal e o
 * ponto e milhar; sem virgula, o ponto e o decimal. */
const num = (v) => {
  const t = String(v ?? "").trim();
  if (!t) return 0;
  const n = parseFloat(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : 0;
};
const cent = (v) => Math.round(v * 100) / 100;

/* MEDIÇÕES — a entrada manda, o resto divide o que sobrou.
 *
 * As demais dividem proporcionalmente ao percentual ORIGINAL do modelo
 * (`pBase`), não ao atual: sem isso, mexer na entrada duas vezes seguidas
 * ia deformando as outras a cada passada, porque a segunda conta usaria o
 * resultado deformado da primeira. */
export function ratearMedicoes(medicoes, entradaPct) {
  const m = (medicoes || []).map((x) => ({ ...x, pBase: x.pBase != null ? x.pBase : x.p }));
  if (m.length < 2) return m;

  const entrada = Math.min(Math.max(num(entradaPct != null ? entradaPct : m[0].p), 0), 100);
  m[0].p = String(cent(entrada));

  const resto = 100 - entrada;
  const demais = m.slice(1);
  const base = demais.map((x) => num(x.pBase));
  const soma = base.reduce((a, b) => a + b, 0);
  let acc = 0;

  demais.forEach((x, i) => {
    let v;
    if (i === demais.length - 1) {
      v = cent(resto - acc);          // a última absorve o arredondamento
    } else {
      v = soma > 0 ? (resto * base[i]) / soma : resto / demais.length;
      v = cent(v);
      acc += v;
    }
    x.p = String(v);
  });
  return m;
}

/* PARCELAS — divide o total em n, com a entrada podendo ser diferente.
 *
 * `sugerirEntrada` divide tudo igual (é o que acontece quando muda o
 * total ou a quantidade de parcelas). Sem ele, a entrada digitada à mão é
 * respeitada e só o resto se redistribui. */
export function ratearParcelas(parcelas, total, sugerirEntrada) {
  const n = (parcelas || []).length;
  const p = (parcelas || []).map((x) => ({ ...x }));
  if (!n || !total) return p;
  if (n === 1) { p[0].v = total.toFixed(2); return p; }

  let entrada = sugerirEntrada ? cent(total / n) : num(p[0].v);
  if (entrada > total) entrada = total;
  if (entrada < 0) entrada = 0;
  p[0].v = entrada.toFixed(2);

  const resto = total - entrada;
  const m = n - 1;
  let acc = 0;
  for (let i = 1; i < n; i++) {
    const v = i === n - 1 ? cent(resto - acc) : cent(resto / m);
    if (i !== n - 1) acc += v;
    p[i].v = v.toFixed(2);
  }
  return p;
}

/** Rótulos padrão: a primeira é a entrada, as outras numeradas. */
export function reorganizarParcelas(parcelas) {
  return (parcelas || []).map((p, i) => ({
    ...p,
    rot: !p.rot || p.rot === "1ª Parcela (entrada)" || /^\d+ª Parcela$/.test(p.rot)
      ? (i === 0 ? "1ª Parcela (entrada)" : `${i + 1}ª Parcela`)
      : p.rot,
    via: p.via || "PIX",
  }));
}

/** Entre 1 e 60 parcelas — acrescenta ou tira, renumera e redivide. */
export function ajustarQtdParcelas(parcelas, quantas, total) {
  const n = Math.max(1, Math.min(60, Math.round(quantas) || 1));
  const p = [...(parcelas || [])];
  while (p.length < n) p.push({ rot: "", v: "", venc: "", via: "PIX", obs: "" });
  while (p.length > n) p.pop();
  return ratearParcelas(reorganizarParcelas(p), total, true);
}

/* A sexta-feira mais próxima daqui pra frente — hoje conta, se for sexta.
 *
 * A casa paga fornecedor na sexta. Vencimento no meio da semana volta pro
 * financeiro pra ser remarcado, e a data do contrato deixa de valer. */
export function naSexta(d) {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + ((5 - x.getDay() + 7) % 7));
  return x;
}

/** Datas a partir do 1º vencimento, de `intervalo` em `intervalo` dias. */
export function sugerirDatas(parcelas, primeiroVenc, intervaloDias) {
  if (!primeiroVenc) return parcelas || [];
  const base = new Date(`${primeiroVenc}T12:00:00`);
  if (isNaN(base)) return parcelas || [];
  const iv = Math.max(0, Math.round(num(intervaloDias))) || 30;
  return (parcelas || []).map((p, i) => {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i * iv);
    const s = naSexta(d);
    const iso = `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}-${String(s.getDate()).padStart(2, "0")}`;
    return { ...p, venc: iso };
  });
}

export function somaParcelas(parcelas) {
  return (parcelas || []).reduce((a, p) => a + num(p.v), 0);
}

export function parcelasPadrao() {
  return [
    { rot: "1ª Parcela (entrada)", v: "", venc: "", via: "PIX", obs: "" },
    { rot: "2ª Parcela", v: "", venc: "", via: "PIX", obs: "" },
    { rot: "3ª Parcela", v: "", venc: "", via: "PIX", obs: "" },
    { rot: "4ª Parcela", v: "", venc: "", via: "PIX", obs: "" },
  ];
}
