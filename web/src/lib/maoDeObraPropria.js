import { supabaseConfigurado } from "./supabase";
import { apiJson } from "./api";

/**
 * A mão de obra própria (Gestão de compras): a equipe interna — a
 * especialidade, a função, a diária e, quando se sabe, o nome da pessoa.
 * É daqui que a calculadora da "mão de obra a contratar" tira os valores.
 * Tabela: supabase/mao-de-obra-propria.sql.
 *
 * Quem fala com a tabela é a API (web/api/_lib/rotas/cadastros.js): o
 * navegador só usa o Supabase para o login (VH-02). O "a tabela ainda não
 * existe" dependia do código de erro do Postgres e foi junto: a rota
 * decide e manda `faltaTabela`, a tela avisa como sempre avisou.
 */

const paraApp = (r) => ({
  id: r.id, nome: r.nome || "", especialidade: r.especialidade, funcao: r.funcao,
  diaria: Number(r.diaria) || 0, ativo: r.ativo !== false,
});

/** `{ lista }` com a equipe interna; `faltaTabela` enquanto o SQL não roda. */
export async function carregarPrestadores() {
  if (!supabaseConfigurado) return { lista: [] };
  const r = await apiJson("/api/prestadores-internos");
  const lista = (r?.lista || []).map(paraApp);
  return r?.faltaTabela ? { lista, faltaTabela: true } : { lista };
}

/**
 * Cria (sem `id`) ou atualiza um prestador. Devolve a linha gravada.
 *
 * A conferência de especialidade e função continua aqui: ela é a resposta
 * ao que a pessoa acabou de digitar, e não vale gastar uma ida à API pra
 * dizer o que a tela já sabe. A rota confere de novo, como toda rota faz.
 * `por` fica na assinatura, mas quem assina a linha é o login conferido no
 * servidor (SEG-13).
 */
export async function salvarPrestador(p, por) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  const linha = {
    nome: String(p.nome || "").trim() || null,
    especialidade: String(p.especialidade || "").trim(),
    funcao: String(p.funcao || "").trim(),
    diaria: Number(p.diaria) || 0,
    ativo: p.ativo !== false,
  };
  if (!linha.especialidade || !linha.funcao) throw new Error("Especialidade e função são obrigatórias.");
  return paraApp(await apiJson("/api/prestadores-internos", {
    metodo: "PUT",
    corpo: p.id ? { id: p.id, ...linha } : linha,
  }));
}

/** Tira um prestador do cadastro. */
export async function excluirPrestador(id) {
  if (!supabaseConfigurado) throw new Error("Banco não configurado.");
  await apiJson(`/api/prestadores-internos/${encodeURIComponent(id)}`, { metodo: "DELETE" });
}
