/* O contorno do que esta' chegando.
 *
 * O app inteiro carregava com uma frase: "Carregando as obras…". Frase
 * nao diz QUANTO vem nem COMO e', entao a tela pula quando o conteudo
 * chega — e a cada carregamento a pessoa reencontra a tela do zero.
 *
 * O `.animate-shimmer` existe no design-system.css desde que ele foi
 * portado, e nunca tinha sido usado uma vez. Este componente e' o
 * primeiro uso.
 *
 * aria-hidden nas barras: elas nao significam nada faladas — "retangulo,
 * retangulo, retangulo". Quem ouve recebe a palavra, uma vez, pelo
 * `rotulo`. */
export default function Esqueleto({ linhas = 3, altura = 16, rotulo = "Carregando…", classe = "" }) {
  return (
    <div className={`esqueleto ${classe}`}>
      <span className="sr-apenas">{rotulo}</span>
      {Array.from({ length: linhas }, (_, i) => (
        <span key={i} aria-hidden="true" className="esqueleto-barra animate-shimmer"
          style={{
            height: altura,
            /* A ultima barra e' mais curta: bloco de texto acaba no meio da
               linha, e barras todas do mesmo tamanho leem como tabela. */
            width: i === linhas - 1 ? "62%" : "100%",
          }} />
      ))}
    </div>
  );
}
