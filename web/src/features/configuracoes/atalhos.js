/* OS ATALHOS DE CONFIGURAÇÕES (ADR-009, 25/09/2026).

   Um catálogo só, lido pelo hub (os cartões e a busca) e pelo índice lateral
   de cada tela de configuração — os dois nunca discordam sobre o que existe.
   O `id` de cada item é o id do módulo no App.jsx; quem pode ver cada um
   continua sendo o `podeVerModulo` (e, de verdade, a API e o RLS). */

export const AREAS_DE_CONFIGURACOES = Object.freeze([
  {
    id: "acesso",
    nome: "Acesso",
    resumo: "Quem entra no sistema e o que cada um vê.",
    itens: [
      { id: "equipe", nome: "Equipe e acessos", sub: "quem é quem, e o que cada um vê", sinonimos: ["pessoas", "perfil", "usuários", "permissão"] },
    ],
  },
  {
    id: "sienge",
    nome: "Sienge",
    resumo: "O que vem do Sienge e alimenta compras e orçamento.",
    itens: [
      { id: "precos", nome: "Banco de Preços", sub: "preço pago por insumo, dos pedidos", sinonimos: ["preço", "pedido de compra", "custo"] },
      { id: "eap", nome: "EAP Sienge", sub: "apropriação do orçamento", sinonimos: ["orçamento", "apropriação", "plano de contas"] },
      { id: "insumos", nome: "Cadastro de Insumos", sub: "insumos ativos, do relatório do Sienge", sinonimos: ["insumo", "produto", "material", "relatório"] },
    ],
  },
]);

/* Os módulos que moram dentro de Configurações (saem do menu lateral). */
export const MODULOS_DE_CONFIGURACOES = Object.freeze(
  AREAS_DE_CONFIGURACOES.flatMap((a) => a.itens.map((i) => i.id)));

const normalizar = (texto) => String(texto ?? "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** As áreas só com os itens que a pessoa pode ver; área vazia sai. */
export function areasVisiveis(areas, podeVer) {
  return areas
    .map((a) => ({ ...a, itens: a.itens.filter((i) => podeVer(i.id)) }))
    .filter((a) => a.itens.length > 0);
}

/**
 * Filtra pelo nome do item, pela descrição, por sinônimo ou pelo nome da área.
 * Casar pelo nome da área devolve a área inteira: quem digita "sienge" quer
 * ver o que tem lá.
 */
export function filtrarAtalhos(areas, termo) {
  const alvo = normalizar(termo).trim();
  if (!alvo) return areas;
  return areas
    .map((a) => {
      if (normalizar(a.nome).includes(alvo)) return a;
      const casa = (i) => [i.nome, i.sub, ...(i.sinonimos || [])].some((t) => normalizar(t).includes(alvo));
      return { ...a, itens: a.itens.filter(casa) };
    })
    .filter((a) => a.itens.length > 0);
}
