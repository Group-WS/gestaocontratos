import React, { useEffect, useState } from "react";
import { ConfirmDialog, MessageDialog, Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogBody, DialogFooter, Button, Field, Label, Input } from "@group-ws/ws-ui";
import { toast } from "sonner";

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

/* ---------------------------------------------------------------------------
   Aviso modal (substitui window.alert): para o que o usuário precisa LER antes
   de seguir — validação de negócio que bloqueia a ação em curso.
   Retorno de ação concluída ou falha fora de formulário é toast (`avisar`).
   --------------------------------------------------------------------------- */
let abrirMensagem = null;

export function mensagem(opcoes) {
  const pedido = typeof opcoes === "string" ? { mensagem: opcoes } : (opcoes || {});
  if (!abrirMensagem) return Promise.resolve();
  return new Promise((resolve) => abrirMensagem({ ...pedido, resolve }));
}

export function MensagemHost() {
  const [pedidos, setPedidos] = useState([]);
  useEffect(() => {
    const receber = (pedido) => setPedidos((fila) => [...fila, pedido]);
    abrirMensagem = receber;
    return () => { if (abrirMensagem === receber) abrirMensagem = null; };
  }, []);
  const pedido = pedidos[0];
  if (!pedido) return null;
  return (
    <MessageDialog
      open
      onOpenChange={(open) => {
        if (open) return;
        pedido.resolve();
        setPedidos((fila) => fila.filter((item) => item !== pedido));
      }}
      title={pedido.titulo || "Atenção"}
      message={pedido.mensagem}
      description={pedido.detalhe}
      tone={pedido.tom || "warning"}
      dismissLabel={pedido.fechar || "Entendi"}
    />
  );
}

/* ---------------------------------------------------------------------------
   Pergunta com resposta em texto (substitui window.prompt). Resolve com a
   string digitada ou null quando a pessoa cancela ou fecha o diálogo.
   --------------------------------------------------------------------------- */
let abrirPergunta = null;

export function perguntar(opcoes) {
  const pedido = typeof opcoes === "string" ? { mensagem: opcoes } : (opcoes || {});
  if (!abrirPergunta) return Promise.resolve(null);
  return new Promise((resolve) => abrirPergunta({ ...pedido, resolve }));
}

function PerguntaDialog({ pedido, onResponder }) {
  const [valor, setValor] = useState(pedido.inicial || "");
  const id = React.useId();
  const enviar = (e) => { e.preventDefault(); onResponder(valor); };
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onResponder(null); }}>
      <DialogContent size="sm">
        <form onSubmit={enviar}>
          <DialogHeader>
            <DialogTitle>{pedido.titulo || "Informe um valor"}</DialogTitle>
            {pedido.mensagem && <DialogDescription>{pedido.mensagem}</DialogDescription>}
          </DialogHeader>
          <DialogBody>
            <Field>
              <Label htmlFor={id}>{pedido.rotulo || "Valor"}</Label>
              <Input id={id} autoFocus value={valor} inputMode={pedido.inputMode}
                placeholder={pedido.placeholder} onChange={(e) => setValor(e.target.value)} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onResponder(null)}>{pedido.cancelar || "Cancelar"}</Button>
            <Button type="submit">{pedido.confirmar || "Confirmar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PerguntarHost() {
  const [pedidos, setPedidos] = useState([]);
  useEffect(() => {
    const receber = (pedido) => setPedidos((fila) => [...fila, pedido]);
    abrirPergunta = receber;
    return () => { if (abrirPergunta === receber) abrirPergunta = null; };
  }, []);
  const pedido = pedidos[0];
  if (!pedido) return null;
  return (
    <PerguntaDialog key={pedidos.length} pedido={pedido} onResponder={(resposta) => {
      pedido.resolve(resposta);
      setPedidos((fila) => fila.filter((item) => item !== pedido));
    }} />
  );
}

/* Toast padronizado (TELA-50/51): sucesso "<Entidade> <particípio>.",
   erro "Não foi possível <verbo>…". */
export const avisar = {
  ok: (texto, descricao) => toast.success(texto, descricao ? { description: descricao } : undefined),
  erro: (texto, descricao) => toast.error(texto, descricao ? { description: descricao } : undefined),
  info: (texto, descricao) => toast(texto, descricao ? { description: descricao } : undefined),
};
