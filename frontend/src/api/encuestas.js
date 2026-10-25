// Carga de encuestas (militantes) y estadísticas (administración)
import { pedir } from './cliente'

export const obtenerParaResponder = () => pedir('/api/responder/').then((r) => r.cuestionarios)
export const obtenerCuestionarioParaResponder = (id) =>
  pedir(`/api/responder/${id}/`).then((r) => r.cuestionario)
export const enviarRespuestas = (id, datos) => pedir(`/api/responder/${id}/`, { method: 'POST', datos })

export const obtenerEstadisticas = (id) => pedir(`/api/cuestionarios/${id}/estadisticas/`)
