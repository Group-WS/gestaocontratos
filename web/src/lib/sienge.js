/**
 * Casar item da obra com insumo do Sienge, e gerar a descrição no padrão.
 *
 * O que está em jogo: lançar compra no Sienge exige um insumo cadastrado.
 * Quem faz isso hoje procura na mão, um por um, numa base de milhares —
 * e quando não acha, cadastra um insumo novo que já existia com outro
 * nome. A base incha e o mesmo produto passa a ter dois códigos.
 *
 * Por isso o casamento tem TRÊS respostas, não duas. "Não achei" e "achei
 * parecido, confira" são coisas diferentes: a primeira manda cadastrar, a
 * segunda manda olhar antes de cadastrar.
 */

export const norm = (s) => String(s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

/* Palavras que não distinguem produto nenhum. Sem tirá-las, "Kit de
   instalação para banheira" casa com "Kit de instalação para chuveiro"
   por causa de "kit", "de", "instalacao" e "para". */
const VAZIAS = new Set(["de", "da", "do", "das", "dos", "para", "p", "com", "sem", "em", "e",
  "a", "o", "as", "os", "um", "uma", "no", "na", "por", "kit", "cor", "un", "und", "pc"]);

const palavras = (s) => norm(s).split(" ").filter((p) => p.length > 2 && !VAZIAS.has(p));

/* Quanto duas descrições se parecem, de 0 a 1.

   Jaccard sobre as palavras que importam: quantas elas têm em comum
   dividido por quantas têm ao todo. Simples de explicar pra quem vai
   confiar no resultado — e é isso que faz alguém aceitar ou recusar o
   "achei parecido" com segurança. */
export function semelhanca(a, b) {
  const A = new Set(palavras(a));
  const B = new Set(palavras(b));
  if (!A.size || !B.size) return 0;
  let comuns = 0;
  A.forEach((p) => { if (B.has(p)) comuns += 1; });
  return comuns / (A.size + B.size - comuns);
}

export const VERDE = "exato", LARANJA = "aproximado", VERMELHO = "sem";

/* Acima disto, é a mesma coisa escrita diferente; abaixo, é outro produto.
   0,55 saiu de olhar os casos reais da base: "Cuba de apoio Deca L-1043"
   contra "Cuba de apoio Deca" dá 0,75; contra "Cuba de embutir Deca" dá
   0,5, e essas são peças diferentes que ninguém quer ver casadas. */
const CORTE = 0.55;

/**
 * Procura o insumo. Devolve { status, insumo, score, alternativas }.
 *
 * `alternativas` existe porque no laranja a pessoa precisa escolher — uma
 * sugestão só transforma a conferência num sim/não cego.
 */
export function casarInsumo(desc, base) {
  const alvo = norm(desc);
  if (!alvo || !(base || []).length) return { status: VERMELHO, insumo: null, score: 0, alternativas: [] };

  const exato = base.find((i) => norm(i.descricao) === alvo);
  if (exato) return { status: VERDE, insumo: exato, score: 1, alternativas: [] };

  const notas = base
    .map((i) => ({ insumo: i, score: semelhanca(desc, i.descricao) }))
    .filter((x) => x.score >= CORTE)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (!notas.length) return { status: VERMELHO, insumo: null, score: 0, alternativas: [] };
  return { status: LARANJA, insumo: notas[0].insumo, score: notas[0].score, alternativas: notas };
}

/* INSUMO MÃE — o agrupador, quando ele existe de verdade.
 *
 * O relatório do Sienge não traz coluna de pai: o agrupamento vive
 * embutido na própria descrição, antes do primeiro " - ", como em
 * "FERRAMENTAS MANUAIS E ACESSÓRIOS - ESTILETE".
 *
 * Só que isso vale pra metade da base. Medindo os 2.701 insumos do
 * relatório: 53% têm o prefixo, e de 265 prefixos distintos, 122 têm UM
 * único filho — nesses o texto antes do traço é parte do nome, não um
 * pai ("ASSINATURA DE PERIÓDICO", "PROJETO SPDA").
 *
 * Por isso a regra é: só é mãe quem tem pelo menos DOIS filhos. Chamar de
 * mãe um prefixo solitário inventaria uma hierarquia que o Sienge não
 * tem, e alguém cadastraria insumo pendurado num pai que não existe. */
export function indiceDeMaes(base) {
  const cont = new Map();
  (base || []).forEach((i) => {
    const m = String(i.descricao || "").match(/^(.*?)\s+-\s+/);
    if (!m) return;
    const chave = m[1].trim();
    if (chave.length < 3) return;
    cont.set(chave, (cont.get(chave) || 0) + 1);
  });
  const maes = new Set();
  cont.forEach((n, chave) => { if (n >= 2) maes.add(chave); });
  return maes;
}

/** Devolve a mãe do insumo, ou null quando a base não tem uma de verdade. */
export function insumoMae(descricao, maes) {
  const m = String(descricao || "").match(/^(.*?)\s+-\s+/);
  if (!m || !maes) return null;
  const chave = m[1].trim();
  return maes.has(chave) ? chave : null;
}

/* Descrição no padrão da casa: MARCA / DESCRIÇÃO / MODELO / COR / CÓDIGO.
 *
 * Campo que não existe é PULADO, não vira espaço vazio nem "—": a
 * descrição vai ser colada no cadastro do Sienge, e separador sobrando
 * lá dentro fica pra sempre.
 *
 * Tudo em caixa alta porque é assim que a base do Sienge é escrita — e
 * uma linha em caixa mista salta como erro no meio das outras. */
export function descricaoSienge({ marca, desc, modelo, cor, codigo }) {
  return [marca, desc, modelo, cor, codigo]
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .join(" / ")
    .toUpperCase();
}
