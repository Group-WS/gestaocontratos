import { supabaseConfigurado } from "./supabase";
import { apiJson } from "./api";
import { enviarAssinado } from "./storage";

/**
 * Os arquivos que a equipe anexa na obra — cadernos do Executivo e o
 * documento assinado pelo cliente.
 *
 * Antes o app guardava só o NOME do arquivo e um endereço `blob:`, que
 * o navegador cria pra sessão atual e apaga ao fechar a aba. Na tela
 * parecia anexado; depois do F5 o "Baixar" apontava pro nada. No caso
 * do documento assinado era pior: ele é a prova de que o cliente
 * aprovou a compra, e a prova nunca chegou a existir.
 *
 * Agora o arquivo vai pro bucket `obra-arquivos` do Supabase e o que
 * fica gravado na obra é o CAMINHO dele lá dentro.
 *
 * Quem fala com o Storage é a API (VH-02): ela confere quem está
 * mandando, MONTA o caminho e assina o endereço; o arquivo em si sobe
 * daqui direto, pelo endereço assinado, porque a função da Vercel corta
 * o corpo em 4,5 MB e o balde aceita 50 MB. Ver web/src/lib/storage.js
 * e web/api/_lib/rotas/arquivos.js.
 */

// O bucket é privado — contrato e documento assinado de cliente não
// ficam num endereço que qualquer um abre. Cada download pede um
// endereço temporário, válido por esta janela; quanto tempo ele dura é
// decisão da rota (`MINUTOS_DO_LINK`, em web/api/_lib/rotas/arquivos.js).

/**
 * Manda o arquivo pro Storage e devolve o que a obra guarda dele.
 *
 * O caminho leva a hora do envio, então trocar um caderno nunca
 * sobrescreve o anterior no meio de um download em andamento — quem
 * chama apaga o antigo depois, com `apagarArquivo`. Quem monta esse
 * caminho é a rota: o navegador manda o NOME, não o lugar.
 */
/* O que o deposito aceita. Tem que casar com `allowed_mime_types` do
   bucket: tipo de fora e' recusado pelo Storage com uma mensagem que nao
   diz o que fazer, e a pessoa fica sem saber se o problema e' o arquivo,
   a internet ou o sistema. */
export const EXTENSOES_ACEITAS = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.xlsm,.csv,.txt,.png,.jpg,.jpeg,.webp,.zip";

export function tipoAceito(nome) {
  return EXTENSOES_ACEITAS.split(",").some((e) => nome.toLowerCase().endsWith(e));
}

export async function subirArquivo({ obraCodigo, chave, file, por }) {
  if (!supabaseConfigurado) throw new Error("Banco de dados não configurado — o arquivo não tem onde ficar guardado.");

  const assinatura = await apiJson("/api/arquivos/envio", {
    metodo: "POST",
    corpo: { obraCodigo: String(obraCodigo), chave, nome: nomeSeguro(file.name) },
  });
  const caminho = await enviarAssinado("obra-arquivos", assinatura, file, { upsert: false });

  return {
    nome: file.name,
    caminho,
    tamanhoKB: Math.round(file.size / 1024),
    em: new Date().toISOString(),
    por: por || null,
  };
}

/** Endereço temporário pra baixar. Some sozinho depois de uma hora. */
/* `baixar: true` manda o navegador SALVAR; sem ele, ele ABRE o PDF na
   aba. Sao duas coisas diferentes e as duas sao pedidas: quem vai
   conferir uma prancha quer ver, quem vai mandar pro fornecedor quer o
   arquivo. Mesmo link assinado, uma opcao a mais. */
export async function linkParaArquivo(caminho, { baixar = true } = {}) {
  if (!supabaseConfigurado) throw new Error("Banco de dados não configurado.");
  const { url } = await apiJson("/api/arquivos/link", { metodo: "POST", corpo: { caminho, baixar } });
  return url;
}

export const linkParaBaixar = (caminho) => linkParaArquivo(caminho, { baixar: true });
export const linkParaVer = (caminho) => linkParaArquivo(caminho, { baixar: false });

/**
 * Apaga o arquivo trocado. É faxina: se falhar, o arquivo novo já está
 * guardado e o antigo só ocupa espaço — não é motivo pra mostrar erro
 * pra quem só queria trocar um anexo.
 */
export async function apagarArquivo(caminho) {
  if (!supabaseConfigurado || !caminho) return;
  try {
    await apiJson("/api/arquivos/remover", { metodo: "POST", corpo: { caminho } });
  } catch {
    /* silêncio proposital */
  }
}

/**
 * Um anexo só é recuperável depois do reload se tiver caminho no
 * Storage. Sem banco configurado (modo local) o `blob:` da sessão ainda
 * serve — mas só até fechar a aba.
 */
export function anexoRecuperavel(arq) {
  if (!arq) return false;
  return Boolean(arq.caminho) || (!supabaseConfigurado && Boolean(arq.url));
}

// O Storage aceita um subconjunto de caracteres no caminho; acento e
// espaço no nome do arquivo derrubavam o upload com um erro que não
// dizia isso. O nome original continua guardado em `nome` — este aqui
// só serve pra endereçar. A rota confere que o nome chegou assim.
function nomeSeguro(nome) {
  return nome
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
}

/* Erro de Storage chega como uma frase em inglês vinda do servidor. As
   três que a equipe realmente encontra viram instrução em português —
   principalmente a primeira, que não é defeito nem culpa de quem está
   anexando: é a migração que ainda não rodou.
   A tradução mora em `explicarStorage` (web/src/lib/storage.js), pra
   subida daqui, e em `erroDoStorage` (web/api/_lib/storage.js), pro que
   a rota responde. Duas cópias divergentes já custaram uma frase que
   não dizia qual SQL rodar. */
