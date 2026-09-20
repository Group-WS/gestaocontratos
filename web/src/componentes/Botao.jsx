/* Um botao, quatro variantes — no lugar de CINQUENTA E UMA classes.
 *
 * O app tem 51 nomes de classe `btn-*`, e a camada do Design System ja'
 * agrupa todas elas em quatro aparencias, com listas :is(...) de ate' 18
 * classes cada. Ou seja: as quatro variantes SEMPRE existiram — o que
 * faltava era um lugar pra escolher entre elas sem inventar a 52a.
 *
 * As classes canonicas (btn-primario, btn-contorno, btn-tracejado,
 * btn-icone) entraram nessas mesmas listas :is(). Por isso este componente
 * nao muda um pixel: ele veste a roupa que ja' estava pendurada.
 *
 * As 51 classes antigas continuam funcionando. Migrar as ~300 chamadas de
 * uma vez seria um diff enorme, sem mudanca visual, disputando o mesmo
 * arquivo com quem mais estiver mexendo nele. Elas saem aos poucos; o que
 * importa e' que codigo NOVO tenha um caminho so'.
 *
 * O `rotulo` vira aria-label. Botao so' de icone SEM rotulo e' o defeito
 * que o botoes-tem-nome.test.mjs vigia — oito existiam, todos de fechar.
 * Aqui o componente avisa em desenvolvimento, antes de virar teste. */

const VARIANTES = {
  primario: "btn-primario",     // a acao principal da tela: fundo cheio
  contorno: "btn-contorno",     // as demais: borda, fundo do papel
  tracejado: "btn-tracejado",   // "adicionar mais um": borda pontilhada
  icone: "btn-icone",           // so' o simbolo, sem moldura
};

export default function Botao({
  variante = "contorno",
  rotulo,                 // aria-label — obrigatorio quando so' ha' icone
  carregando = false,
  carregandoRotulo,       // o que a pessoa le' enquanto espera
  disabled,
  className = "",
  children,
  type = "button",
  ...resto
}) {
  const classe = VARIANTES[variante] || VARIANTES.contorno;

  if (import.meta.env?.DEV && !rotulo) {
    /* So' o icone chega como elemento; texto chega como string ou numero.
       Se nao ha' nenhum texto e nao ha' rotulo, ninguem que usa leitor de
       tela sabe o que este botao faz. */
    const temTexto = [].concat(children ?? []).some((c) => typeof c === "string" || typeof c === "number");
    if (!temTexto && children) {
      console.warn("[Botao] so' com icone e sem `rotulo` — quem usa leitor de tela ouve apenas \"botao\".", children);
    }
  }

  return (
    <button
      type={type}
      className={`${classe} ${className}`.trim()}
      aria-label={rotulo}
      /* aria-busy diz que o botao esta' ocupado sem mudar o nome dele:
         trocar o texto por "Enviando…" faz o leitor reanunciar o botao
         inteiro, e a pessoa perde o lugar. */
      aria-busy={carregando || undefined}
      disabled={disabled || carregando}
      {...resto}
    >
      {carregando && carregandoRotulo ? carregandoRotulo : children}
    </button>
  );
}
