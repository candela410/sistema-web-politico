// API de cuestionarios (se guardan completos: título, preguntas y opciones)
import { pedir } from './cliente'

export const obtenerCuestionarios = () => pedir('/api/cuestionarios/').then((r) => r.cuestionarios)
export const obtenerCuestionario = (id) => pedir(`/api/cuestionarios/${id}/`).then((r) => r.cuestionario)
export const crearCuestionario = (datos) =>
  pedir('/api/cuestionarios/', { method: 'POST', datos }).then((r) => r.cuestionario)
export const guardarCuestionario = (id, datos) =>
  pedir(`/api/cuestionarios/${id}/`, { method: 'PUT', datos }).then((r) => r.cuestionario)
export const borrarCuestionario = (id) => pedir(`/api/cuestionarios/${id}/`, { method: 'DELETE' })
