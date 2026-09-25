/* A gravação da obra, do lado da tela: o que ela faz para nada se perder.
 *
 * Roda com: node web/src/__testes__/gravacao-na-tela.test.mjs
 *
 * A análise de confiabilidade de 22/09/2026 achou os caminhos em que o que a
 * pessoa digitava não chegava ao banco — ou chegava apagando o trabalho de
 * outra pessoa. Cada bloco abaixo é um deles, fechado:
 *   1. cópia velha: habilitar a edição agora traz a obra do banco;
 *   2. duas gravações ao mesmo tempo: uma fila por obra (a fila é testada em
 *      fila-de-gravacao.test.mjs; aqui, que a tela usa ela);
 *   3. sair da tela engolindo a falha: agora, sem gravar, a trava fica e o
 *      aviso aparece;
 *   4. fechar a aba com trabalho por gravar: o navegador pergunta;
 *   5. mensagem mandando dar F5 antes de o dado estar gravado: não há mais.
 *
 * O resto — trava e versão — é o banco que garante (supabase/salvar-obra.sql,
 * provado em supabase/tests/12-salvar-obra.sql), e a E2E de duas sessões
 * prova no navegador (e2e/duas-sessoes.spec.mjs).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(aqui, "..", "App.jsx"), "utf8");
const dados = fs.readFileSync(path.join(aqui, "..", "lib", "dadosObra.js"), "utf8");
const ui = fs.readFileSync(path.join(aqui, "..", "lib", "gravacaoUi.jsx"), "utf8");
/* Desde que o navegador deixou de falar com o Supabase, quem toma a trava
   (e devolve a obra junto) é a rota. */
