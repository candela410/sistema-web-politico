// Formatos y catálogo de gráficos de las estadísticas

const formatoNumero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 })
export const f = (n) => formatoNumero.format(n)
export const plural = (n, uno, varios) => `${f(n)} ${n === 1 ? uno : varios}`

// Qué gráficos hay y para qué preguntas sirven
export const CATALOGO = [
  { clave: 'barras', nombre: 'Barras horizontales', sirve: () => true },
  { clave: 'columnas', nombre: 'Columnas', sirve: (p) => p.variable === 'cualitativa' },
  { clave: 'columnas', nombre: 'Histograma', sirve: (p) => p.variable === 'cuantitativa' },
  { clave: 'torta', nombre: 'Torta', sirve: (p) => p.variable === 'cualitativa' },
  { clave: 'distribucion', nombre: 'Barra 100 %', sirve: (p) => p.variable === 'cualitativa' && p.tipo === 'una_opcion' },
  { clave: 'linea', nombre: 'Polígono de frecuencias', sirve: (p) => p.variable === 'cuantitativa' },
  { clave: 'tabla', nombre: 'Tabla de frecuencias', sirve: () => true },
  { clave: 'medidas', nombre: 'Medidas (media, mediana…)', sirve: (p) => p.variable === 'cuantitativa' },
]

export const disponibles = (pregunta) => CATALOGO.filter((g) => g.sirve(pregunta))

export function porDefecto(pregunta) {
  if (pregunta.variable === 'cuantitativa') return ['columnas', 'medidas', 'tabla']
  return pregunta.tipo === 'una_opcion' ? ['barras', 'distribucion'] : ['barras']
}
