
import { pedir } from './cliente'

export const obtenerGrupos = () =>
  pedir('/api/grupos/').then((respuesta) => respuesta.grupos)

export const crearGrupo = (datos) =>
  pedir('/api/grupos/', {
    method: 'POST',
    datos,
  }).then((respuesta) => respuesta.grupo)

export const editarGrupo = (id, datos) =>
  pedir(`/api/grupos/${id}/`, {
    method: 'PATCH',
    datos,
  }).then((respuesta) => respuesta.grupo)

export const borrarGrupo = (id) =>
  pedir(`/api/grupos/${id}/`, {
    method: 'DELETE',
  })
// Permisos que se pueden asignar, agrupados por sección:
// [{ seccion, permisos: [{ id, codigo, accion }] }]
export const obtenerPermisos = () =>
  pedir('/api/grupos/permisos/').then((respuesta) => respuesta.secciones)
