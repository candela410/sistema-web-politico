// Prepara la foto de perfil antes de enviarla: la recorta cuadrada (desde el
// centro), la achica a 256 px y la convierte a JPEG. Así pesa unos 15-25 KB
// aunque la original sea una foto de varios MB del celular.
const LADO = 256
const TIPOS = ['image/jpeg', 'image/png', 'image/webp']

export async function fotoCuadrada(archivo) {
  if (!TIPOS.includes(archivo.type)) throw new Error('Elija una imagen JPG, PNG o WebP.')
  if (archivo.size > 15 * 1024 * 1024) throw new Error('La imagen pesa demasiado (máximo 15 MB).')
  const url = URL.createObjectURL(archivo)
  try {
    const img = await new Promise((ok, mal) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = () => mal(new Error('No se pudo leer la imagen.'))
      i.src = url
    })
    const lado = Math.min(img.naturalWidth, img.naturalHeight)
    const lienzo = document.createElement('canvas')
    lienzo.width = LADO
    lienzo.height = LADO
    const dibujo = lienzo.getContext('2d')
    // Fondo blanco: los PNG con transparencia no quedan con fondo negro al pasar a JPEG
    dibujo.fillStyle = '#fff'
    dibujo.fillRect(0, 0, LADO, LADO)
    dibujo.drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, LADO, LADO)
    return lienzo.toDataURL('image/jpeg', 0.85)
  } finally {
    URL.revokeObjectURL(url)
  }
}
