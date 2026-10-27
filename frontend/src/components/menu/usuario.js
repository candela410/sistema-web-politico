// Datos del usuario para mostrar (barra superior y pantalla de inicio)

export const nombreDe = (usuario) =>
  [usuario.nombre, usuario.apellido].filter(Boolean).join(' ') || usuario.username || usuario.email

export function rolDe(usuario) {
  if (usuario.es_superusuario) return 'Superusuario'
  if (usuario.permisos?.includes('core.administrar_campana')) return 'Administración'
  return usuario.grupos?.[0] ?? (usuario.es_militante ? 'Militante' : 'Usuario')
}

export const inicialDe = (usuario) => nombreDe(usuario).trim().charAt(0).toUpperCase()
