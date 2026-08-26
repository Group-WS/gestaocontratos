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

/* Normaliza pra comparar — mas NÃO quebra número.
 *
 * "9.000 BTUS" e "18.000 BTUS" empatavam em 100%: o ponto virava espaço,
 * "9" e "18" eram descartados por serem curtos, e sobrava "000" nos dois.
 * A capacidade é justamente o que mais distingue um ar-condicionado do
 * outro, e era a única coisa que a comparação não via.
 *
 * Por isso o separador de milhar sai ANTES: 9.000 vira 9000, 18.000 vira
 * 18000, e aí os dois deixam de ser a mesma palavra. */
export const norm = (s) => String(s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase()
  .replace(/(\d)[.,](\d)/g, "$1$2")
  .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

/* Palavras que não distinguem produto nenhum. Sem tirá-las, "Kit de
   instalação para banheira" casa com "Kit de instalação para chuveiro"
   por causa de "kit", "de", "instalacao" e "para". */
const VAZIAS = new Set(["de", "da", "do", "das", "dos", "para", "p", "com", "sem", "em", "e",
  "a", "o", "as", "os", "um", "uma", "no", "na", "por", "kit", "cor", "un", "und", "pc"]);

/* Número entra mesmo curto: "18" e "220v" distinguem produto, e eram
   descartados pela regra de tamanho junto com "de" e "da". */
export const palavras = (s) => norm(s).split(" ")
  .filter((p) => (p.length > 2 || /\d/.test(p)) && !VAZIAS.has(p));

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

/* MÃE E DETALHE — a estrutura real da base do Sienge.
 *
 * O CÓDIGO é a mãe, e ele se repete. Debaixo do 275 (AR CONDICIONADO)
 * moram dezenas de variantes; debaixo do 6050 (CONDENSADORA), outras
 * tantas. A descrição carrega as duas coisas separadas por " / ":
 *
 *   275 | AR CONDICIONADO / ELECTROLUX / SPLIT 9.000 BTUS QUENTE/FRIO
 *         └── mãe ──────┘   └────────── detalhe ──────────────────┘
 *
 * Tratar cada linha como um insumo solto — que era o que eu fazia — faz a
 * escolha virar uma lista de dezenas de textos quase iguais, onde a
 * pessoa compara "9.000" com "18.000" no meio de uma frase. Separando,
 * ela primeiro confirma QUE COISA é (ar-condicionado), e só depois
 * escolhe QUAL (marca, capacidade, ciclo).
 */

const SEP = " / ";

export function partesDoInsumo(descricao) {
  const p = String(descricao || "").split(SEP).map((x) => x.trim()).filter(Boolean);
  return { mae: p[0] || "", detalhe: p.slice(1).join(SEP) };
}

/** Agrupa a base por código: cada grupo é uma mãe com suas variantes. */
export function agruparPorMae(base) {
  const m = new Map();
  (base || []).forEach((i) => {
    const { mae, detalhe } = partesDoInsumo(i.descricao);
    const chave = String(i.codigo);
    if (!m.has(chave)) m.set(chave, { codigo: chave, nome: mae, variantes: [] });
    const g = m.get(chave);
    // Codigo com nomes de mae diferentes: fica o mais frequente, que e o
    // que a base de fato chama aquilo.
    g.variantes.push({ ...i, mae, detalhe: detalhe || mae });
  });
  m.forEach((g) => {
    const cont = new Map();
    g.variantes.forEach((v) => cont.set(v.mae, (cont.get(v.mae) || 0) + 1));
    g.nome = [...cont.entries()].sort((a, b) => b[1] - a[1])[0][0];
  });
  return [...m.values()];
}

/* Acha a MÃE do item — que coisa é, antes de qual variante.
 *
 * Compara contra o nome da mãe E contra as variantes: "Ar-condicionado
 * Electrolux 9.000" casa com a mãe pelo nome, mas "Condensadora Split
 * 18.000" só casa pela variante, porque o nome da mãe sozinho ("
 * CONDENSADORA") tem uma palavra só. */
export function acharMaes(desc, grupos, limite = 4) {
  const notas = (grupos || []).map((g) => {
    const porNome = semelhanca(desc, g.nome);
    const porVariante = g.variantes.reduce((melhor, v) => Math.max(melhor, semelhanca(desc, v.descricao)), 0);
    return { grupo: g, score: Math.max(porNome, porVariante) };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  return notas.slice(0, limite);
}

/* Ordena as variantes de UMA mãe e diz quais palavras casaram.
 *
 * As palavras casadas voltam junto de proposito: "62%" nao ajuda ninguem
 * a decidir entre duas condensadoras. Ver que casou ELECTROLUX e 18.000 e
 * que NAO casou quente/frio e o que permite escolher com seguranca. */
export function ordenarDetalhes(desc, grupo) {
  const alvo = new Set(palavras(desc));
  return (grupo?.variantes || [])
    .map((v) => {
      const dele = new Set(palavras(v.descricao));
      const casaram = [...alvo].filter((p) => dele.has(p));
      const faltaram = [...alvo].filter((p) => !dele.has(p));
      return { insumo: v, score: semelhanca(desc, v.descricao), casaram, faltaram };
    })
    .sort((a, b) => b.score - a.score || b.casaram.length - a.casaram.length);
}

/* Dá pra associar sem alguém olhar?

   Só quando a melhor variante casa TODAS as palavras do item. Aceitar a
   melhor de qualquer jeito seria rápido e errado: a linha de 9.000 BTUs
   viraria a de 18.000 sem ninguém ver, e o erro só aparece quando o
   equipamento chega na obra.

   Vale pra associação em massa. Uma a uma a pessoa está olhando, e aí
   escolher o parecido é decisão dela. */
export function podeAssociarSozinho(detalhes) {
  const melhor = (detalhes || [])[0];
  return !!melhor && melhor.faltaram.length === 0;
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
