/* O histórico de versões da obra.
 *
 * Roda com: node web/src/__testes__/versoes-obra.test.mjs
 *
 * Nasceu de 18/09/2026: três obras esvaziadas em dois minutos, e o banco
 * guardando um estado só — o último. Não havia para onde voltar a não ser o
 * backup diário do Supabase, que no dia seguinte já vinha com o estrago.
 *
 * Duas decisões dela em 19/09/2026 estão travadas aqui:
 *   · restaurar é SÓ do admin master (o botão desfaz o trabalho dos outros);
 *   · a lista mora dentro do Histórico da obra, não numa tela de admin.
 *
 * E uma decisão de engenharia que vale um teste próprio: quem grava o
 * histórico é o GATILHO do banco, não o app. Se isso virar código de tela
 * algum dia, volta a existir o caminho que esquece de chamar — e foi
 * exatamente assim que as três obras se perderam.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(aqui, "..", "lib", "versoesObra.js"), "utf8");
const app = fs.readFileSync(path.join(aqui, "..", "App.jsx"), "utf8");
const sql = fs.readFileSync(path.join(aqui, "..", "..", "..", "supabase", "obra-versao.sql"), "utf8");

const bloco = (assinatura, fim = "\n}\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei em versoesObra.js: ${assinatura}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};
const trecho = (comeco, fim) => {
  const i = src.indexOf(comeco);
  if (i === -1) throw new Error(`não achei em versoesObra.js: ${comeco}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};

let supabaseStub = null;
const M = eval("(function () {\n"
  + "  const supabaseConfigurado = true;\n"
  + "  const supabase = { from: (t) => supabaseStub.from(t) };\n"
  + trecho("const semTabela =", ";\n")
  + trecho("const CAMPOS_RESTAURAVEIS =", "];\n")
  + bloco("export async function listarVersoes(").replace("export ", "")
  + bloco("export async function restaurarVersao(").replace("export ", "")
  + "  return { semTabela, CAMPOS_RESTAURAVEIS, listarVersoes, restaurarVersao };\n"
  + "})()");

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(62)} ${String(o).padEnd(8)} ${ok ? "" : "esperava " + e}`); };

/* ============================================================
   1. O QUE NÃO VOLTA NUMA RESTAURAÇÃO
   ============================================================ */
const campos = M.CAMPOS_RESTAURAVEIS;
conf("as categorias voltam", campos.includes("categorias"), true);
conf("os cadernos voltam", campos.includes("cadernos"), true);
conf("os arquivos voltam", campos.includes("arquivos"), true);
conf("as aprovações voltam", campos.includes("aprovacoes"), true);
conf("o CMV liberado volta", campos.includes("cmv_liberado"), true);
conf("as etapas concluídas voltam", campos.includes("etapas_concluidas"), true);

/* A TRAVA NÃO VOLTA. Ela é de agora, não de então — devolver a trava antiga
   deixaria a obra presa em nome de quem já foi embora, e sem ninguém para
   soltá-la a não ser o vencimento de 5 minutos. */
conf("a trava de edição NÃO volta", campos.includes("editando_por"), false);
conf("... nem a hora dela", campos.includes("editando_desde"), false);
/* Identidade da linha não é conteúdo: reescrever o código da obra moveria a
   linha para outra obra. */
conf("o código da obra NÃO volta", campos.includes("obra_codigo"), false);
conf("quem restaurou é quem clicou agora", campos.includes("atualizado_por"), false);

/* ============================================================
   2. A RESTAURAÇÃO
   ============================================================ */
function montarStub({ versao, erroNaBusca = null }) {
  const chamadas = { buscou: 0, gravou: 0, patch: null };
  const stub = {
    from: (tabela) => ({
      select: () => ({
        eq: () => ({
          order: async () => ({ data: [], error: null }),
          maybeSingle: async () => {
            chamadas.buscou += 1;
            return erroNaBusca ? { data: null, error: erroNaBusca } : { data: versao, error: null };
          },
        }),
      }),
      upsert: async (patch) => {
        chamadas.gravou += 1;
        chamadas.patch = patch;
        return { error: null };
      },
    }),
  };
  return { stub, chamadas };
}

const conteudo = {
  obra_codigo: "2450",
  categorias: [{ num: "01", itens: [{ desc: "mesa" }] }],
  cadernos: { especificacao: { nome: "x.pdf" } },
  cmv_liberado: 1000,
  editando_por: "quemfoiembora@x.com",
  editando_desde: "2026-09-18T10:00:00Z",
  atualizado_por: "lorena@x.com",
};

/* O caminho feliz. */
{
  const { stub, chamadas } = montarStub({ versao: { id: 7, obra_codigo: "2450", conteudo, n_itens: 269, criado_em: "2026-09-18T19:00:00Z" } });
  supabaseStub = stub;
  let erro = null;
  const r = await M.restaurarVersao("2450", 7, "eu@x.com").catch((e) => { erro = e; return null; });
  conf("restaura", chamadas.gravou, 1);
  conf("... sem erro", erro, "null");
  conf("... e diz quantos itens voltaram", r?.restaurou, 269);
  conf("... levando as categorias", JSON.stringify(chamadas.patch?.categorias?.[0]?.itens?.[0]), '{"desc":"mesa"}');
  conf("... e carimbando quem restaurou", chamadas.patch?.atualizado_por, "eu@x.com");
  conf("... sem devolver a trava de quem foi embora",
    Object.prototype.hasOwnProperty.call(chamadas.patch, "editando_por"), false);
}

