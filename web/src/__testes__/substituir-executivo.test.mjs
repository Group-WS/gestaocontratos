/* Substituir a Planilha Executivo: trava e aviso.
 *
 * Roda com: node web/src/__testes__/substituir-executivo.test.mjs
 *
 * Pedido dela em 19/09/2026: "se uma pessoa clica em substituir a planilha do
 * executivo, pode apagar tudo que esta pra frente. vamos criar uma regra que:
 * se tiver algo ja liberado para compra, somente admin pode fazer essa
 * alteracao."
 *
 * Ela estava certa, e o motivo é uma linha só de `importPlanilhaExecutivo`:
 *
 *     return { ...c, itens: doArquivo, itensPlanilhaExecutivo: doArquivo };
 *
 * `itens` é TROCADA pela lista do arquivo. E é nela que moram a aprovação
 * para compra, o concluído executivo, o comprado, a solicitação ao Sienge, o
 * canal, a alocação MAT/MO, as trocas de produto e as remoções com
 * justificativa. Nada é comparado: é trocado.
 *
 * A trava que existia usava `comprasLiberadas`, a chave ANTIGA — de antes de
 * a aprovação virar item a item (ADR-005). Medido em 19/09/2026: a obra 2469
 * tinha 230 aprovações, 132 solicitações ao Sienge e 5 compras com essa chave
 * em `false`, e qualquer pessoa que editasse podia trocar a planilha.
 *
 * Escolha dela: permissão E aviso com os números. Só trancar mudaria QUEM
 * aperta o botão; o estrago seguiria igual e silencioso.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(aqui, "..", "App.jsx"), "utf8");
const sql = fs.readFileSync(path.join(aqui, "..", "..", "..", "supabase", "obra-versao.sql"), "utf8");

const bloco = (assinatura, fim = "\n}\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei em App.jsx: ${assinatura}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};

const M = eval("(function () {\n"
  + bloco("function liberadoParaCompra(")
  + bloco("function resumoDoQueSePerde(")
  + bloco("function frasesDoQueSePerde(")
  + "  return { resumoDoQueSePerde, frasesDoQueSePerde };\n"
  + "})()");

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(60)} ${String(o).padEnd(10)} ${ok ? "" : "esperava " + e}`); };

/* ============================================================
   1. A CONTA DO QUE SE PERDE
   ============================================================ */
const obra = {
  categorias: [
    { num: "01", itens: [
      { ehTitulo: true, desc: "um título não é item" },
      { desc: "a", liberadoCompra: true, concluidoExecutivo: true },
      { desc: "b", liberadoCompra: true, solicitado: true },
      { desc: "c", comprado: true, liberadoCompra: true },
    ] },
    { num: "02", itens: [
      { desc: "d" },
      { desc: "e", excluido: true, excluidoMotivo: "saiu do escopo do cliente" },
      { desc: "f", troca: { em: "2026-09-18" } },
    ] },
  ],
};
const r = M.resumoDoQueSePerde(obra);

conf("título não conta como item", r.itens, 6);
conf("conta os aprovados para compra", r.liberados, 3);
conf("conta os concluídos no executivo", r.concluidos, 1);
conf("conta os comprados", r.comprados, 1);
conf("conta os solicitados ao Sienge", r.solicitados, 1);
conf("conta as remoções com justificativa", r.removidos, 1);
conf("conta as trocas de produto", r.trocas, 1);

conf("obra vazia não quebra", M.resumoDoQueSePerde({}).itens, 0);
conf("obra nula não quebra", M.resumoDoQueSePerde(null).liberados, 0);

/* A frase só lista o que EXISTE. Dizer "0 compras" ao lado de "230
   aprovações" dilui justamente o número que importa. */
const frases = M.frasesDoQueSePerde(r);
conf("a frase lista só o que existe", frases.length, 6);
conf("... e começa pelo que mais dói", /aprovados para compra/.test(frases[0]), true);
const soLiberados = M.frasesDoQueSePerde({ itens: 10, liberados: 1, concluidos: 0, comprados: 0, solicitados: 0, removidos: 0, trocas: 0 });
conf("obra só com aprovação: uma linha só", soLiberados.length, 1);
conf("... no singular", soLiberados[0], "1 item aprovado para compra");
conf("nada a perder: nenhuma linha",
  M.frasesDoQueSePerde({ itens: 9, liberados: 0, concluidos: 0, comprados: 0, solicitados: 0, removidos: 0, trocas: 0 }).length, 0);

/* ============================================================
   2. A TRAVA
   ============================================================ */
/* A chave é a aprovação item a item, NÃO a `comprasLiberadas` antiga —
   é essa troca que faz a trava voltar a proteger alguma coisa. */
conf("a trava olha os aprovados, não a chave antiga",
  src.includes("const trocaCustaCaro = perdas.liberados > 0;"), true);
