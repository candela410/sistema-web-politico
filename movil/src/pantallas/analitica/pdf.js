// PDF de los gráficos del Dashboard ("Exportar todo"), con el mismo estilo que
// el informe de estadísticas: encabezado con el logo, datos del informe y cada
// gráfico (los PNG que dibuja el servidor) con su explicación debajo.
import { pedirImagen } from '../../api/cliente'
import { compartirPdf, esc, ESTILOS, logoBase64, TITULOS_EXPLICACION } from '../../util/pdf'


export async function descargarGraficosPdf({ titulo, campana, periodo, generadoPor, graficos, archivo }) {
  const logo = await logoBase64()
  const ahora = new Date().toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const imagenes = []
  for (const g of graficos) imagenes.push(await pedirImagen(g.url))

  const filas = [...(campana ? [['Campaña', campana]] : []), ...(periodo ? [['Período', periodo]] : []), ['Emitido por', generadoPor || '-'], ['Fecha de emisión', ahora]]

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${ESTILOS}</style></head><body>
  <div class="franja"></div>
  <div class="cabecera">${logo ? `<img src="${logo}">` : '<span></span>'}<div class="der"><b>DASHBOARD</b><br>${
    campana ? `Campaña: ${esc(campana)}<br>` : ''
  }Fecha de emisión: ${esc(ahora)}</div></div>
  <h1>${esc(titulo)}</h1>
  <table class="datos">${filas.map(([e, v]) => `<tr><th>${esc(e)}</th><td>${esc(v)}</td></tr>`).join('')}</table>
  ${graficos
    .map(
      (g, i) => `<div class="pregunta"><h2>${esc(g.titulo)}</h2><p class="gris">${esc(g.pregunta)}</p>
      <div class="grafico"><img src="${imagenes[i]}"></div>
      ${
        g.explicacion?.length
          ? `<div class="explicacion">${g.explicacion.map((p, j) => `<small>${TITULOS_EXPLICACION[j] ?? 'Además'}</small><p>${esc(p)}</p>`).join('')}</div>`
          : ''
      }</div>`,
    )
    .join('')}
  </body></html>`

  await compartirPdf(html, archivo)
}
