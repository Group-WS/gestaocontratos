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
/* Desde 22/09/2026 a restauração e o gatilho vigentes moram em
   supabase/salvar-obra.sql (que substitui a função do obra-versao.sql). */
const sqlNovo = fs.readFileSync(path.join(aqui, "..", "..", "..", "supabase", "salvar-obra.sql"), "utf8");
const restaurarSql = sqlNovo.slice(sqlNovo.indexOf("create or replace function public.restaurar_versao_obra("),
  sqlNovo.indexOf("revoke execute on function public.restaurar_versao_obra("));
const gatilhoSql = sqlNovo.slice(sqlNovo.indexOf("create or replace function public.obra_dados_guarda_versao()"),
  sqlNovo.indexOf("revoke execute on function private.obra_dados_controle()"));

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
let respostaDaApi = null;
const pedidos = [];
const M = eval("(function () {\n"
  + "  const supabaseConfigurado = true;\n"
  + "  const supabase = { from: (t) => supabaseStub.from(t) };\n"
  + "  const apiFetch = async (caminho, opcoes) => { pedidos.push({ caminho, opcoes }); return respostaDaApi; };\n"
  + trecho("const semTabela =", ";\n")
  + bloco("export async function listarVersoes(").replace("export ", "")
  + bloco("export async function restaurarVersao(").replace("export ", "")
  + "  return { semTabela, listarVersoes, restaurarVersao };\n"
  + "})()");

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(62)} ${String(o).padEnd(8)} ${ok ? "" : "esperava " + e}`); };

/* ============================================================
   1. O QUE VOLTA — E O QUE NÃO VOLTA — NUMA RESTAURAÇÃO
   A lista mora na função do banco `restaurar_versao_obra`.
   ============================================================ */
const lista = restaurarSql.slice(restaurarSql.indexOf("where e.key in ("), restaurarSql.indexOf(");", restaurarSql.indexOf("where e.key in (")));
const volta = (c) => lista.includes(`'${c}'`);
conf("as categorias voltam", volta("categorias"), true);
conf("os cadernos voltam", volta("cadernos"), true);
conf("os arquivos voltam", volta("arquivos"), true);
conf("as aprovações voltam", volta("aprovacoes"), true);
conf("o CMV liberado volta", volta("cmv_liberado"), true);
conf("as etapas concluídas voltam", volta("etapas_concluidas"), true);

/* A TRAVA NÃO VOLTA. Ela é de agora, não de então — devolver a trava antiga
   deixaria a obra presa em nome de quem já foi embora, e sem ninguém para
   soltá-la a não ser o vencimento de 5 minutos. */
conf("a trava de edição NÃO volta", volta("editando_por"), false);
conf("... nem a hora dela", volta("editando_desde"), false);
/* Identidade da linha não é conteúdo: reescrever o código da obra moveria a
   linha para outra obra. */
conf("o código da obra NÃO volta", volta("obra_codigo"), false);
conf("quem restaurou é quem clicou agora", volta("atualizado_por"), false);
/* A versão sobe na restauração, nunca volta: é o que faz a tela que tinha a
   cópia de antes da restauração não gravar por cima dela. */
conf("a versão da obra NÃO volta", volta("versao"), false);

/* ============================================================
   2. A RESTAURAÇÃO
   Quem decide é o banco (restaurar_versao_obra), pela API. O navegador
   só pede e traduz a resposta.
   ============================================================ */
const resposta = (status, corpo) => ({ ok: status < 400, status, json: async () => corpo });

/* O caminho feliz. */
{
  respostaDaApi = resposta(200, { versao: 12, restaurou: 269, de: "2026-09-18T19:00:00Z" });
  let erro = null;
  const r = await M.restaurarVersao("2450", 7).catch((e) => { erro = e; return null; });
  conf("restaura", pedidos.at(-1)?.caminho, "/api/obras/2450/versoes/7/restaurar");
  conf("... por POST", pedidos.at(-1)?.opcoes?.method, "POST");
  conf("... sem erro", erro, "null");
  conf("... e diz quantos itens voltaram", r?.restaurou, 269);
  conf("... e a versão nova da obra", r?.versao, 12);
}

/* ALGUÉM ESTÁ EDITANDO. Restaurar por cima apagaria o trabalho em andamento. */
{
  respostaDaApi = resposta(409, { motivo: "trava", por: "lorena@x.com" });
  let erro = null;
  await M.restaurarVersao("2450", 7).catch((e) => { erro = e; });
  conf("com a obra em edição, não restaura", /lorena@x\.com está editando/.test(erro?.message || ""), true);
}

/* Versão que não existe mais (podada, ou id inventado). */
{
  respostaDaApi = resposta(404, { error: "Registro não encontrado." });
  let erro = null;
  await M.restaurarVersao("2450", 999).catch((e) => { erro = e; });
  conf("versão inexistente: avisa", /não existe mais/.test(erro?.message || ""), true);
}

/* O banco faz o que o navegador fazia — e mais. */
conf("versão de OUTRA obra é recusada no banco", /if guardada\.obra_codigo <> p_codigo then\s*\n\s*return jsonb_build_object\('ok', false, 'motivo', 'outra_obra'\)/.test(restaurarSql), true);
conf("campo ausente na versão não é escrito (coluna criada depois da cópia)",
  restaurarSql.includes("from jsonb_each(guardada.conteudo) e"), true);
conf("... porque a escrita só mexe no que veio", sqlNovo.includes("categorias                 = case when c ? 'categorias' then c -> 'categorias' else d.categorias end"), true);
conf("não restaura por cima da trava viva de outra pessoa",
  /linha\.dono <> '' and linha\.dono <> quem and linha\.editando_desde > now\(\) - interval '5 minutes' then\s*\n\s*return jsonb_build_object\('ok', false, 'motivo', 'trava'/.test(restaurarSql), true);
/* E a restauração tem que conseguir RECRIAR a linha apagada. UPDATE numa
   linha que não existe não atualiza nada e não reclama: a tela diria
   "restaurado" e nada teria voltado. */
conf("restaurar recria a obra apagada, não só atualiza",
  restaurarSql.includes("insert into public.obra_dados (obra_codigo) values (p_codigo);"), true);
conf("o navegador não grava mais a obra direto na restauração", /\.from\("obra_dados"\)/.test(bloco("export async function restaurarVersao(")), false);

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
conf("... guardando a linha inteira de antes", gatilhoSql.includes("to_jsonb(old)"), true);
/* Guardar a linha inteira (e não coluna por coluna) é o que faz o histórico
   sobreviver a colunas novas sem ninguém mexer no SQL de novo. */
/* HISTÓRICO MAIS FINO (22/09/2026): toda gravação INTEIRA vira versão, e não
   só uma por hora. O patch e a gravação direta seguem de hora em hora. */
conf("... toda gravação inteira", gatilhoSql.includes("inteira      boolean := coalesce(current_setting('confere.gravacao', true), '') = 'inteira';"), true);
conf("... uma por hora nas outras (o marco)", gatilhoSql.includes("eh_marco := ultimo_marco is null or ultimo_marco < now() - interval '1 hour';"), true);
conf("... e SEMPRE que os itens caem", gatilhoSql.includes("if apagando or eh_queda or inteira or eh_marco then"), true);
conf("só a gravação inteira da função liga a cópia fina",
  sqlNovo.includes("nova := private.obra_dados_escrever(p_codigo, p_conteudo, quem, 'inteira', linha.editando_por);"), true);
conf("gravação que não mexeu no conteúdo não vira versão",
  gatilhoSql.includes("(to_jsonb(new) - private.obra_dados_controle())\n       is not distinct from (to_jsonb(old) - private.obra_dados_controle())"), true);

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
  gatilhoSql.includes("if apagando or eh_queda or inteira or eh_marco then"), true);
conf("... e não passa pelo filtro de 'nada mudou'", gatilhoSql.includes("if not apagando then"), true);
conf("depois de apagar sobram zero itens",
  gatilhoSql.includes("depois := case when apagando then 0 else private.obra_conta_itens(new.categorias) end;"), true);
/* Num gatilho BEFORE, devolver NULL CANCELA a operação — um `return NEW`
   no DELETE (NEW é nulo ali) impediria qualquer apagamento no banco. */
conf("o gatilho deixa o apagamento seguir",
  gatilhoSql.includes("return case when apagando then old else new end;"), true);

/* A PODA não pode comer a versão de antes do estrago: é justamente a que
   alguém vem buscar, e as gravações seguintes a empurrariam para fora. */
conf("a poda guarda as quedas por 30 dias",
  gatilhoSql.includes("not (v.queda and v.criado_em > now() - interval '30 days')"), true);
conf("... as 24 mais novas de cada obra", /order by r\.criado_em desc, r\.id desc\s*\n\s*limit 24\)/.test(gatilhoSql), true);
/* Com uma cópia por gravação, uma tarde de digitação empurraria para fora a
   cópia de ontem. Os marcos de hora em hora têm lugar próprio na poda. */
conf("... e os 24 marcos mais novos", /where m\.obra_codigo = old\.obra_codigo and m\.marco\s*\n\s*order by m\.criado_em desc, m\.id desc\s*\n\s*limit 24\)/.test(gatilhoSql), true);
conf("as cópias que já existiam nascem como marcos", sqlNovo.includes("add column if not exists marco boolean not null default true;"), true);

/* Histórico que pode ser editado não é histórico. */
conf("a tabela tem RLS", sql.includes("alter table obra_versao enable row level security"), true);
conf("o time LÊ o histórico", /create policy[^;]*on obra_versao\s*\n\s*for select/.test(sql), true);
conf("e ninguém escreve nele na mão", /for (insert|update|delete)[\s\S]{0,200}on obra_versao/.test(sql), false);
conf("o gatilho passa por cima da RLS pra conseguir gravar", gatilhoSql.includes("security definer"), true);
conf("... com search_path vazio, que é o cuidado que vem junto", gatilhoSql.includes("set search_path = ''"), true);

/* Lista que não é lista vale zero: obra antiga pode ter chave em formato
   velho, e um erro aqui travaria o salvamento da obra inteira. */
conf("contar itens não quebra com formato inesperado",
  sqlNovo.includes("case when jsonb_typeof(c -> 'itens') = 'array' then jsonb_array_length(c -> 'itens') else 0 end"), true);
conf("as quatro fontes contam", /itensContrato[\s\S]{0,300}itensPlanilhaExecutivo/.test(sqlNovo), true);

/* ============================================================
   5. A TELA
   ============================================================ */
conf("restaurar é do admin master",
  app.includes("podeRestaurar={podeGerenciarPessoas(eu, pessoas)}"), true);
conf("as versões moram dentro do Histórico da obra",
  app.includes("<VersoesDaObra obra={obra} podeRestaurar={podeRestaurar} />"), true);
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
