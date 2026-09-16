/**
 * Aditivos de obra: supressao, adicao e o saldo entre as duas.
 *
 * O modelo do documento e o mesmo da ferramenta avulsa que a Priscila ja
 * usava; o que muda aqui e' que ele deixa de viver no localStorage de um
 * navegador so e passa a ficar guardado por obra, com numero e status.
 */

/* A ordem E' o caminho do documento: nasce rascunho, vai pro cliente,
   e volta aprovado ou reprovado.

   "Aguardando cliente" e' espera, nao compromisso: ela NAO mexe no
   dinheiro, igual ao rascunho. Quem conta no Dashboard, no CMV e no
   Plano de Compras continua sendo so' o aprovado (`aditivoVale`).

   O banco tem trava nesses valores: fase nova exige
   supabase/aditivo-aguardando.sql rodado. */
export const STATUS_ADITIVO = [
  { id: "rascunho", nome: "Rascunho", cor: "var(--ink-3)" },
  { id: "aguardando", nome: "Aguardando cliente", cor: "var(--alert)" },
  { id: "aprovado", nome: "Aprovado", cor: "var(--green)" },
  { id: "reprovado", nome: "Reprovado", cor: "var(--red)" },
];

export const CONDICOES_PADRAO = "Esta proposta é válida por 10 dias.";

const uid = () => Math.random().toString(36).slice(2, 9);

/* `alocacao` nasce MAT porque aditivo e', na maioria, coisa pra comprar
   — movel, louca, eletro. Mas ela e' um campo, e nao um chute escondido:
   sem ela o valor do item cairia inteiro em mao de obra na hora de entrar
   no Plano de Compras, e o material do aditivo simplesmente nao apareceria
   pra comprar. */
/* `custo` e `espec` sao INTERNOS: nao existem no documento do cliente.
   O `valor` e' o que o cliente paga; o `custo` e' o que a empresa gasta, e
   e' ele que vai pro Plano de Compras — comprar pelo preco de venda faria
   a obra parecer gastar a margem inteira. A `espec` e' marca/modelo/medida:
   o que quem compra precisa ler e o cliente nao precisa ver. */
export const novoItem = () => ({ id: uid(), descricao: "", ambiente: "", qtd: "1,00", unidade: "un", valor: "", custo: "", espec: "", alocacao: "MAT" });
export const novoGrupo = (n) => ({ id: uid(), num: String(n), nome: "", itens: [novoItem()] });

export function novoDocumento(obra) {
  return {
    cliente: obra?.nome || "",
    proposta: obra?.codigo || "",
    data: new Date().toISOString().slice(0, 10),
    cond: CONDICOES_PADRAO,
    supressao: [novoGrupo(1)],
    adicao: [novoGrupo(1)],
  };
}

/**
 * Numero em texto -> numero.
 *
 * A VIRGULA decide quem e' decimal. "1.234,56" tem ponto de milhar;
 * "1234.56" veio do teclado numerico e o ponto e' decimal. Apagar todos
 * os pontos sem olhar transformaria 3.333,33 em 333333 — foi exatamente
 * assim que tres parcelas de um contrato de dez mil viraram um milhao.
 */
