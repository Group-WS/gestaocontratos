/* O selo — no lugar de trinta e quatro classes.
 *
 * A camada do Design System agrupa 34 nomes diferentes numa lista :is()
 * so' (.pill, .chip, .gc-selo, .tipo-tag, .tag-aditivo, .conf-badge...),
 * todos com a MESMA aparencia: mono, caixa alta, fundo suave, pilula.
 * Trinta e quatro nomes para uma coisa e' o sintoma mais claro de que
 * faltava onde escolher.
 *
 * O que varia de verdade nao e' a forma, e' o TOM — e tom aqui significa
 * estado, nao decoracao. Por isso sao cinco e nao mais:
 *
 *   neutro   o que simplesmente e' (uma categoria, um canal)
 *   ok       o que esta' resolvido
 *   atencao  o que ainda da' tempo
 *   risco    o que ja' custa
 *   info     recado, que nao e' estado do item — indigo de proposito,
 *            porque verde, ambar e vermelho ja' significam estado
 *
 * As classes canonicas entraram na mesma lista :is(), entao a forma vem
 * de la' e aqui so' mora a cor. Nao muda um pixel do que ja' existe. */

const TONS = {
  neutro: "",
  ok: "selo-ok",
  atencao: "selo-atencao",
  risco: "selo-risco",
  info: "selo-info",
};

export default function Selo({ tom = "neutro", Icone, titulo, className = "", children, ...resto }) {
  return (
    <span className={`selo ${TONS[tom] || ""} ${className}`.trim()} title={titulo} {...resto}>
      {Icone && <Icone size={10} aria-hidden="true" />}
      {children}
    </span>
  );
}
