/**
 * Backend do Confere — API do Monday.com + leitura de PDFs.
 * -----------------------------------------------------------
 * Fonte única, usada em dois lugares:
 *  - Produção (Vercel): web/api/index.js reexporta este app como
 *    função serverless — roda no mesmo domínio do frontend, sob /api/*.
 *  - Dev local: monday-proxy/server.js importa este mesmo arquivo e
 *    chama .listen() nele — é o que o proxy do Vite aponta em dev.
 *
 * Por que existe: o frontend roda no navegador, então qualquer token
 * ali fica visível pra quem inspecionar a página. Esse app guarda o
 * token do Monday como variável de ambiente (nunca no código) e expõe
 * só o que o Confere precisa.
 */

const express = require("express");
const cors = require("cors");
const { publicError } = require("./publicError.js");
const {
  exigirLogin, exigirMembro, exigirPerfilDeEdicao, exigirObra, exigirEdicaoDeObra, podeAcessarObra,
} = require("./auth.js");
const { zValidator, validarPdf, esquemas, z, LIMITE_PDF_BYTES, LIMITE_PDF_BASE64, PAGINAS_MAX } = require("./validacao.js");

// Importa o miolo do pdf-parse em vez do index.js. O index tem um
// bloco "modo debug" que dispara quando `module.parent` é vazio: ele
// tenta ler um PDF de teste que não é publicado junto, e esse erro
// derruba o arquivo inteiro no carregamento. Localmente `module.parent`
// existe e o bloco dorme; no empacotamento da Vercel, não — daí todas
// as rotas quebravam, até as que não têm nada a ver com PDF.
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

const app = express();
// O cabecalho "X-Powered-By: Express" so' ajuda quem procura falha conhecida.
app.disable("x-powered-by");

/* Quem pode chamar este backend, de qual endereco.
   `cors()` puro liberava QUALQUER site do mundo a chamar estas rotas com
   o token do Monday e a credencial do Sienge do servidor. A lista vem do
   ambiente (ALLOWED_ORIGINS, separada por virgula) porque dominio de
   producao nao se escreve em codigo. Em dev, localhost entra sozinho.
   Regra: .quality/regras/03-seguranca-e-acesso.md (SEG-36). */
const ORIGENS_PERMITIDAS = [
  ...String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  ...(process.env.NODE_ENV === "production"
    ? []
    : ["http://localhost:5173", "http://127.0.0.1:5173"]),
];

app.use(
  cors({
    origin(origin, cb) {
      // Sem Origin = mesma origem ou chamada fora do navegador (curl, Vercel
      // servindo /api no proprio dominio). Quem barra esses e' o login.
      if (!origin) return cb(null, true);
      cb(null, ORIGENS_PERMITIDAS.includes(origin));
    },
  })
);

/* Daqui pra baixo, tudo exige usuario logado E do time (perfil ativo).
   Vem ANTES das rotas de proposito: rota nova nasce protegida, sem
   ninguem precisar lembrar. */
app.use(exigirLogin);
app.use(exigirMembro);

/* JSON em todas as rotas, com limite — menos na leitura de PDF do Sienge,
   que tem o proprio leitor com o limite do arquivo em base64. Antes o
   leitor global (100 KB) rodava primeiro e recusava o base64 de qualquer
   PDF acima de ~75 KB, antes de a rota ter a chance de ler. */
const jsonPadrao = express.json({ limit: "1mb" });
app.use((req, res, next) => (req.path === "/api/sienge/texto" ? next() : jsonPadrao(req, res, next)));

/* As rotas de DADOS do app moram em _lib/rotas/, uma por assunto, cada uma
   com o proprio exigirLogin (que nao repete a verificacao feita acima). */
const { rotasDePreferencias } = require("./rotas/preferencias.js");
app.use(rotasDePreferencias);

const MONDAY_API_URL = "https://api.monday.com/v2";

function mondayToken() {
  return process.env.MONDAY_API_TOKEN;
}

// Cache em memória com TTL. A listagem de obras não muda a cada
// segundo — guardar a resposta por alguns segundos evita martelar a
// API do Monday (que tem orçamento de complexidade/rate-limit) e faz
// recarregar a página ficar instantâneo. Em serverless (Vercel), esse
// cache vale só enquanto a mesma instância da função estiver quente —
// não é garantido entre chamadas, mas ajuda quando acontece.
const CACHE_TTL_MS = 60_000;
const cache = new Map(); // chave -> { expira, data }

async function mondayQuery(query, variables = {}) {
  const token = mondayToken();
  if (!token) throw new Error("MONDAY_API_TOKEN não configurado no ambiente.");

  const chave = JSON.stringify({ query, variables });
  const hit = cache.get(chave);
  if (hit && hit.expira > Date.now()) return hit.data;

  const res = await fetch(MONDAY_API_URL, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      "API-Version": "2024-10",
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    const msg = json.errors.map((e) => e.message).join("; ");
    throw new Error(`Monday API error: ${msg}`);
  }
  cache.set(chave, { expira: Date.now() + CACHE_TTL_MS, data: json.data });
  return json.data;
}

/* As obras do Monday, squad por squad.
 *
 * Esta e' a UNICA rota do Monday que o app usa (a lista de obras de cada
 * squad, na barra lateral). As rotas de "descoberta" que existiam aqui —
 * /boards, /columns, /obras, /workspaces e o modo ?full=1&debug=1 desta
 * mesma rota — serviram pra achar os IDs quando a integracao nasceu, e
 * depois ficaram abertas a qualquer pessoa logada: com elas dava pra ler
 * a conta INTEIRA do Monday (todo board, toda coluna) com o token do
 * servidor, e o ?full=1 montava regex com texto vindo da URL. Saem todas.
 * Precisando descobrir ID de novo, a propria interface do Monday mostra. */

/* Os workspaces de cada squad — os mesmos de SQUADS em web/src/App.jsx
   (o teste api-autorizacao confere que as duas listas batem). Fora destes,
   a rota recusa: nao e' porta pra listar qualquer workspace da conta. */
const WORKSPACES_DOS_SQUADS = new Set(["13339794", "14451479", "13339790"]);

const queryObrasExecucao = z.object({
  workspaceId: z.string().refine((id) => WORKSPACES_DOS_SQUADS.has(id)),
}).strict();

/**
 * GET /api/monday/obras-execucao?workspaceId=13339790
 *
 * Cada board dentro do workspace é uma obra (ex: "2281 - TKWS"). Devolve
 * a listagem ENXUTA (id + código + nome dos boards): é o que a sidebar
 * precisa e tem complexidade mínima na API do Monday (rápido).
 */
