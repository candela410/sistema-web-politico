// Qué puede ver cada usuario según sus permisos de Django (vienen en /api/auth/me/).
// Las opciones del menú y el permiso de cada una están en components/menu/opciones.js

export const tiene = (usuario, ...permisos) => permisos.every((p) => usuario?.permisos?.includes(p))

export function inicioDe(usuario) {
  if (!usuario) return '/login'
  if (!usuario.campana) return usuario.puede_elegir_campana ? '/campana' : '/sin-campana'
  return '/inicio'
}
