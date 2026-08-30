import { supabase, supabaseConfigurado } from "./supabase";

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
 */

// O bucket é privado — contrato e documento assinado de cliente não
// ficam num endereço que qualquer um abre. Cada download pede um
// endereço temporário, válido por esta janela.
const MINUTOS_DO_LINK = 60;

/**
 * Manda o arquivo pro Storage e devolve o que a obra guarda dele.
 *
 * O caminho leva a hora do envio, então trocar um caderno nunca
 * sobrescreve o anterior no meio de um download em andamento — quem
 * chama apaga o antigo depois, com `apagarArquivo`.
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

  const caminho = `${obraCodigo}/${chave}/${Date.now()}-${nomeSeguro(file.name)}`;
  const { error } = await supabase.storage
    .from("obra-arquivos")
    .upload(caminho, file, { contentType: file.type || undefined, upsert: false });

  if (error) throw new Error(explicar(error));

  return {
    nome: file.name,
    caminho,
    tamanhoKB: Math.round(file.size / 1024),
    em: new Date().toISOString(),
    por: por || null,
  };
}

/** Endereço temporário pra baixar. Some sozinho depois de uma hora. */
/* `download: true` manda o navegador SALVAR; sem ele, ele ABRE o PDF na
   aba. Sao duas coisas diferentes e as duas sao pedidas: quem vai
   conferir uma prancha quer ver, quem vai mandar pro fornecedor quer o
   arquivo. Mesmo link assinado, uma opcao a mais. */
export async function linkParaArquivo(caminho, { baixar = true } = {}) {
  if (!supabaseConfigurado) throw new Error("Banco de dados não configurado.");
  const { data, error } = await supabase.storage
    .from("obra-arquivos")
    .createSignedUrl(caminho, MINUTOS_DO_LINK * 60, baixar ? { download: true } : {});
  if (error) throw new Error(explicar(error));
  return data.signedUrl;
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
    await supabase.storage.from("obra-arquivos").remove([caminho]);
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
// só serve pra endereçar.
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
   anexando: é a migração que ainda não rodou. */
function explicar(error) {
  const msg = error?.message || "";
  if (/bucket not found/i.test(msg))
    return 'O depósito de arquivos ainda não existe no banco. Rode "supabase/arquivos.sql" no SQL Editor do Supabase e tente de novo.';
  if (/exceeded the maximum allowed size|payload too large/i.test(msg))
    return "Arquivo grande demais — o limite é 50 MB por arquivo.";
  if (/mime type|not supported/i.test(msg))
    return "Tipo de arquivo não aceito aqui. Vale PDF, Excel, CSV, PNG ou JPG.";
  if (/row-level security|not authorized|jwt/i.test(msg))
    return "Sua sessão expirou. Saia e entre de novo pra anexar.";
  return "Não consegui guardar o arquivo: " + msg;
}
