import { supabaseConfigurado } from "./supabase";
import { apiJson } from "./api";

/**
 * Ciclo de vida das obras.
 *
 * O Monday lista tudo que existe; esta tabela guarda o que o time
 * decidiu acompanhar. Uma obra do Monday que ninguém iniciou é só uma
 * sugestão — aparece em "Novas obras" e mais nada.
 *
 * Quem fala com o banco é a API (web/api/_lib/rotas/obras.js): o
 * navegador não consulta mais a tabela direto (VH-02). Mudou o caminho,
 * não o que a tela recebe — mesma função, mesmo retorno, mesma frase de
 * erro. As decisões que dependiam do código do erro do Postgres (a coluna
 * nova que ainda não existe) vivem na rota, e aqui chega a lista pronta.
 *
 * Sem Supabase configurado (modo local, sem .env), tudo aqui vira
 * conversa fiada silenciosa: devolve vazio e não grava. O app continua
 * abrindo, só não persiste — que é o comportamento antigo.
 */

/* A obra que só existe no NOSSO banco.
 *
 * A barra lateral se alimenta do Monday. Obra cadastrada à mão não está
 * lá — e sem esta conta ela aparece no instante em que é criada e some
 * ao recarregar: viva no banco, invisível na tela. Aconteceu com a 2517.
 *
 * Casa por CÓDIGO, que é a chave de verdade da obra nos dois mundos. O
 * `id` não serve: no Monday ele cai pro boardId quando a obra não tem
 * código, e aí duas coisas iguais teriam nomes diferentes.
 */
export function faltandoNaTela(linhas, obras) {
  const naTela = new Set((obras || []).map((o) => String(o.codigo)));
  return (linhas || []).filter((l) => l && l.codigo && !naTela.has(String(l.codigo)));
}

const daObra = (codigo) => `/api/obras/${encodeURIComponent(String(codigo))}`;

export async function listarObras() {
  if (!supabaseConfigurado) return [];
  /* Traz TUDO que descreve a obra, e não só a situação (a rota lista as
     colunas). Obra cadastrada à mão não existe no Monday: se a leitura do
     banco devolvesse só `situacao`, não haveria como remontá-la, e ela
     sumiria a cada recarregada — que foi exatamente o que aconteceu com a
     2517. A obra ativa continua aparecendo mesmo antes de a migração das
     colunas novas rodar: quem resolve isso agora é a rota. */
  return apiJson("/api/obras");
}

/**
 * Registra a obra no banco — é o "Dar start". A partir daqui ela passa
 * a existir por conta própria: some do Monday e ela continua aqui.
 *
 * `obra` é o objeto do app (o mesmo que a sidebar usa).
 */
export async function iniciarObra(obra) {
  if (!supabaseConfigurado) throw new Error("Supabase não configurado.");
  try {
    return await apiJson("/api/obras", {
      metodo: "POST",
      corpo: {
        codigo: String(obra.codigo),
        nome: obra.nome,
        squad: obra.squad,
        boardId: obra.boardId ? String(obra.boardId) : null,
        cliente: obra.cliente,
        endereco: obra.endereco,
        gc: obra.gc,
        valorVendido: obra.valorVendido || null,
      },
    });
  } catch (err) {
    /* Centro de custo repetido. Antes o texto cru do Postgres ("duplicate
       key…") chegava até a tela, que o traduzia; agora o Postgres não fala
       mais com o navegador — vem o código do erro, e a frase que a pessoa
       lê é montada aqui, palavra por palavra igual à de antes. */
    if (err?.code === "23505") throw new Error(`Já existe uma obra com o centro de custo ${obra.codigo}.`);
    throw err;
  }
}

/** Tira da sidebar e manda pro Arquivo (só leitura). */
export async function concluirObra(codigo) {
  if (!supabaseConfigurado) throw new Error("Supabase não configurado.");
  return apiJson(`${daObra(codigo)}/situacao`, { metodo: "PATCH", corpo: { situacao: "concluida" } });
}

/** Volta pra sidebar — pra quando alguém concluir sem querer. */
export async function reabrirObra(codigo) {
  if (!supabaseConfigurado) throw new Error("Supabase não configurado.");
  return apiJson(`${daObra(codigo)}/situacao`, { metodo: "PATCH", corpo: { situacao: "ativa" } });
}

/**
 * Quem responde pela obra.
 *
 * Guarda o E-MAIL, nao o nome: e' a identidade que o login ja' da', e e'
 * o unico jeito de "as minhas obras" saber quais sao as minhas sem
 * alguem manter uma tabela de nomes em dia. O nome bonito sai do proprio
 * e-mail na hora de mostrar.
 */
export async function definirGC(codigo, email) {
  if (!supabaseConfigurado) throw new Error("Supabase não configurado.");
  return apiJson(`${daObra(codigo)}/papel`, { metodo: "PATCH", corpo: { papel: "gc", email } });
}

/* Os outros dois papéis de "Equipe da obra" — mesmo padrão do GC, cada
   um em coluna própria porque uma obra pode ter os três ao mesmo tempo.

   Aqui, diferente do GC, é o próprio UPDATE que toca a coluna nova —
   sem migração rodada não tem como salvar de jeito nenhum, então o
   erro precisa dizer isso claramente em vez de estourar cru na tela.
   Quem distingue os dois casos é a rota, que é quem vê o erro do banco;
   a frase chega aqui pronta, dentro do `Error`. */
export async function definirTailorMade(codigo, email) {
  if (!supabaseConfigurado) throw new Error("Supabase não configurado.");
  return apiJson(`${daObra(codigo)}/papel`, { metodo: "PATCH", corpo: { papel: "tailor_made", email } });
}

export async function definirResponsavelExecutivo(codigo, email) {
  if (!supabaseConfigurado) throw new Error("Supabase não configurado.");
  return apiJson(`${daObra(codigo)}/papel`, { metodo: "PATCH", corpo: { papel: "responsavel_executivo", email } });
}

/* O endereço da obra, corrigido à mão (só administrador e admin master veem
   o botão). Vazio grava nulo, e a tela volta ao endereço do cadastro do Sienge. */
export async function definirEndereco(codigo, endereco) {
  if (!supabaseConfigurado) throw new Error("Supabase não configurado.");
  return apiJson(`${daObra(codigo)}/endereco`, { metodo: "PATCH", corpo: { endereco } });
}
