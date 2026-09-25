/* A trava de edição vence, e a tela tem que concordar com isso.
 *
 * Roda com: node web/src/__testes__/trava-vencida.test.mjs
 *
 * Em 17/09/2026 a tarja dentro da obra dizia "alexandre está editando desde
 * 10:47" às 13:02 — 136 minutos depois, com o cadeado da barra lateral já
 * apagado. O vencimento estava aplicado ao ASSUMIR a trava (`pegarEdicao`) e
 * ao listar o cadeado (`listarTravas`), mas não ao LER a obra. Quem olhava
 * achava que não podia mexer, e podia.
 *
 * O arquivo é fatiado em vez de importado: `dadosObra.js` puxa o cliente do
 * Supabase logo na primeira linha, e o Node não resolve esse import fora do
 * Vite.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "lib", "dadosObra.js"), "utf8");
/* O vencimento vale em três lugares, e dois deles passaram para a API
   quando o navegador deixou de falar com o Supabase: a condição do UPDATE
   que toma a trava e o filtro da lista de cadeados. O terceiro — a leitura
   da obra — continua aqui, em `paraApp`. */
const rota = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "api", "_lib", "rotas", "obraConteudo.js"), "utf8");
const bloco = (assinatura, fim = "\n}\n") => {
  const i = src.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei em dadosObra.js: ${assinatura}`);
  return src.slice(i, src.indexOf(fim, i) + fim.length);
};
const linha = (comeco) => {
  const i = src.indexOf(comeco);
  if (i === -1) throw new Error(`não achei em dadosObra.js: ${comeco}`);
  return src.slice(i, src.indexOf("\n", i) + 1);
};

const M = eval(`(function () {
  ${linha("export const MINUTOS_ATE_TRAVA_EXPIRAR").replace("export ", "")}
  ${bloco("export function travaViva(").replace("export ", "")}
  return { travaViva, MINUTOS_ATE_TRAVA_EXPIRAR };
})()`);

let f = 0;
const conf = (n, o, e) => { const ok = String(o) === String(e); if (!ok) f++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${n.padEnd(58)} ${String(o).padEnd(12)} ${ok ? "" : "esperava " + e}`); };

const minutosAtras = (m) => new Date(Date.now() - m * 60_000).toISOString();

/* 5 minutos desde a última alteração — era 30, e ela pediu a troca em
   17/09/2026 depois de ver a obra parada com a tarja de outra pessoa. */
conf("prazo é de 5 minutos", M.MINUTOS_ATE_TRAVA_EXPIRAR, 5);
conf("acabou de pegar, vale", M.travaViva(new Date().toISOString()), true);
conf("4 minutos, ainda vale", M.travaViva(minutosAtras(4)), true);
conf("6 minutos, venceu", M.travaViva(minutosAtras(6)), false);
conf("o caso real (136 min) venceu", M.travaViva(minutosAtras(136)), false);

/* Sem data não há trava: `liberarEdicao` zera os dois campos juntos, e linha
   antiga pode ter e-mail sem data. Nos dois casos a obra está livre. */
conf("sem data, não é trava", M.travaViva(null), false);
conf("data vazia, não é trava", M.travaViva(""), false);
conf("data undefined, não é trava", M.travaViva(undefined), false);
conf("data sem sentido, não é trava", M.travaViva("qualquer coisa"), false);

/* Relógio adiantado no cliente devolveria data no futuro. Ainda é trava viva:
   soltar cedo demais deixa duas pessoas gravando por cima uma da outra, que é
   pior do que esperar. */
conf("data no futuro ainda é trava", M.travaViva(minutosAtras(-5)), true);

/* A leitura da obra tem que usar a mesma régua do cadeado da lista lateral —
   é a divergência entre as duas que criou o caso de 17/09. */
