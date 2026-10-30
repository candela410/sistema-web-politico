// Arma el informe PDF de estadísticas. Los textos, tablas y recuadros se
// dibujan directamente con jsPDF (quedan nítidos y seleccionables); cada
// gráfico se convierte en imagen JPEG tal como se ve en pantalla
// (html-to-image) y se ubica en hojas A4.
import { getFontEmbedCSS, toJpeg } from 'html-to-image'
import { jsPDF } from 'jspdf'
import logoUrl from '../../assets/logo.png'

// Medidas de la hoja A4 (mm)
const ANCHO_HOJA = 210
const ALTO_HOJA = 297
const MARGEN = 18
const ANCHO_UTIL = ANCHO_HOJA - 2 * MARGEN
const INICIO_CONTENIDO = 30 // debajo del encabezado de las hojas 2 en adelante
const FIN_CONTENIDO = ALTO_HOJA - 22 // encima del pie de página

// Colores
const VIOLETA = [81, 49, 143]
const TEXTO = [21, 18, 28]
const GRIS = [93, 90, 102]
const GRIS_CLARO = [140, 137, 148]
const BORDE = [222, 220, 230]
const FONDO = [247, 246, 250]

const TIPOS = { una_opcion: 'Una sola opción', opcion_multiple: 'Opción múltiple' }

/**
 * informe: {
 *   cuestionario: { titulo, categoria, descripcion, activo, creado_en },
 *   campana, generadoPor, generadoEn (Date), formatoFecha, f (formato de números),
 *   resumen: { encuestas, militantes, preguntas, ultima } | null,
 *   preguntas: [{ numero, total, enunciado, tipo, variable, obligatoria, respondidas, sin_responder,
 *                 graficos: [{ nodo, nombre }] }],
 *   archivo,
 * }
 */
