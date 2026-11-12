// Pantalla Dashboard: los gráficos del Módulo de Analítica (analitica/analitica.py)
import { pedir } from './cliente'

// { desde: '2026-10-01', hasta: '' } → "?desde=2026-10-01" (sin los vacíos)
function consulta(filtros) {
  const parametros = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v !== '' && v != null))
  return parametros.size ? `?${parametros}` : ''
}

// Período que se va a mostrar, cuántas encuestas tiene y los cuestionarios y zonas para elegir
export const obtenerResumenAnalitica = (filtros) => pedir(`/api/analitica/${consulta(filtros)}`)

// Dirección de la imagen PNG de un gráfico (periodo, donut, evolucion, heatmap, dashboard o
// respuestas con ?cuestionario=&zona=)
export const urlGraficoAnalitica = (clave, filtros) => `/api/analitica/${clave}.png${consulta(filtros)}`
