/* Foto de perfil e o menu do trilho (19/09/2026).
 *
 * Roda com: node web/src/__testes__/foto-perfil.test.mjs
 *
 * Pedido dela: clicar no avatar do trilho abrir a opção de escolher uma
 * foto — "fica mais pessoal o app" — num menu pequeno, com Meus dados e
 * Sair; e a foto aparecer também na saudação do Início.
 *
 * O que estes testes guardam:
 *
 *   1. O MENU FLUTUA. Ele não tinha `position`, e como a `.barra` é
 *      `display: flex` ele entrava como item flex e virava uma COLUNA de
 *      altura inteira que empurrava a lista de obras pro lado. Era isso o
 *      "menu grande" do pedido — não o conteúdo, o posicionamento.
 *   2. UM AVATAR SÓ. A bolinha estava copiada em cinco lugares, e um
 *      deles calculava as iniciais DIFERENTE: a tela Equipe pegava as
 *      duas primeiras letras ("Priscila Wayhs" → "PR"), os outros a
 *      inicial de cada palavra ("PW"). A mesma pessoa tinha duas
 *      iniciais dependendo da tela.
 *   3. SEM FOTO, NADA MUDA. A saudação do Início só ganha a bolinha
 *      quando existe foto — o comentário que tirou o avatar de lá falava
 *      de INICIAIS, que de fato não dizem nada que o nome ao lado já não
 *      diga. Foto diz.
 *   4. SOBE, DEPOIS GRAVA. Gravar o caminho antes de a imagem existir
 *      deixaria um avatar quebrado no lugar do rosto.
 */
import { readFileSync } from "fs";
const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const lib = readFileSync(new URL("../lib/pessoas.js", import.meta.url), "utf8");
const sql = readFileSync(new URL("../../../supabase/foto-perfil.sql", import.meta.url), "utf8");

const bloco = (assinatura, fim = "\n}\n") => {
  const i = app.indexOf(assinatura);
  if (i === -1) throw new Error(`não achei no App.jsx: ${assinatura}`);
  return app.slice(i, app.indexOf(fim, i) + fim.length);
};
const { iniciaisDe } = eval(`(function(){ ${bloco("function iniciaisDe(")}; return { iniciaisDe }; })()`);

