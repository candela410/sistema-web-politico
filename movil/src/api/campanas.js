// Campañas: elegir con cuál trabajar y administrarlas
import { pedir } from './cliente'

export const elegirCampana = (id) =>
  pedir('/api/campanas/activa/', { method: 'POST', datos: { campana: id } }).then((r) => r.usuario)
export const salirDeCampana = () => pedir('/api/campanas/activa/', { method: 'DELETE' }).then((r) => r.usuario)

export const obtenerCampanas = () => pedir('/api/campanas/').then((r) => r.campanas)
export const crearCampana = (datos) => pedir('/api/campanas/', { method: 'POST', datos }).then((r) => r.campana)
export const editarCampana = (id, datos) =>
  pedir(`/api/campanas/${id}/`, { method: 'PATCH', datos }).then((r) => r.campana)
