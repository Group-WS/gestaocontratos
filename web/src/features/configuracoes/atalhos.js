import { Boxes, Calculator, DollarSign, KeyRound, ShieldCheck, Workflow } from "lucide-react";

/* OS ATALHOS DE CONFIGURAÇÕES (ADR-009, 25/09/2026).

   Um catálogo só, no formato `SettingsNavArea` do DS (1.4.0), lido pelas
   três superfícies do settings-nav: o hub (SettingsHub), o índice lateral
   (SettingsIndex) e o painel do ⌘, (SettingsPanel). O `modulo` de cada item
   é o id do módulo no App.jsx; quem pode ver cada um continua sendo o
   `podeVerModulo` (e, de verdade, a API e o RLS). */

export const AREAS_DE_CONFIGURACOES = Object.freeze([
  {
    id: "acesso",
    label: "Acesso",
    Icon: KeyRound,
    accent: "var(--mod-settings)",
    resumo: "Quem entra no sistema e o que cada um vê.",
    itens: [
      { to: "/configuracoes/equipe", modulo: "equipe", label: "Equipe e acessos", Icon: ShieldCheck, sinonimos: ["pessoas", "perfil", "usuários", "permissão"] },
    ],
  },
  {
    id: "sienge",
    label: "Sienge",
    Icon: Workflow,
    accent: "var(--mod-orcamentos)",
    resumo: "O que vem do Sienge e alimenta compras e orçamento.",
    itens: [
      { to: "/configuracoes/precos", modulo: "precos", label: "Banco de Preços", Icon: DollarSign, sinonimos: ["preço", "pedido de compra", "custo"] },
      { to: "/configuracoes/eap", modulo: "eap", label: "EAP Sienge", Icon: Calculator, sinonimos: ["orçamento", "apropriação", "plano de contas"] },
      { to: "/configuracoes/insumos", modulo: "insumos", label: "Cadastro de Insumos", Icon: Boxes, sinonimos: ["insumo", "produto", "material", "relatório"] },
    ],
  },
]);

/* Os módulos que moram dentro de Configurações (saem do menu lateral). */
export const MODULOS_DE_CONFIGURACOES = Object.freeze(
  AREAS_DE_CONFIGURACOES.flatMap((a) => a.itens.map((i) => i.modulo)));

/* O endereço do hub; os itens moram abaixo dele. */
export const ENDERECO_DO_HUB = "/configuracoes";

/** O módulo que um endereço do catálogo abre (o hub, se não for de um item). */
export function moduloDoAtalho(to) {
  for (const a of AREAS_DE_CONFIGURACOES) {
    const item = a.itens.find((i) => i.to === to);
    if (item) return item.modulo;
  }
  return "configuracoes";
}

/** As áreas só com os itens que a pessoa pode ver; área vazia sai. */
export function areasVisiveis(areas, podeVer) {
  return areas
    .map((a) => ({ ...a, itens: a.itens.filter((i) => podeVer(i.modulo)) }))
    .filter((a) => a.itens.length > 0);
}
