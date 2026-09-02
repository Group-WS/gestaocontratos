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

/* Quanto do item da OBRA aparece na linha do Sienge.
 *
 * Aqui os dois lados nao sao simetricos: a linha do Sienge carrega a mae
 * e a especificacao inteira ("MOBILIA SOLTA - POLTRONA / DESTACK /
 * POLTRONA TORII / MADEIRA NATURAL"), a da obra e curta ("Poltrona Torii
 * Destack"). Jaccard castiga o lado longo e dava 0,43 pra duas linhas que
 * sao o mesmo movel.
 *
 * A pergunta certa e de CONTENCAO: das palavras que descrevem o item da
 * obra, quantas estao na linha do Sienge? Palavra a mais do lado de la
 * nao e divergencia — e detalhe. */
export function cobertura(itemObra, linhaSienge) {
  const A = new Set(palavras(itemObra));
  const B = new Set(palavras(linhaSienge));
  if (!A.size) return 0;
  let comuns = 0;
  A.forEach((p) => { if (B.has(p)) comuns += 1; });
  return comuns / A.size;
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
export function descricaoSienge({ fornecedor, marca, desc, modelo, cor, especificacao, codigo }) {
  /* O FORNECEDOR abre o detalhe.
     E' assim que a base do Sienge escreve — "AR CONDICIONADO / ELECTROLUX
     / SPLIT 9.000 BTUS" — e a cotacao inteira costuma ser de uma casa so,
     entao ele e' digitado uma vez la em cima e vale pra todas as linhas.

     Marca igual ao fornecedor nao repete: "MACROSUL / MACROSUL / MESA"
     seria ruido dentro do cadastro, e ninguem apaga isso depois. */
  const mesmo = (a, b2) => norm(a) && norm(a) === norm(b2);
  /* A descricao as vezes JA COMECA com o fornecedor -- e' o formato da
     planilha de detalhes da obra ("DELUCCI / BANQUETA KOYOTO / ..."). Ali
     ele nao entra de novo, senao sai "DELUCCI / DELUCCI / BANQUETA". */
  const jaAbre = (d, f) => {
    const p = norm(f);
    if (!p) return false;
    const inicio = norm(d).slice(0, p.length + 1);
    return inicio === p || inicio === p + " ";
  };
  const abrir = fornecedor && !jaAbre(desc, fornecedor) ? fornecedor : null;
  const cabeca = abrir && !mesmo(marca, fornecedor) ? [abrir, marca] : [abrir || (mesmo(marca, fornecedor) ? null : marca)];
  /* A ordem e' a da casa, e ela termina no CODIGO:
       FORNECEDOR / DESCRICAO / COR / ESPECIFICACAO / CODIGO
     A especificacao entra antes do codigo porque e' o que distingue duas
     pecas de mesmo nome ("SOMENTE BASE E ESTRUTURA PARA TAMPO DE PEDRA"),
     e o codigo fecha por ser o identificador — quem procura no cadastro
     olha o fim da linha. */
  return [...cabeca, desc, modelo, cor, especificacao, codigo]
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .join(" / ")
    .toUpperCase();
}

/* Le uma lista de produtos de planilha qualquer.
 *
 * Aqui o arquivo nao e' um relatorio do Sienge — e' o que a pessoa tem
 * na mao: uma lista de fornecedor, um recorte do executivo, uma cotacao.
 * Por isso as colunas sao procuradas por VARIOS nomes: a mesma coisa se
 * chama Descricao num lugar, Insumo noutro e Produto num terceiro.
 *
 * Falta de coluna nao inventa dado: campo que nao existe fica vazio e
 * some da descricao gerada, em vez de virar separador solto no cadastro.
 */
/* ---------------------------------------------------------------------
   LISTA SEM CABECALHO

   Nem toda planilha de compra tem cabecalho. A de climatizacao comeca no
   titulo do grupo ("CLIMATIZACAO/ EXAUSTAO") e emenda nas linhas, sem
   nunca escrever "Descricao" em lugar nenhum — e ate entao o gerador
   respondia "nao achei uma coluna de descricao", o que e' verdade e nao
   ajuda em nada: a coluna esta la, so nao tem nome.

   Sem nome, quem identifica a coluna e' o conteudo.
   --------------------------------------------------------------------- */

const soTexto = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

/* Uma descricao de produto e' uma FRASE: tem espaco, tem letra e tem
   tamanho. Isso sozinho ja descarta codigo ("5.1"), quantidade, unidade e
   link — que sao justamente as outras colunas. */
function pareceFrase(v) {
  const t = soTexto(v);
  if (t.length < 10 || !/\s/.test(t)) return false;
  if (/^https?:/i.test(t)) return false;
  return (t.match(/[a-zà-ÿ]/gi) || []).length >= 5;
}

/* Modelo do fabricante: "ZT-W18GTTAA", "S3-W12JAQAL". Bloco unico com
   letra E numero. O "5.1" da primeira coluna tem numero e nao tem letra,
   entao nao entra; o link tem letra e numero e e' barrado antes. */
function pareceModelo(v) {
  const t = soTexto(v);
  if (!t || /\s/.test(t) || t.length < 3 || t.length > 24) return false;
  if (/^https?:/i.test(t)) return false;
  return /[a-z]/i.test(t) && /\d/.test(t);
}

const pareceUnidade = (v) => /^(un|und|unid|unidade|p[cç]|pe[cç]a|cj|conj|kit|m|m2|m²|ml|kg)$/i.test(soTexto(v));

/* Rotulo: texto curto que NOMEIA em vez de descrever. E' a forma de
   fornecedor ("Casa Cristallo") e de ambiente ("Suite Master") — as duas
   colunas laterais que a planilha de detalhes traz e que o leitor
   jogava fora. */
function pareceRotulo(v) {
  const t = soTexto(v);
  if (!t || t.length < 3 || t.length > 40) return false;
  if (/^https?:/i.test(t)) return false;
  if (/^[\d.,/-]+$/.test(t)) return false;          // "16.3", "0", datas
  if (t.split(/\s+/).length > 4) return false;       // frase, nao rotulo
  return (t.match(/[a-zà-ÿ]/gi) || []).length >= 3;
}

/* Vocabulario de ambiente. Serve pra separar as DUAS colunas de rotulo
   uma da outra: fornecedor e ambiente tem exatamente o mesmo formato, e
   sem isto a escolha seria cara ou coroa. Nao e' lista fechada — e' voto:
   ganha a coluna que casar mais. */
const AMBIENTES = /\b(living|sala|estar|jantar|cozinha|copa|su[ií]te|dormit[óo]rio|quarto|banh[oa]|banheiro|lavabo|varanda|sacada|home|closet|hall|corredor|escrit[óo]rio|lavanderia|[áa]rea|churrasqueira|piscina|garagem|terra[çc]o|gourmet|despensa|circula[çc][ãa]o|entrada|recep[çc][ãa]o|social)\b/i;

/* Todas as colunas que parecem rotulo, da esquerda pra direita. Uma
   planilha de detalhes costuma trazer duas: fornecedor e ambiente. */
function colunasDeRotulo(L, exceto = []) {
  const largura = Math.max(...L.map((r) => r.length), 0);
  const achadas = [];
  for (let c = 0; c < largura; c++) {
    if (exceto.includes(c)) continue;
    const n = L.reduce((a, r) => a + (pareceRotulo(r[c]) ? 1 : 0), 0);
    // metade das linhas preenchidas ja e' coluna, nao coincidencia
    if (n >= Math.max(2, Math.ceil(L.length * 0.4))) {
      const votos = L.reduce((a, r) => a + (AMBIENTES.test(soTexto(r[c])) ? 1 : 0), 0);
      achadas.push({ i: c, n, ambiente: votos });
    }
  }
  return achadas;
}

/* Coluna vencedora e' a que mais vezes parece o que se procura. Empate
   fica com a mais a esquerda, que numa planilha de compra e' a que a
   pessoa preencheu primeiro. */
function colunaQueMais(L, pred, exceto = []) {
  const largura = Math.max(...L.map((r) => r.length), 0);
  let melhor = -1, placar = 0;
  for (let c = 0; c < largura; c++) {
    if (exceto.includes(c)) continue;
    const n = L.reduce((a, r) => a + (pred(r[c]) ? 1 : 0), 0);
    if (n > placar) { placar = n; melhor = c; }
  }
  return placar ? melhor : -1;
}

/* Zero nao e' informacao: e' o que a planilha escreve onde nao ha nada.
   Link tambem nao: a coluna de especificacao as vezes traz a pagina do
   produto, e URL dentro do descritivo do Sienge e' lixo. */
const semZero = (v) => {
  const t = v == null ? "" : String(v).trim();
  if (!t || /^0+([.,]0+)?$/.test(t) || /^https?:/i.test(t)) return null;
  return v;
};

const mesmaCoisa = (a, b) => !!a && !!b && norm(a) === norm(b);

export function lerListaSemCabecalho(L) {
  if (!L || !L.length) return [];
  const iDesc = colunaQueMais(L, pareceFrase);
  if (iDesc === -1) return [];

  const iModelo = colunaQueMais(L, (v) => pareceModelo(v));
  const iUn = colunaQueMais(L, pareceUnidade);
  const iQtd = colunaQueMais(L, (v) => typeof v === "number" && v > 0 && Number.isFinite(v));

  /* Especificacao e' a SEGUNDA coluna de frase: a descricao ganha, e o
     que sobra descreve. Sem isto, a planilha de detalhes chegava aqui
     com o nome do movel e nada mais — "Sofa Portillo", sem o tecido,
     sem a medida, sem o lado do braco. */
  const iEspec = colunaQueMais(L, (v, ) => pareceFrase(v), [iDesc]);

  /* Fornecedor e ambiente tem o mesmo formato. Quem casa mais com o
     vocabulario de ambiente e' o ambiente; a outra e' o fornecedor. Com
     uma coluna so', ela e' fornecedor se nao parecer ambiente. */
  const rotulos = colunasDeRotulo(L, [iDesc, iEspec, iModelo, iUn].filter((x) => x >= 0));
  const porAmbiente = [...rotulos].sort((a, b) => b.ambiente - a.ambiente);
  const oAmbiente = porAmbiente[0] && porAmbiente[0].ambiente > 0 ? porAmbiente[0] : null;
  const oFornecedor = rotulos.find((c) => c !== oAmbiente) || null;

  const pega = (r, i) => (i >= 0 && i !== iDesc ? soTexto(r[i]) || null : null);

  return L.filter((r) => {
    if (!pareceFrase(r[iDesc])) return false;
    /* Titulo de grupo tambem e' frase ("CLIMATIZACAO/ EXAUSTAO"), e a
       unica coisa que o separa de um produto e' estar SOZINHO na linha:
       produto tem modelo, link, ambiente, unidade. Numero nao conta —
       titulo de grupo vem com o numero do grupo e com zeros. */
    return r.some((c, k) => k !== iDesc && typeof c === "string" && /[a-zà-ÿ]/i.test(c));
  }).map((r) => ({
    desc: soTexto(r[iDesc]),
    marca: null,
    modelo: pega(r, iModelo),
    cor: null,
    codigo: null,
    qtd: iQtd >= 0 && typeof r[iQtd] === "number" ? r[iQtd] : null,
    un: pega(r, iUn),
    /* "0" e' celula vazia disfarcada: a planilha da casa preenche com
       zero o que nao tem. Zero nao e' fornecedor nem especificacao. */
    fornecedor: semZero(pega(r, oFornecedor ? oFornecedor.i : -1)),
    ambiente: semZero(pega(r, oAmbiente ? oAmbiente.i : -1)),
    /* Especificacao igual a descricao nao acrescenta nada: repetiria a
       mesma frase duas vezes dentro do descritivo do Sienge. Acontece
       quando a planilha traz o descritivo completo nas duas colunas. */
    especificacao: mesmaCoisa(pega(r, iEspec), soTexto(r[iDesc])) ? null : semZero(pega(r, iEspec)),
  }));
}

export function lerListaDeProdutos(brutas) {
  const L = (brutas || []).filter((r) => Array.isArray(r) && r.some((c) => String(c ?? "").trim()));
  if (!L.length) return [];
  const limpo = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  const iCab = L.findIndex((r) =>
    Array.from(r, limpo).some((c) => /descri|insumo|produto|^item$|especifica/.test(c)));
  if (iCab === -1) return lerListaSemCabecalho(L);

  // Array.from e nao .map: celula vazia e' buraco, e findIndex nao pula
  // buraco — testar `undefined` casa com padrao errado. Mesma armadilha
  // que ja fez a coluna de unidade sumir no leitor de pedido.
  const cab = Array.from(L[iCab], limpo);
  const acha = (...pads) => {
    for (const p of pads) {
      const i = cab.findIndex((c) => p.test(c || ""));
      if (i >= 0) return i;
    }
    return -1;
  };
  const iDesc = acha(/descri/, /^insumo/, /^produto/, /^item$/);
  /* Fornecedor tem coluna PROPRIA, e nao e' sinonimo de marca: numa
     planilha de detalhes as duas coexistem, e enfiar fornecedor em
     `marca` fazia a informacao de quem vende sumir. */
  const iForn = acha(/fornecedor/, /^loja$/, /revenda/);
  const iMarca = acha(/marca/, /fabricante/);
  const iAmb = acha(/ambiente/, /^local$/, /^c[ôo]modo$/);
  const iEspecCab = acha(/especifica/, /^detalhe/, /^observa/);
  const iModelo = acha(/modelo/, /^ref\b/, /referencia/);
  const iCor = acha(/^cor$/, /acabamento/);
  const iCodigo = acha(/^cod/, /^c[oó]d/, /^sku$/);
  if (iDesc === -1) return lerListaSemCabecalho(L);

  const pega = (r, i) => (i >= 0 ? String(r[i] ?? "").replace(/\s+/g, " ").trim() || null : null);
  const saida = [];
  L.slice(iCab + 1).forEach((r) => {
    const desc = pega(r, iDesc);
    if (!desc) return;
    if (/^(descri|insumo|produto|item)/.test(limpo(desc))) return;   // cabecalho repetido
    const espec = pega(r, iEspecCab);
    saida.push({
      desc,
      marca: pega(r, iMarca),
      modelo: pega(r, iModelo),
      cor: pega(r, iCor),
      codigo: pega(r, iCodigo),
      fornecedor: semZero(pega(r, iForn)),
      ambiente: semZero(pega(r, iAmb)),
      especificacao: mesmaCoisa(espec, desc) ? null : semZero(espec),
    });
  });
  return saida;
}

/* A mesma lista, mas vinda de PDF ("Insumos Orcados" do Sienge).
 *
 * O extrator de PDF cola as colunas e quebra a descricao em varias
 * linhas:
 *
 *   405MOBILIA SOLTA - POLTRONA / Detalhe: DESTACK /
 *   POLTRONA TORII / MADEIRA NATURAL (LAMINA) / COURO
 *   MEL
 *   un1,00007.008,85707.008,8630/08/2024
 *   ^^ ^^^^^^ unidade e quantidade grudadas no preco
 *
 * Entao a leitura ancora em DOIS pontos: a linha que abre o item
 * (codigo colado numa descricao em caixa alta) e a linha de valores, que
 * fecha o bloco. Tudo entre as duas e' continuacao da descricao.
 *
 * "Detalhe:" e' rotulo, nao conteudo — sai fora. Ele aparece em toda
 * linha e, contado como palavra, aproximaria produtos que nao tem nada a
 * ver so por compartilhar o rotulo.
 */
/* Cotacao: o CODIGO do fornecedor e' quem abre o item.
 *
 * Ele vem sozinho numa linha ("10228.B", "20142") e e' o unico sinal
 * confiavel de onde um produto comeca — nome de produto se parece com
 * observacao, com acabamento e com endereco, e filtrar por "parece nome"
 * trazia 29 linhas onde havia 13 produtos.
 *
 * Depois do codigo vem a descricao (uma ou mais linhas), o acabamento
 * com a quantidade ("AMENDOA/.=1"), a linha de valores colados, e as
 * observacoes. A observacao entra como especificacao porque ela carrega
 * o que distingue o item ("TECIDO 694 B", "TAMPO LAMINADO").
 */
export function lerCotacaoPDF(texto) {
  const L = String(texto || "").split("\n").map((x) => x.trim()).filter(Boolean);
  /* Codigo de fornecedor tem NUMERO. Sem exigir isso, "BAIXA" e
     "PEDIDO" — palavras soltas da propria cotacao — abriam itens. */
  const CODIGO = /^(?=.*\d)[A-Z0-9][A-Z0-9.\-]{2,12}$/i;
  /* Sem \b: em "61UN10" nao ha fronteira entre digito e letra — os dois
     sao caracteres de palavra. Com \b a linha de valores nunca casava e
     ia inteira pra dentro da descricao. */
  const VALORES = /\d,\d{2}.*?(UN|PC|CJ|M2|KG)\d/i;
  const ACABAMENTO = /^(.*?)\/.*?=\s*(\d+)\s*$/;

  const itens = [];
  let atual = null;
  const fechar = () => {
    if (!atual) return;
    const desc = atual.desc.join(" ").replace(/\s+/g, " ").trim();
    if (desc) itens.push({
      desc, codigo: atual.codigo, cor: atual.cor, qtd: atual.qtd, temValor: atual.passouValor,
      especificacao: atual.obs.join(" ").replace(/\s+/g, " ").trim() || null,
      marca: null, modelo: null, un: null,
    });
    atual = null;
  };

  /* Codigo abre item so quando a PROXIMA linha tem cara de descricao.

     "074" e' o modelo do sofa e vem sozinho numa linha: puro numero, tres
     digitos, identico a um codigo. Ele abria um item novo e o SOFA ARACA
     inteiro sumia da lista. O que separa os dois e' o que vem depois —
     codigo e' seguido do nome do produto; modelo, do acabamento. */
  const temTexto = (t) => (String(t || "").match(/[A-Za-zÀ-ú]/g) || []).length >= 5;

  /* Observacao so aceita linha de TEXTO. Sem isso o ultimo item engolia o
     rodape ("19.171,11", "0,00Desconto do subtotal:") e o cabecalho
     colado da pagina seguinte, porque nao havia proximo codigo pra
     fechar o bloco. */
  // O rodape tem espacos e letras como qualquer observacao — so o
  // vocabulario o denuncia. Sem esta lista, o ultimo item da cotacao
  // sempre termina com o total da nota colado na especificacao.
  const RODAPE = /valor l[ií]quido|resumo por|desconto do subtotal|valor dos produtos|^frete|vedada a autentica|documento fiscal|comprova pagamento/i;
  const obsValida = (t) => t.includes(" ") && temTexto(t)
    && !/^\d[\d.,]*[A-Za-zÀ-ú]/.test(t) && !RODAPE.test(t);

  L.forEach((linha, i) => {
    if (CODIGO.test(linha) && !VALORES.test(linha) && temTexto(L[i + 1])) {
      fechar();
      atual = { codigo: linha, desc: [], obs: [], cor: null, qtd: null, passouValor: false };
      return;
    }
    if (!atual) return;
    const ac = linha.match(ACABAMENTO);
    if (ac && !atual.passouValor) {
      // "./650=1": o acabamento e' so um ponto — nao ha cor, e gravar "."
      // poria pontuacao no lugar de informacao.
      const cor = ac[1].trim();
      atual.cor = /[A-Za-zÀ-ú]/.test(cor) ? cor : null;
      atual.qtd = Number(ac[2]);
      return;
    }
    if (VALORES.test(linha)) { atual.passouValor = true; return; }
    // Antes do valor e' descricao; depois, observacao.
    if (atual.passouValor) { if (obsValida(linha)) atual.obs.push(linha); }
    else atual.desc.push(linha);
  });
  fechar();

  /* So e' produto quem teve LINHA DE VALORES.
     O numero do documento ("24187") tambem parece codigo e abriria um
     item com o cabecalho inteiro dentro. Produto tem preco; cabecalho
     nao. */
  return itens.filter((x) => x.temValor && (x.desc.match(/[A-Za-zÀ-ú]/g) || []).length >= 6);
}

export function lerListaDeProdutosPDF(texto) {
  const L = String(texto || "").split("\n").map((x) => x.trim()).filter(Boolean);
  // "un1,0000..." ou "m²12,5000..." — unidade grudada na quantidade.
  const VALORES = /^([a-zçãµ²³.]{1,4})(\d{1,3}(?:\.\d{3})*,\d{4})/i;
  /* Codigo seguido de PELO MENOS TRES LETRAS.
     Sem isso, uma linha de continuacao como "50X50X45CM / TECIDO 1546"
     passava por item novo — "50" + "X..." em maiuscula — e partia a
     descricao em dois pedacos, os dois sem preco. Nome de insumo comeca
     com palavra ("MOBILIA", "COIFA"); medida comeca com numero. */
  const ABRE = /^(\d{2,6})([A-ZÀ-Ú]{3,}[^]*)$/;

  const saida = [];
  let atual = null;
  L.forEach((linha) => {
    const v = atual && linha.match(VALORES);
    if (v) {
      atual.un = v[1].replace(/\.$/, "");
      atual.qtd = Number(v[2].replace(/\./g, "").replace(",", "."));
      saida.push(atual);
      atual = null;
      return;
    }
    const a = linha.match(ABRE);
    if (a) {
      // Item novo comecou sem a linha de valores do anterior: guarda o
      // que tinha em vez de descartar — descricao sem preco ainda serve
      // pra casar com o insumo.
      if (atual) saida.push(atual);
      atual = { codigo: a[1], partes: [a[2]], marca: null, modelo: null, cor: null };
      return;
    }
    if (atual) atual.partes.push(linha);
  });
  if (atual) saida.push(atual);

  return saida.map((x) => {
    const inteiro = x.partes.join(" ").replace(/\s+/g, " ").replace(/\bDetalhe:\s*/gi, "").trim();
    return { desc: inteiro, codigo: null, codigoSienge: x.codigo, un: x.un || null, qtd: x.qtd ?? null,
             marca: null, modelo: null, cor: null };
  }).filter((x) => x.desc);
}

/* O TEMPLATE DE IMPORTACAO DE DETALHES DO SIENGE.
 *
 * E' o destino de tudo isto: o arquivo que sobe no Sienge e cadastra os
 * detalhes dentro dos insumos, sem ninguem digitar um por um.
 *
 * Cabecalho exato, separador PONTO E VIRGULA — o Sienge le assim, e uma
 * virgula no lugar errado faz ele recusar o arquivo inteiro sem dizer
 * qual linha.
 *
 * Tres colunas sao obrigatorias (marcadas com * no proprio template).
 * Quando falta uma, a linha sai mesmo assim, VAZIA naquele campo: e
 * melhor a pessoa ver o buraco na planilha e preencher do que o gerador
 * inventar um codigo que nao existe no Sienge.
 */
export const CABECALHO_TEMPLATE_SIENGE =
  "Código auxiliar do insumo*;Descrição do insumo;Código do detalhe*;" +
  "Código auxiliar do detalhe*;Descrição do detalhe*;Produto fiscal";

/* Nada de aspas: o ponto e virgula sai do TEXTO.
 *
 * A convencao de CSV manda por o campo entre aspas quando ele contem o
 * separador. So que o destino aqui e o importador do Sienge, e a regra
 * da casa e' explicita — sem formulas, sem mascaras, sem mexer nas
 * colunas. Um campo entre aspas que o parser deles nao entenda desloca
 * as colunas em silencio, e a importacao entra errada em vez de falhar.
 *
 * Entao ";" vira "," e a aspa vira apostrofo dentro do proprio texto. E
 * perda cosmetica de pontuacao numa descricao de produto — que ja usa
 * "/" como separador — em troca de um arquivo que qualquer leitor abre
 * igual. */
const celulaCSV = (v) => {
  const t = String(v ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/;/g, ",")
    .replace(/"/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  /* "A planilha nao deve possuir formulas": celula que comeca com = + - @
     e' formula pra qualquer leitor de planilha, e um codigo de fornecedor
     como "-DR-M" cairia nisso. O espaco na frente e' o desarme mais
     barato — nao muda o nome de coluna nenhum e nao inventa aspas. */
  return /^[=+\-@]/.test(t) ? " " + t : t;
};

/**
 * Monta o CSV a partir das linhas que precisam de cadastro.
 *
 * Cada linha e { maeCodigo, maeNome, codigoDetalhe, codigoAuxDetalhe,
 * descricaoDetalhe, produtoFiscal }.
 */
/* O codigo auxiliar e' o campo onde o Sienge guarda a referencia de FORA
   — o jeito da casa chamar aquela peca. Por isso a ordem: primeiro o
   codigo que o proprio arquivo trouxe, e so depois o modelo do
   fabricante ("ZT-W18GTTAA"), que e' referencia externa do mesmo jeito e
   costuma ser a unica que existe quando a planilha nao tem coluna de
   codigo — o caso da lista de climatizacao.

   Vazio nao e' opcao silenciosa: a coluna e' obrigatoria no template, e
   uma celula em branco so aparece depois, quando o Sienge recusa. */
export function codigoAuxiliarDe(it) {
  return String(it?.codigo || it?.codigoSienge || it?.modelo || "").trim();
}

/**
 * Sorteia codigo auxiliar pras linhas que nao tem nenhum.
 *
 * O campo e' obrigatorio no template, e ha planilha que simplesmente nao
 * traz codigo nem modelo. Um numero sorteado resolve — mas ele so presta
 * se for UNICO: dois detalhes com o mesmo auxiliar e' exatamente o tipo
 * de duplicata que o campo existe pra evitar, e o Sienge aceitaria calado.
 * Por isso o sorteio conhece os codigos que ja estao no arquivo e os que
 * ele mesmo acabou de dar.
 *
 * Devolve Map<indice, codigo> so pras linhas que precisaram.
 */
export function sortearAuxiliares(linhas, jaUsados = []) {
  const usados = new Set(jaUsados.map((x) => String(x).trim()).filter(Boolean));
  (linhas || []).forEach((l) => { const c = codigoAuxiliarDe(l); if (c) usados.add(c); });

  const novos = new Map();
  (linhas || []).forEach((l, i) => {
    if (codigoAuxiliarDe(l)) return;
    let n;
    do { n = String(Math.floor(10000 + Math.random() * 90000)); } while (usados.has(n));
    usados.add(n);
    novos.set(i, n);
  });
  return novos;
}

export function montarTemplateSienge(linhas) {
  const corpo = (linhas || []).map((l) => [
    l.maeCodigo, l.maeNome, l.codigoDetalhe, l.codigoAuxDetalhe, l.descricaoDetalhe, l.produtoFiscal,
  ].map(celulaCSV).join(";"));
  /* SEM BOM. Ele ajudaria o Excel a abrir os acentos, mas este arquivo
     nao e' pra ser aberto — e' pra ser importado. O BOM gruda um
     caractere invisivel no comeco de "Código auxiliar do insumo*", e a
     regra da casa diz pra nao alterar o nome das colunas. Um importador
     que compare o cabecalho literalmente recusaria o arquivo inteiro, e
     a causa seria invisivel na tela. */
  return [CABECALHO_TEMPLATE_SIENGE, ...corpo].join("\r\n") + "\r\n";
}

/* O que falta pra linha ser aceita pelo Sienge.
 *
 * Devolver a lista dos campos vazios — e nao um simples "invalida" —
 * porque a pessoa precisa saber O QUE preencher, e o gerador nao tem como
 * saber o codigo que o Sienge vai dar. */
export function faltaNoTemplate(l) {
  const falta = [];
  if (!String(l.maeCodigo || "").trim()) falta.push("código do insumo");
  if (!String(l.codigoDetalhe || "").trim()) falta.push("código do detalhe");
  if (!String(l.codigoAuxDetalhe || "").trim()) falta.push("código auxiliar do detalhe");
  if (!String(l.descricaoDetalhe || "").trim()) falta.push("descrição do detalhe");
  return falta;
}
