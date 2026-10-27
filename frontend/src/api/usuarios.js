// Usuarios de la campaña, permisos (solo lectura) e historial de actividad
import { pedir } from './cliente'

export const obtenerUsuarios = () => pedir('/api/usuarios/')
export const crearUsuario = (datos) => pedir('/api/usuarios/', { method: 'POST', datos }).then((r) => r.usuario)
export const editarUsuario = (id, datos) =>
  pedir(`/api/usuarios/${id}/`, { method: 'PATCH', datos }).then((r) => r.usuario)
export const desactivarUsuario = (id) => pedir(`/api/usuarios/${id}/`, { method: 'DELETE' }).then((r) => r.usuario)

export const obtenerPermisos = () => pedir('/api/permisos/')

export function obtenerHistorial(filtros) {
  const parametros = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v !== '' && v != null))
  return pedir(`/api/historial/?${parametros}`)
}