app.get("/api/monday/obras-execucao", zValidator("query", queryObrasExecucao), async (req, res) => {
  const { workspaceId } = req.valido.query;
  try {
    // Boards "Subelementos de ..." são metadados internos do Monday (subitens),
    // não são obras — ficam de fora da listagem.
    const isSubelementos = (nome) => /^subelementos de/i.test(nome);
    // separa "2256 - Ed.Bliss Campus" em código + nome
    const parseNome = (fullName) => {
      const m = fullName.match(/^\s*(\d{3,})\s*[-–]\s*(.+)$/);
      return { codigo: m ? m[1] : null, nome: m ? m[2].trim() : fullName };
    };

    const data = await mondayQuery(
      `query ($workspaceIds: [ID]) {
        boards(workspace_ids: $workspaceIds, limit: 200) { id name }
      }`,
      { workspaceIds: [workspaceId] }
    );
    const obras = data.boards
      .filter((b) => !isSubelementos(b.name))
      .map((b) => ({ boardId: b.id, ...parseNome(b.name), obra: b.name }));
    res.json(obras);
  } catch (err) {
    publicError(res, err);
  }
});

/* ============================================================
 * LEITURA DO VENDIDO EM PDF
 * A proposta padrão (Group WS) vira texto e é varrida linha a linha:
 * verba = número (1..19) + NOME EM CAIXA + valor R$; item = código
 * "N.M" + descrição (pode quebrar em 2 linhas) + quantidade/unidade
 * (grudadas, ex "…RRT1,00vb0") + ambiente.
 * ============================================================ */

