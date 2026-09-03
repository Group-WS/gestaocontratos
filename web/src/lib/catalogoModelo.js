/**
 * CATÁLOGO TKWS — o que a casa especifica.
 *
 * A pergunta que ele responde não é "quanto custa", é "qual spot a gente
 * usa". Hoje isso vive numa planilha que alguém precisa lembrar de abrir,
 * e o resultado é cada obra especificando um spot diferente.
 *
 * O GRUPO DO CATÁLOGO É A VERBA DA EAP, e não uma segunda taxonomia.
 * Os grupos da planilha dela já eram verbas com outro nome:
 *
 *   ILUMINAÇÃO           -> 05 Instalações Elétricas e Iluminação
 *   LOUÇAS E METAIS      -> 27 Louças, Metais e Equipamentos Especiais
 *   MÓVEIS SOLTOS        -> 24 Móveis Soltos
 *   CORTINAS E PERSIANAS -> 30 Cortinas e Persianas
 *
 * Amarrar nas verbas custa nada e paga em dois lugares: o produto sabe
 * sozinho em que verba cai quando vai pra planilha da obra, e o catálogo
 * não vira um terceiro vocabulário pra alguém manter.
 */

/* ---------- PRODUTO OU ACABAMENTO ----------
 *
 * Não é a mesma coisa, e misturar os dois faz a busca virar palheiro.
 *
 *   PRODUTO     é peça: torneira, spot, coifa. Tem código, tem preço, é
 *               comprada, e vira linha no orçamento da obra.
 *   ACABAMENTO  é cor e material: MDF Freijó, laca off white, tecido
 *               2796 cor 08, pintura Suvinil Nuvem de Papel. Não se
 *               compra sozinho — ele QUALIFICA outra coisa.
 *
 * Só o produto vai pro Executivo. Acabamento indo pro orçamento criaria
 * uma linha de custo pra uma cor, e alguém teria que apagar depois.
 */
export const TIPOS = [
  { id: "produto", nome: "Produtos", sub: "peças que se compram" },
  { id: "acabamento", nome: "Acabamentos", sub: "cor e material" },
];

export const ehAcabamento = (p) => p?.tipoItem === "acabamento";
export const podeIrParaObra = (p) => !ehAcabamento(p);

/* ---------- SUBGRUPOS ----------
 *
 * A planilha não tem subgrupo, mas os produtos têm: dentro de Iluminação
 * já existem spots, fitas, perfis e fontes, e ninguém procura "um item de
 * iluminação" — procura uma fonte de 12V.
 *
 * Os padrões abaixo saíram dos 56 produtos reais dela. A ORDEM IMPORTA:
 * ganha o primeiro que casar, então o mais específico vem antes. "Perfil
 * LED Mini Neon Flex" tem "led" e tem "perfil" — e é perfil.
 */
