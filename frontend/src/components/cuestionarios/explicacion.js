// Explicación en palabras del gráfico elegido en una pregunta, para el informe
// PDF de estadísticas. Devuelve dos párrafos: cómo se lee ese tipo de gráfico
// y qué muestran los datos de la pregunta (se calcula con los mismos números
// que el gráfico: las opciones con sus cantidades y, si es cuantitativa, las medidas).
import { f, plural } from './catalogoGraficos'

const LECTURA = {
  barras:
    'Cada barra es una opción de respuesta y su largo indica cuántas personas la eligieron. Al final de cada barra figura el porcentaje sobre quienes respondieron y, entre paréntesis, la cantidad.',
  columnas:
    'Cada columna es una opción de respuesta y su altura indica cuántas personas la eligieron (el número que tiene arriba).',
  histograma:
    'Histograma: los valores están ordenados de menor a mayor y la altura de cada barra indica cuántas personas respondieron ese valor. Sirve para ver alrededor de qué valores se concentran las respuestas.',
  torta:
    'El círculo completo representa a todas las personas que respondieron y cada porción, la parte que eligió esa opción: cuanto más grande la porción, más elegida fue.',
  distribucion:
    'La barra completa representa el 100 % de las personas que respondieron y cada tramo de color, la parte que eligió esa opción.',
  linea:
    'Polígono de frecuencias: cada punto indica cuántas personas respondieron ese valor y la línea que los une muestra la forma de la distribución (dónde sube, dónde está el pico y dónde baja).',
  tabla:
    'En la tabla, fi es la cantidad de personas que eligió cada opción (frecuencia absoluta) y fr % es el porcentaje que representa sobre el total (frecuencia relativa).',
  tablaAcumulada:
    ' Fi y Fr % son los acumulados: cuántas personas respondieron ese valor o uno menor.',
  medidas:
    'Resumen numérico de las respuestas. La media es el promedio; la mediana, el valor que deja la mitad de las respuestas por debajo y la otra mitad por encima; la moda, el valor más repetido; y el desvío estándar indica cuánto se alejan las respuestas del promedio.',
}

const porcentaje = (n, total) => (total ? f(Math.round((1000 * n) / total) / 10) : '0')
const entreComillas = (opciones) => {
  const nombres = opciones.map((o) => `«${o.texto}»`)
  return nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}` : nombres[0]
}

function resultadoCualitativa(p) {
  const total = p.respondidas
  const orden = [...p.opciones].sort((a, b) => b.cantidad - a.cantidad)
  const elegidas = orden.filter((o) => o.cantidad > 0)
  const primeras = elegidas.filter((o) => o.cantidad === elegidas[0].cantidad)
  const dato = (o) => `${plural(o.cantidad, 'respuesta', 'respuestas')} (${porcentaje(o.cantidad, total)} %)`
  const frases = [`Respondieron ${plural(total, 'persona', 'personas')}.`]

  if (primeras.length > 1) {
    frases.push(`Hay un empate en el primer lugar entre ${entreComillas(primeras)}, con ${dato(primeras[0])} cada una.`)
  } else {
    frases.push(`La opción más elegida fue «${primeras[0].texto}», con ${dato(primeras[0])}.`)
    const segunda = elegidas[1]
    if (segunda) {
      const diferencia = Math.round((1000 * (primeras[0].cantidad - segunda.cantidad)) / total) / 10
      frases.push(
        `Le sigue «${segunda.texto}» con ${dato(segunda)}: una diferencia de ${f(diferencia)} puntos porcentuales.`,
      )
    }
  }
  const ultima = elegidas.at(-1)
  if (elegidas.length > 2 && ultima.cantidad < elegidas[0].cantidad) {
    frases.push(`La menos elegida fue «${ultima.texto}», con ${dato(ultima)}.`)
  }
  const nadie = orden.filter((o) => o.cantidad === 0)
  if (nadie.length) frases.push(`Nadie eligió ${entreComillas(nadie)}.`)
  if (p.tipo === 'opcion_multiple') {
    frases.push('Como se podía elegir más de una opción, los porcentajes pueden sumar más de 100 %.')
  }
  return frases
}

function resultadoCuantitativa(p) {
  const m = p.medidas
  if (!m) return [`Respondieron ${plural(p.respondidas, 'persona', 'personas')}.`]
  const frases = [
    `Respondieron ${plural(m.n, 'persona', 'personas')}.`,
    `En promedio respondieron ${f(m.media)} (media) y la mitad respondió ${f(m.mediana)} o menos (mediana).`,
  ]
  if (m.moda.length === 1) frases.push(`El valor más repetido fue ${f(m.moda[0])} (moda).`)
  else if (m.moda.length > 1) frases.push(`Los valores más repetidos fueron ${m.moda.map(f).join(' y ')} (modas).`)
  else frases.push('Ningún valor se repite más que los demás (no hay moda).')
  // Dispersión: el desvío comparado con la media (coeficiente de variación)
  const variacion = m.media ? m.desvio / Math.abs(m.media) : 0
  const dispersion =
    m.rango === 0
      ? 'todas las respuestas son iguales'
      : variacion < 0.25
        ? 'las respuestas son parecidas entre sí'
        : variacion < 0.5
          ? 'las respuestas están moderadamente dispersas'
          : 'las respuestas son muy distintas entre sí'
  frases.push(
    `Las respuestas van de ${f(m.minimo)} a ${f(m.maximo)} (rango ${f(m.rango)}), con un desvío estándar de ${f(m.desvio)}: ${dispersion}.`,
  )
  return frases
}

/** pregunta: como viene de /estadisticas/; clave: el gráfico elegido. → [cómo leerlo, qué muestran los datos] */
export function explicarGrafico(pregunta, clave) {
  const cuantitativa = pregunta.variable === 'cuantitativa'
  let lectura = LECTURA[clave === 'columnas' && cuantitativa ? 'histograma' : clave] ?? ''
  if (clave === 'tabla' && cuantitativa) lectura += LECTURA.tablaAcumulada
  const resultado = cuantitativa ? resultadoCuantitativa(pregunta) : resultadoCualitativa(pregunta)
  if (pregunta.sin_responder > 0) {
    resultado.push(
      `${plural(pregunta.sin_responder, 'persona no respondió', 'personas no respondieron')} esta pregunta.`,
    )
  }
  return [lectura, resultado.join(' ')].filter(Boolean)
}
