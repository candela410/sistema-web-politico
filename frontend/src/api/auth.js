// Cliente de la API de autenticación de Django (sesión + CSRF)

function leerCookie(nombre) {
  const fila = document.cookie.split('; ').find((c) => c.startsWith(`${nombre}=`))
  return fila ? decodeURIComponent(fila.split('=')[1]) : null
}

async function pedir(url, opciones = {}) {
  const respuesta = await fetch(url, {
    credentials: 'same-origin',
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      // Se lee en cada pedido porque Django rota el token al iniciar sesión
      'X-CSRFToken': leerCookie('csrftoken') ?? '',
      ...opciones.headers,
    },
  })
  const datos = await respuesta.json().catch(() => ({}))
  if (!respuesta.ok) {
    const error = new Error(datos.error || 'No se pudo conectar con el servidor.')
    error.status = respuesta.status
    throw error
  }
  return datos
}

export async function prepararCsrf() {
  await pedir('/api/auth/csrf/')
}

export async function usuarioActual() {
  try {
    const { usuario } = await pedir('/api/auth/me/')
    return usuario
  } catch (error) {
    if (error.status === 401) return null
    throw error
  }
}

export async function iniciarSesion(email, password, recordar = false) {
  const { usuario } = await pedir('/api/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ email, password, recordar }),
  })
  return usuario
}

export async function cerrarSesion() {
  await pedir('/api/auth/logout/', { method: 'POST' })
}