let falhas = 0;
const conf = (nome, obtido, esperado = true) => {
  const ok = String(obtido) === String(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHOU"} ${nome.padEnd(56)} ${ok ? "" : `${obtido} (esperava ${esperado})`}`);
};

console.log("=== 1. O MENU FLUTUA, NÃO OCUPA COLUNA ===");
/* O menu e' um Popover do DS: flutua por portal, fecha fora e no Esc. */
conf("o menu é um Popover do DS", app.includes('<Popover open={menuPerfil} onOpenChange={setMenuPerfil}>'));
conf("... aberto à direita do trilho", app.includes('<PopoverContent ref={menuRef} side="right" align="end"'));
conf("... e largura própria", /<PopoverContent [^>]*className="w-64 p-2"/.test(app));
conf("a .barra segue sticky, que é a referência", app.includes('<aside className="barra naoimprime sticky top-16 flex shrink-0" ref={barraRef}>'));
// a regra que TINHA position mirava uma classe que nao existe mais
conf("a regra morta .sidebar.recolhida saiu", app.includes(".sidebar.recolhida .perfil-menu {"), false);

console.log("\n=== 2. UM AVATAR SÓ, UMA FÓRMULA SÓ ===");
conf("duas palavras viram duas letras", iniciaisDe("Priscila Wayhs"), "PW");
conf("um nome só vira uma letra", iniciaisDe("Priscila"), "P");
conf("três palavras param em duas", iniciaisDe("Ana Júlia Salvadori"), "AJ");
conf("espaço a mais não conta como palavra", iniciaisDe("  Ana   Júlia  "), "AJ");
conf("sem nome não quebra", iniciaisDe(""), "?");
conf("sem nome nenhum também não", iniciaisDe(null), "?");
// a formula divergente da tela Equipe tinha que sumir: "Priscila Wayhs" -> "PR"
conf("a fórmula de duas letras da Equipe saiu", app.includes('.slice(0, 2).toUpperCase()}</div>'), false);
conf("o componente existe", app.includes("function Avatar({ pessoa, nome, classe"));
conf("... e cai nas iniciais quando não há foto", /if \(url\) \{[\s\S]{0,400}return <div className=\{classe\}[^>]*>\{vazio \?\? iniciaisDe\(quem\)\}/.test(app));
// os pontos que antes calculavam iniciais sozinhos
conf("trilho usa o componente", app.includes('<Avatar pessoa={euNaEquipe} nome={meuNome} classe="avatar avatar-sm" />'));
/* O TOPO NÃO TEM MAIS AVATAR. Pedido dela em 20/09/2026, olhando a tela:
   "esse avatar aqui em cima pode retirar, já tem lá embaixo". Aquele era só a
   foto — não abria nada; o do pé do trilho é o que tem o menu de perfil. Duas
   fotos iguais na mesma tela fazem quem olha procurar a diferença entre elas,
   e a única diferença era que uma funcionava e a outra não. */
conf("o topo não repete a foto", /<div className="topbar-right">[\s\S]{0,900}<Avatar/.test(app), false);
conf("equipe da obra usa", app.includes("classe={`equipe-avatar ${valor ? \"\" : \"vazio\"}`}"));
conf("tela Equipe usa", app.includes("classe={`eq-avatar ${estaOnline(p) ? \"online\" : \"\"}`}"));
conf("a foto é recortada, nunca esticada", app.includes(".avatar-foto { object-fit: cover;"));

// O dashboard de 20/09 segue a referência: identidade permanece no trilho,
// sem repetir a saudação com avatar acima dos indicadores.
conf("o dashboard não duplica o avatar do trilho", app.includes('classe="ini-foto"'), false);

console.log("\n=== 4. O MENU: FOTO, MEUS DADOS, SAIR ===");
conf("a própria foto é o botão de trocar", /<Button asChild variant="ghost" size="icon" className=\{cn\("group relative h-10 w-10 shrink-0 cursor-pointer rounded-full p-0"[\s\S]{0,1200}<input type="file"/.test(app));
conf("a câmera só aparece no hover", app.includes("opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"));
conf("Meus dados abre e fecha", app.includes('<Collapsible open={verDados} onOpenChange={setVerDados}>'));
conf("... em leitura, com o motivo escrito", app.includes("O nome é alterado por quem cuida da Equipe."));
// pedido dela: o cartao mostra so' nome e e-mail
conf("cargo ficou fora do cartão", app.includes("<div><span>Cargo</span>"), false);
conf("perfil também", app.includes("<div><span>Perfil</span>"), false);
conf("dá pra voltar pras iniciais", app.includes("Remover a foto"));
conf("Sair continua como estava", app.includes('<Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={onSair}>'));
conf("erro de upload aparece no menu", app.includes('{erroFoto && <p className="px-2 pb-2 text-xs text-danger">{erroFoto}</p>}'));

console.log("\n=== 5. SOBE, DEPOIS GRAVA ===");
const troca = bloco("  async function trocarMinhaFoto(file, recorte) {");
conf("o upload vem antes do banco", troca.indexOf("subirFotoPerfil") < troca.indexOf("definirFotoPerfil"));
conf("remover manda caminho nulo", troca.includes("const caminho = file ? await subirFotoPerfil(file, usuario, recorte) : null;"));
// a lista de pessoas e' uma so': trilho, Inicio e Equipe leem dela
conf("a lista local é atualizada na hora", troca.includes("setPessoas((antes) => antes.map("));

console.log("\n=== 6. A CAMADA DA FOTO ===");
conf("foto entra no mapeamento do banco", lib.includes("foto: l.foto === undefined ? undefined : (l.foto || null),"));
conf("a imagem é reduzida antes de subir", lib.includes("const LADO_FOTO = 256;"));
/* Fonte QUADRADA em destino quadrado: é o que impede o retrato em pé de
   ser esticado pra caber. O "de onde" virou escolha da pessoa (ver a
   seção 11); o "quadrado" continua sendo regra. */
conf("recorte quadrado, nunca esticado", lib.includes("ctx.drawImage(img, sx, sy, lado, lado, 0, 0, LADO_FOTO, LADO_FOTO);"));
conf("carimbo de tempo fura o cache", lib.includes("${PASTA_FOTO}/${quem}/${Date.now()}.jpg"));
conf("o balde é o do catálogo, não um novo", lib.includes('const BALDE_FOTO = "catalogo";'));
conf("a url é síncrona, pra entrar no src", lib.includes("export function urlDaFoto(caminho) {"));
conf("grava pela função, não por upsert", lib.includes('supabase.rpc("definir_foto", { caminho: caminho || "" })'));
conf("e diz qual SQL falta rodar", lib.includes("Falta rodar supabase/foto-perfil.sql"));

console.log("\n=== 7. O SQL ===");
conf("a coluna é reaplicável", sql.includes("alter table pessoa add column if not exists foto text;"));
conf("security definer, como o registrar_acesso", sql.includes("language plpgsql volatile security definer set search_path = public"));
conf("o e-mail vem do login, não de parâmetro", sql.includes("where email = lower(auth.jwt() ->> 'email')"));
// sem isso, alguem apontaria o proprio avatar pra foto de um produto
conf("o caminho é obrigado a ser de pessoas/", sql.includes("caminho not like 'pessoas/%'"));
conf("caminho vazio apaga a foto", sql.includes("set foto = nullif(caminho, '')"));
conf("só autenticado executa", sql.includes("grant execute on function public.definir_foto(text) to authenticated;"));
conf("e ninguém mais", sql.includes("revoke all on function public.definir_foto(text) from public;"));

/* ---- A BARRA RECOLHE SOZINHA DEPOIS DA ESCOLHA (19/09/2026) ----
 *
 * "depois que eu seleciono a obra, no primeiro clique fora da side bar deve
 * recolher a side bar."
 *
 * UMA VEZ POR OBRA. Se ela reabrir a lista pelo botão de dobrar, é porque
 * quer a lista aberta — recolher de novo no clique seguinte seria o app
 * discutindo com ela. O rearme só volta quando outra obra for escolhida.
 *
 * Não confundir com o relato anterior, do mesmo dia: "no primeiro clique
 * DENTRO a barra recolhe", que era defeito. Dentro não recolhe; fora sim.
 */
conf("o recolher olha a obra escolhida", app.includes("const recolhidoPor = useRef(null);"));
conf("... e não repete na mesma obra", app.includes("if (recolhidoPor.current === selected) return;"));
conf("clique DENTRO da barra não recolhe", app.includes("if (barraRef.current && barraRef.current.contains(e.target)) return;"));
conf("marca a obra antes de recolher", /recolhidoPor\.current = selected;\s*\n\s*setPainelEscondido\(true\);/.test(app));
conf("só arma com painel aberto e obra escolhida", app.includes("if (!largo || !temPainel || !selected) return;"));
/* CLICK, nao mousedown: recolher no mousedown tirava o painel e jogava o
   conteudo 280px pra esquerda antes do mouseup, entao o alvo fugia de
   baixo do cursor. "clico em Planejamento, ele recolhe a tela e eu tenho
   que clicar em Planejamento novamente". */
conf("ouve o click, pra o alvo resolver primeiro", app.includes('document.addEventListener("click", fora);'));
conf("... e nao o mousedown, que engolia o clique", /recolhidoPor[\s\S]{0,700}addEventListener\("mousedown"/.test(app), false);
conf("e solta o ouvinte ao sair", app.includes('return () => document.removeEventListener("click", fora);'));
// o botao Obras continua so' mostrando: era defeito dela, ja' corrigido antes
conf("o capacete Obras segue só mostrando, nunca escondendo",
  /rotulo="Obras"[\s\S]{0,200}setPainelEscondido\(false\);/.test(app));

/* ---- O RECORTADOR CIRCULAR (20/09/2026) ----
 *
 * "ao subir a imagem, deve abrir um redimensionador de imagem pra colocar
 * no tamanho, colocar tipo bolinha já para o usuário ajustar."
 *
 * Antes, `quadradoDe` pegava o quadrado do MEIO e pronto: foto de corpo
 * inteiro saía cortada no lugar errado, sem o que fazer além de trocar a
 * foto e torcer.
 *
 * A máscara é redonda desde o primeiro quadro, e não quadrada — o avatar
 * é um círculo, e enquadrar num quadrado para descobrir depois o que o
 * círculo comeu é adivinhar duas vezes.
 */
const lib2 = readFileSync(new URL("../lib/pessoas.js", import.meta.url), "utf8");

console.log("\n=== 8. O RECORTADOR ===");
conf("o componente existe", app.includes("function RecortadorFoto({ file, onConfirmar, onCancelar }) {"));
conf("sai por portal, como o outro modal do app", /RecortadorFoto[\s\S]{0,6000}return createPortal\(/.test(app));
conf("usa a moldura de modal que já existe", app.includes('className="sobreposto-caixa recorte-caixa"'));
conf("fecha no Escape", /RecortadorFoto[\s\S]{0,1500}if \(e\.key === "Escape"\) onCancelar\(\);/.test(app));
conf("e no clique no fundo", /className="sobreposto-fundo" onClick=\{\(e\) => \{ if \(e\.target === e\.currentTarget\) onCancelar\(\); \}\}/.test(app));
// a mascara e' redonda: e' o ponto do pedido
conf("a máscara é um círculo", app.includes(".recorte-mascara { position: absolute;") && app.includes("border-radius: 50%; box-shadow: 0 0 0 9999px"));
/* StrictMode monta, limpa e monta de novo. Com o useMemo criando a URL e
   um efeito separado revogando, a limpeza matava o endereço que a segunda
   montagem ainda usava: a janela abria PRETA, com naturalWidth 0 e
   complete true — e nada no console dizia por quê. Criar e revogar têm
   que viver no mesmo efeito. */
/* NÃO revogar na limpeza do efeito, e isso é deliberado.

   Em StrictMode o React monta, limpa e monta de novo. A limpeza revogava
   um endereço cuja LEITURA ainda estava em curso. Com arquivo em memória
   a leitura termina na hora e nada aparece — foi por isso que todos os
   testes daqui passaram enquanto ela via preto. Com arquivo do DISCO, que
   é o caso real, o endereço morre no meio da leitura.

   Um endereço por troca de foto, liberado quando a página fecha, custa
   nada perto de a função não funcionar. */
conf("não revoga o endereço em uso", app.includes("return () => URL.revokeObjectURL(u);"), false);
conf("... nem por useMemo, que o StrictMode fura", app.includes("const url = useMemo(() => URL.createObjectURL(file)"), false);
/* Arquivo novo, começo novo: sem isto um erro passageiro ficava grudado e
   a imagem seguinte nunca mais era desenhada. */
conf("arquivo novo limpa erro e medida anteriores", /useEffect\(\(\) => \{\s*\n\s*setErro\(null\);\s*\n\s*setImg\(null\);\s*\n\s*setUrl\(URL\.createObjectURL\(file\)\);/.test(app));
// "nao abriu" sem dizer qual arquivo ja' me fez chutar errado duas vezes
conf("a mensagem diz qual arquivo era", app.includes('{file.name} · {file.type || "tipo desconhecido"} · {(file.size / 1024 / 1024).toFixed(1)} MB'));

console.log("\n=== 9. O ARRASTE ===");
// setPointerCapture: sem ele a imagem "cai" quando o cursor sai da area
conf("captura o ponteiro, pra o arrasto não cair", app.includes("e.currentTarget.setPointerCapture?.(e.pointerId);"));
conf("o mesmo código serve pro toque", app.includes("onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}"));
// sem isto o navegador rouba o gesto e arrasta a imagem como arquivo
conf("a imagem não é arrastável pelo navegador", app.includes('alt="" draggable={false} className="recorte-img"'));
conf("touch-action none, senão o celular rola a página", app.includes("touch-action: none;"));
// a imagem nunca pode descobrir o circulo
conf("o arrasto é limitado pela folga da máscara", app.includes("const folgaX = Math.max(0, (larg - LADO_MASCARA) / 2);"));

console.log("\n=== 10. ZOOM POR BOTÕES, NÃO POR BARRA ===");
// o app nunca teve <input type="range">; o zoom dele e' stepper
conf("passos discretos, como o zoom da Apresentação", app.includes("const ZOOM_FOTO = [1, 1.25, 1.5, 2, 2.5, 3, 4];"));
conf("não entrou barra deslizante", app.includes('type="range"'), false);
conf("tem o desfazer de quem arrastou demais", app.includes("Centralizar"));
conf("e a prévia no tamanho real do avatar", app.includes("recorte-previa-bolinha"));

console.log("\n=== 11. O RECORTE CHEGA NO ARQUIVO ===");
conf("o recorte sai da tela em pixels da imagem", app.includes("const lado = LADO_MASCARA / escala;"));
conf("quadradoDe aceita o recorte", lib2.includes("function quadradoDe(file, recorte) {"));
conf("... e usa quando vem", lib2.includes("const lado = recorte?.lado || Math.min(img.width, img.height);"));
// sem recortador, segue o centro: e' o caminho de quando ele nao pode rodar
conf("sem recorte, mantém o centro de antes", lib2.includes("const sx = recorte ? recorte.sx : (img.width - lado) / 2;"));
conf("subirFotoPerfil repassa", lib2.includes("export async function subirFotoPerfil(file, email, recorte) {"));

console.log("\n=== 12. O MENU SAI DE CENA ===");
/* O menu fecha ao clique fora. Com o recortador aberto, cada clique
   DENTRO dele seria "fora" do menu — o menu fecharia e levaria o
   recortador junto se ele morasse lá dentro. */
conf("escolher a foto fecha o menu", /setMenuPerfil\(false\);\s*\n\s*setFotoEscolhida\(file\);/.test(app));
conf("o recortador mora na barra, fora do menu", app.includes("{fotoEscolhida && (\n        <RecortadorFoto file={fotoEscolhida}"));
conf("cancelar devolve o menu", app.includes("onCancelar={() => { setFotoEscolhida(null); setMenuPerfil(true); }}"));
conf("e o erro também, pra ser lido", /setErroFoto\(err\.message\);\s*\n\s*setMenuPerfil\(true\);/.test(app));

/* ---- A JANELA PRETA E CALADA (20/09/2026) ----
 *
 * "subi a foto e nao apareceu nada .. ficou preto."
 *
 * Duas falhas somadas:
 *
 *   1. `accept="image/*"` deixava o seletor do Mac oferecer HEIC — o
 *      formato padrão de foto de iPhone e da Fototeca. NENHUM navegador
 *      desenha HEIC num <img>. O balde do app aceita heic para anexo de
 *      obra, o que torna fácil supor que aqui também vale.
 *   2. Não havia `onError` nem medição do tamanho: a imagem "terminava"
 *      de carregar com naturalWidth 0 e a janela ficava preta, sem uma
 *      palavra. Preto e calado é pior do que um erro: não há o que fazer.
 */
console.log("\n=== 13. IMAGEM QUE O NAVEGADOR NÃO ABRE ===");
conf("o seletor só oferece o que o navegador lê", app.includes('accept="image/jpeg,image/png,image/webp"'));
conf("... e não mais image/* solto", app.includes('accept="image/*"'), false);
// HEIC escolhido por "todos os arquivos" nao chega a abrir janela preta
/* O NOME NÃO BASTA. O caso real dela chegou como "IMG_0889-Edit.jpg",
   tipo "image/jpeg", e era HEIC por dentro: o macOS carimba o tipo pela
   extensão, não pelo conteúdo. Checar só nome e type deixava passar
   exatamente o arquivo que derrubava a janela. */
conf("o formato sai dos BYTES, não do nome", app.includes("async function formatoReal(file) {"));
conf("reconhece a família HEIC pelo ftyp", app.includes('if (txt(4, 4) === "ftyp") {'));
conf("... incluindo o mif1 que o iPhone usa", app.includes('/^(hei|hev|mif1|msf1|avif|avis)/.test(marca)'));
conf("e barra antes de abrir a janela", app.includes("formatoReal(file).then((fmt) => {"));
// mensagem diferente pra cada caso: .heic assumido x .jpg disfarcado
conf("o disfarçado tem mensagem própria", app.includes("é HEIC por dentro, apesar do nome .jpg"));
conf("... com o caminho da saída no Mac", app.includes("Pré-Visualização, use Arquivo > Exportar e escolha JPEG"));
conf("a mensagem diz a saída, não só o problema", app.includes("exporte como JPEG e tente de novo."));
// onError nao dispara em todo navegador: medir e' o unico jeito honesto
conf("tamanho zero conta como ilegível", app.includes("if (!w || !h) { falhou(); return; }"));
conf("e o onError também avisa", app.includes("onError={falhou}"));
/* Falhando, a mensagem sai do CONTEÚDO do arquivo: o HEIC disfarçado
   recebe a instrução de exportar, não o genérico. */
conf("a falha consulta o formato real", app.includes('formatoReal(file).then((fmt) => setErro(fmt === "heic" ? MSG_HEIC_DISFARCADO : MSG_IMAGEM_ILEGIVEL))'));
// imagem em cache pode terminar antes de o React pendurar o onLoad
conf("imagem já completa não fica esquecida", app.includes("if (!el || img || erro || !el.complete) return;"));
conf("não dá pra confirmar o que não abriu", app.includes("disabled={!img || !!erro}"));

console.log(falhas === 0 ? "\nTUDO OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