/* VERSÃO DE OUTRA OBRA. O id vem de fora da função, e restaurar a obra
   errada é irreversível para quem perdeu o trabalho. */
{
  const { stub, chamadas } = montarStub({ versao: { id: 9, obra_codigo: "2498", conteudo, n_itens: 611 } });
  supabaseStub = stub;
  let erro = null;
  await M.restaurarVersao("2450", 9, "eu@x.com").catch((e) => { erro = e; });
  conf("versão de outra obra: NÃO grava", chamadas.gravou, 0);
  conf("... e diz por quê", /de outra obra/.test(erro?.message || ""), true);
}

/* Versão que não existe mais (podada, ou id inventado). */
{
  const { stub, chamadas } = montarStub({ versao: null });
  supabaseStub = stub;
  let erro = null;
  await M.restaurarVersao("2450", 999, "eu@x.com").catch((e) => { erro = e; });
  conf("versão inexistente: NÃO grava", chamadas.gravou, 0);
  conf("... e avisa", /não existe mais/.test(erro?.message || ""), true);
}

/* Campo que a versão não tem (coluna criada depois do snapshot) não pode ser
   escrito como `undefined`, senão a restauração APAGA o valor de hoje. */
{
  const { stub, chamadas } = montarStub({ versao: { id: 3, obra_codigo: "2450", conteudo: { categorias: [] }, n_itens: 0 } });
  supabaseStub = stub;
  await M.restaurarVersao("2450", 3, "eu@x.com").catch(() => {});
  conf("campo ausente na versão não é escrito",
    Object.prototype.hasOwnProperty.call(chamadas.patch, "cmv_liberado"), false);
  conf("... e o que existe é escrito", Object.prototype.hasOwnProperty.call(chamadas.patch, "categorias"), true);
}

/* ============================================================
   3. A LISTA
   ============================================================ */
/* Não traz o `conteudo`: é o JSONB gordo, centenas de KB POR VERSÃO. Uma
   lista de 24 versões arrastaria megabytes para mostrar data e contagem. */
const corpoLista = bloco("export async function listarVersoes(");
conf("a lista NÃO carrega o conteúdo das versões", /select\("id, n_itens, queda, atualizado_por, criado_em"\)/.test(corpoLista), true);
conf("... da mais nova pra mais velha", /ascending: false/.test(corpoLista), true);

/* "Tabela não existe" é só isso — dois códigos. Qualquer outro erro virando
   "falta rodar o SQL" esconderia queda de rede atrás de migração pendente. */
conf("42P01 é tabela que não existe", M.semTabela({ code: "42P01" }), true);
conf("PGRST205 também", M.semTabela({ code: "PGRST205" }), true);
conf("mas erro de rede não é", M.semTabela({ code: "500", message: "falhou" }), false);
conf("nem permissão negada", M.semTabela({ code: "42501" }), false);

/* ============================================================
   4. O GATILHO — quem grava é o BANCO
   ============================================================ */
conf("o gatilho é BEFORE UPDATE em obra_dados",
  /create trigger trg_obra_dados_versao\s*\n\s*before update on obra_dados/.test(sql), true);
conf("... guardando a linha inteira de antes", sql.includes("to_jsonb(OLD)"), true);
/* Guardar a linha inteira (e não coluna por coluna) é o que faz o histórico
   sobreviver a colunas novas sem ninguém mexer no SQL de novo. */
conf("... uma por hora", sql.includes("ultima < now() - interval '1 hour'"), true);
conf("... e SEMPRE que os itens caem", sql.includes("or eh_queda or ultima is null"), true);
conf("gravação que não mexeu no conteúdo não vira versão",
  sql.includes("OLD.categorias  is not distinct from NEW.categorias"), true);

/* O APAGAMENTO DA LINHA também vira versão.
 *
 * Pergunta dela em 19/09/2026: "e o soft-delete?". A resposta é que o
 * histórico faz mais — desde que pegue o DELETE. Sem o segundo gatilho,
 * `delete from obra_dados where obra_codigo = '2450'` levaria a obra sem
 * deixar cópia, e foi assim que o limpar-obras-teste.sql apagou 12 obras em
 * 16/09. Soft-delete guardaria o FATO; aqui fica o CONTEÚDO. */
conf("existe gatilho no apagamento também",
  /create trigger trg_obra_dados_versao_del\s*\n\s*before delete on obra_dados/.test(sql), true);
conf("apagar SEMPRE guarda versão, sem esperar o relógio",
  sql.includes("if apagando or eh_queda or ultima is null"), true);