const rota = fs.readFileSync(path.join(aqui, "..", "..", "api", "_lib", "rotas", "obraConteudo.js"), "utf8");

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(70)} ${String(o).padEnd(8)} ${ok ? "" : "esperava " + e}`); };
const entre = (texto, a, b) => {
  const i = texto.indexOf(a);
  if (i === -1) throw new Error(`não achei: ${a}`);
  const j = texto.indexOf(b, i + a.length);
  return texto.slice(i, j === -1 ? undefined : j);
};
// Só o código: comentário explica o passado e pode citar o que não se faz mais.
const semComentarios = (texto) => texto
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");

/* ---------- 1. habilitar a edição traz a obra do banco ---------- */
const habilitar = entre(app, "async function habilitarEdicao() {", "\n  }\n");
conf("habilitar pega a trava", habilitar.includes("const r = await pegarEdicao(codigo, usuario);"), true);
conf("... e passa a editar a obra como está no banco AGORA", habilitar.includes("aplicarDadosDoBanco(codigo, r.dados);"), true);
conf("... a não ser que haja alteração desta tela ainda por gravar", /if \(!fila\.temPendencia\(\)\) \{[\s\S]*aplicarDadosDoBanco\(codigo, r\.dados\);/.test(habilitar), true);
conf("... e só então libera a edição",
  habilitar.indexOf("aplicarDadosDoBanco(codigo, r.dados);") < habilitar.indexOf("setEdicao({ minha: true, por: null, desde: null });"), true);
conf("sem a versão no banco (SQL não rodou), a edição não abre",
  /if \(r\.dados\?\.versao == null\) \{[\s\S]*await liberarEdicao\(codigo, usuario\);[\s\S]*return;/.test(habilitar), true);
conf("com conflito em aberto, primeiro a pessoa decide", habilitar.includes('if (fila.situacao().estado === "conflito") return;'), true);
/* A TRAVA VOLTA JUNTO COM A LINHA DO BANCO — é o mesmo UPDATE que toma a
   trava e devolve a obra como ela está naquele instante. Sem isso, quem
   habilitava a edição continuava editando a cópia que abriu de manhã. */
conf("a trava volta junto com a linha do banco",
  /\.update\(\{ editando_por: email, editando_desde: agora \}\)[\s\S]{0,300}\.select\(COLUNAS_DA_OBRA\.join/.test(rota), true);
conf("... e a tela a recebe no formato de sempre", /if \(r\.ok\) return \{ ok: true, dados: paraApp\(doGzip\(r\.gzip\)\) \};/.test(dados), true);
/* A lista de colunas substitui o `select("*")` de antes: campo que faltar
   nela não dá erro nenhum — some da tela como se o banco estivesse vazio. */
conf("a leitura traz todas as colunas que a tela lê",
  Object.keys(Object.fromEntries(
    [...entre(dados, "function paraApp(linha) {", "\n}\n").matchAll(/linha\.([a-z_]+)/g)].map((m) => [m[1], true]),
  )).every((coluna) => entre(rota, "const COLUNAS_DA_OBRA = [", "\n];").includes(`"${coluna}"`)), true);
conf("a leitura traz a versão", dados.includes("versao: linha.versao ?? null,"), true);
/* COLUNA QUE AINDA NÃO EXISTE NÃO DERRUBA A OBRA. Entre publicar o app e
   alguém rodar o SQL novo, o Postgres recusa a leitura INTEIRA por causa de
   uma coluna desconhecida. O `select("*")` de antes atravessava essa janela
   sozinho; a lista de colunas só atravessa com este retry. */
conf("coluna que ainda não existe cai no conjunto mínimo",
  rota.includes("const COLUNAS_DE_SEMPRE = [") && /faltaColuna\(completa\.error\)/.test(rota), true);
conf("... e o mínimo não inclui as colunas que vieram depois",
  ["versao", "escopos", "etapas_concluidas", "cmv_liberado"]
    .every((c) => !entre(rota, "const COLUNAS_DE_SEMPRE = [", "\n];").includes(`"${c}"`)), true);
const aplicar = entre(app, "function aplicarDadosDoBanco(codigo, dados) {", "\n  }\n");
conf("aplicar o que veio do banco guarda a versão lida", aplicar.includes("versaoDaObra.current.set(chave, dados.versao ?? null);"), true);
conf("... e marca que não é alteração de ninguém", aplicar.includes("cargaDoBanco.current.add(chave);"), true);
const abrir = entre(app, "// Ao abrir uma obra, traz o que já foi salvo dela.", "}, [obra?.codigo, usuario, cargaPedida]);");
conf("abrir a obra não passa por cima do que falta gravar", abrir.includes("if (!filaDaObra(codigo).temPendencia()) aplicarDadosDoBanco(codigo, dados);"), true);

/* ---------- 2. uma fila por obra ---------- */
conf("a tela usa a fila de gravação", app.includes("fila = criarFilaDeGravacao({"), true);
conf("... uma por obra, guardada enquanto a aba viver", app.includes("filasDeGravacao.current.set(chave, fila);"), true);
conf("... e a situação de cada uma vai para a tela", app.includes("aoMudar: (situacao) => setGravacoes((prev) => new Map(prev).set(chave, situacao)),"), true);
const marcar = entre(app, "// Toda mudança de conteúdo na obra, com a edição habilitada, entra na fila.", "}, [obra, edicao.minha]);");
conf("toda mudança de conteúdo, editando, entra na fila", marcar.includes("filaDaObra(codigo).alterou();"), true);
conf("... mas o que chegou do banco não conta", marcar.includes("if (cargaDoBanco.current.delete(codigo)) return;"), true);
conf("... nem o que não vai ao banco (aditivos, totais)", marcar.includes("mesmoConteudo(antes, obra)"), true);
conf("o salvamento antigo, de relógio solto, não existe mais", /setTimeout\(async \(\) => \{\s*\n\s*setSalvando\("salvando"\)/.test(app), false);
const rodada = entre(app, "async function gravarUmaVez(codigo) {", "\n  }\n");
conf("a gravação lê a obra na hora de gravar", rodada.includes("const atual = obrasRef.current.find((o) => String(o.codigo) === codigo);"), true);
conf("... e se apresenta com a versão que a tela conhece", rodada.includes("const r = await salvarDadosObra(codigo, atual, v);"), true);
conf("... guardando a versão nova que o banco devolve", rodada.includes("versaoDaObra.current.set(codigo, r.versao);"), true);
conf("as obras mais recentes chegam antes das limpezas dos efeitos", app.includes("useLayoutEffect(() => { obrasRef.current = obras; }, [obras]);"), true);
const retomar = entre(app, "async function gravarObraAgora(codigo) {", "\n  }\n");
conf("trava solta sem dono: assume de novo e tenta uma vez", retomar.includes("const r = await pegarEdicao(codigo, usuario)"), true);
conf("... mas nunca por cima da trava viva de outra pessoa", retomar.includes("(d.por && travaViva(d.desde))"), true);
conf("conflito volta a tela ao modo leitura",
  /if \(gravacaoDaObra\?\.estado === "conflito" && edicao\.minha\) setEdicao\(\{ minha: false, por: null, desde: null \}\);/.test(app), true);

/* ---------- 3. sair da tela: grava e só então solta; sem gravar, não solta ---------- */
const trava = entre(app, "useEffect(() => {\n    const codigo = edicao.minha && naObra && obra?.codigo ? String(obra.codigo) : null;", "}, [edicao.minha, naObra, obra?.codigo, usuario, telaDeTrabalho]);");
conf("sair da tela esvazia a fila da obra", trava.includes("filaDaObra(codigo).descarregar()"), true);
conf("... e só depois devolve a trava", /\.descarregar\(\)\s*\n\s*\.then\(\(\) => \{[\s\S]*return liberarEdicao\(codigo, usuario\);/.test(trava), true);
conf("a falha não é mais engolida calada", /catch\(\(\) => \{\}\)/.test(semComentarios(trava)), false);
conf("... fica registrada e a trava continua com a tela", trava.includes("a trava fica com esta tela até gravar"), true);
conf("voltou a editar enquanto a gravação esperava: a trava fica", trava.includes("if (travaRef.current === codigo) return undefined;"), true);
const pagehide = entre(app, "window.addEventListener(\"pagehide\", sair);", "\n  }, [usuario]);");
const sair = entre(app, "const sair = () => {\n      const codigo = travaRef.current;", "window.addEventListener(\"pagehide\", sair);");
conf("fechar a aba com gravação pendente não solta a trava", sair.includes("if (!codigo || filaDaObra(codigo).temPendencia()) return;"), true);
conf("(o ouvinte do pagehide segue registrado)", pagehide.length > 0, true);
conf("finalizar é voltar ao modo leitura; a limpeza grava e solta",
  /function finalizarEdicao\(\) \{\s*\n\s*setEdicao\(\{ minha: false, por: null, desde: null \}\);\s*\n\s*\}/.test(app), true);

/* ---------- 4. fechar a aba, esconder, voltar a rede ---------- */
const guarda = entre(app, "/* NÃO SAIR COM TRABALHO POR GRAVAR.", "/* RECARREGAR A OBRA DO BANCO");
conf("fechar ou recarregar com trabalho por gravar: o navegador pergunta", guarda.includes('window.addEventListener("beforeunload", antesDeSair);'), true);
conf("... só quando há o que gravar", guarda.includes("if (!filas().some((f) => f.temPendencia())) return;"), true);
conf("... e manda o que falta na mesma hora", guarda.includes("filas().forEach((f) => { f.gravarAgora(); });"), true);
conf("aba escondida grava sem esperar a mão parar", guarda.includes('if (document.visibilityState === "hidden") filas().forEach((f) => { f.gravarAgora(); });'), true);
conf("a rede voltou: tenta na hora", guarda.includes('window.addEventListener("online", aoVoltarARede);'), true);
const saida = entre(app, "async function sairDaConta() {", "\n  }\n");
conf("sair da conta grava antes o que falta", saida.includes("filas.map((f) => f.descarregar())"), true);
conf("... e, se não der, pergunta antes de descartar", saida.includes('titulo: "Descartar alterações?"'), true);
conf("... com os botões do catálogo de mensagens", saida.includes('confirmar: "Descartar", cancelar: "Continuar editando"'), true);

/* ---------- 5. a tela diz o que acontece, sem mandar dar F5 ---------- */
conf("o aviso da gravação aparece em qualquer tela", app.includes("<AvisosDeGravacao gravacoes={gravacoes}"), true);
conf("... com a saída de recarregar a obra (sempre perguntando antes)", /async function recarregarObra\(codigo\) \{[\s\S]*titulo: "Recarregar a obra\?"/.test(app), true);
conf("a faixa da edição mostra a situação da gravação", app.includes("<SituacaoDaGravacao situacao={gravacao} onTentarAgora={onTentarGravar} discreta />"), true);
/* Um lugar só na faixa, fora dos ramos do estado: vale para quem edita e
   para o modo leitura (quem acabou de finalizar vê o 'salvo'). */
conf("... também em modo leitura (quem acabou de finalizar vê o 'salvo')", app.includes("{podeMostrarGravacao && (gravacao || edicao.minha) && ("), true);
conf("a contagem da nova tentativa anda sozinha", ui.includes("const t = setInterval(() => setAgora(Date.now()), 1000);"), true);
/* O aviso de recusa e conflito é flutuante (toast), não um bloco no topo
   que empurra a obra (pedido de 25/09/2026). */
conf("os avisos são flutuantes (toast), não bloco no topo", ui.includes("mostrar(aviso.titulo, aviso.descricao, { id, duracao: Infinity, acao, secundaria });"), true);
conf("... e somem quando a gravação se resolve", ui.includes("avisar.fechar(id)"), true);
/* O estado da barra é um selo do DS com ícone e cor (23/09/2026), e o
   "salvo" diz a hora. */
conf("a situação da barra é um Badge do DS", ui.includes("<Badge tone={selo.tom}>"), true);
conf("... e o salvo diz a hora", ui.includes("hora ? `Salvo às ${hora}`"), true);
conf("o erro de gravação não vai mais para o aviso genérico", /setErroBanco\(`Não consegui salvar/.test(app), false);
const gravacaoNoCodigo = semComentarios(entre(app, "/* ---------- A GRAVAÇÃO DA OBRA ----------", "/* A FILA DE PATCHES"));
conf("nenhuma mensagem da gravação manda dar F5", /F5|[Rr]ecarregue a página/.test(gravacaoNoCodigo), false);
conf("nem o lib da obra", /F5|[Rr]ecarregue a página/.test(semComentarios(dados)), false);

/* ---------- 6. quem altera a obra por fora da tela ---------- */
conf("a Apresentação e o Catálogo passam pela trava e pela versão", dados.includes("export async function alterarObra(codigo, email, mudar) {"), true);
conf("... e, com a obra em edição nesta aba, a mudança entra pela tela",
  /definirEdicaoNestaAba\(\(codigo, mudar\) => \{\s*\n\s*if \(travaRef\.current !== codigo\) return false;/.test(app), true);
conf("o navegador não grava mais a obra com UPSERT", /\.upsert\(linha/.test(dados), false);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