export async function descargarPdf(informe) {
  const { cuestionario, campana, generadoPor, generadoEn, formatoFecha, f, resumen, preguntas, archivo } = informe
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  pdf.setProperties({
    title: `Informe de estadísticas - ${cuestionario.titulo}`,
    subject: 'Informe de estadísticas del cuestionario',
    author: generadoPor,
    creator: 'Sistema web político',
  })
  const soloFecha = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const fecha = (valor) => (valor ? formatoFecha.format(new Date(valor)) : '-')
  let y = MARGEN

  // --- Utilidades de dibujo -----------------------------------------------

  const fuente = (tamano, negrita = false, color = TEXTO) => {
    pdf.setFont('helvetica', negrita ? 'bold' : 'normal')
    pdf.setFontSize(tamano)
    pdf.setTextColor(...color)
  }
  const altoLinea = (tamano) => tamano * 0.42
  const nuevaHoja = () => {
    pdf.addPage()
    y = INICIO_CONTENIDO
  }
  const espacio = (alto) => {
    if (y + alto > FIN_CONTENIDO) nuevaHoja()
  }
  const parrafo = (contenido, { tamano = 10, negrita = false, color = TEXTO, ancho = ANCHO_UTIL, x = MARGEN, despues = 2 } = {}) => {
    fuente(tamano, negrita, color)
    const lineas = pdf.splitTextToSize(String(contenido), ancho)
    for (const linea of lineas) {
      espacio(altoLinea(tamano))
      pdf.text(linea, x, y + tamano * 0.35)
      y += altoLinea(tamano)
    }
    y += despues
  }
  const tituloSeccion = (contenido) => {
    espacio(16)
    y += 3
    fuente(12, true, VIOLETA)
    pdf.text(contenido.toUpperCase(), MARGEN, y + 4)
    y += 6.5
    pdf.setDrawColor(...VIOLETA)
    pdf.setLineWidth(0.6)
    pdf.line(MARGEN, y, MARGEN + 18, y)
    pdf.setDrawColor(...BORDE)
    pdf.setLineWidth(0.2)
    pdf.line(MARGEN + 18, y, MARGEN + ANCHO_UTIL, y)
    y += 5
  }

  // Tabla de dos columnas "Dato | Valor"
  const tablaDatos = (filas) => {
    const anchoEtiqueta = 52
    const anchoValor = ANCHO_UTIL - anchoEtiqueta
    filas.forEach(([etiqueta, valor], i) => {
      fuente(9.5)
      const lineas = pdf.splitTextToSize(String(valor), anchoValor - 6)
      const alto = Math.max(8, lineas.length * altoLinea(9.5) + 4)
      espacio(alto)
      pdf.setDrawColor(...BORDE)
      pdf.setLineWidth(0.2)
      pdf.setFillColor(...FONDO)
      pdf.rect(MARGEN, y, anchoEtiqueta, alto, 'FD')
      if (i % 2) pdf.setFillColor(252, 252, 253)
      else pdf.setFillColor(255, 255, 255)
      pdf.rect(MARGEN + anchoEtiqueta, y, anchoValor, alto, 'FD')
      fuente(9.5, true, GRIS)
      pdf.text(etiqueta, MARGEN + 3, y + 5.2)
      fuente(9.5, false, TEXTO)
      pdf.text(lineas, MARGEN + anchoEtiqueta + 3, y + 5.2)
      y += alto
    })
    y += 4
  }

  // Recuadros con un número grande y su etiqueta
  const indicadores = (lista) => {
    const separacion = 4
    const ancho = (ANCHO_UTIL - separacion * (lista.length - 1)) / lista.length
    const alto = 22
    espacio(alto + 4)
    lista.forEach(([etiqueta, valor], i) => {
      const x = MARGEN + i * (ancho + separacion)
      pdf.setFillColor(...FONDO)
      pdf.setDrawColor(...BORDE)
      pdf.setLineWidth(0.2)
      pdf.roundedRect(x, y, ancho, alto, 2, 2, 'FD')
      pdf.setFillColor(...VIOLETA)
      pdf.rect(x, y + 3, 1.2, alto - 6, 'F')
      const largo = String(valor).length > 8
      fuente(largo ? 12 : 16, true, TEXTO)
      pdf.text(String(valor), x + 5, y + 10)
      fuente(8, false, GRIS)
      pdf.text(pdf.splitTextToSize(etiqueta, ancho - 8), x + 5, y + 16)
    })
    y += alto + 6
  }

  // Fila de datos de una pregunta (celdas con etiqueta arriba y valor abajo)
  const fichaPregunta = (celdas) => {
    const alto = 11
    const ancho = ANCHO_UTIL / celdas.length
    espacio(alto)
    pdf.setFillColor(...FONDO)
    pdf.setDrawColor(...BORDE)
    pdf.setLineWidth(0.2)
    pdf.rect(MARGEN, y, ANCHO_UTIL, alto, 'FD')
    celdas.forEach(([etiqueta, valor], i) => {
      const x = MARGEN + i * ancho
      if (i) pdf.line(x, y + 2, x, y + alto - 2)
      fuente(7, false, GRIS_CLARO)
      pdf.text(etiqueta.toUpperCase(), x + 3, y + 4)
      fuente(8.5, true, TEXTO)
      pdf.text(pdf.splitTextToSize(String(valor), ancho - 5)[0], x + 3, y + 8.5)
    })
    y += alto + 4
  }

  // --- Portada / primera hoja --------------------------------------------

  // Franja superior y logo
  pdf.setFillColor(...VIOLETA)
  pdf.rect(0, 0, ANCHO_HOJA, 4, 'F')
  const logo = await cargarImagen(logoUrl).catch(() => null)
  if (logo) {
    const alto = 16
    pdf.addImage(logo, 'PNG', MARGEN, 10, (logo.naturalWidth / logo.naturalHeight) * alto, alto)
  }
  fuente(8, true, VIOLETA)
  pdf.text('INFORME DE ESTADÍSTICAS', ANCHO_HOJA - MARGEN, 14, { align: 'right' })
  fuente(8, false, GRIS)
  if (campana) pdf.text(`Campaña: ${campana}`, ANCHO_HOJA - MARGEN, 19, { align: 'right' })
  pdf.text(`Fecha de emisión: ${formatoFecha.format(generadoEn)}`, ANCHO_HOJA - MARGEN, 24, { align: 'right' })
  pdf.setDrawColor(...BORDE)
  pdf.setLineWidth(0.3)
  pdf.line(MARGEN, 31, ANCHO_HOJA - MARGEN, 31)
  y = 40

  // Título del informe
  parrafo('Informe de resultados del cuestionario', { tamano: 9, color: GRIS, despues: 1 })
  parrafo(cuestionario.titulo, { tamano: 20, negrita: true, despues: 2 })
  if (cuestionario.descripcion) parrafo(cuestionario.descripcion, { tamano: 10, color: GRIS, despues: 2 })
  y += 2

  // Datos de identificación
  tituloSeccion('Datos del cuestionario')
  tablaDatos([
    ['Cuestionario', `"${cuestionario.titulo}"`],
    ['Categoría', cuestionario.categoria],
    ...(campana ? [['Campaña', campana]] : []),
    ['Estado', cuestionario.activo === false ? 'Inactivo' : 'Activo'],
    ['Fecha de creación', fecha(cuestionario.creado_en)],
    ['Cantidad de preguntas', f(preguntas.total)],
    ['Emitido por', generadoPor || '-'],
    ['Fecha de emisión', formatoFecha.format(generadoEn)],
  ])

  // Resumen general
  if (resumen) {
    tituloSeccion('Resumen general')
    indicadores([
      ['Encuestas realizadas', f(resumen.encuestas)],
      ['Militantes que cargaron', f(resumen.militantes)],
      ['Preguntas con respuestas', `${f(resumen.conRespuestas)} de ${f(resumen.preguntas)}`],
      ['Última encuesta', resumen.ultima ? soloFecha.format(new Date(resumen.ultima)) : '-'],
    ])
  }

  // --- Resultados por pregunta -------------------------------------------

  const conGraficos = preguntas.lista.filter((p) => p.graficos.length)
  if (conGraficos.length) {
    // Los resultados empiezan siempre en una hoja nueva
    nuevaHoja()
    tituloSeccion('Resultados por pregunta')

    // Las tipografías se embeben una sola vez para todos los gráficos
    const fontEmbedCSS = await getFontEmbedCSS(conGraficos[0].graficos[0].nodo).catch(() => '')

    for (const p of conGraficos) {
      // Primero las imágenes, así el título de la pregunta no queda solo al pie de una hoja
      const imagenes = []
      for (const { nodo, nombre } of p.graficos) {
        const imagen = await imagenDelGrafico(nodo, fontEmbedCSS)
        const { width, height } = await medidas(imagen.datos)
        let ancho = ANCHO_UTIL - 4
        let alto = (height / width) * ancho
        // Un gráfico nunca ocupa más de media hoja
        if (alto > 120) {
          alto = 120
          ancho = (width / height) * alto
        }
        imagenes.push({ imagen, ancho, alto, nombre })
      }

      // Encabezado de la pregunta: número, enunciado y ficha
      fuente(11.5, true)
      const lineasEnunciado = pdf.splitTextToSize(p.enunciado, ANCHO_UTIL - 12)
      // Reserva lugar para número, enunciado, ficha y el primer gráfico, así nunca quedan separados
      espacio(lineasEnunciado.length * altoLinea(11.5) + 45 + (imagenes[0]?.alto ?? 0))
      y += 2
      pdf.setFillColor(...VIOLETA)
      pdf.roundedRect(MARGEN, y, 8, 8, 1.5, 1.5, 'F')
      fuente(9, true, [255, 255, 255])
      pdf.text(String(p.numero), MARGEN + 4, y + 5.5, { align: 'center' })
      fuente(7.5, true, GRIS_CLARO)
      pdf.text(`PREGUNTA ${p.numero} DE ${p.total}`, MARGEN + 11, y + 3)
      y += 4.5
      parrafo(p.enunciado, { tamano: 11.5, negrita: true, x: MARGEN + 11, ancho: ANCHO_UTIL - 11, despues: 3 })

      const base = p.respondidas + p.sin_responder
      const tasa = base ? ` (${f(Math.round((1000 * p.respondidas) / base) / 10)} %)` : ''
      fichaPregunta([
        ['Tipo de pregunta', TIPOS[p.tipo] ?? p.tipo],
        ['Variable', p.variable === 'cuantitativa' ? 'Cuantitativa' : 'Cualitativa'],
        ['Obligatoria', p.obligatoria ? 'Sí' : 'No'],
        ['Respondieron', `${f(p.respondidas)}${tasa}`],
        ['Sin responder', f(p.sin_responder)],
      ])

      for (const { imagen, ancho, alto, nombre } of imagenes) {
        espacio(alto + 12)
        fuente(8.5, true, GRIS)
        pdf.text(`Gráfico: ${nombre}`, MARGEN, y + 3)
        y += 5.5
        pdf.setDrawColor(...BORDE)
        pdf.setLineWidth(0.2)
        pdf.rect(MARGEN, y, ANCHO_UTIL, alto + 4)
        pdf.addImage(imagen.datos, imagen.formato, MARGEN + (ANCHO_UTIL - ancho) / 2, y + 2, ancho, alto)
        y += alto + 4 + 6
      }
      y += 3
    }
  }

  // --- Notas ---------------------------------------------------------------

  tituloSeccion('Notas')
  const notas = [
    'Los porcentajes de cada pregunta se calculan sobre la cantidad de personas que la respondieron.',
    ...(preguntas.lista.some((p) => p.tipo === 'opcion_multiple')
      ? ['En las preguntas de opción múltiple una persona puede elegir varias opciones, por lo que la suma de los porcentajes puede superar el 100 %.']
      : []),
    `Los datos corresponden a las encuestas cargadas en el sistema hasta el ${formatoFecha.format(generadoEn)}`,
  ]
  for (const nota of notas) {
    fuente(8.5, false, GRIS)
    const lineas = pdf.splitTextToSize(nota, ANCHO_UTIL - 5)
    espacio(lineas.length * altoLinea(8.5) + 1.5)
    pdf.text('-', MARGEN, y + 3)
    pdf.text(lineas, MARGEN + 4, y + 3)
    y += lineas.length * altoLinea(8.5) + 1.5
  }

  // --- Encabezado (hojas 2+) y pie de página en todas las hojas -----------

  const paginas = pdf.getNumberOfPages()
  const tituloCorto = recortar(pdf, `Cuestionario: "${cuestionario.titulo}"`, ANCHO_UTIL - 45, 8)
  for (let i = 1; i <= paginas; i++) {
    pdf.setPage(i)
    if (i > 1) {
      pdf.setFillColor(...VIOLETA)
      pdf.rect(0, 0, ANCHO_HOJA, 2.5, 'F')
      fuente(8, true, VIOLETA)
      pdf.text('INFORME DE ESTADÍSTICAS', MARGEN, 13)
      fuente(8, false, GRIS)
      pdf.text(tituloCorto, ANCHO_HOJA - MARGEN, 13, { align: 'right' })
      pdf.setDrawColor(...BORDE)
      pdf.setLineWidth(0.3)
      pdf.line(MARGEN, 17, ANCHO_HOJA - MARGEN, 17)
    }
    pdf.setDrawColor(...BORDE)
    pdf.setLineWidth(0.3)
    pdf.line(MARGEN, ALTO_HOJA - 15, ANCHO_HOJA - MARGEN, ALTO_HOJA - 15)
    fuente(7.5, false, GRIS_CLARO)
    pdf.text(
      recortar(pdf, `Emitido el ${formatoFecha.format(generadoEn)}${generadoPor ? ` por ${generadoPor}` : ''}`, ANCHO_UTIL - 35, 7.5),
      MARGEN,
      ALTO_HOJA - 10,
    )
    pdf.text(`Página ${i} de ${paginas}`, ANCHO_HOJA - MARGEN, ALTO_HOJA - 10, { align: 'right' })
  }

  pdf.save(archivo)
}