export const SUBGRUPOS = {
  "05": [
    { nome: "Spots", casa: /\bspot\b/i },
    { nome: "Lâmpadas", casa: /l[âa]mpada|dicr[óo]ica/i },
    { nome: "Perfis", casa: /\bperfil\b|neon\s*flex/i },
    { nome: "Fitas LED", casa: /\bfita\b/i },
    { nome: "Fontes", casa: /\bfonte\b|driver/i },
    { nome: "Pendentes e arandelas", casa: /pendente|arandela|plafon|lustre/i },
    { nome: "Trilhos e balizadores", casa: /trilho|balizador/i },
  ],
  "27": [
    /* Sifao e engate vem ANTES de cuba: "SIFÃO - 01 POR CUBA/ ENGATE
       FLEXÍVEL" cita a cuba de passagem, e caia em "Cubas e tanques". */
    { nome: "Complementos hidráulicos", casa: /sif[ãa]o|engate|v[áa]lvula de escoa|\bralo\b/i },
    { nome: "Cubas e tanques", casa: /\bcuba\b|\btanque\b/i },
    { nome: "Bacias e assentos", casa: /bacia|vaso sanit|assento sanit/i },
    { nome: "Chuveiros e duchas", casa: /chuveiro|ducha/i },
    { nome: "Acabamentos de registro", casa: /acabamento.*registro|registro/i },
    { nome: "Torneiras e monocomandos", casa: /torneira|monocomando|misturador/i },
    { nome: "Acessórios de banho", casa: /porta[- ]?toalha|cabide|papeleira|saboneteira|lixeira/i },
  ],
  "24": [
    { nome: "Colchões", casa: /colch[ãa]o/i },
    { nome: "Camas e cabeceiras", casa: /\bcama\b|cabeceira/i },
    { nome: "Mesas", casa: /\bmesa\b|aparador|console/i },
    { nome: "Cadeiras e banquetas", casa: /cadeira|banqueta|poltrona|puff/i },
    { nome: "Sofás", casa: /sof[áa]|chaise/i },
    { nome: "Estantes e racks", casa: /estante|rack|buffet|cristaleira/i },
  ],
  "30": [
    /* Cortina tem PEÇA e tem ACABAMENTO, e os dois moram nesta verba: a
       prega e o blackout são jeitos de fazer, não coisas que se compram
       soltas. Foi ela quem apontou. */
    { nome: "Pregas", casa: /prega/i },
    { nome: "Blackout", casa: /black\s*out|blackout/i },
    { nome: "Tecidos de cortina", casa: /tecido|linho|voil|vo[ií]l/i },
    { nome: "Persianas", casa: /persiana|rolo|romana|horizontal|vertical/i },
    { nome: "Trilhos e varões", casa: /trilho|var[ãa]o|motoriza/i },
    { nome: "Cortinas", casa: /cortina/i },
  ],
  "20": [
    { nome: "Split Hi-Wall", casa: /hi[- ]?wall|split(?!.*(cassete|duto|piso))/i },
    { nome: "Cassete", casa: /cassete/i },
    { nome: "Dutado", casa: /\bduto|dutad/i },
    { nome: "Exaustores", casa: /exaust|ventila/i },
  ],
  "28": [
    { nome: "Cocção", casa: /cooktop|forno|coifa|depurador|fog[ãa]o/i },
    { nome: "Refrigeração", casa: /geladeira|refrigerador|frigobar|freezer/i },
    { nome: "Lavanderia", casa: /lava\s*e\s*seca|lavadora|secadora|lava[- ]?lou/i },
    { nome: "Áudio e vídeo", casa: /\btv\b|televis|som|soundbar|projetor/i },
  ],
};

/* Sem padrão que case, o produto fica SEM subgrupo — e não num "Outros"
   inventado. "Outros" com trinta itens dentro é a mesma coisa que não ter
   subgrupo, com a diferença de parecer organizado. Sem subgrupo, a tela
   mostra quantos faltam classificar, e alguém classifica. */
export function subgrupoDe(descricao, verba) {
  const regras = SUBGRUPOS[String(verba || "")] || [];
  const t = String(descricao || "");
  for (const r of regras) if (r.casa.test(t)) return r.nome;
  return null;
}

export const subgruposDaVerba = (verba) =>
  (SUBGRUPOS[String(verba || "")] || []).map((r) => r.nome);

/* ---------- DUAS DESCRIÇÕES ----------
 *
 * O mesmo produto é dito de dois jeitos, e não por capricho:
 *
 *   EXECUTIVO — a descrição técnica inteira, que precisa bastar pra
 *   comprar e pra cadastrar no Sienge: "SPOT EMBUTIDO POWERUS 3 LEDS
 *   BRANCO 6W 3000K".
 *
 *   CRIATIVO — o que o cliente lê na apresentação, mais curto: "Spot
 *   embutido branco".
 *
 * Só a do executivo é obrigatória. Sem a do criativo, a apresentação usa
 * a técnica — feia, mas presente. O contrário (obrigar as duas) faria o
 * cadastro travar por causa de um campo que nem sempre difere.
 */
export const descricaoDoExecutivo = (p) => p?.descricao || "";

export const descricaoDoCriativo = (p) =>
  String(p?.descricaoCriativo || "").trim() || p?.descricao || "";

/* Em inglês, na apresentação: a versão em inglês, senão a do criativo,
   senão a técnica. A apresentação sempre sai — nunca com campo vazio. */
export const descricaoDoCriativoEn = (p) =>
  String(p?.descricaoEn || "").trim()
  || String(p?.descricaoCriativo || "").trim()
  || p?.descricao || "";

