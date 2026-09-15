/**
 * Cliente da API do Sienge — o primeiro ponto do GC que fala com ela.
 * -----------------------------------------------------------------
 * Tudo que o Sienge conhecia deste app até aqui entrava por planilha. A
 * solicitação de compra é a primeira coisa que SAI daqui direto pra lá.
 *
 * PORTADO do `agendadefretesws` (lib/sienge-platform/client/client.ts),
 * que já fala com a mesma API em produção: mesmos nomes de variável de
 * ambiente, mesmo caminho base, mesmo timeout, mesmo backoff de 429 e os
 * mesmos códigos de erro. Ele é TypeScript num app Next; aqui o backend é
 * CommonJS numa função serverless — o que muda é a sintaxe, não o
 * contrato. Duas credenciais diferentes pro mesmo ERP seria o começo de
 * dois jeitos de falar com ele.
 *
 * As variáveis (ver web/.env.example) são as MESMAS de lá, de propósito:
 *   SIENGE_BASE_URL    default https://api.sienge.com.br
 *   SIENGE_SUBDOMAIN   o subdomínio da empresa ("ws")
 *   SIENGE_USERNAME    usuário do tipo API cadastrado no Sienge
 *   SIENGE_PASSWORD    a senha dele
 *
 * Nada de VITE_ aqui: esse prefixo vai pro bundle do navegador, e
 * credencial no bundle é credencial publicada.
 *
 * A ÚNICA diferença de comportamento em relação ao original é deliberada:
 * lá um erro HTTP vira `Sienge HTTP 422` e o corpo é descartado; aqui o
 * corpo é lido e o `clientMessage` sobe inteiro. Ver `mensagemDoSienge`.
 */

const BASE_URL = process.env.SIENGE_BASE_URL || "https://api.sienge.com.br";
const SUBDOMAIN = process.env.SIENGE_SUBDOMAIN || "ws";
const TIMEOUT_PADRAO_MS = 30_000;

function autorizacao() {
  const usuario = process.env.SIENGE_USERNAME;
  const senha = process.env.SIENGE_PASSWORD;
  if (!usuario || !senha) {
    throw erroSienge(
      "As credenciais de acesso ao Sienge não estão configuradas neste ambiente.",
      "SIENGE_NOT_CONFIGURED", 503,
      "Isto é configuração do sistema, não algo que dê pra resolver na tela. " +
      "Peça a quem cuida do ambiente pra definir SIENGE_USERNAME e SIENGE_PASSWORD " +
      "(em desenvolvimento, no monday-proxy/.env; em produção, nas variáveis da Vercel). " +
      "Nada foi enviado ao Sienge.");
  }
  return "Basic " + Buffer.from(`${usuario}:${senha}`).toString("base64");
}

