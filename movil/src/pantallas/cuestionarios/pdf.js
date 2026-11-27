// Informe PDF de estadísticas de un cuestionario (mismo contenido que el de la web)
import { compartirPdf, esc, ESTILOS, logoBase64, TITULOS_EXPLICACION } from '../../util/pdf'

const TIPOS = { una_opcion: 'Una sola opción', opcion_multiple: 'Opción múltiple' }

export function tablaHtml(opciones, total, acumuladas, f) {
  const acumulado = opciones.map((_, i) => opciones.slice(0, i + 1).reduce((a, o) => a + o.cantidad, 0))
  const pct = (n) => (total ? f(Math.round((1000 * n) / total) / 10) : 0)
  return `<table class="frec"><thead><tr><th>${acumuladas ? 'Valor' : 'Opción'}</th><th>fi</th><th>fr %</th>${
    acumuladas ? '<th>Fi</th><th>Fr %</th>' : ''
  }</tr></thead><tbody>${opciones
    .map(
      (o, i) =>
        `<tr><td>${esc(o.texto)}</td><td>${f(o.cantidad)}</td><td>${pct(o.cantidad)}</td>${
          acumuladas ? `<td>${f(acumulado[i])}</td><td>${pct(acumulado[i])}</td>` : ''
        }</tr>`,
    )
    .join('')}</tbody><tfoot><tr><th>Total</th><td>${f(total)}</td><td>100</td>${acumuladas ? '<td colspan="2"></td>' : ''}</tr></tfoot></table>`
}

export function medidasHtml(m, f) {
  if (!m) return ''
  const datos = [
    ['Media', f(m.media)],
    ['Mediana', f(m.mediana)],
    ['Moda', m.moda.length ? m.moda.map(f).join(' y ') : 'No hay'],
    ['Desvío estándar', f(m.desvio)],
    ['Mínimo', f(m.minimo)],
    ['Máximo', f(m.maximo)],
    ['Rango', f(m.rango)],
  ]
  return `<div class="medidas">${datos.map(([e, v]) => `<div><b>${esc(v)}</b><span>${e}</span></div>`).join('')}</div>`
}

/**
 * informe: { cuestionario, campana, generadoPor, generadoEn, formatoFecha (fn), f,
 *   resumen: { encuestas, militantes, preguntas, conRespuestas, ultima } | null,
 *   preguntas: { total, lista: [{ numero, total, enunciado, tipo, variable, obligatoria, respondidas,
 *                sin_responder, graficos: [{ html, nombre, explicacion }] }] }, archivo }
 */
export async function descargarPdf(informe) {
  const { cuestionario, campana, generadoPor, generadoEn, formatoFecha, f, resumen, preguntas, archivo } = informe
  const logo = await logoBase64()
  const fecha = (v) => (v ? formatoFecha(v) : '-')
  const soloFecha = (v) => new Date(v).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const filas = [
    ['Cuestionario', `"${cuestionario.titulo}"`],
    ['Categoría', cuestionario.categoria],
    ...(campana ? [['Campaña', campana]] : []),
    ['Estado', cuestionario.activo === false ? 'Inactivo' : 'Activo'],
    ['Fecha de creación', fecha(cuestionario.creado_en)],
    ['Cantidad de preguntas', f(preguntas.total)],
    ['Emitido por', generadoPor || '-'],
    ['Fecha de emisión', formatoFecha(generadoEn)],
  ]

  const conGraficos = preguntas.lista.filter((p) => p.graficos.length)

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${ESTILOS}</style></head><body>
  <div class="franja"></div>
  <div class="cabecera">${logo ? `<img src="${logo}">` : '<span></span>'}<div class="der"><b>INFORME DE ESTADÍSTICAS</b><br>${
    campana ? `Campaña: ${esc(campana)}<br>` : ''
  }Fecha de emisión: ${esc(formatoFecha(generadoEn))}</div></div>
  <div class="gris" style="font-size:9pt">Informe de resultados del cuestionario</div>
  <h1>${esc(cuestionario.titulo)}</h1>
  ${cuestionario.descripcion ? `<p class="gris">${esc(cuestionario.descripcion)}</p>` : ''}
  <h2>Datos del cuestionario</h2>
  <table class="datos">${filas.map(([e, v]) => `<tr><th>${esc(e)}</th><td>${esc(v)}</td></tr>`).join('')}</table>
  ${
    resumen
      ? `<h2>Resumen general</h2><div class="indicadores">${[
          ['Encuestas realizadas', f(resumen.encuestas)],
          ['Usuarios que cargaron', f(resumen.militantes)],
          ['Preguntas con respuestas', `${f(resumen.conRespuestas)} de ${f(resumen.preguntas)}`],
          ['Última encuesta', resumen.ultima ? soloFecha(resumen.ultima) : '-'],
        ]
          .map(([e, v]) => `<div class="indicador"><b>${esc(v)}</b><span>${esc(e)}</span></div>`)
          .join('')}</div>`
      : ''
  }
  ${
    conGraficos.length
      ? `<div class="salto"></div><h2>Resultados por pregunta</h2>${conGraficos
          .map((p) => {
            const base = p.respondidas + p.sin_responder
            const tasa = base ? ` (${f(Math.round((1000 * p.respondidas) / base) / 10)} %)` : ''
            const ficha = [
              ['Tipo de pregunta', TIPOS[p.tipo] ?? p.tipo],
              ['Variable', p.variable === 'cuantitativa' ? 'Cuantitativa' : 'Cualitativa'],
              ['Obligatoria', p.obligatoria ? 'Sí' : 'No'],
              ['Respondieron', `${f(p.respondidas)}${tasa}`],
              ['Sin responder', f(p.sin_responder)],
            ]
            return `<div class="pregunta"><span class="num">${p.numero}</span><span class="de">PREGUNTA ${p.numero} DE ${p.total}</span>
              <h3>${esc(p.enunciado)}</h3>
              <div class="ficha">${ficha.map(([e, v]) => `<div><small>${e}</small><b>${esc(v)}</b></div>`).join('')}</div>
              ${p.graficos
                .map(
                  (g) => `<div class="titulo-grafico">Gráfico: ${esc(g.nombre)}</div><div class="grafico">${g.html}</div>${
                    g.explicacion?.length
                      ? `<div class="explicacion">${g.explicacion
                          .map((par, i) => `<small>${TITULOS_EXPLICACION[i] ?? 'Además'}</small><p>${esc(par)}</p>`)
                          .join('')}</div>`
                      : ''
                  }`,
                )
                .join('')}</div>`
          })
          .join('')}`
      : ''
  }
  <div class="pie">Sistema de gestión · ${esc(cuestionario.titulo)}</div>
  </body></html>`

  await compartirPdf(html, archivo)
}
