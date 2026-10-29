// API de cuestionarios (se guardan completos: título, preguntas y opciones)
import { pedir } from './cliente'

export const obtenerCuestionarios = () => pedir('/api/cuestionarios/').then((r) => r.cuestionarios)
export const obtenerCuestionario = (id) => pedir(`/api/cuestionarios/${id}/`).then((r) => r.cuestionario)
export const crearCuestionario = (datos) =>
  pedir('/api/cuestionarios/', { method: 'POST', datos }).then((r) => r.cuestionario)
export const guardarCuestionario = (id, datos) =>
  pedir(`/api/cuestionarios/${id}/`, { method: 'PUT', datos }).then((r) => r.cuestionario)
export const borrarCuestionario = (id) => pedir(`/api/cuestionarios/${id}/`, { method: 'DELETE' })

// Asignación a militantes: trae el cuestionario, los equipos con sus militantes y los que no tienen equipo
export const obtenerAsignaciones = (id) => pedir(`/api/cuestionarios/${id}/asignaciones/`)
// Guarda la lista completa de usuarios asignados (los que no vienen se quitan)
export const guardarAsignaciones = (id, usuarios) =>
  pedir(`/api/cuestionarios/${id}/asignaciones/`, { method: 'PUT', datos: { usuarios } })
