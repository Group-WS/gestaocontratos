import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* A CONFIRMACAO DE REMOCAO (20/09/2026).

   Toda remocao passa por aqui antes de acontecer: o usuario ve o que vai
   sair e escolhe continuar ou nao. Troca o window.confirm, que nao segue o
   tema, some no celular em alguns navegadores e nao deixa pintar de vermelho
   o botao que apaga.

   Uso: `if (!(await confirmar("Excluir X?"))) return;`
   ou   `confirmar({ titulo, mensagem, confirmar: "Excluir" })`.
   Devolve uma Promise<boolean>. Esc e clique fora contam como "nao". */

let abrir = null;

export function confirmar(opcoes) {
  const o = typeof opcoes === "string" ? { mensagem: opcoes } : (opcoes || {});
  if (!abrir) return Promise.resolve(window.confirm(o.mensagem || o.titulo || "Continuar?"));
  return new Promise((resolve) => abrir({ ...o, resolve }));
}

/* Montado uma vez, na raiz. */
export function ConfirmarHost() {
  const [pedido, setPedido] = useState(null);
  const btnRef = useRef(null);

  useEffect(() => {
    abrir = setPedido;
    return () => { abrir = null; };
  }, []);

  const responder = (sim) => {
    pedido?.resolve(sim);
    setPedido(null);
  };

  useEffect(() => {
    if (!pedido) return;
    btnRef.current?.focus();
    const tecla = (e) => { if (e.key === "Escape") { e.stopPropagation(); responder(false); } };
    window.addEventListener("keydown", tecla, true);
    return () => window.removeEventListener("keydown", tecla, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido]);

  if (!pedido) return null;
  const titulo = pedido.titulo || "Confirmar remoção";
  const perigo = pedido.perigo !== false;

  return createPortal(
    <div className="sobreposto-fundo confirmar-fundo"
      onClick={(e) => { if (e.target === e.currentTarget) responder(false); }}>
      <div className="sobreposto-caixa confirmar-caixa" role="alertdialog" aria-modal="true" aria-label={titulo}>
        <div className="sobreposto-topo"><b>{titulo}</b></div>
        {pedido.mensagem && <div className="sobreposto-corpo confirmar-msg">{pedido.mensagem}</div>}
        <div className="sobreposto-rodape">
          <button type="button" className="btn-cancelar" onClick={() => responder(false)}>
            {pedido.cancelar || "Cancelar"}
          </button>
          <button type="button" ref={btnRef}
            className={perigo ? "btn-linha-excluir-confirma confirmar-ok" : "btn-cancelar confirmar-ok"}
            onClick={() => responder(true)}>
            {pedido.confirmar || "Remover"}
          </button>
        </div>
      </div>
      <style>{`
        .confirmar-fundo { z-index: 1400; }
        .confirmar-caixa { width: min(440px, 100%); }
        .confirmar-msg { white-space: pre-line; font-size: 13.5px; line-height: 1.5; }
        .confirmar-ok { min-height: 38px; padding: 0 16px; border-radius: 10px; font-size: 13px; }
      `}</style>
    </div>,
    document.body
  );
}