// Imagen de un gráfico para el PDF.
// - Los gráficos que dibuja el servidor (PNG de matplotlib) se descargan
//   directamente: así salen en todos los navegadores (Safari deja en blanco las
//   imágenes cuando se "fotografía" la pantalla) y con mejor calidad.
// - La tabla de frecuencias y las medidas (HTML) se convierten en imagen tal
//   como se ven en pantalla.
async function imagenDelGrafico(nodo, fontEmbedCSS) {
  const img = nodo.querySelector('.grafico-imagen img')
  if (img) {
    const respuesta = await fetch(img.currentSrc || img.src, { credentials: 'same-origin', cache: 'no-store' })
    if (!respuesta.ok) throw new Error('no se pudo descargar uno de los gráficos')
    return { datos: await comoDataUrl(await respuesta.blob()), formato: 'PNG' }
  }
  const datos = await toJpeg(nodo, {
    pixelRatio: 2,
    quality: 0.92,
    backgroundColor: '#ffffff',
    fontEmbedCSS,
    // Sin el margen de pantalla ni el título del gráfico (va escrito en el PDF)
    style: { margin: '0', border: '0' },
    filter: (n) => n.tagName !== 'FIGCAPTION',
  })
  return { datos, formato: 'JPEG' }
}

function comoDataUrl(blob) {
  return new Promise((ok, mal) => {
    const lector = new FileReader()
    lector.onload = () => ok(lector.result)
    lector.onerror = () => mal(lector.error)
    lector.readAsDataURL(blob)
  })
}

// Acorta un texto con "..." para que entre en el ancho dado
function recortar(pdf, texto, ancho, tamano) {
  pdf.setFontSize(tamano)
  if (pdf.getTextWidth(texto) <= ancho) return texto
  let corto = texto
  while (corto.length > 4 && pdf.getTextWidth(`${corto}...`) > ancho) corto = corto.slice(0, -1)
  return `${corto.trimEnd()}...`
}

function cargarImagen(src) {
  return new Promise((ok, mal) => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = mal
    img.src = src
  })
}

async function medidas(src) {
  const img = await cargarImagen(src)
  return { width: img.naturalWidth, height: img.naturalHeight }
}