export function parseNum(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = String(v ?? "").replace(/[^\d.,-]/g, "").trim();
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/* Soma em CENTAVOS INTEIROS, e arredonda no item — que e' a linha
   impressa.

   9,60 m² x R$ 414,00 da' 3974.3999999999996 em ponto flutuante. Na tela
   isso vira "R$ 3.974,40" e ninguem ve o problema; somando cinquenta
   linhas assim, o total do documento fecha centavos diferente da soma
   das linhas que o cliente consegue conferir na mao — e a conversa sobre
   esses centavos custa mais que os centavos.

   Arredondar so no fim nao resolveria: o erro ja teria entrado por cada
   linha. E somar float arredondado tambem nao — 3974.4 nao existe exato
   em binario, e cinquenta somas dele erram de novo. Inteiro soma exato,
   e a divisao acontece uma vez so. */
const cent = (n) => Math.round(n * 100);
const centItem = (i) => cent(parseNum(i.qtd) * parseNum(i.valor));
const centGrupo = (g) => (g.itens || []).reduce((a, i) => a + centItem(i), 0);
const centSecao = (grupos) => (grupos || []).reduce((a, g) => a + centGrupo(g), 0);

export const totalItem = (i) => centItem(i) / 100;
export const totalGrupo = (g) => centGrupo(g) / 100;
export const totalSecao = (grupos) => centSecao(grupos) / 100;

export function totaisDoDocumento(doc) {
  const s = centSecao(doc?.supressao);
  const a = centSecao(doc?.adicao);
  return { supressao: s / 100, adicao: a / 100, saldo: (a - s) / 100 };
}

/* ---------- O CUSTO INTERNO ----------

   Mesma conta do total, sobre o custo: centavos inteiros, arredondado no
   item. Linha sem custo vale ZERO aqui e nao vira estimativa em lugar
   nenhum — quem ainda nao sabe o custo nao sabe, e repetir o preco de
   venda no lugar dele encheria o Plano de Compras de numero que ninguem
   conferiu. */
const centCusto = (i) => cent(parseNum(i.qtd) * parseNum(i.custo));
const centCustoGrupo = (g) => (g.itens || []).reduce((a, i) => a + centCusto(i), 0);

export const custoItem = (i) => centCusto(i) / 100;
export const custoGrupo = (g) => centCustoGrupo(g) / 100;
export const temCusto = (i) => parseNum(i.custo) > 0;

/* Linha que EXISTE no documento (tem descricao ou valor) e ainda nao tem
   custo. Ela entra no Plano de Compras como "a orcar", e o editor precisa
   dizer quantas sao — senao a pessoa so descobre na outra tela. */
function itensSemCusto(doc) {
  return (doc?.adicao || []).reduce((a, g) => a + (g.itens || []).filter(
    (i) => !temCusto(i) && (String(i.descricao || "").trim() || parseNum(i.valor) > 0),
  ).length, 0);
}

/**
 * A margem do aditivo: vendido menos custo, so' da ADICAO.
 *
 * Supressao fica de fora porque o custo do que saiu nao mora aqui — ele
 * esta na planilha do executivo. Comparar a adicao vendida com a adicao
 * comprada e' a unica conta que fecha com as duas colunas que a pessoa ve
 * escritas na tela.
 */
export function margemDoDocumento(doc) {
  const vendido = totalSecao(doc?.adicao);
  const custo = (doc?.adicao || []).reduce((a, g) => a + centCustoGrupo(g), 0) / 100;
  const margem = vendido - custo;
  return {
    vendido, custo, margem,
    pct: vendido > 0 ? (margem / vendido) * 100 : null,
    semCusto: itensSemCusto(doc),
  };
}

/* Positivo o cliente paga; negativo ele recebe de volta. Chamar os dois
   de "saldo" deixaria a linha mais importante do documento ambigua bem
   na hora em que ela e' lida. */
export function rotuloSaldo(s) {
  if (s > 0) return "Valor do aditivo";
  if (s < 0) return "Crédito gerado do aditivo";
  return "Saldo do aditivo";
}

/* ---------- A PLANILHA INTERNA ----------

   O PDF e' do cliente; esta planilha e' de dentro de casa. Por isso ela
   leva justamente o que o documento esconde: custo, margem e a
   especificacao de compra.

   Devolve MATRIZ, nao arquivo. Quem tem o XLSX na mao monta o arquivo; o
   que decide o conteudo fica aqui, onde o teste alcanca sem navegador.

   As verbas entram por funcao de fora porque quem sabe a EAP e' o App —
   a lib nao conhece (e nao deve conhecer) a tabela de verbas. */

const NOME_ALOC_PLANILHA = { MAT: "MATERIAL (MAT)", MO: "MÃO DE OBRA (MO)", AMBOS: "MAT+MO" };

export const CABECALHO_PLANILHA_ADITIVO = [
  "Seção", "Grupo", "Nome do grupo", "Verba", "Nome da verba", "Item", "Descrição",
  "Ambiente", "Qtd", "Un.", "Valor unit. (cliente)", "Total cliente (R$)",
  "Custo unit. (interno)", "Custo total (R$)", "Margem (R$)", "Margem (%)",
  "Alocação", "Especificação de compra", "No Plano de Compras",
];

/* As larguras saem do CONTEUDO, nao de um numero redondo: descricao e
   especificacao sao frases, ambiente e' uma lista de comodos, e o resto
   e' numero curto. Sem isso o Excel abre tudo com 8 caracteres e a
   descricao vira "Fechadura PADO Op###". */
const LARGURAS_ADITIVO = [11, 7, 22, 7, 24, 7, 52, 26, 9, 6, 16, 16, 16, 16, 14, 11, 18, 46, 20];

const MOEDA = '"R$" #,##0.00';
const PORCENTO = "0.0%";
const DATA_HORA = "dd/mm/yyyy hh:mm";

/* Texto vira Date so' quando da': celula de data com lixo dentro mostra
   "Invalid Date" no Excel, que e' pior que a data em branco.

   E dia sozinho ("2026-09-14") vira MEIO-DIA local, nao meia-noite: em
   UTC a meia-noite do dia 14 e' 21h do dia 13 no Brasil, e a planilha
   mostrava 13/09 onde a pessoa escreveu 14/09. Num papel sobre dinheiro,
   um dia a menos e' erro de documento, nao detalhe. */
const comoData = (v) => {
  if (!v) return "";
  if (v instanceof Date) return isNaN(v.getTime()) ? "" : v;
  const texto = String(v);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(texto) ? new Date(`${texto}T12:00:00`) : new Date(texto);
  return isNaN(d.getTime()) ? "" : d;
};

const dataBRcurta = (d) => (d instanceof Date
  ? d.toLocaleDateString("pt-BR")
  : String(d || "").slice(0, 10).split("-").reverse().join("/"));

/**
 * O aditivo em forma de planilha, folha a folha.
 *
 * Devolve FOLHAS DESCRITAS (linhas, larguras, mesclagens, formatos), e
 * nao arquivo: quem tem o XLSX na mao monta o arquivo, e o que decide o
 * conteudo — e o layout — fica aqui, onde o teste alcanca sem navegador.
 *
 * As verbas entram por funcao de fora porque quem conhece a EAP e' o App.
 */
export function planilhaDoAditivo(aditivo, doc, { verbaDoGrupo = () => null, nomeDaVerba = () => "", agora = new Date() } = {}) {
  const d = doc || aditivo?.doc || {};
  const t = totaisDoDocumento(d);
  const m = margemDoDocumento(d);
  const nCols = CABECALHO_PLANILHA_ADITIVO.length;
  const vazia = new Array(nCols).fill("");

  const cabecalho = [
    [`Aditivo ${aditivo?.numero || ""}${aditivo?.descricao ? ` · ${aditivo.descricao}` : ""}`],
    [`${d.cliente || ""}${d.data ? ` · documento de ${dataBRcurta(d.data)}` : ""}${aditivo?.status ? ` · ${aditivo.status}` : ""}`],
    ["Uso interno — custo, margem e especificação de compra não saem no PDF do cliente."],
    [],
  ];
  const linhas = [...cabecalho, [...CABECALHO_PLANILHA_ADITIVO]];
  const linhaDoCabecalho = linhas.length - 1;
  /* Que papel cada linha faz. O estilo sai DAQUI, e nao de uma regra
     escrita dentro do App: assim o negrito do subtotal e' conferido no
     teste junto com a soma que ele mostra. */
  const subtotais = [];

  /* Uma secao por vez, e um subtotal no fim de cada uma. O subtotal e' o
     que faz a folha ser conferivel: quem abre soma a coluna e tem que
     bater com o rodape do documento. */
  const secao = (chave, rotulo) => {
    const ehAdicao = chave === "adicao";
    const itens = [];
    (d[chave] || []).forEach((g) => {
      const verba = verbaDoGrupo(g);
      (g.itens || []).forEach((it, k) => {
        const descricao = String(it.descricao || "").trim();
        const venda = totalItem(it);
        if (!descricao && venda <= 0) return;
        /* Custo e margem SO' na adicao. Supressao e' escopo que saiu: o
           custo do que saiu vive na planilha do executivo, e zero aqui
           pareceria "custou nada", que e' outra coisa. */
        const orcado = ehAdicao && temCusto(it);
        const gasto = orcado ? custoItem(it) : null;
        itens.push([
          rotulo, g.num || "", g.nome || "", verba || "", verba ? nomeDaVerba(verba) : "",
          `${g.num || ""}.${k + 1}`, descricao, it.ambiente || "",
          parseNum(it.qtd), it.unidade || "", parseNum(it.valor), venda,
          orcado ? parseNum(it.custo) : "",
          orcado ? gasto : "",
          orcado ? venda - gasto : "",
          // FRACAO, e nao 30.47: o formato de porcentagem do Excel
          // multiplica por cem sozinho. Guardar 30.47 mostraria 3047%.
          orcado && venda > 0 ? (venda - gasto) / venda : "",
          NOME_ALOC_PLANILHA[it.alocacao] || it.alocacao || "",
          ehAdicao ? String(it.espec || "").trim() : "",
          !ehAdicao ? "não vira linha"
            : !verba ? "sem verba — não entra"
            : orcado ? "entra com o custo" : "entra como a orçar",
        ]);
      });
    });
    if (!itens.length) return;
    /* A linha em branco SEPARA as secoes, e so' entra quando ja ha algo
       em cima. Sobrando no fim, o filtro do cabecalho levaria junto uma
       linha vazia. */
    if (linhas.length > linhaDoCabecalho + 1) linhas.push([...vazia]);
    linhas.push(...itens);
    const soma = (col) => itens.reduce((a, L) => a + (typeof L[col] === "number" ? L[col] : 0), 0);
    const total = [...vazia];
    total[6] = `Total ${rotulo.toLowerCase()}`;
    total[11] = soma(11);
    if (ehAdicao) { total[13] = soma(13); total[14] = soma(14); }
    subtotais.push(linhas.length);
    linhas.push(total);
  };

  secao("supressao", "Supressão");
  secao("adicao", "Adição");

  const folhaItens = {
    nome: "Aditivo",
    linhas,
    larguras: LARGURAS_ADITIVO,
    // O titulo ocupa a folha inteira; as tres primeiras linhas sao o cabecalho.
    mesclagens: cabecalho.slice(0, 3).map((_, i) => ({ linha: i, de: 0, ate: nCols - 1 })),
    alturas: [{ linha: 0, altura: 22 }],
    filtro: linhas.length > linhaDoCabecalho + 1
      ? { linha: linhaDoCabecalho, de: 0, ate: nCols - 1, ultima: linhas.length - 1 } : null,
    papeis: {
      titulo: 0,
      apoio: [1, 2],
      cabecalho: linhaDoCabecalho,
      subtotais,
      // Frase longa quebra dentro da celula; numero e codigo, nao.
      quebraLinha: [2, 4, 6, 7, 17, 18],
      congelarAte: linhaDoCabecalho,
    },
    formatos: [
      ...[10, 11, 12, 13, 14].map((c) => ({ coluna: c, z: MOEDA, de: linhaDoCabecalho + 1 })),
      { coluna: 15, z: PORCENTO, de: linhaDoCabecalho + 1 },
    ],
  };

  /* A folha do resumo e' de leitura, nao de conta: duas colunas, rotulo e
     valor, com o dinheiro formatado onde e' dinheiro. */
  const res = [];
  const fmtRes = [];
  const por = (rotulo, valor, z) => { res.push([rotulo, valor]); if (z) fmtRes.push({ linha: res.length - 1, coluna: 1, z }); };
  const respiro = () => res.push([]);

  res.push([`Resumo do aditivo ${aditivo?.numero || ""}`], []);
  por("Obra (centro de custo)", aditivo?.obraCodigo || "");
  por("Do que se trata", aditivo?.descricao || "");
  por("Status", aditivo?.status || "");
  por("Cliente / obra", d.cliente || "");
  por("Nº da proposta", d.proposta || "");
  por("Data do documento", comoData(d.data), "dd/mm/yyyy");
  respiro();
  por("Total supressão", t.supressao, MOEDA);
  por("Total adição", t.adicao, MOEDA);
  por(rotuloSaldo(t.saldo), t.saldo, MOEDA);
  respiro();
  por("Custo da adição", m.custo, MOEDA);
  // A mesma regra da tela: sem custo nenhum nao existe margem — "100%"
  // seria uma mentira bonita dentro de uma planilha que alguem vai usar.
  por("Margem da adição", m.custo > 0 ? m.margem : "", m.custo > 0 ? MOEDA : null);
  por("Margem da adição (%)", m.custo > 0 && m.pct != null ? m.pct / 100 : "", m.custo > 0 ? PORCENTO : null);
  por("Linhas de adição sem custo", m.semCusto);
  respiro();
  por("Condições de pagamento", d.cond || "");
  por("Observação interna", d.observacao || "");
  por("Pipefy", d.pipefy?.em ? `enviado em ${dataBRcurta(comoData(d.pipefy.em))}` : "pendente");
  respiro();
  por("Criado em", comoData(aditivo?.criadoEm), DATA_HORA);
  por("Criado por", aditivo?.criadoPor || "");
  por("Atualizado em", comoData(aditivo?.atualizadoEm), DATA_HORA);
  por("Atualizado por", aditivo?.atualizadoPor || "");
  respiro();
  por("Planilha gerada em", comoData(agora), DATA_HORA);

  const folhaResumo = {
    nome: "Resumo",
    linhas: res,
    larguras: [30, 54],
    mesclagens: [{ linha: 0, de: 0, ate: 1 }],
    alturas: [{ linha: 0, altura: 22 }],
    filtro: null,
    formatos: fmtRes,
    papeis: { titulo: 0, apoio: [], cabecalho: null, subtotais: [], colunaRotulo: 0, quebraLinha: [1] },
  };

  return { folhas: [folhaItens, folhaResumo] };
}

/* O numero que a obra ve: centro de custo + sequencia. */
export const numeroAditivo = (codigo, seq) => `${codigo}/${seq}`;

/* Proxima sequencia = maior ja usada + 1, e nao "quantidade + 1".
   Aditivo excluido abre um buraco na contagem, e reaproveitar o numero
   dele criaria dois documentos diferentes com o mesmo "2405/3" — um deles
   ja na mao do cliente. */
export function proximaSeq(existentes) {
  const maior = (existentes || []).reduce((a, x) => Math.max(a, Number(x.seq) || 0), 0);
  return maior + 1;
}

/* ---------- A solicitacao de contrato no Pipefy ----------

   Aditivo aprovado obriga abrir a "Solicitacao de contrato" no Pipefy. O
   app NAO envia sozinho, por dois motivos que nao se resolvem com codigo:

   1. O formulario tem captcha. Passar por cima dele nao esta em questao.
   2. Metade dos campos obrigatorios o app nao sabe e nao tem como saber —
      closer, hunter, indicador, Neolix, parcelamento, forma e data de
      pagamento — e ainda ha dois anexos obrigatorios. Um envio automatico
      com esses campos chutados criaria um card errado no fluxo comercial,
      que e' pior que card nenhum.

   O que da' pra fazer, e que resolve a parte chata: abrir o formulario ja
   com o tipo marcado e o valor preenchido, e nao deixar esquecer que ele
   existe. */
export const PIPEFY_FORM = "https://app.pipefy.com/public/form/9dreYs1N";

/* Os nomes de campo sao os do proprio formulario — conferidos na pagina.
   Se o time mexer no formulario, o link continua abrindo; ele so deixa de
   preencher, que e' a falha certa pra esse tipo de ligacao. */
export function linkPipefy(saldo) {
  const q = new URLSearchParams({ parab_ns_pelo_fechamento_o_que_fechado: "Aditivo" });
  /* Saldo negativo e' credito pro cliente, e o campo do Pipefy e' "valor
     fechado" — mandar numero negativo ali confundiria o comercial. Nesse
     caso o campo vai vazio e a pessoa decide o que escrever. */
  if (saldo > 0) q.set("qual_o_valor_fechado", String(Math.round(saldo * 100) / 100));
  return `${PIPEFY_FORM}?${q}`;
}

/* Aprovado sem o Pipefy aberto e' pendencia. Rascunho e reprovado nao
   viram card nenhum, entao nao cobram nada. */
export const pipefyPendente = (a) => a?.status === "aprovado" && !a?.doc?.pipefy?.em;