/* ---------- DINHEIRO ----------
 *
 * O banco guarda CENTAVOS inteiros: float de dinheiro soma errado, e
 * "1.234,56" já custou caro neste app.
 *
 * Mas o item da obra guarda REAIS (parseBRL devolve 1234.56). Esta é a
 * emenda entre os dois mundos, e ela mora aqui, em uma função só, em vez
 * de espalhada por cada lugar que lê um preço.
 */
export const centavos = (reais) =>
  reais == null || reais === "" ? null : Math.round(Number(reais) * 100);
export const reais = (cent) => (cent == null ? null : cent / 100);

/* Preço digitado à mão ENVELHECE. Guardar a data junto é o que permite a
   tela dizer "de 4 meses atrás" em vez de apresentar um número velho com
   cara de número atual. */
export const mesesDesde = (iso) => {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.round((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.4)));
};
export const precoVelho = (iso, limite = 6) => {
  const m = mesesDesde(iso);
  return m != null && m >= limite;
};

/* ---------- O PRODUTO VIRA LINHA DA OBRA ----------
 *
 * É o ponto do módulo: escolher no catálogo e a linha aparecer na
 * planilha da obra, já na verba certa.
 *
 * O que NÃO vai junto, de propósito:
 *   - `comprado`: escolher não é comprar.
 *   - total: quem multiplica é quem já multiplica no resto do app, a
 *     partir de custo unitário e quantidade.
 */
export function produtoParaItem(p, qtd = 1) {
  const q = Number(qtd) || 1;
  const unit = reais(p.precoRef);
  return {
    codigo: p.codigo || null,
    // Vai pro EXECUTIVO: a descrição técnica, que precisa bastar pra comprar.
    desc: descricaoDoExecutivo(p),
    marca: p.fornecedor || null,
    especificacao: p.observacoes || null,
    ambiente: null,
    qtdVendida: q,
    un: p.unidade || "un",
    /* Produto de catálogo é MATERIAL — é coisa que se compra. Mão de obra
       não tem foto nem código de fornecedor. */
    tipo: "produto",
    custoMaterial: unit,
    totalMaterial: unit == null ? null : unit * q,
    custoMO: null,
    totalMO: null,
    custoUnitario: unit,
    custo: unit == null ? null : unit * q,
    /* De onde veio. Sem isto não há como responder depois "esta linha foi
       escolhida no catálogo ou digitada?" — e é essa pergunta que diz se
       a padronização está pegando. */
    doCatalogo: p.id,
  };
}

/* ---------- BUSCA E AGRUPAMENTO ---------- */

const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filtrarProdutos(produtos, { termo, verba, subgrupo, fornecedor, tipoItem } = {}) {
  const t = semAcento(termo).trim();
  return (produtos || []).filter((p) => {
    if (p.ativo === false) return false;
    /* Sem tipo gravado, é PRODUTO: foi assim que tudo entrou antes deste
       campo existir, e mudar o passado calado seria pior. */
    if (tipoItem && (p.tipoItem || "produto") !== tipoItem) return false;
    if (verba && p.verba !== verba) return false;
    if (subgrupo && (p.subgrupo || "") !== subgrupo) return false;
    if (fornecedor && (p.fornecedor || "") !== fornecedor) return false;
    if (!t) return true;
    return semAcento(`${p.descricao} ${p.descricaoCriativo || ""} ${p.codigo || ""} ${p.fornecedor || ""} ${p.observacoes || ""}`).includes(t);
  });
}

/* Agrupa pra prateleira: verba, e dentro dela o subgrupo. O que não tem
   subgrupo fica por último, junto, pra virar fila de trabalho. */
export function porPrateleira(produtos) {
  const porVerba = new Map();
  (produtos || []).forEach((p) => {
    if (!porVerba.has(p.verba)) porVerba.set(p.verba, new Map());
    const sub = p.subgrupo || "";
    const m = porVerba.get(p.verba);
    if (!m.has(sub)) m.set(sub, []);
    m.get(sub).push(p);
  });
  return [...porVerba.entries()].map(([verba, m]) => ({
    verba,
    subgrupos: [...m.entries()]
      .sort((a, b) => (a[0] === "" ? 1 : b[0] === "" ? -1 : a[0].localeCompare(b[0], "pt-BR")))
      .map(([nome, itens]) => ({ nome, itens })),
  }));
}