conf("a leitura da obra aplica a régua", /editandoPor: travaViva\(/.test(src), true);
conf("a trava que a tela não conseguiu pegar também", /por: travaViva\(r\.desde\)/.test(src), true);
conf("listarTravas continua filtrando por data", /\.gte\("editando_desde", limiteDaTrava\(\)\)/.test(rota), true);
/* O MESMO PRAZO NOS DOIS LADOS. O servidor não importa a constante da tela
   (são mundos separados): prazo diferente aqui e lá faria o cadeado sumir
   da lista com a obra ainda travada, ou o contrário. */
conf("o servidor usa o mesmo prazo", /const MINUTOS_ATE_TRAVA_EXPIRAR = 5;/.test(rota), true);

/* QUEM CHEGA EM SEGUNDO LUGAR NÃO TOMA A TRAVA.
   A condição vai DENTRO do UPDATE: ler, decidir e só então gravar deixaria
   a fresta em que as duas pessoas leem "livre" antes de qualquer uma
   escrever. Isto vive na rota desde que a gravação passou pela API. */
const pegar = rota.slice(rota.indexOf('rotas.post("/api/obras/:codigo/edicao"'), rota.indexOf("/** Devolve a obra pros outros"));
conf("a trava é tomada por UPDATE condicional",
  /\.update\(\{ editando_por: email, editando_desde: agora \}\)[\s\S]{0,200}\.or\(`editando_por\.is\.null,editando_por\.eq\.\$\{email\},editando_desde\.lt\.\$\{limite\}`\)/.test(pegar), true);
conf("... com o e-mail de quem está logado, não o que o pedido mandou",
  pegar.includes("const email = req.usuario.email;"), true);

/* A TELA TAMBÉM DESISTE, e não só o banco.
   Sem isto, passado o prazo a trava apenas PODE ser assumida por outra
   pessoa — mas quem abriu continuava com "Editando" na tela, digitando numa
   obra que já era de outro. O efeito devolve o modo leitura; quem grava
   antes de soltar é a limpeza do efeito da trava, e por isso ele não solta. */
const app = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "App.jsx"), "utf8");
conf("a tela desabilita a edição sozinha", /setEdicao\(\{ minha: false, por: null, desde: null \}\);\s*\}, MINUTOS_ATE_TRAVA_EXPIRAR \* 60_000\)/.test(app), true);
conf("o relógio reinicia a cada alteração da obra", app.includes("}, [edicao.minha, naObra, obra, usuario]);"), true);
conf("a tarja promete o prazo de verdade", app.includes("Libera sozinho após ${MINUTOS_ATE_TRAVA_EXPIRAR} min sem alteração"), true);

/* A TRAVA DE OUTRA PESSOA TAMBÉM VENCE NA TELA.
   Caso dela, 17/09/2026: mandou a verba 30 sem botão nenhum — "cortinas e
   persianas ta ficando preso na liberacao". Não era a verba. Ela tinha
   aberto a obra enquanto outra pessoa editava, e esse "fulano está
   editando" ficava guardado para sempre: os 5 minutos só eram conferidos na
   LEITURA da obra. A trava vencia no banco, a pessoa ia embora, e a tela
   continuava em modo leitura.

   E não havia saída pela própria tela: o botão "Habilitar edição" fica
   escondido justamente enquanto ela acha que a obra é de outro. */
conf("a tela confere a trava alheia com o relógio andando",
  /if \(!travaViva\(edicao\.desde\)\) setEdicao\(\{ minha: false, por: null, desde: null \}\);/.test(app), true);
conf("... de tempos em tempos, não só ao abrir", /const t = setInterval\(vencer, 30_000\);/.test(app), true);
conf("... e já na primeira passada", /vencer\(\);\s*\n\s*const t = setInterval\(vencer/.test(app), true);
conf("o App importa a régua em vez de recriá-la",
  /import \{[^}]*travaViva[^}]*\} from "\.\/lib\/dadosObra"/.test(app), true);
/* Vencer NÃO é tomar. Pegar a obra continua sendo um clique consciente: se a
   outra pessoa ainda estiver lá, o clique volta com o nome e a hora nova. */
const efeito = app.slice(app.indexOf("A TRAVA DE OUTRA PESSOA TAMBEM VENCE"), app.indexOf("TROCAR DE TELA VOLTA PRO MODO LEITURA"));
conf("vencer não toma a trava sozinho", /pegarEdicao\(/.test(efeito), false);
/* O botão mora na faixa da edição, no topo (25/09/2026): a associação ao
   Sienge voltou pra linha e o aviso de modo leitura ficou só lá em cima. */
const faixa = app.slice(app.indexOf('selo = <Badge tone="brand"><Eye size={12} aria-hidden="true" /> Modo leitura</Badge>;'),
  app.indexOf("const podeMostrarGravacao"));
conf("o botão de habilitar aparece quando não há dono",
  faixa.includes("onClick={onHabilitar}") && app.includes("{edicao.por} está editando"), true);

console.log(f === 0 ? "\nOK — todas passaram" : `\n${f} falha(s)`);
process.exit(f === 0 ? 0 : 1);
