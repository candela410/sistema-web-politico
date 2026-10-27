// Arma el PDF de estadísticas con los gráficos elegidos. Cada gráfico se
// convierte en imagen JPEG tal como se ve en pantalla (html-to-image) y se ubica en
// hojas A4 (jsPDF).
import { getFontEmbedCSS, toJpeg } from 'html-to-image'
import { jsPDF } from 'jspdf'

const MARGEN = 15
const ANCHO_UTIL = 210 - 2 * MARGEN
const ALTO_HOJA = 297
const VIOLETA = [81, 49, 143]

/**
 * secciones: [{ titulo, detalle, graficos: [{ nodo }] }] (cada gráfico ya muestra su nombre)
 */
export async function descargarPdf({ titulo, subtitulo, secciones, archivo }) {
  // compress: el PDF queda liviano (con imágenes JPEG pesa unos cientos de KB)
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  let y = MARGEN

  const nuevaHoja = () => {
    pdf.addPage()
    y = MARGEN
  }
  const espacio = (alto) => {
    if (y + alto > ALTO_HOJA - MARGEN) nuevaHoja()
  }
  const texto = (contenido, { tamano = 10, negrita = false, color = [21, 18, 28], separacion = 1.5 } = {}) => {
    pdf.setFont('helvetica', negrita ? 'bold' : 'normal')
    pdf.setFontSize(tamano)
    pdf.setTextColor(...color)
    const lineas = pdf.splitTextToSize(contenido, ANCHO_UTIL)
    const alto = lineas.length * tamano * 0.42
    espacio(alto)
    pdf.text(lineas, MARGEN, y + tamano * 0.35)
    y += alto + separacion
  }

  // Encabezado con la franja de la campaña
  pdf.setFillColor(...VIOLETA)
  pdf.rect(0, 0, 210, 6, 'F')
  y = MARGEN + 2
  texto(titulo, { tamano: 18, negrita: true, separacion: 2 })
  texto(subtitulo, { tamano: 9, color: [93, 90, 102], separacion: 6 })

  // Las tipografías se embeben una sola vez para todos los gráficos
  const primerNodo = secciones.flatMap((s) => s.graficos)[0]?.nodo
  const fontEmbedCSS = primerNodo ? await getFontEmbedCSS(primerNodo).catch(() => '') : ''

  for (const seccion of secciones) {
    // Primero las imágenes, así el título de la pregunta no queda solo al pie de una hoja
    const imagenes = []
    for (const { nodo } of seccion.graficos) {
      // style: sin el margen izquierdo que tiene en pantalla, para que no se corte
      const imagen = await toJpeg(nodo, {
        pixelRatio: 2,
        quality: 0.92,
        backgroundColor: '#ffffff',
        fontEmbedCSS,
        style: { margin: '0' },
      })
      const { width, height } = await medidas(imagen)
      let ancho = ANCHO_UTIL
      let alto = (height / width) * ancho
      // Un gráfico nunca ocupa más de media hoja
      if (alto > 130) {
        alto = 130
        ancho = (width / height) * alto
      }
      imagenes.push({ imagen, ancho, alto })
    }

    espacio(18 + (imagenes[0]?.alto ?? 0))
    texto(seccion.titulo, { tamano: 12, negrita: true, separacion: 1 })
    if (seccion.detalle) texto(seccion.detalle, { tamano: 8.5, color: [93, 90, 102], separacion: 3 })

    for (const { imagen, ancho, alto } of imagenes) {
      espacio(alto + 4)
      pdf.addImage(imagen, 'JPEG', MARGEN, y, ancho, alto)
      y += alto + 5
    }
    y += 5
  }

  // Pie con número de página
  const paginas = pdf.getNumberOfPages()
  for (let i = 1; i <= paginas; i++) {
    pdf.setPage(i)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(140, 137, 148)
    pdf.text(`Página ${i} de ${paginas}`, 210 - MARGEN, ALTO_HOJA - 8, { align: 'right' })
  }
  pdf.save(archivo)
}

function medidas(src) {
  return new Promise((ok, mal) => {
    const img = new Image()
    img.onload = () => ok({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = mal
    img.src = src
  })
}
