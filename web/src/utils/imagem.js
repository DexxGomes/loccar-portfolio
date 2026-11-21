// ============================================================================
//  Redução de imagem no NAVEGADOR, antes de enviar.
//
//  Por que: a foto de um celular tem 3–6 MB. Subir isso em 4G no pátio da
//  locadora é lento e caro. Reduzida para 1600px de lado maior em JPEG, a
//  mesma foto fica em 200–400 KB e continua boa para provar um arranhão.
// ============================================================================

/**
 * Lê um arquivo de imagem e devolve um data URL JPEG reduzido.
 * @param {File} arquivo
 * @param {object} [opcoes]
 * @param {number} [opcoes.maxLado=1600] maior dimensão em pixels
 * @param {number} [opcoes.qualidade=0.72]
 * @returns {Promise<string>} data:image/jpeg;base64,...
 */
export async function reduzirImagem(arquivo, { maxLado = 1600, qualidade = 0.72 } = {}) {
  if (!arquivo.type.startsWith('image/')) {
    throw new Error('O arquivo escolhido não é uma imagem.');
  }

  // imageOrientation resolve a foto deitada de celular (dado EXIF).
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });

  const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;

  const ctx = canvas.getContext('2d');
  // Fundo branco: JPEG não tem transparência e PNG transparente sairia preto.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, largura, altura);
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close?.();

  return canvas.toDataURL('image/jpeg', qualidade);
}

/** Tamanho aproximado, em KB, de um data URL base64. */
export function tamanhoKb(dataUrl) {
  const base64 = dataUrl.split(',')[1] || '';
  return Math.round((base64.length * 0.75) / 1024);
}
