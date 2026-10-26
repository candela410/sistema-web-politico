// Datos del usuario para mostrar (barra superior y pantalla de inicio)

export const nombreDe = (usuario) =>
  [usuario.nombre, usuario.apellido].filter(Boolean).join(' ') || usuario.username || usuario.email

export const rolDe = (usuario) => (usuario.es_staff ? 'Administración' : 'Militante')

export const inicialDe = (usuario) => nombreDe(usuario).trim().charAt(0).toUpperCase()
