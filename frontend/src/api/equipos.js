// API de equipos. El listado trae también las rutas de la campaña (para el selector)
import { pedir } from './cliente'

export const obtenerEquipos = () => pedir('/api/equipos/')
export const crearEquipo = (datos) =>
  pedir('/api/equipos/', { method: 'POST', datos }).then((r) => r.equipo)
export const editarEquipo = (id, datos) =>
  pedir(`/api/equipos/${id}/`, { method: 'PATCH', datos }).then((r) => r.equipo)
export const borrarEquipo = (id) => pedir(`/api/equipos/${id}/`, { method: 'DELETE' })