/** true quando dá pra chamar o Sienge — a tela pergunta antes de oferecer o botão. */
function siengeConfigurado() {
  return !!(process.env.SIENGE_USERNAME && process.env.SIENGE_PASSWORD);
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/* Todo erro que sai daqui carrega, além da mensagem, o que a pessoa pode
   FAZER a respeito — e quem consegue resolver, quando não é ela.
   "Credenciais Sienge inválidas" sozinho deixa quem está comprando sem
   saber se errou alguma coisa, se espera, ou se pede ajuda a alguém. */
function erroSienge(mensagem, code, statusCode, comoResolver) {
  const err = new Error(mensagem);
  err.code = code;
  if (statusCode !== undefined) err.statusCode = statusCode;
  if (comoResolver) err.comoResolver = comoResolver;
  return err;
}

/* A mensagem que o Sienge manda pra pessoa (`clientMessage`) é MUITO
   melhor que qualquer coisa que a gente escreveria por cima dela:
   "Não é possível cadastrar mais de um insumo de mesmo código, obra,
   detalhe e marca. O insumo 275 - AR CONDICIONADO já existe na
   solicitação 23488." Ela diz o que houve, com qual item e onde olhar.

   Por isso ela sobe inteira pra tela — é a razão de este cliente ler o
   corpo do erro em vez de parar em "HTTP 422" como o original.
   `developerMessage` fica de fora: é chave de i18n do Sienge
   ("adc.message.solicitacao.insumo.ja.existe"), não serve pra quem está
   comprando. */
function mensagemDoSienge(corpo, status) {
  if (corpo && typeof corpo === "object") {
    if (corpo.clientMessage) return corpo.clientMessage;
    if (Array.isArray(corpo.errors) && corpo.errors.length) {
      return corpo.errors.map((e) => e.clientMessage || e.message || String(e)).join(" · ");
    }
    if (corpo.message) return corpo.message;
  }
  if (typeof corpo === "string" && corpo.trim()) return corpo.trim().slice(0, 500);
  return `O Sienge respondeu ${status} sem explicar o motivo.`;
}

/**
 * Uma chamada à API.
 *
 * Devolve `{ ok, status, body, location, erro }` em vez de lançar em erro
 * de negócio: quem chama precisa distinguir "o Sienge recusou ESTE item"
 * (que vira linha no resultado, e o envio segue) de "não deu pra falar
 * com o Sienge" (que derruba o envio inteiro). Só o segundo lança —
 * junto com 401 e timeout, que também não são sobre o item.
 *
 * O backoff de 429 é o do original: quatro tentativas, 800ms por
 * tentativa. Caminho paralelo escaparia da desaceleração combinada com o
 * Sienge, e o `agendadefretesws` fala com a mesma cota.
 */
async function chamarSienge(metodo, caminho, corpo, opcoes = {}, tentativa = 0) {
  const timeoutMs = opcoes.timeoutMs ?? TIMEOUT_PADRAO_MS;
  const url = `${BASE_URL}/${SUBDOMAIN}/public/api/v1${caminho}`;
  const cabecalhos = { Authorization: autorizacao(), Accept: "application/json" };
  if (corpo !== undefined) cabecalhos["Content-Type"] = "application/json";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(url, {
      method: metodo,
      headers: cabecalhos,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: controller.signal,
    });
  } catch (err) {
    if (err && err.name === "AbortError") {
      throw erroSienge(
        `O Sienge não respondeu em ${timeoutMs / 1000} segundos.`,
        "SIENGE_TIMEOUT", 504,
        "Costuma ser lentidão momentânea do Sienge. Espere um minuto e tente de novo — " +
        "MAS confira antes, em Suprimentos > Solicitações de Compra, se a solicitação chegou a ser criada: " +
        "o pedido pode ter entrado mesmo sem a resposta voltar. Se repetir, avise quem cuida da integração.");
    }
    // Rede: o Sienge não respondeu. Nada foi decidido do lado de lá.
    throw erroSienge(
      `Não foi possível falar com o Sienge: ${err.message}`,
      "SIENGE_REDE", 502,
      "O servidor não conseguiu alcançar o Sienge — pode ser a internet daqui ou o Sienge fora do ar. " +
      "Tente de novo em alguns minutos; se continuar, avise quem cuida da integração. " +
      "Nada foi enviado.");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401) {
    throw erroSienge(
      "O Sienge recusou as credenciais deste sistema.",
      "SIENGE_401", 401,
      "A senha do usuário de API do Sienge provavelmente mudou ou expirou. " +
      "Não é algo que se resolva na tela: peça a quem cuida da integração pra atualizar " +
      "SIENGE_USERNAME/SIENGE_PASSWORD. Nada foi enviado.");
  }
  if (res.status === 429) {
    if (tentativa < 4) {
      await espera(800 * (tentativa + 1));
      return chamarSienge(metodo, caminho, corpo, opcoes, tentativa + 1);
    }
    throw erroSienge(
      "O Sienge está limitando as chamadas deste sistema (muitas requisições seguidas).",
      "SIENGE_429", 429,
      "Já tentamos quatro vezes, esperando entre elas. Aguarde alguns minutos e envie de novo. " +
      "Se acontecer sempre, pode ser outro sistema consumindo a mesma cota (o Agenda de Fretes usa a mesma) — " +
      "avise quem cuida da integração.");
  }

  const texto = await res.text();
  let body = null;
  if (texto) { try { body = JSON.parse(texto); } catch { body = texto; } }

  return {
    ok: res.ok,
    status: res.status,
    body,
    // O id do recurso criado às vezes só vem aqui, não no corpo.
    location: res.headers.get("location"),
    erro: res.ok ? null : mensagemDoSienge(body, res.status),
  };
}

/* O id da solicitação criada: o Sienge devolve ora no corpo, ora só no
   header Location (".../purchase-requests/23488"). Ler os dois é a
   diferença entre a tela mostrar o número e a pessoa ter que ir procurar
   no Sienge qual solicitação acabou de criar. */
function idCriado(resposta) {
  const b = resposta.body;
  if (b && typeof b === "object" && (b.id || b.purchaseRequestId)) return Number(b.id || b.purchaseRequestId);
  const m = String(resposta.location || "").match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

module.exports = { chamarSienge, siengeConfigurado, idCriado, mensagemDoSienge };
