// PDF de los gráficos del Dashboard ("Exportar todo"), con el mismo estilo que
// el informe de estadísticas (cuestionarios/pdf.js): encabezado con el logo,
// título, datos del informe y cada gráfico en hojas A4, con número de página al
// pie. Si el gráfico trae `explicacion`, va debajo en un recuadro.
// Los gráficos son los PNG que dibuja el servidor (matplotlib): se descargan y
// se ubican tal cual, así salen nítidos y en todos los navegadores.
import { jsPDF } from 'jspdf'
import logoUrl from '../../assets/logo.png'

const ANCHO_HOJA = 210
const ALTO_HOJA = 297
const MARGEN = 16
const ANCHO_UTIL = ANCHO_HOJA - 2 * MARGEN
const INICIO = 30
const FIN = ALTO_HOJA - 20

const VIOLETA = [81, 49, 143]
const TEXTO = [21, 18, 28]
const GRIS = [93, 90, 102]
const BORDE = [222, 220, 230]
const FONDO = [247, 246, 250]
const TITULOS_EXPLICACION = ['Cómo leer este gráfico', 'Qué muestran los datos']

function comoDataUrl(blob) {
  return new Promise((ok, mal) => {
    const lector = new FileReader()
    lector.onload = () => ok(lector.result)
    lector.onerror = () => mal(lector.error)
    lector.readAsDataURL(blob)
  })
}

function medidas(src) {
  return new Promise((ok, mal) => {
    const img = new Image()
    img.onload = () => ok({ ancho: img.naturalWidth, alto: img.naturalHeight })
    img.onerror = mal
    img.src = src
  })
}

async function imagen(url) {
  const respuesta = await fetch(url, { credentials: 'same-origin', cache: 'no-store' })
  if (!respuesta.ok) throw new Error('No se pudo descargar uno de los gráficos.')
  const datos = await comoDataUrl(await respuesta.blob())
  return { datos, ...(await medidas(datos)) }
}

/**
 * informe: { titulo, campana, periodo, generadoPor, archivo,
 *            graficos: [{ titulo, pregunta, url, explicacion: [párrafos] | null }] }
 */
export async function descargarGraficosPdf({ titulo, campana, periodo, generadoPor, graficos, archivo }) {
  // Primero se descargan todas las imágenes (en paralelo)
  const imagenes = await Promise.all(graficos.map((g) => imagen(g.url)))
  const logo = await imagen(logoUrl).catch(() => null)

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  pdf.setProperties({ title: titulo, subject: 'Dashboard de la campaña', author: generadoPor, creator: 'Sistema web político' })
  const fuente = (tamano, negrita = false, color = TEXTO) => {
    pdf.setFont('helvetica', negrita ? 'bold' : 'normal')
    pdf.setFontSize(tamano)
    pdf.setTextColor(...color)
  }
  let y = MARGEN

  // Portada: logo, título y datos del informe
  if (logo) {
    const alto = 16
    pdf.addImage(logo.datos, 'PNG', MARGEN, y, (logo.ancho / logo.alto) * alto, alto)
  }
  y += 24
  fuente(20, true)
  pdf.text(titulo, MARGEN, y)
  y += 4
  pdf.setDrawColor(...VIOLETA)
  pdf.setLineWidth(0.8)
  pdf.line(MARGEN, y, MARGEN + 24, y)
  y += 8
  fuente(10, false, GRIS)
  const generado = new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
  for (const linea of [`Campaña: ${campana}`, `Período: ${periodo}`, `Generado por ${generadoPor} el ${generado}`]) {
    pdf.text(linea, MARGEN, y)
    y += 5.5
  }
  y += 4

  graficos.forEach((g, i) => {
    const img = imagenes[i]
    // Explicación: se mide primero para que el gráfico y su texto queden en la misma hoja
    fuente(9)
    const bloques = (g.explicacion ?? []).map((p) => pdf.splitTextToSize(p, ANCHO_UTIL - 12))
    const altoExplicacion = bloques.length ? bloques.reduce((a, l) => a + 5 + l.length * 3.8 + 2, 0) + 4 : 0
    // Ancho completo; si no entra de alto, se achica para que quepa en una hoja
    let ancho = ANCHO_UTIL
    let alto = (img.alto / img.ancho) * ancho
    const maximo = FIN - INICIO - 16 - (altoExplicacion ? altoExplicacion + 4 : 0)
    if (alto > maximo) {
      alto = maximo
      ancho = (img.ancho / img.alto) * alto
    }
    if (y + alto + 16 + (altoExplicacion ? altoExplicacion + 4 : 0) > FIN) {
      pdf.addPage()
      y = INICIO
    }
    fuente(12, true, VIOLETA)
    pdf.text(g.titulo, MARGEN, y)
    y += 5
    fuente(9, false, GRIS)
    pdf.text(pdf.splitTextToSize(g.pregunta, ANCHO_UTIL)[0], MARGEN, y)
    y += 4
    pdf.setDrawColor(...BORDE)
    pdf.setLineWidth(0.2)
    pdf.addImage(img.datos, 'PNG', MARGEN + (ANCHO_UTIL - ancho) / 2, y, ancho, alto)
    pdf.rect(MARGEN, y - 1, ANCHO_UTIL, alto + 2)
    y += alto + (bloques.length ? 4 : 10)
    if (bloques.length) {
      pdf.setFillColor(...FONDO)
      pdf.roundedRect(MARGEN, y, ANCHO_UTIL, altoExplicacion, 1.5, 1.5, 'FD')
      pdf.setFillColor(...VIOLETA)
      pdf.rect(MARGEN, y, 1.2, altoExplicacion, 'F')
      let yTexto = y + 3
      bloques.forEach((lineas, n) => {
        fuente(7.5, true, VIOLETA)
        pdf.text((TITULOS_EXPLICACION[n] ?? 'Además').toUpperCase(), MARGEN + 6, yTexto + 2.6)
        yTexto += 5
        fuente(9, false, TEXTO)
        pdf.text(lineas, MARGEN + 6, yTexto + 2.6)
        yTexto += lineas.length * 3.8 + 2
      })
      y += altoExplicacion + 10
    }
  })

  // Encabezado (desde la hoja 2) y pie con número de página
  const hojas = pdf.getNumberOfPages()
  for (let n = 1; n <= hojas; n++) {
    pdf.setPage(n)
    if (n > 1) {
      fuente(9, true, VIOLETA)
      pdf.text(titulo, MARGEN, 16)
      fuente(9, false, GRIS)
      pdf.text(campana, ANCHO_HOJA - MARGEN, 16, { align: 'right' })
      pdf.setDrawColor(...BORDE)
      pdf.line(MARGEN, 19, ANCHO_HOJA - MARGEN, 19)
    }
    fuente(8, false, GRIS)
    pdf.text(`Página ${n} de ${hojas}`, ANCHO_HOJA - MARGEN, ALTO_HOJA - 10, { align: 'right' })
  }
  pdf.save(archivo)
}
