import React, { useEffect, useState } from "react";
import { ConfirmDialog } from "@group-ws/ws-ui";

/* API compartilhada pelas ações de remoção. O host apresenta uma confirmação
   por vez; fechar ou desmontar cancela a ação pendente. */
let abrir = null;

export function confirmar(opcoes) {
  const pedido = typeof opcoes === "string" ? { mensagem: opcoes } : (opcoes || {});
  // Sem o host não há confirmação: nunca autorizar a operação por omissão.
  if (!abrir) return Promise.resolve(false);
  return new Promise((resolve) => abrir({ ...pedido, resolve }));
}

export function ConfirmarHost() {
  const [pedidos, setPedidos] = useState([]);

  useEffect(() => {
    const pendentes = new Set();
    const receber = (pedido) => {
      const resolver = pedido.resolve;
      const item = {
        ...pedido,
        resolve: (resposta) => {
          pendentes.delete(item);
          resolver(resposta);
        },
      };
      pendentes.add(item);
      setPedidos((fila) => [...fila, item]);
    };
    abrir = receber;
    return () => {
      if (abrir === receber) abrir = null;
      for (const pedido of pendentes) pedido.resolve(false);
    };
  }, []);

  const pedido = pedidos[0];
  function responder(resposta) {
    pedido.resolve(resposta);
    setPedidos((fila) => fila.filter((item) => item !== pedido));
  }

  if (!pedido) return null;
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => { if (!open) responder(false); }}
      title={pedido.titulo || "Confirmar remoção"}
      description={pedido.mensagem}
      confirmLabel={pedido.confirmar || "Remover"}
      cancelLabel={pedido.cancelar || "Cancelar"}
      variant={pedido.perigo === false ? "default" : "danger"}
      onConfirm={() => responder(true)}
    />
  );
}
