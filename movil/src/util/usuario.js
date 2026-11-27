// Datos del usuario para mostrar (barra superior y pantalla de inicio)

export const nombreDe = (usuario) =>
  [usuario.nombre, usuario.apellido].filter(Boolean).join(' ') || usuario.username || usuario.email

// Todos los roles del usuario, separados por coma (ficha del usuario)
export function rolesDe(usuario) {
  if (usuario.es_superusuario) return 'Superusuario'
  const nombres = (usuario.grupos ?? []).map((g) => (typeof g === 'string' ? g : g.nombre))
  return nombres.join(', ') || 'Sin rol'
}

// Rol principal (barra superior, menú lateral)
export function rolDe(usuario) {
  if (usuario.es_superusuario) return 'Superusuario'
  return usuario.grupos?.[0] ?? 'Usuario'
}

// Hasta dos iniciales para el avatar: nombre y apellido ("Juan Pérez" → "JP")
export function inicialDe(usuario) {
  const iniciales = `${usuario.nombre?.trim()?.[0] ?? ''}${usuario.apellido?.trim()?.[0] ?? ''}`
  return (iniciales || nombreDe(usuario).trim().charAt(0) || '?').toUpperCase()
}
