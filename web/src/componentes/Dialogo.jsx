import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/* A sobreposicao que bloqueia a tela — uma so', para todas.
 *
 * Existiam SEIS, escritas a mao, cada uma lembrando de uma parte:
 * RecortadorFoto tinha Escape e role, o detalhe do item tinha clique fora
 * e mais nada, a barra do PDF tinha Escape mas nenhum papel, o Simulador
 * tinha role e clique fora. Nenhuma das seis prendia o foco, e nenhuma
 * devolvia o foco pra onde ele estava.
 *
 * O que isso custa, na pratica: com a caixa aberta, o Tab passeia por tras
 * dela. Quem navega por teclado vai parar num botao que nao consegue ver,
 * clica, e alguma coisa acontece fora da caixa. E ao fechar, o foco volta
 * pro comeco da pagina em vez do botao que abriu — entao a pessoa precisa
 * percorrer a tela inteira de novo pra continuar de onde parou.
 *
 * As CLASSES continuam vindo de fora. Cada caixa dessas ja' tem o seu
 * desenho (sobreposto-caixa, detalhe-caixa, rel-barra, sim-painel), e
 * uniformizar isso e' outra conversa — esta aqui e' so' sobre
 * comportamento, e por isso nao muda um pixel. */
export default function Dialogo({
  rotulo,                 // vira aria-label: diz o que e' a caixa pra quem nao a ve
  onFechar,
  fundo,                  // classe do plano de fundo
  caixa,                  // classe da caixa; sem ela o proprio fundo e' a caixa —
                          // ha' sobreposicao com DOIS filhos irmaos (a barra do
                          // PDF e o visor), e embrulhar os dois mudaria o layout
  fecharNoFundo = true,   // clicar fora fecha
  podeFechar = true,      // false enquanto algo esta' em voo (envio, upload)
  children,
}) {
  const refCaixa = useRef(null);
  const refAnterior = useRef(null);

  useEffect(() => {
    /* Quem tinha o foco antes de abrir. E' pra ca' que ele volta. */
    refAnterior.current = document.activeElement;

    /* O primeiro campo da caixa recebe o foco. Sem isso o leitor de tela
       continua lendo a pagina de tras, e o Tab comeca do topo do documento. */
    const focaveis = () => [...(refCaixa.current?.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) || [])];
    const primeiro = focaveis()[0];
    (primeiro || refCaixa.current)?.focus();

    const naTecla = (e) => {
      if (e.key === "Escape" && podeFechar) { e.stopPropagation(); onFechar?.(); return; }
      if (e.key !== "Tab") return;
      /* A armadilha: o Tab no ultimo volta pro primeiro, e o Shift+Tab no
         primeiro vai pro ultimo. So' isso mantem o teclado dentro. */
      const lista = focaveis();
      if (lista.length === 0) { e.preventDefault(); return; }
      const primeiro = lista[0], ultimo = lista[lista.length - 1];
      if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
      else if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
    };
    document.addEventListener("keydown", naTecla, true);

    /* A pagina de tras para de rolar: rolar o que esta' atras de uma caixa
       aberta da' a impressao de que o clique passou. */
    const rolagem = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", naTecla, true);
      document.body.style.overflow = rolagem;
      /* `focus` num elemento que saiu do documento nao faz nada e nao da'
         erro — o teste do `isConnected` e' so' pra nao tentar a toa. */
      if (refAnterior.current?.isConnected) refAnterior.current.focus();
    };
  }, [onFechar, podeFechar]);

  const papel = { role: "dialog", "aria-modal": "true", "aria-label": rotulo, tabIndex: -1 };
  const aoClicar = (e) => {
    if (!fecharNoFundo || !podeFechar) return;
    if (e.target === e.currentTarget) onFechar?.();
  };

  return createPortal(
    caixa ? (
      <div className={fundo} onClick={aoClicar}>
        <div ref={refCaixa} className={caixa} {...papel}>{children}</div>
      </div>
    ) : (
      <div ref={refCaixa} className={fundo} onClick={aoClicar} {...papel}>{children}</div>
    ),
    document.body,
  );
}