conf("... e só o administrador passa",
  src.includes("const trocaTravada = congelado || (trocaCustaCaro && !souAdmin);"), true);
conf("... na troca da planilha",
  src.includes('<ImportButton congelado={trocaTravada} label={temExecutivo ? "Substituir Planilha Executivo"'), true);
// A trava de admin é só da troca: as células seguem editáveis para quem
// está com a edição (pedido de 23/09 — "volta como era antes").
conf("editar célula não exige admin",
  src.includes("const congelado = obra.comprasLiberadas || !podeEditar;\n"), true);
conf("a tela diz que é permissão, não modo leitura",
  src.includes("só um <b>administrador</b> pode fazer isso."), true);
conf("... dizendo quantas aprovações estão em jogo",
  src.includes("{perdas.liberados} {perdas.liberados === 1 ? \"item aprovado\" : \"itens aprovados\"} para compra"), true);
conf("o Executivo recebe quem é admin", src.includes("podeEditar={edicao.minha} souAdmin={souAdmin} />"), true);

/* ============================================================
   3. O AVISO — uma pergunta só, e ANTES de aplicar o arquivo
   ============================================================ */
/* Até 23/09/2026 eram duas perguntas seguidas (o que se perde, antes de
   ler; o resumo das verbas, depois). Juntas numa só: as duas acontecem
   antes de APLICAR — se viessem depois, a planilha já teria entrado. */
const i0 = src.indexOf("function ExecutivoView(");
const exec = src.slice(i0, src.indexOf("\nfunction ", i0 + 10));
const importar = exec.slice(exec.indexOf("async function aoImportar(file)"));
conf("o aviso é perguntado antes de aplicar o arquivo",
  importar.indexOf("await confirmarImportacao(") > -1
  && importar.indexOf("await confirmarImportacao(") < importar.indexOf("onImportPlanilhaExecutivo(itens)"), true);
conf("... numa pergunta só (o aviso de antes da leitura saiu)", src.includes("avisoAntesDeTrocar"), false);
conf("... e 'cancelar' não deixa nada acontecer",
  src.includes("if (!ok) {\n      const desistiu = new Error(\"Importação cancelada.\");"), true);
conf("o que se perde só entra quando há planilha E há o que perder",
  exec.includes("perda: temExecutivo && trocaCustaCaro ? frasesDoQueSePerde(perdas) : null"), true);
conf("com perda, a pergunta é de perigo", src.includes("confirmar: temPerda ? \"Trocar mesmo assim\" : \"Importar\","), true);
conf("o aviso diz que se apaga nas verbas trocadas", src.includes("Nas verbas trocadas, isso é apagado."), true);
conf("... que o que vem novo entra zerado", src.includes("O que o arquivo novo trouxer entra zerado"), true);
conf("... e que dá para voltar atrás", src.includes("O histórico de versões guarda o estado de agora"), true);

/* ============================================================
   4. A REDE DE SEGURANÇA NO BANCO
   ============================================================ */
/* O gatilho guardava versão quando o número de itens caía. Numa troca de
   planilha o número quase não muda — some o ESTADO. Sem isto, a gravação
   mais perigosa do app passaria pelo filtro de uma hora sem deixar cópia. */
conf("o banco sabe contar aprovados", sql.includes("create or replace function obra_conta_liberados("), true);

/* Item removido não conta.
 *
 * Este teste já cobrou a grafia exata da linha
 * (`and not coalesce((it ->> 'excluido')::boolean, false)`) e ficou vermelho
 * quando 456d8a1 a reescreveu — sem que nada tivesse quebrado. Cobrar texto
 * literal de SQL é assim: quem conserta o código é que leva o erro.
 *
 * Agora ele cobra as duas coisas que importam de verdade, e nenhuma delas é
 * a redação: que a conta olha `excluido`, e que NÃO usa `::boolean` nele.
 * O `::boolean` é o bug de 20/09 — `liberadoCompra` virou carimbo, a
 * conversão derrubou a instrução, e como esta conta roda dentro do gatilho,
 * quem caiu foi o UPDATE: toda obra com item liberado parou de salvar. */
/* Sem os comentários: o da própria função conta a história do `::boolean`,
   e cobrar a palavra no comentário acusaria justamente quem a documentou. */
const conta = sql.slice(
  sql.indexOf("create or replace function obra_conta_liberados("),
  sql.indexOf("$$;", sql.indexOf("create or replace function obra_conta_liberados("))
).replace(/--.*$/gm, "");
conf("... ignorando item removido", /excluido/.test(conta), true);
conf("... sem converter com ::boolean (foi o bug de 20/09)",
  /::boolean/.test(conta), false);
conf("perder aprovação conta como queda",
  sql.includes("or (case when apagando then 0 else obra_conta_liberados(NEW.categorias) end)"), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
