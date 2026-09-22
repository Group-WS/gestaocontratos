/* PREPARAR A FOTO ANTES DE SUBIR.
 *
 * A foto de um ambiente sai do celular com 4 a 8 MB e 4000 px de lado. Ela
 * era enviada inteira, e isso: (1) não cabe no corpo de uma função da Vercel
 * (4,5 MB), (2) deixa o PDF da apresentação pesado a ponto de não abrir no
 * e-mail do cliente e (3) enche o depósito com pixel que nenhum slide mostra
 * — o slide inteiro tem menos de 2000 px de largura.
 *
 * Aqui ela é reduzida no navegador, antes de sair: lado maior de 2000 px,
 * JPEG de qualidade 0,85. O que a pessoa vê no editor e no PDF é o mesmo.
 */

export const LADO_MAIOR = 2000;
export const QUALIDADE = 0.85;

/** A foto reduzida, em JPEG. Lança quando o navegador não sabe abrir o arquivo. */
export async function reduzirImagem(file, { ladoMaior = LADO_MAIOR, qualidade = QUALIDADE } = {}) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // HEIC do iPhone, arquivo corrompido, PDF com nome de imagem.
    throw new Error("Não consegui ler esta imagem. Salve como JPG ou PNG e tente de novo.");
  }

  const escala = Math.min(1, ladoMaior / Math.max(bitmap.width, bitmap.height));
  const largura = Math.max(1, Math.round(bitmap.width * escala));
  const altura = Math.max(1, Math.round(bitmap.height * escala));

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  /* Fundo branco: PNG com transparência vira JPEG, que não tem transparência
     — sem isto, o que era transparente sai preto no slide. */
  ctx.fillStyle = "#ffffff"; // gate-allow DS-03: fundo da FOTO que vira JPEG, não cor de tela — o canvas não lê os tokens do app, e o slide impresso é branco em qualquer tema
  ctx.fillRect(0, 0, largura, altura);
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", qualidade));
  if (!blob) throw new Error("Não consegui preparar esta imagem para o envio.");
  return { tipo: "image/jpeg", bytes: new Uint8Array(await blob.arrayBuffer()) };
}
