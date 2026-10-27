// Cliente HTTP para la API de Django (sesión + CSRF)

function leerCookie(nombre) {
  const fila = document.cookie.split('; ').find((c) => c.startsWith(`${nombre}=`))
  return fila ? decodeURIComponent(fila.split('=')[1]) : null
}

export async function pedir(url, opciones = {}) {
  const { datos, ...resto } = opciones
  const respuesta = await fetch(url, {
    credentials: 'same-origin',
    ...resto,
    body: datos === undefined ? resto.body : JSON.stringify(datos),
    headers: {
      'Content-Type': 'application/json',
      // Se lee en cada pedido porque Django rota el token al iniciar sesión
      'X-CSRFToken': leerCookie('csrftoken') ?? '',
      ...resto.headers,
    },
  })
  const cuerpo = await respuesta.json().catch(() => ({}))
  if (!respuesta.ok) {
    const error = new Error(cuerpo.error || 'No se pudo conectar con el servidor.')
    error.status = respuesta.status
    error.codigo = cuerpo.codigo
    // La sesión no tiene campaña elegida: App.jsx lleva a la pantalla de elegir
    if (cuerpo.codigo === 'sin_campana') window.dispatchEvent(new Event('sin-campana'))
    throw error
  }
  return cuerpo
}