conf("... e não passa pelo filtro de 'nada mudou'", sql.includes("if not apagando then"), true);
conf("depois de apagar sobram zero itens",
  sql.includes("case when apagando then 0 else obra_conta_itens(NEW.categorias) end"), true);
/* Num gatilho BEFORE, devolver NULL CANCELA a operação — um `return NEW`
   no DELETE (NEW é nulo ali) impediria qualquer apagamento no banco. */
conf("o gatilho deixa o apagamento seguir",
  sql.includes("return case when apagando then OLD else NEW end;"), true);
/* E a restauração tem que conseguir RECRIAR a linha apagada. UPDATE numa
   linha que não existe não atualiza nada e não reclama: a tela diria
   "restaurado" e nada teria voltado. */
conf("restaurar recria a obra apagada, não só atualiza",
  src.includes('.upsert({ ...patch, obra_codigo: String(codigo) }, { onConflict: "obra_codigo" })'), true);

/* A PODA não pode comer a versão de antes do estrago: é justamente a que
   alguém vem buscar, e as gravações seguintes a empurrariam para fora. */
conf("a poda guarda as quedas por 30 dias",
  sql.includes("not (v.queda and v.criado_em > now() - interval '30 days')"), true);
conf("... e as 24 mais novas de cada obra", /order by criado_em desc\s*\n\s*limit 24/.test(sql), true);

/* Histórico que pode ser editado não é histórico. */
conf("a tabela tem RLS", sql.includes("alter table obra_versao enable row level security"), true);
conf("o time LÊ o histórico", /create policy[^;]*on obra_versao\s*\n\s*for select/.test(sql), true);
conf("e ninguém escreve nele na mão", /for (insert|update|delete)[\s\S]{0,200}on obra_versao/.test(sql), false);
conf("o gatilho passa por cima da RLS pra conseguir gravar", sql.includes("security definer"), true);
conf("... com search_path fixo, que é o cuidado que vem junto", sql.includes("set search_path = public"), true);

/* Lista que não é lista vale zero: obra antiga pode ter chave em formato
   velho, e um erro aqui travaria o salvamento da obra inteira. */
conf("contar itens não quebra com formato inesperado",
  sql.includes("case when jsonb_typeof(v) = 'array' then jsonb_array_length(v) else 0 end"), true);
conf("as quatro fontes contam", /itensContrato[\s\S]{0,200}itensPlanilhaExecutivo/.test(sql), true);

/* ============================================================
   5. A TELA
   ============================================================ */
conf("restaurar é do admin master",
  app.includes("podeRestaurar={podeGerenciarPessoas(eu, pessoas)}"), true);
conf("as versões moram dentro do Histórico da obra",
  app.includes("<VersoesDaObra obra={obra} podeRestaurar={podeRestaurar} usuario={usuario} />"), true);
/* Sem permissão o botão não existe — e a lista continua visível, porque
   saber o que aconteceu com a obra não é privilégio de ninguém. */
const tela = app.slice(app.indexOf("function VersoesDaObra("), app.indexOf("/* O HISTORICO NO PE' DA PAGINA."));
conf("o botão de restaurar depende da permissão", tela.includes("{podeRestaurar && (confirmando === v.id"), true);
conf("a lista NÃO depende da permissão", /podeRestaurar[^\n]*versoes\.map/.test(tela), false);
conf("restaurar pede confirmação com os dois números",
  tela.includes("troca os {agora} de agora por estes {v.n_itens}?"), true);
/* A consulta só sai quando alguém abre: o Histórico fecha TODA tela da obra,
   e as versões só interessam quando algo deu errado. */
conf("só busca as versões quando alguém abre", tela.includes("if (!aberto || jaBuscou.current) return;"), true);
conf("trocar de obra zera a lista", tela.includes("}, [obra?.codigo]);"), true);

/* O "JÁ BUSQUEI" FICA NUM REF, E O EFEITO NÃO DEPENDE DO ESTADO.
 *
 * Aconteceu em 19/09/2026, na primeira vez que abri a tela: com `estado` nas
 * dependências, o `setEstado("carregando")` de dentro do efeito fazia ele
 * rodar de novo, e a LIMPEZA do anterior marcava `vivo = false` antes de a
 * resposta chegar. O `.then` desistia calado e a tela ficava em "Buscando…"
 * para sempre.
 *
 * Nenhum teste de código-fonte pegou isso — foi abrir a tela que pegou. O
 * que dá para travar aqui é a FORMA que evita o laço. */
conf("o efeito da busca não depende do estado que ele mesmo muda",
  tela.includes("}, [aberto, obra.codigo]);"), true);
conf("... e não volta a ter `estado` nas dependências",
  /\}, \[aberto, estado/.test(tela), false);
conf("o controle de 'já busquei' é um ref, que não provoca render",
  tela.includes("const jaBuscou = useRef(false);"), true);
conf("... zerado ao trocar de obra", tela.includes("jaBuscou.current = false;"), true);
conf("a tela diz quando o SQL ainda não rodou", tela.includes("supabase/obra-versao.sql"), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
