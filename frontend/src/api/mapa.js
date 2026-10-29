// API del mapa: barrios, calles, zonas y rutas (GeoJSON)
import { pedir } from './cliente'

export const obtenerBarrios = () => pedir('/api/mapa/barrios/')
export const obtenerCallesDeBarrio = (id) => pedir(`/api/mapa/calles/?barrio=${id}`)

export const obtenerZonas = () => pedir('/api/mapa/zonas/').then((r) => r.zonas)
export const crearZona = (datos) =>
  pedir('/api/mapa/zonas/', { method: 'POST', datos }).then((r) => r.zona)
export const editarZona = (id, datos) =>
  pedir(`/api/mapa/zonas/${id}/`, { method: 'PATCH', datos }).then((r) => r.zona)
export const borrarZona = (id) => pedir(`/api/mapa/zonas/${id}/`, { method: 'DELETE' })

export const obtenerRutas = () => pedir('/api/mapa/rutas/').then((r) => r.rutas)
export const crearRuta = (datos) =>
  pedir('/api/mapa/rutas/', { method: 'POST', datos }).then((r) => r.ruta)
export const editarRuta = (id, datos) =>
  pedir(`/api/mapa/rutas/${id}/`, { method: 'PATCH', datos }).then((r) => r.ruta)
export const borrarRuta = (id) => pedir(`/api/mapa/rutas/${id}/`, { method: 'DELETE' })

// Dónde se hizo cada encuesta (solo las que tienen ubicación)
export const obtenerEncuestas = () => pedir('/api/mapa/encuestas/')