function parseBRLnum(s) {
  const n = Number(String(s).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
  return isFinite(n) ? n : null;
}

// remove resíduo de valores/coluna que vazou pro fim da descrição (ex:
// item sem custo real, onde a linha de "-R$ -R$ -R$" acaba grudando).
//
// Só a CAUDA passa pela regex: ancorada no fim, ela recomeça a busca em
// cada posição do texto, e numa linha de 1 MB (PDF montado pra isso) o
// custo virava minutos de CPU. O resíduo mora nos últimos caracteres.
const CAUDA_DA_DESCRICAO = 400;
function limparDescResidual(desc) {
  const s = String(desc || "");
  const corte = Math.max(0, s.length - CAUDA_DA_DESCRICAO);
  const cauda = s.slice(corte).replace(/\s*[\d.,\-]*\s*R\$[\sR$\d.,\-]*$/i, "");
  return (s.slice(0, corte) + cauda).trim();
}

function parseVendidoTexto(texto) {
  const linhas = texto.split("\n").map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim() !== "");
  const reItem = /^(\d{1,2}\.\d+)/;
  // 1..99. Era 1..19, o tamanho da EAP antiga — com o padrao de 32 grupos
  // da empresa, tudo de 20 a 32 (Climatizacao, Moveis, Estofados, Pedras,
  // Loucas, Execucao) deixava de ser reconhecido como linha de grupo, e os
  // itens abaixo grudavam no grupo anterior. Vai ate 99 de proposito: quem
  // decide se o grupo existe e o NOME, na linha seguinte, nao este numero.
  const reVerba = /^([1-9][0-9]?)$/;
  // sem \b no final: a unidade costuma vir colada a um dígito de
  // placeholder de coluna (ex: "1,00vb0") — \b falha entre "b" e "0"
  // (os dois são caracteres de "palavra"). "und" antes de "un" pra não
  // truncar a unidade errada quando as duas casam no mesmo ponto.
  const reQtdUn = /(\d{1,4}(?:\.\d{3})*,\d{2})\s*(vb|und|un|m²|m2|pç|pc|kg|cj|par|vg)/i;
  // MESMO padrao, exigindo fronteira antes do numero.
  //
  // O extrator cola colunas vizinhas: "...Dicroica PAR16" + "4,00" vira
  // "...Dicroica PAR164,00". Sem fronteira, a regex casa "164,00" — leva o
  // "16" do PAR16 junto, sobra "PAR" na descricao, e a obra passa a
  // comprar 164 spots em vez de 4. Erro de 40x, invisivel.
  //
  // Com fronteira o numero grudado nao casa. Nesse caso o parser tenta o
  // padrao solto, mas marca a leitura como duvidosa em vez de aceitar
  // calado — nao da pra saber se "PAR164,00" e PAR16+4,00, PAR1+64,00 ou
  // PAR+164,00, e chutar e o que causou o erro.
  // Grudada: no maximo 2 digitos antes da virgula, pra pegar a leitura
  // mais curta possivel. Ver o bloco que a usa.

  /* Codigos de especificacao que TERMINAM em digito.
     
     Sao a unica familia em que a leitura longa erra: "PAR16" + "4,00"
     cola em "PAR164,00" e vira 164. Nos outros casos o que precede a
     quantidade termina em letra ("7W", "Inox", "cromado") e a leitura
     longa acerta sozinha.
     
     Isto NAO e lista de produto — e designacao tecnica de base e soquete,
     padrao da industria: PAR16/20/30/38 sao refletores, GU10 e MR16 sao
     soquetes, E27 e rosca. Nao muda de obra pra obra, do mesmo jeito que o
     nome do grupo da EAP nao muda. Por isso da pra codificar. */
  const reCodigoTecnico = /(PAR\s?1[46]|PAR\s?20|PAR\s?30|PAR\s?38|GU\s?10|MR\s?16|AR\s?111|E\s?27|E\s?14|T\s?[58])(\d{1,4}(?:\.\d{3})*,\d{2})\s*(vb|und|un|m²|m2|pç|pc|kg|cj|par|vg)/i;
  const reQtdUnComFronteira = /(?:^|[\s;:(\-–—])(\d{1,4}(?:\.\d{3})*,\d{2})\s*(vb|und|un|m²|m2|pç|pc|kg|cj|par|vg)/i;

  const verbas = [];
  const itens = [];
  // Prestacao de contas da leitura. Sem isto, um item perdido no meio do
  // PDF nao deixa rastro nenhum — o import diz "importado" e o numero que
  // faltou so aparece semanas depois, na conferencia.
  const diagnostico = { linhasNoPdf: linhas.length, semQtd: [], semDescricao: [], itensForaDeVerba: [], qtdDuvidosa: [] };
  let i = 0;
  while (i < linhas.length && !/Descri[çc][aã]o/i.test(linhas[i])) i++;
  i++;
  let vAtual = null;
  while (i < linhas.length) {
    const t = linhas[i].trim();
    if (reVerba.test(t)) {
      const num = t.padStart(2, "0");
      const nome = (linhas[i + 1] || "").trim();
      /* Procura o valor da verba nas linhas seguintes — mas SO avanca se
         achar.

         Antes o `k` do laco era usado como ponto de retomada mesmo quando
         nenhum R$ aparecia: sem valor, o laco ia ate i+4 e o parser
         recomecava dali, ENGOLINDO ate tres linhas. Num contrato fechado
         por verba, que nao tem cifrao nenhum (o da 2506 nao tem um), isso
         comia os primeiros itens de cada grupo em silencio.

         Agora o ponto de retomada e a linha do nome; so pula alem dela
         quando o valor foi mesmo encontrado. */
      let valor = null;
      let k = i + 2;               // retomada padrao: logo depois do nome
      for (let j = i + 2; j <= i + 4 && j < linhas.length; j++) {
        if (/R\$/.test(linhas[j])) {
          const ns = (linhas[j].match(/[\d.]+,\d{2}/g) || []).map(parseBRLnum).filter((x) => x != null);
          if (ns.length) valor = Math.max(...ns);
          k = j + 1;
          break;
        }
      }
      vAtual = num;
      verbas.push({ num, nome, valor });
      i = k; // avança de vez para depois da linha do valor (não um deslocamento fixo)
      continue;
    }
    const mi = linhas[i].match(reItem);
    if (mi) {
      const codigo = mi[1];
      let resto = linhas[i].slice(mi[1].length);
      let j = i + 1;
      // linhas só numéricas (índice de linha, placeholder de coluna vazia
      // tipo "0" ou "0,000") são ruído de layout, não descrição — pula.
      const reLinhaSoNumero = /^\d+([.,]\d+)*$/;
      // marcadores do rodapé da proposta (condições de pagamento etc) —
      // o ÚLTIMO item do PDF não tem próximo item/verba pra parar, então
      // sem isso ele "engole" o rodapé inteiro dentro da descrição.
      const reRodape = /^(condi[çc][ãa]?[oõ]es de pagamento|observa[çc][oõ]es importantes|total turnkey|esta proposta [ée] v[áa]lida)/i;
      // Trava de seguranca caso o rodape nao use os marcadores acima.
      // Era 10 — e descricao de marcenaria passa disso com folga (as do
      // 2519 tem 8 e 9 linhas). Ao estourar o limite, o laco parava ANTES
      // de chegar na quantidade, que vem depois da descricao: o item
      // entrava sem quantidade e sem ambiente, e o grupo inteiro aparecia
      // como "nao vendido". Os marcadores de rodape e a proxima linha de
      // item/verba ja param o laco; este numero e so a rede.
      const jLimite = j + 60;
      while (!reQtdUn.test(resto) && j < linhas.length && j < jLimite && !reItem.test(linhas[j]) && !reVerba.test(linhas[j].trim())) {
        const lt = linhas[j].trim();
        if (reRodape.test(lt)) break;
        if (reLinhaSoNumero.test(lt)) { j++; continue; }
        resto += (resto ? " " : "") + lt;
        j++;
      }
      let qtd = null, un = null, amb = null, custo = null, qtdDuvidosa = false;
      // Fronteira primeiro. So cai no padrao solto se o limpo nao achar —
      // e ai a leitura vai marcada.
      let mq = resto.match(reQtdUnComFronteira);
      if (mq) {
        // o grupo 1 do padrao com fronteira ja e o numero; alinha os
        // indices pra reaproveitar o mesmo tratamento abaixo
        mq = { 0: mq[0].replace(/^[\s;:(\-–—]/, ""), 1: mq[1], 2: mq[2],
               index: mq.index + (mq[0].length - mq[0].replace(/^[\s;:(\-–—]/, "").length) };
      } else {
        /* Grudado na descricao pelo extrator. E AMBIGUO, sem solucao no
           texto — a diferenca entre os casos e semantica:

             "...recuado 7W" + "12,00"     -> "...recuado 7W12,00"
             "...Dicroica PAR16" + "4,00"  -> "...Dicroica PAR164,00"

           Os dois tem a mesma forma (letras, digitos, quantidade colada).
           No primeiro "7W" e potencia e a quantidade e 12; no segundo o
           "16" e do modelo PAR16 e a quantidade e 4. Nenhuma regra de
           texto separa isso.

           Entao vale a leitura mais LONGA — todos os digitos ate o
           caractere nao-numerico anterior. Medido contra os casos reais
           da 2519 ela acerta 3 de 4, contra 1 de 4 da leitura curta, que
           chegou a devolver quantidade 0 em "cromado10,00" (leu "0,00").

           Os que ela erra vao marcados como duvidosos: aparecem no aviso
           de importacao com o codigo, e a celula e editavel na tela. */
        // Codigo tecnico terminando em digito vem primeiro: e o unico
        // jeito de saber que o "16" de PAR16 nao e quantidade.
        const mc = resto.match(reCodigoTecnico);
        if (mc) {
          mq = { 0: mc[2] + (mc[0].endsWith(mc[3]) ? mc[3] : ""), 1: mc[2], 2: mc[3],
                 index: mc.index + mc[1].length };
        } else {
          mq = resto.match(reQtdUn);
          if (mq) qtdDuvidosa = true;
        }
      }
      if (mq) {
        qtd = parseBRLnum(mq[1]);
        un = mq[2];
        amb = resto.slice(mq.index + mq[0].length).replace(/^\s*0?\s*/, "").trim() || null;
        resto = resto.slice(0, mq.index).trim();
        // alguns modelos "elaborados" trazem um valor R$ colado depois do
        // ambiente (ex: "...Living2.519,00R$") — captura como custo, se houver.
        if (amb) {
          const mc = amb.match(/([\d.]+,\d{2})\s*R\$|R\$\s*([\d.]+,\d{2})/);
          if (mc) {
            custo = parseBRLnum(mc[1] || mc[2]);
            amb = (amb.slice(0, mc.index) + amb.slice(mc.index + mc[0].length)).trim() || null;
          }
        }
      }
      // O ambiente pode continuar nas linhas seguintes.
      //
      // O laco acima para no instante em que quantidade+unidade aparecem,
      // e no PDF o ambiente vem DEPOIS disso — numa celula que quebra em
      // varias linhas quando o texto e longo ("Living, Circulacao, Suite
      // 02"). O que caia na mesma linha da unidade era capturado por
      // acaso; o resto nunca era lido, e o item ficava sem ambiente.
      //
      // Guardas para nao engolir o proximo item: para no codigo do
      // proximo item, em linha de verba, no rodape, e em linha longa —
      // ambiente e curto, descricao nao.
      if (mq) {
        const partes = amb ? [amb] : [];
        const MAX_LINHAS_AMB = 3, MAX_CHARS_AMB = 60;
        while (j < linhas.length && partes.length < MAX_LINHAS_AMB) {
          const lt = linhas[j].trim();
          if (!lt) { j++; continue; }
          if (reItem.test(linhas[j]) || reVerba.test(lt) || reRodape.test(lt)) break;
          if (reQtdUn.test(lt)) break;              // ja e o proximo item
          // Linha so com numero e ruido de layout ANTES do ambiente comecar.
          // Depois que ele comecou, e continuacao: "Suite Master, Suite" /
          // "01" e uma celula quebrada, e descartar o "01" muda o ambiente.
          if (reLinhaSoNumero.test(lt)) {
            if (partes.length === 0 || lt.length > 4) { j++; continue; }
          }
          if (lt.length > MAX_CHARS_AMB) break;     // isso e descricao, nao ambiente
          partes.push(lt);
          j++;
        }
        if (partes.length) amb = partes.join(" ").replace(/\s+/g, " ").trim() || null;
      }

      resto = limparDescResidual(resto.replace(/\s*0$/, "").trim());
      if (resto) {
        itens.push({ verba: vAtual, codigo, desc: resto, qtd, un, ambiente: amb, custo, qtdColada: qtdDuvidosa });
        if (qtd == null) diagnostico.semQtd.push(codigo);
        if (qtdDuvidosa) diagnostico.qtdDuvidosa.push(codigo);
        if (!vAtual) diagnostico.itensForaDeVerba.push(codigo);
      } else {
        // linha com cara de item que nao produziu descricao nenhuma
        diagnostico.semDescricao.push(codigo);
      }
      i = j;
      continue;
    }
    i++;
  }
  /* RELEITURA — segunda passada por cima do que ja foi lido.
     A primeira passada le; esta desconfia. Todo erro que ja apareceu aqui
     tinha a mesma cara: o numero PARECIA legitimo, entao ninguem revisava.
     164 spots no lugar de 4 so foi notado porque a Priscila conhecia o
     item. Estes testes existem pra que o proximo nao dependa disso. */
  const suspeitas = [];
  const qtds = itens.map((it) => it.qtd).filter((q) => q != null && q > 0);
  const mediana = qtds.length ? [...qtds].sort((a, b) => a - b)[Math.floor(qtds.length / 2)] : null;

  itens.forEach((it) => {
    // Descricao terminando em letra+digito e a assinatura do numero
    // arrancado do meio do texto ("...PAR" era "...PAR16").
    if (it.qtd != null && /[A-Za-z]$/.test(it.desc) && /\d/.test(it.desc.slice(-6))) {
      suspeitas.push({ codigo: it.codigo, motivo: "descricao pode ter perdido digitos para a quantidade" });
    }
    // Quantidade muito fora da curva do proprio documento.
    if (mediana != null && it.qtd != null && it.qtd > Math.max(50, mediana * 30)) {
      suspeitas.push({ codigo: it.codigo, motivo: `quantidade ${it.qtd} muito acima do resto do documento` });
    }
    // Descricao curta demais pra ser descricao de item.
    if (it.desc && it.desc.trim().length < 8) {
      suspeitas.push({ codigo: it.codigo, motivo: "descricao curta demais — pode ter sido cortada" });
    }
  });
  diagnostico.suspeitas = suspeitas;

  diagnostico.verbas = verbas.length;
  diagnostico.itens = itens.length;
  return { verbas, itens, diagnostico };
}

/**
 * POST /api/vendido/parse
 * Corpo = o arquivo PDF do Vendido (application/pdf). Devolve
 * { verbas: [{num, nome, valor}], itens: [{verba, codigo, desc, qtd, un, ambiente}] }.
 */
/* Os leitores de PDF servem a quem importa planilha — quem edita obra.
   O corpo e' o arquivo cru: o que se confere e' tipo, tamanho e a
   assinatura %PDF- (validarPdf), e o leitor para em PAGINAS_MAX. */
const pdfCru = express.raw({ type: "*/*", limit: LIMITE_PDF_BYTES });
const lerPdf = (buf) => pdfParse(buf, { max: PAGINAS_MAX });

// gate-allow VH-06: o corpo é o PDF binário, conferido por validarPdf (tipo, tamanho e assinatura %PDF-)
app.post("/api/vendido/parse", exigirPerfilDeEdicao, pdfCru, validarPdf, async (req, res) => {
  try {
    const data = await lerPdf(req.pdf);
    const resultado = parseVendidoTexto(data.text);
    res.json({ paginas: data.numpages, ...resultado });
  } catch (err) {
    publicError(res, err, { message: "Não foi possível ler o PDF. Confira o arquivo e tente novamente." });
  }
});

/* Texto cru do PDF do Sienge (solicitacao de compra ou pedido).
 *
 * Aqui o servidor so EXTRAI; quem interpreta e o cliente
 * (src/lib/siengePedido.js). E de proposito: o formato do Sienge ainda
 * vai mudar quando entrar a API, e manter a leitura no front deixa o
 * ajuste num arquivo so, sem redeploy de funcao serverless.
 *
 * pdf-parse ja esta aqui pro Vendido — nao entra dependencia nova. */
/* "bad XRef entry" e' a tabela interna do PDF corrompida — costuma vir de
   arquivo montado por sistema (o proprio Sienge, ERPs) ou salvo pela
   metade. A mensagem crua nao diz nada pra quem esta usando, e o
   caminho de saida existe e e' simples: reabrir e salvar de novo
   reconstroi essa tabela.

   Traduzir erro tecnico nao e' enfeite: sem isso a pessoa acha que o
   arquivo dela nao serve e desiste. */
function erroDePDF(error) {
  const m = String(error?.message || "");
  if (/xref|invalid pdf structure|startxref|corrupt/i.test(m)) {
    return "Este PDF está com a estrutura interna danificada (comum em arquivo gerado por sistema). " +
      "Abra ele e salve de novo — no Mac, Visualizar > Arquivo > Exportar como PDF; no navegador, Imprimir > Salvar como PDF. " +
      "Isso reconstrói o arquivo e costuma resolver. Se o relatório tiver versão em Excel, ela é mais confiável.";
  }
  if (/password|encrypt/i.test(m)) return "Este PDF está protegido por senha — remova a proteção e tente de novo.";
  return "Não foi possível ler o PDF. Confira o arquivo e tente novamente.";
}

/* Aceita o PDF de dois jeitos: cru, e em base64 dentro de JSON.
 *
 * O caminho cru e' o eficiente e funciona pra quase tudo. Mas a Vercel
 * mexe no corpo binario de alguns arquivos — a cotacao da Macrosul, 5,9
 * KB e quase toda ASCII, chegava corrompida e o pdfjs acusava "bad XRef
 * entry". O MESMO arquivo, no MESMO codigo, passa por HTTP local.
 *
 * Base64 atravessa qualquer coisa que trate o corpo como texto, ao custo
 * de 33% a mais de bytes. Por isso ele e' a SEGUNDA tentativa, e nao a
 * primeira: arquivo grande continua indo cru. */
function pdfDoCorpo(req, res, next) {
  if (Buffer.isBuffer(req.body)) {
    req.pdf = req.body;
    // Veio cru: se nao passar na conferencia, o front ainda tenta em base64.
    req.extraDoErroPdf = { podeBase64: true };
    return next();
  }
  // O JSON so' pode ser { pdfBase64 } — schema do contrato, e nada alem.
  return zValidator("json", esquemas.pdfEmBase64)(req, res, () => {
    req.pdf = Buffer.from(req.valido.json.pdfBase64, "base64");
    next();
  });
}

// gate-allow VH-06: o corpo é o PDF (binário ou base64); o JSON passa pelo zValidator em pdfDoCorpo e o arquivo por validarPdf
app.post("/api/sienge/texto",
  exigirPerfilDeEdicao,
  // O base64 do maior PDF aceito, com folga para o envelope JSON.
  express.json({ limit: LIMITE_PDF_BASE64 + 1024 }),
  pdfCru,
  pdfDoCorpo,
  validarPdf,
  async (req, res) => {
    try {
      const data = await lerPdf(req.pdf);
      res.json({ paginas: data.numpages, texto: data.text });
    } catch (err) {
      publicError(res, err, { status: 422, message: erroDePDF(err), extra: { podeBase64: true } });
    }
  });

/* ============================================================
 * LEITURA DO EXECUTIVO EM PDF ("Composição de Custo")
 * Formato bem mais denso que o Vendido: cada verba/item tem uma linha
 * de índice sequencial, custo Material + Mão de Obra por item, e uma
 * linha de totais (Total Material / Total MO / Total Geral). Validado
 * contra um PDF real do time — os totais por verba batem exatamente
 * com os valores conhecidos.
 * ============================================================ */

function verbaDoCodigoServer(codigo) {
  const m = String(codigo || "").match(/^(\d{1,2})\./);
  return m ? m[1].padStart(2, "0") : null;
}

function parseExecutivoTexto(texto) {
  const linhas = texto.split("\n").map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim() !== "");
  const reItemCod = /^(\d{1,2}\.\d+)$/;
  const reVerbaCod = /^([1-9]|1[0-9])$/;
  const reQtdUnLine = /^(\d{1,4}(?:\.\d{3})*,\d{2})\s*(vb|und|un|m²|m2|pç|pc|kg|cj|par|vg)$/i;
  const rsMatches = (l) => [...l.matchAll(/(-|[\d.]+,\d{2})\s*R\$/g)].map((m) => parseBRLnum(m[1]));
  const isCapsName = (l) => l.length > 3 && l === l.toUpperCase() && /[A-ZÀÂÃÉÊÍÓÔÕÚÇ]/.test(l);

  const verbas = [];
  const itens = [];
  let i = 0;
  while (i < linhas.length) {
    const t = linhas[i].trim();
    if (reVerbaCod.test(t) && linhas[i + 1] && isCapsName(linhas[i + 1].trim())) {
      const num = t.padStart(2, "0");
      const nome = linhas[i + 1].trim().replace(/0+$/, "").trim();
      let valor = null, j = i + 2;
      for (; j < Math.min(i + 8, linhas.length); j++) {
        const vals = rsMatches(linhas[j]);
        if (vals.length >= 3) { valor = vals[vals.length - 1]; j++; break; }
      }
      verbas.push({ num, nome, valor });
      i = j;
      continue;
    }
    const mi = t.match(reItemCod);
    if (mi) {
      const codigo = mi[1];
      let j = i + 1, descParts = [];
      const jLimite = j + 60; // mesma trava de segurança do parser do Vendido
      while (j < linhas.length && j < jLimite) {
        const lt = linhas[j].trim();
        if (reQtdUnLine.test(lt)) break;
        if (reItemCod.test(lt)) break;
        if (reVerbaCod.test(lt) && linhas[j + 1] && isCapsName(linhas[j + 1].trim())) break;
        if (lt === "0") { j++; continue; }
        descParts.push(lt);
        j++;
      }
      let qtd = null, un = null;
      if (j < linhas.length && reQtdUnLine.test(linhas[j].trim())) {
        const mq = linhas[j].trim().match(reQtdUnLine);
        qtd = parseBRLnum(mq[1]); un = mq[2]; j++;
      }
      let custoMaterial = null, custoMO = null, custoTotal = null;
      if (j < linhas.length) {
        const vals = rsMatches(linhas[j]);
        if (vals.length >= 2) { custoMaterial = vals[0]; custoMO = vals[1]; j++; }
      }
      if (j < linhas.length) {
        const vals = rsMatches(linhas[j]);
        if (vals.length >= 3) { custoTotal = vals[vals.length - 1]; j++; }
      }
      const descLimpa = limparDescResidual(descParts.join(" ").trim());
      itens.push({ verba: verbaDoCodigoServer(codigo), codigo, desc: descLimpa, qtd, un, custoMaterial, custoMO, custoTotal });
      i = j;
      continue;
    }
    i++;
  }
  return { verbas, itens };
}

/**
 * POST /api/executivo/parse
 * Corpo = o PDF do Executivo ("Composição de Custo"). Devolve
 * { verbas: [{num, nome, valor}], itens: [{verba, codigo, desc, qtd, un, custoMaterial, custoMO, custoTotal}] }.
 */
// gate-allow VH-06: o corpo é o PDF binário, conferido por validarPdf (tipo, tamanho e assinatura %PDF-)
app.post("/api/executivo/parse", exigirPerfilDeEdicao, pdfCru, validarPdf, async (req, res) => {
  try {
    const data = await lerPdf(req.pdf);
    const resultado = parseExecutivoTexto(data.text);
    res.json({ paginas: data.numpages, ...resultado });
  } catch (err) {
    publicError(res, err, { message: "Não foi possível ler o PDF. Confira o arquivo e tente novamente." });
  }
});

// O banco de preços (relatório do Sienge) NÃO passa por aqui: o arquivo
// tem ~19 MB e a Vercel corta requisições acima de 4,5 MB. Ele é lido
// direto no navegador (web/src/App.jsx), sem envio e sem limite.

/* ============================================================
 * SOLICITAÇÃO DE COMPRA NO SIENGE
 *
 * A primeira coisa que o GC ESCREVE no Sienge — até aqui, tudo saía em
 * planilha pra alguém redigitar lá dentro. Passa pelo servidor por um
 * motivo só: a credencial do ERP não pode viver no navegador.
 * ============================================================ */

const { chamarSienge, siengeConfigurado, idCriado, SEM_CONFIGURACAO } = require("./sienge.js");

/* Sem credencial do Sienge neste ambiente: a mesma resposta em toda rota,
   sem nome de variavel nem caminho de arquivo (SEG-33). */
const semSienge = (res) => res.status(503).json({
  error: SEM_CONFIGURACAO.mensagem,
  comoResolver: SEM_CONFIGURACAO.comoResolver,
});

/* Erro que nao e' sobre um item. Os do cliente do Sienge (code SIENGE_*)
   foram escritos pra pessoa — mensagem e o que fazer — e sobem como estao.
   Qualquer outro e' inesperado: vai pro log com um codigo, e a tela recebe
   a mensagem padrao (SEG-33). */
function responderErroSienge(res, err) {
  if (err && typeof err.code === "string" && err.code.startsWith("SIENGE_")) {
    return res.status(err.statusCode || 502).json({
      error: err.message, comoResolver: err.comoResolver || null, code: err.code,
    });
  }
  return publicError(res, err, { status: 502, extra: { comoResolver: null, code: null } });
}

// Quem assina as solicitações criadas por aqui. Decisão do negócio
// (ver docs/ADR-003), não um detalhe de implementação: no Sienge, é este
// nome que aparece como solicitante de tudo que sai do GC.
const SOLICITANTE = "VALENTINA";

const REF_ORCAMENTO = /^\d{2}(\.\d{3}){3}$/;
const hojeISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

/* O que impede a chamada de sair daqui. Validar antes de tocar o Sienge
   evita criar uma solicitação vazia — o cabeçalho é criado primeiro, e
   se os itens forem todos recusados ela fica lá, órfã, pra alguém apagar
   na mão. */
function problemaNoPedido(corpo) {
  if (!Number.isInteger(corpo?.buildingId)) return "Obra (buildingId) ausente ou inválida.";
  if (!Array.isArray(corpo?.itens) || !corpo.itens.length) return "Nenhum item para enviar.";
  for (const [i, it] of corpo.itens.entries()) {
    const onde = `item ${i + 1}`;
    if (!Number.isInteger(it?.productId)) return `${onde}: código do insumo ausente ou inválido.`;
    if (!(Number(it?.quantity) > 0)) return `${onde}: quantidade precisa ser maior que zero.`;
    if (!String(it?.unitySymbol || "").trim()) return `${onde}: unidade de medida ausente.`;
    if (!REF_ORCAMENTO.test(String(it?.costEstimationItemReference || ""))) {
      return `${onde}: referência do orçamento inválida (esperado nn.nnn.nnn.nnn).`;
    }
    if (!Number.isInteger(it?.buildingUnitId)) return `${onde}: unidade construtiva ausente ou inválida.`;
  }
  return null;
}

function itemParaSienge(it, data) {
  const corpo = {
    productId: it.productId,
    quantity: Number(it.quantity),
    unitySymbol: String(it.unitySymbol).trim(),
    buildingsApropriations: [{
      buildingUnitId: it.buildingUnitId,
      costEstimationItemReference: it.costEstimationItemReference,
      percentage: 100,
    }],
    // A entrega repete a quantidade do item: o GC não controla entrega
    // parcelada, e o Sienge exige ao menos uma necessidade.
    deliveryRequirements: [{ requirementDate: data, requirementQuantity: Number(it.quantity) }],
  };
  // Opcionais só entram quando existem: `detailId: null` é recusado, e
  // `estimatedPrice: 0` diz "de graça", que não é o mesmo que "não sei".
  if (Number.isInteger(it.detailId)) corpo.detailId = it.detailId;
  if (Number.isInteger(it.trademarkId)) corpo.trademarkId = it.trademarkId;
  if (Number(it.estimatedPrice) > 0) corpo.estimatedPrice = Number(it.estimatedPrice);
  if (it.notes) corpo.notes = String(it.notes).slice(0, 4000);
  return corpo;
}

/* As referências de orçamento que EXISTEM numa unidade construtiva.
 *
 * É a validação que impede a solicitação vazia. O cabeçalho precisa ser
 * criado antes dos itens (a API exige o id pra mandá-los), então quando
 * todo item é recusado sobra uma solicitação sem nada no ERP — e ela não
 * pode ser apagada, porque a API não tem DELETE nem cancelamento. Foram
 * nove assim numa tarde só.
 *
 * A recusa quase sempre é a mesma: a apropriação aponta pra um par
 * (unidade construtiva, item do orçamento) que não existe naquela obra.
 * Isso se confere com um GET, antes de escrever qualquer coisa.
 */
const ORCAMENTO_TTL_MS = 30 * 60_000;
const orcamentoCache = new Map(); // `${obra}:${unidade}` -> { expira, refs }

async function referenciasDoOrcamento(buildingId, unidadeId) {
  const chave = `${buildingId}:${unidadeId}`;
  const hit = orcamentoCache.get(chave);
  if (hit && hit.expira > Date.now()) return hit.refs;

  const r = await chamarSienge("GET",
    `/building-cost-estimations/${buildingId}/sheets/${unidadeId}/items?limit=500`);
  /* Não deu pra conferir: devolve null e o envio segue. Barrar um envio
     legítimo porque uma consulta auxiliar falhou seria trocar um problema
     raro por outro pior. */
  if (!r.ok) return null;
  const refs = new Set((r.body?.results || []).map((x) => x.wbsCode).filter(Boolean));
  orcamentoCache.set(chave, { expira: Date.now() + ORCAMENTO_TTL_MS, refs });
  return refs;
}

/* Criar solicitacao e' ESCREVER no Sienge em nome da obra: so' quem edita
   aquela obra (a Mehoo ve todas e nao edita nenhuma). O corpo passa pelo
   schema do contrato antes de qualquer consulta. */
app.post("/api/sienge/solicitacao",
  zValidator("json", esquemas.solicitacaoDeCompra),
  exigirEdicaoDeObra((req) => req.valido.json.buildingId),
  async (req, res) => {
  if (!siengeConfigurado()) return semSienge(res);
  const pedido = req.valido.json;
  const problema = problemaNoPedido(pedido);
  if (problema) {
    return res.status(400).json({
      error: `O pedido não passou na conferência antes de sair: ${problema}`,
      comoResolver: "Isso não deveria chegar até aqui — a tela confere os mesmos campos antes de " +
        "oferecer o envio. Feche o modal, confira o item citado nas Compras (quantidade, unidade, " +
        "insumo associado) e tente de novo; se persistir, avise quem cuida do sistema, " +
        "porque é sinal de defeito. Nada foi enviado ao Sienge.",
    });
  }

  const { buildingId, notes, itens } = pedido;
  const data = hojeISO();

  /* Reenvio: quando o cliente manda `solicitacaoId`, a solicitação JÁ
     existe no Sienge e só faltam itens nela. Criar outro cabeçalho aqui
     seria a duplicata que todo o resto do desenho existe pra evitar —
     item recusado volta pra MESMA solicitação. */
  const reenvio = pedido.solicitacaoId ?? null;

  try {
    /* O número do reenvio vem do navegador — e pode ser de OUTRA obra. Sem
       esta conferência, quem edita a obra A mandava itens para dentro da
       solicitação da obra B: a checagem de acesso olhava só a obra A, e a
       API do Sienge não tem DELETE para desfazer. A solicitação tem que
       existir e ser desta obra; se não for, "não encontrada" (SEG-14). */
    if (reenvio) {
      const existente = await chamarSienge("GET", `/purchase-requests/${reenvio}`);
      if (existente.ok ? Number(existente.body?.buildingId) !== buildingId : existente.status === 404) {
        return res.status(404).json({
          error: `A solicitação ${reenvio} não foi encontrada nesta obra.`,
          comoResolver: "NADA foi enviado. Confira o número da solicitação no Sienge " +
            "(Suprimentos > Solicitações de Compra) e tente de novo.",
          etapa: "validacao",
        });
      }
      if (!existente.ok) {
        return res.status(502).json({
          error: `Não deu pra conferir a solicitação ${reenvio} no Sienge: ${existente.erro}`,
          comoResolver: "NADA foi enviado. Tente de novo em alguns minutos.",
          etapa: "validacao",
        });
      }
    }

    /* Confere a apropriação ANTES de criar o cabeçalho — é o que impede a
       solicitação vazia, que não tem como ser apagada depois. */
    const invalidos = [];
    for (const unidadeId of [...new Set(itens.map((i) => i.buildingUnitId))]) {
      const refs = await referenciasDoOrcamento(buildingId, unidadeId);
      if (!refs) continue; // não deu pra conferir: deixa o Sienge decidir
      if (!refs.size) {
        invalidos.push(`a unidade construtiva ${unidadeId} não tem itens de orçamento nesta obra`);
        continue;
      }
      itens.filter((i) => i.buildingUnitId === unidadeId)
        .map((i) => i.costEstimationItemReference)
        .filter((ref, k, a) => a.indexOf(ref) === k && !refs.has(ref))
        .forEach((ref) => invalidos.push(`${ref} não existe na unidade construtiva ${unidadeId}`));
    }
    if (invalidos.length) {
      return res.status(400).json({
        error: `A apropriação não confere com o orçamento da obra ${buildingId}: ${invalidos.join("; ")}.`,
        comoResolver: "NADA foi enviado e NENHUMA solicitação foi criada. " +
          "A unidade construtiva é o número da planilha do orçamento e muda de obra para obra — " +
          "confira o campo no topo do envio. O item do orçamento de cada verba se ajusta em EAP Sienge.",
        etapa: "validacao",
      });
    }

    const cabecalho = reenvio ? null : await chamarSienge("POST", "/purchase-requests", {
      buildingId,
      requesterUser: SOLICITANTE,
      createdBy: SOLICITANTE,
      requestDate: data,
      notes: notes ? String(notes).slice(0, 4000) : undefined,
    });
    if (cabecalho && !cabecalho.ok) {
      return res.status(502).json({
        error: `O Sienge recusou a abertura da solicitação: ${cabecalho.erro}`,
        comoResolver: "A mensagem acima vem do próprio Sienge. Ela costuma apontar o campo do " +
          "cabeçalho (obra, solicitante, data). Confira se a obra existe no Sienge com o mesmo " +
          "código que aparece aqui; se a mensagem citar o solicitante, o usuário VALENTINA precisa " +
          "estar ativo lá. Nenhum item foi enviado.",
        etapa: "solicitacao",
      });
    }

    const solicitacaoId = reenvio || idCriado(cabecalho);
    if (!solicitacaoId) {
      return res.status(502).json({
        error: "O Sienge criou a solicitação, mas não devolveu o número dela — " +
          "por isso não deu pra enviar os itens.",
        comoResolver: "NÃO tente de novo antes de conferir: abra no Sienge " +
          "Suprimentos > Solicitações de Compra e veja se existe uma solicitação vazia criada agora. " +
          "Se existir, lance os itens por lá ou cancele-a antes de reenviar daqui — repetir o envio " +
          "sem isso cria uma segunda solicitação com os mesmos itens.",
        etapa: "solicitacao",
      });
    }

    /* Um POST por item, em sequência.
     *
     * O array inteiro numa chamada só seria mais rápido, e é justamente
     * o que não serve: um insumo repetido devolve 422 e derrubaria o
     * lote todo — inclusive os itens que estavam certos. Assim cada
     * recusa fica sendo sobre o seu item, e a pessoa vê o que entrou e o
     * que faltou, em vez de "deu erro".
     *
     * Em sequência, e não em paralelo, porque a cota do Sienge é
     * compartilhada com o agendadefretesws (ver o backoff de 429 no
     * cliente). */
    const resultados = [];
    for (const it of itens) {
      const r = await chamarSienge("POST", `/purchase-requests/${solicitacaoId}/items`, [itemParaSienge(it, data)]);
      resultados.push({ chaves: it.chaves || [], productId: it.productId, ok: r.ok, erro: r.erro });
    }

    res.json({
      solicitacaoId,
      reenvio: !!reenvio,
      resultados,
      ok: resultados.filter((r) => r.ok).length,
      falhas: resultados.filter((r) => !r.ok).length,
    });
  } catch (err) {
    // Aqui só chega o que não é sobre um item: credencial, timeout, rede.
    // O `comoResolver` vem montado do cliente, que sabe qual foi a causa.
    responderErroSienge(res, err);
  }
});

/* GET /api/sienge/insumos/:buildingId?ids=275,300 — os DETALHES de cada insumo.
 *
 * O detalhe é o que diz QUAL produto é: o insumo 275 é "AR CONDICIONADO",
 * e o detalhe 4 é "LG / SPLIT DUAL INVERTER 18.000 BTUS QUENTE E FRIO /
 * BRANCO". Mandar a solicitação só com o insumo deixa a compra genérica,
 * e quem vai cotar não sabe o que comprar.
 *
 * Sai de `/building-cost-estimations/{obra}/resources`, que traz cada
 * insumo do orçamento com `details[]` e `trademarks[]` — o único lugar da
 * API pública onde esse catálogo aparece (os itens de pedido só devolvem
 * o detalhe DE UM pedido que já existe, o que não serve para escolher).
 *
 * A varredura é inteira porque o endpoint ignora filtro por insumo: ~14
 * páginas, ~5s na obra 2045. Daí o cache — sem ele, abrir o modal
 * custaria isso toda vez. O catálogo muda quando alguém cadastra insumo
 * novo, então meia hora de validade é folgado e ainda assim curto o
 * bastante para um detalhe recém-criado aparecer.
 */
const CATALOGO_TTL_MS = 30 * 60_000;
const catalogoInsumos = new Map(); // buildingId -> { expira, porId }

async function carregarInsumosDaObra(buildingId) {
  const hit = catalogoInsumos.get(buildingId);
  if (hit && hit.expira > Date.now()) return hit.porId;

  const porId = new Map();
  const PAGINA = 200;
  for (let offset = 0; offset < 20000; offset += PAGINA) {
    const r = await chamarSienge("GET",
      `/building-cost-estimations/${buildingId}/resources?limit=${PAGINA}&offset=${offset}`);
    if (!r.ok) {
      // Cache do que já veio seria pior que não ter: o modal mostraria
      // meia lista de detalhes como se fosse a lista inteira.
      const e = new Error(`Não deu pra ler os insumos da obra ${buildingId} no Sienge: ${r.erro}`);
      e.code = "SIENGE_INSUMOS";
      e.statusCode = 502;
      e.comoResolver = "Sem isso dá pra enviar a solicitação assim mesmo, só sem especificar o " +
        "detalhe do produto. Tente de novo em alguns minutos; se persistir, avise quem cuida da integração.";
      throw e;
    }
    const lote = r.body?.results || [];
    lote.forEach((x) => porId.set(Number(x.id), {
      id: Number(x.id),
      descricao: x.description || "",
      unidade: x.unitOfMeasure || null,
      /* `id` é o `detailId` que a solicitação manda; `codigo` é o código
         auxiliar que a pessoa vê no cadastro do Sienge (detailCode), e
         que costuma vir vazio. Os dois aparecem na tela: o número do
         detalhe é como alguém confere o item lá dentro. */
      detalhes: (x.details || []).map((d) => ({
        id: Number(d.id),
        codigo: (d.detailCode ?? "").toString().trim() || null,
        descricao: d.description || "",
      })),
      marcas: (x.trademarks || []).map((m) => ({ id: Number(m.id), descricao: m.description || m.name || "" })),
    }));
    if (lote.length < PAGINA) break;
  }

  catalogoInsumos.set(buildingId, { expira: Date.now() + CATALOGO_TTL_MS, porId });
  return porId;
}

app.get("/api/sienge/insumos/:buildingId",
  zValidator("param", esquemas.paramObra),
  zValidator("query", esquemas.queryInsumos),
  exigirObra((req) => req.valido.param.buildingId),
  async (req, res) => {
  if (!siengeConfigurado()) return semSienge(res);
  const { buildingId } = req.valido.param;
  const ids = String(req.valido.query.ids || "").split(",").filter(Boolean).map(Number);
  try {
    const porId = await carregarInsumosDaObra(buildingId);
    // Só os insumos pedidos: a obra tem milhares, e o modal precisa de
    // alguns — mandar tudo seria megabytes por abertura.
    const insumos = (ids.length ? ids : [...porId.keys()])
      .map((id) => porId.get(id))
      .filter(Boolean);
    res.json({ buildingId, insumos, naoEncontrados: ids.filter((id) => !porId.has(id)) });
  } catch (err) {
    responderErroSienge(res, err);
  }
});

/* GET /api/sienge/obra/:buildingId/unidades — as unidades construtivas.
 *
 * A unidade construtiva (`buildingUnitId`) é a PLANILHA do orçamento da
 * obra, e o id dela **varia de obra para obra**:
 *
 *   obra 15 (modelo)  …  9 = EAP INICIAL - TKWS INTERIORES
 *   obra 2519            1 = Orçamento Executivo · 2 = Pós Venda e Marketing
 *
 * Isso custou três solicitações vazias no Sienge (23494, 23498, 23501): o
 * cadastro da EAP guardava a unidade do relatório importado — o 9 da obra
 * modelo — e mandava esse número para qualquer obra. A apropriação é do
 * par (unidade, item do orçamento), então o Sienge recusava item a item
 * com "Item do orçamento é inválido", que é verdade e não diz onde está o
 * erro: o item existe, a unidade é que não.
 *
 * Por isso a unidade passou a vir DAQUI, da obra de destino, e não do
 * cadastro.
 */
app.get("/api/sienge/obra/:buildingId/unidades",
  zValidator("param", esquemas.paramObra),
  exigirObra((req) => req.valido.param.buildingId),
  async (req, res) => {
  if (!siengeConfigurado()) return semSienge(res);
  const { buildingId } = req.valido.param;

  try {
    const r = await chamarSienge("GET", `/building-cost-estimations/${buildingId}/sheets?limit=50`);
    if (!r.ok) {
      return res.status(502).json({
        error: `Não deu pra ler as unidades construtivas da obra ${buildingId}: ${r.erro}`,
        comoResolver: "Sem elas não dá pra apropriar a compra. Confira no Sienge se a obra tem " +
          "orçamento cadastrado; se tiver, tente de novo em alguns minutos.",
      });
    }
    const unidades = (r.body?.results || []).map((x) => ({
      id: Number(x.id),
      descricao: x.description || `Planilha ${x.id}`,
      status: x.status || null,
    }));
    res.json({ buildingId, unidades });
  } catch (err) {
    responderErroSienge(res, err);
  }
});

/* GET /api/sienge/solicitacao/:id — o que o Sienge REALMENTE tem.
 *
 * A peça que fecha a garantia de não duplicar. Quando um envio fica sem
 * resposta (aba fechada, timeout, rede caindo na volta), o registro local
 * fica em 'enviando' e ninguém sabe se entrou. Supor é o caminho para as
 * duas piores saídas: reenviar e duplicar, ou não reenviar e perder o
 * pedido.
 *
 * Aqui a pergunta é feita a quem sabe. O Sienge é a fonte da verdade
 * sobre as solicitações dele — o registro local é só o nosso rastro. */
app.get("/api/sienge/solicitacao/:id", zValidator("param", esquemas.paramSolicitacao), async (req, res) => {
  if (!siengeConfigurado()) return semSienge(res);
  const { id } = req.valido.param;

  try {
    const solicitacao = await chamarSienge("GET", `/purchase-requests/${id}`);
    if (solicitacao.status === 404) {
      // Resposta legítima e útil: a solicitação NÃO existe (nunca foi
      // criada, ou foi cancelada). É o que libera o reenvio com segurança.
      return res.json({ existe: false, solicitacaoId: id });
    }
    if (!solicitacao.ok) {
      return res.status(502).json({
        error: `Não deu pra consultar a solicitação ${id} no Sienge: ${solicitacao.erro}`,
        comoResolver: "Abra o Sienge em Suprimentos > Solicitações de Compra e confira a solicitação " +
          `${id} manualmente antes de reenviar qualquer coisa.`,
      });
    }

    /* Só o cabeçalho, e não por escolha: `GET /purchase-requests/{id}/items`
       responde 405 — a API aceita POST de itens e não devolve a lista deles.
       Então a pergunta que dá pra responder aqui é "esta solicitação existe
       e em que estado está", não "o que tem dentro". O que foi mandado por
       este app está no nosso próprio registro (sienge_solicitacao), que é
       quem a tela usa pra mostrar o conteúdo. */
    const c = solicitacao.body || {};
    /* O número vem da URL: qualquer um de quem está logado. Sem esta
       conferência, um laço sobre os números lia obra, observações e autor
       de todas as solicitações da empresa. A solicitação é da obra dela:
       quem não vê a obra recebe "não encontrada" — e não `existe: false`,
       que liberaria o reenvio (SEG-11, SEG-14). */
    if (!(await podeAcessarObra(req, c.buildingId))) {
      return res.status(404).json({ error: "Solicitação não encontrada." });
    }
    res.json({
      existe: true,
      solicitacaoId: id,
      cabecalho: {
        buildingId: c.buildingId ?? null,
        requesterUser: c.requesterUser ?? null,
        requestDate: c.requestDate ?? null,
        notes: c.notes ?? null,
        // PENDING / AUTHORIZED / … — é o que diz se ela ainda vale.
        status: c.status ?? null,
        // IN_INCLUSION = aberta, ainda sendo montada.
        consistent: c.consistent ?? null,
        createdBy: c.createdBy ?? null,
        createdAt: c.createdAt ?? null,
      },
      // A API não expõe os itens; a tela não deve prometer que expõe.
      itensDisponiveis: false,
    });
  } catch (err) {
    responderErroSienge(res, err);
  }
});

/* O que escapou de toda rota — corpo grande demais, JSON quebrado, erro
   inesperado — cai aqui, e nao na pagina de erro do Express (que mostra
   stack em desenvolvimento). A pessoa recebe a mensagem padrao; o detalhe
   fica no log, com o codigo (SEG-33, ARQ-06). */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "O conteúdo enviado passa do limite permitido." });
  }
  if (err?.type === "entity.parse.failed" || err?.type === "encoding.unsupported") {
    return res.status(400).json({ error: "Os dados enviados não estão no formato esperado." });
  }
  return publicError(res, err, { status: 500 });
});

module.exports = app;
