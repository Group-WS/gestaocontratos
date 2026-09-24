/**
 * Grupo do arquivo que a EAP não reconhece: a pessoa escolhe a verba
 * (RN-030, 23/09/2026).
 *
 * Antes o grupo ia calado para o fim da lista, marcado "fora do padrão da
 * EAP". Agora a importação para e mostra cada grupo não reconhecido, e a
 * pessoa escolhe a verba ou decide manter fora do padrão. A escolha vira
 * apelido da verba (`eap_grupo.apelidos`), e o próximo arquivo com o mesmo
 * grupo já entra no lugar.
 *
 * Funções puras: quem abre o diálogo e grava o apelido é a importação.
 */

/**
 * O nome do grupo na forma em que o depara compara: sem acento, sem caixa,
 * sem espaço nem pontuação, e sem o número que o arquivo põe na frente
 * ("15 PAISAGISMO" vira "paisagismo") — a numeração briga entre documentos,
 * o nome não. Vazio quando não sobra nome que valha como apelido.
 */
export function apelidoDoGrupo(nome) {
  const comprimido = String(nome || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .replace(/^\d+/, "");
  return comprimido.length >= 3 ? comprimido.slice(0, 80) : "";
}

/** Os grupos fora do padrão que vieram no arquivo, com quantos itens cada. */
export function gruposForaDoPadrao(itens) {
  const porNome = new Map();
  (itens || []).forEach((it) => {
    if (!it.foraDoPadrao) return;
    const nome = it.grupoOriginal || "Grupo não identificado";
    porNome.set(nome, (porNome.get(nome) || 0) + 1);
  });
  return [...porNome].map(([nome, itens]) => ({ nome, itens }));
}

/**
 * Leva os itens de cada grupo para a verba escolhida. `escolhas` é
 * Map(nome do grupo -> num da verba | null); null mantém fora do padrão.
 */
export function aplicarEscolhaDeVerbas(itens, escolhas) {
  return (itens || []).map((it) => {
    if (!it.foraDoPadrao) return it;
    const num = escolhas.get(it.grupoOriginal || "Grupo não identificado");
    if (!num) return it;
    const { foraDoPadrao, grupoOriginal, ...resto } = it;
    return { ...resto, num };
  });
}
