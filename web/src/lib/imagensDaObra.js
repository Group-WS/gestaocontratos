import { useEffect, useRef, useState } from "react";
import { enderecosDeImagens } from "./apresentacao";

/* OS ENDEREÇOS DAS IMAGENS DA OBRA, PARA A TELA MOSTRAR.
 *
 * As imagens de ambiente moram no balde privado da obra, então não existe um
 * endereço fixo: cada um é assinado pela API e vale uma hora. Este gancho
 * pede os endereços dos caminhos que a tela precisa (todos de uma vez),
 * guarda o que já pediu e renova antes de vencer — uma apresentação fica
 * aberta a tarde inteira, e o que não fosse renovado viraria imagem quebrada
 * no meio do trabalho.
 */

// Renova com folga: o endereço vale 60 minutos.
const VALIDADE_MS = 50 * 60 * 1000;

export function useImagensDaObra(obraCodigo, caminhos) {
  const [mapa, setMapa] = useState({});
  const [rodada, setRodada] = useState(0);
  const pedidos = useRef(new Map());   // caminho -> quando foi pedido

  // A chave é a lista ordenada: o efeito só roda de novo quando entra ou
  // sai um caminho, e não a cada tecla no editor.
  const chave = [...new Set((caminhos || []).filter(Boolean))].sort().join("|");

  useEffect(() => {
    pedidos.current = new Map();
    setMapa({});
  }, [obraCodigo]);

  useEffect(() => {
    if (!obraCodigo || !chave) return undefined;
    const agora = Date.now();
    const faltam = chave.split("|").filter((c) => {
      const quando = pedidos.current.get(c);
      return quando === undefined || agora - quando > VALIDADE_MS;
    });
    if (!faltam.length) return undefined;

    let vivo = true;
    faltam.forEach((c) => pedidos.current.set(c, agora));
    enderecosDeImagens(obraCodigo, faltam)
      .then((urls) => { if (vivo) setMapa((m) => ({ ...m, ...urls })); })
      // Deu errado: esquece o pedido para a próxima volta tentar de novo.
      .catch(() => faltam.forEach((c) => pedidos.current.delete(c)));
    return () => { vivo = false; };
  }, [obraCodigo, chave, rodada]);

  useEffect(() => {
    const t = setInterval(() => setRodada((n) => n + 1), VALIDADE_MS);
    return () => clearInterval(t);
  }, []);

  return { url: (caminho) => (caminho ? mapa[caminho] || null : null) };
}
