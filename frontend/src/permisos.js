// Qué puede ver cada usuario según sus permisos de Django (vienen en /api/auth/me/)

export const tiene = (usuario, ...permisos) => permisos.every((p) => usuario?.permisos?.includes(p))

// Secciones del menú, en orden. La primera a la que tenga acceso es su inicio.
export const SECCIONES = [
  { ruta: '/mapa', texto: 'Mapa', permiso: 'core.view_zona' },
  { ruta: '/cuestionarios', texto: 'Cuestionarios', permiso: 'core.view_cuestionario' },
  { ruta: '/categorias', texto: 'Categorías', permiso: 'core.view_categoria' },
  { ruta: '/responder', texto: 'Encuestas', permiso: 'core.add_encuesta' },
]

export const GESTION = [
  { ruta: '/usuarios', texto: 'Usuarios', permiso: 'core.view_usuario' },
  { ruta: '/permisos', texto: 'Permisos', permiso: 'auth.view_group' },
  { ruta: '/actividad', texto: 'Actividad', permiso: 'admin.view_logentry' },
  { ruta: '/campanas', texto: 'Campañas', permiso: 'core.view_campana' },
]

export function inicioDe(usuario) {
  if (!usuario) return '/login'
  if (!usuario.campana) return usuario.puede_elegir_campana ? '/campana' : '/sin-campana'
  return [...SECCIONES, ...GESTION].find((s) => tiene(usuario, s.permiso))?.ruta ?? '/sin-permisos'
}
