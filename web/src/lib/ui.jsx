import { useEffect, useState } from "react";

/* Breakpoint `lg` do Tailwind: acima dele a barra lateral fica fixa na
   tela; abaixo, ela abre num Sheet pelo botão de menu do topo. */
export const LARGO = "(min-width: 1024px)";

/* Verdadeiro enquanto a media query casa. Serve pra montar UMA das duas
   cascas (barra fixa ou Sheet) — nunca as duas ao mesmo tempo, senão os
   popovers e as refs de dentro dobram. */
export function useMediaQuery(query) {
  const [casa, setCasa] = useState(() => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false));
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const ouvir = () => setCasa(mq.matches);
    ouvir();
    mq.addEventListener("change", ouvir);
    return () => mq.removeEventListener("change", ouvir);
  }, [query]);
  return casa;
}

/* Contador pequeno e redondo, pra pendurar num ícone ou no fim de uma
   linha (alertas da obra, pendências da equipe, obras finalizadas). */
export function Contador({ tom = "brand", className = "", children }) {
  const cor = { brand: "bg-brand text-bg", danger: "bg-danger text-bg", warning: "bg-warning text-bg", neutral: "bg-surface-4 text-text-soft" }[tom] || "bg-brand text-bg";
  return (
    <span className={`flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-xs font-semibold leading-none ${cor} ${className}`}>
      {children}
    </span>
  );
}
