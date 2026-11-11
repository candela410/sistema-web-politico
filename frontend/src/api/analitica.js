// Pantalla Analítica: los gráficos del Módulo de Analítica (analitica/analitica.py)
import { pedir } from './cliente'

// { desde: '2026-10-01', meta: '' } → "?desde=2026-10-01" (sin los vacíos)
function consulta(filtros) {
  const parametros = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v !== '' && v != null))
  return parametros.size ? `?${parametros}` : ''
}

// Período que se va a mostrar y cuántas encuestas tiene
export const obtenerResumenAnalitica = (filtros) => pedir(`/api/analitica/${consulta(filtros)}`)

// Dirección de la imagen PNG de un gráfico (barras, donut, evolucion, heatmap, dashboard)
export const urlGraficoAnalitica = (clave, filtros) => `/api/analitica/${clave}.png${consulta(filtros)}`
