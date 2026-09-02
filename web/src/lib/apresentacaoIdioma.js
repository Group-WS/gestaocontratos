/**
 * PORTUGUÊS OU INGLÊS — só na saída.
 *
 * A equipe escreve em português, sempre. O idioma é escolhido na hora de
 * ver e de emitir. Isso evita o pior dos dois mundos: um cadastro meio em
 * português e meio em inglês, que ninguém consegue buscar depois.
 *
 * O QUE DÁ E O QUE NÃO DÁ
 *
 * Dá pra traduzir o que é VOCABULÁRIO FECHADO: o título, o rótulo do
 * rodapé, os nomes de ambiente (living, suíte, cozinha...). São poucas
 * palavras e elas se repetem em toda obra.
 *
 * NÃO dá pra traduzir sozinho a descrição do produto — "SOFÁ ELYSIUM NOA
 * MODULO 220CM + 90CM + MODULO CHAISE 140CM / TECIDO 2025/706" é nome de
 * peça, medida e código de tecido misturados, e chutar ali é pior do que
 * deixar em português. Por isso o produto do catálogo tem um campo de
 * descrição em inglês, opcional: quando existe, é ele que sai; quando
 * não, sai o português e a apresentação continua saindo.
 */

export const IDIOMAS = [
  { id: "pt", nome: "Português", bandeira: "🇧🇷" },
  { id: "en", nome: "English", bandeira: "🇺🇸" },
];

export const TEXTOS = {
  pt: {
    titulo: "APRESENTAÇÃO DE ESPECIFICAÇÕES",
    squad: "Squad",
    cliente: "Cliente",
    projeto: "Nº do projeto",
    data: "Data",
    rev: "Rev",
    local: "Localização",
  },
  en: {
    titulo: "SPECIFICATIONS PRESENTATION",
    squad: "Squad",
    cliente: "Client",
    projeto: "Project no.",
    data: "Date",
    rev: "Rev",
    local: "Location",
  },
};

/* Os ambientes que aparecem em obra de interiores. Lista fechada de
   propósito: ambiente que não estiver aqui sai como foi escrito, em
   português, em vez de sair traduzido errado. */
const AMBIENTES = {
  "living": "Living",
  "sala": "Living Room",
  "sala de estar": "Living Room",
  "estar": "Living Room",
  "sala de jantar": "Dining Room",
  "jantar": "Dining Room",
  "cozinha": "Kitchen",
  "copa": "Pantry",
  "despensa": "Pantry",
  "suite": "Suite",
  "suite master": "Master Suite",
  "dormitorio": "Bedroom",
  "quarto": "Bedroom",
  "banho": "Bathroom",
  "banheiro": "Bathroom",
  "bwc": "Bathroom",
  "lavabo": "Powder Room",
  "varanda": "Balcony",
  "sacada": "Balcony",
  "terraco": "Terrace",
  "home": "Home Theater",
  "home theater": "Home Theater",
  "closet": "Closet",
  "hall": "Hall",
  "corredor": "Hallway",
  "circulacao": "Hallway",
  "entrada": "Entrance",
  "escritorio": "Home Office",
  "lavanderia": "Laundry",
  "area de servico": "Service Area",
  "churrasqueira": "Barbecue Area",
  "piscina": "Pool",
  "garagem": "Garage",
  "gourmet": "Gourmet Area",
  "academia": "Gym",
  "brinquedoteca": "Playroom",
};

const chave = (s) => String(s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/\s+/g, " ").trim();

/**
 * "Suíte Master 03" → "Master Suite 03".
 *
 * O número fica: é ele que diferencia a suíte 01 da 03, e traduzir isso
 * não faria sentido nenhum.
 */
export function ambienteEm(nome, idioma) {
  const t = String(nome || "").trim();
  if (idioma !== "en" || !t) return t;

  const m = t.match(/^(.*?)[\s]*(\d+)?$/);
  const base = chave(m?.[1] || t);
  const numero = m?.[2] ? ` ${m[2]}` : "";

  if (AMBIENTES[base]) return AMBIENTES[base] + numero;

  /* Nome composto que a lista não tem inteiro ("Suíte Casal"): traduz o
     começo que ela conhece e devolve o resto como veio. Melhor meio
     traduzido do que traduzido errado. */
  const partes = base.split(" ");
  for (let n = partes.length - 1; n >= 1; n--) {
    const inicio = partes.slice(0, n).join(" ");
    if (AMBIENTES[inicio]) {
      const resto = String(m?.[1] || t).trim().split(/\s+/).slice(n).join(" ");
      return `${AMBIENTES[inicio]}${resto ? " " + resto : ""}${numero}`;
    }
  }
  return t;
}

/** O texto do bloco no idioma pedido, com volta pro português. */
export const textoDoBloco = (b, idioma) =>
  (idioma === "en" && String((b && b.textoEn) || "").trim()) ? b.textoEn : ((b && b.texto) || "");

/** Quantos blocos ainda não têm versão em inglês. */
export const faltamEmIngles = (doc) =>
  ((doc && doc.slides) || []).reduce((a, s) =>
    a + (s.blocos || []).filter((b) => !String(b.textoEn || "").trim()).length, 0);
