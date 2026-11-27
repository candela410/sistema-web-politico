// Cliente HTTP para la API de Django (sesión + CSRF), versión React Native.
//
// En la web el navegador guardaba las cookies y el frontend leía `csrftoken`
// de document.cookie. En el celular las cookies las guarda el sistema (iOS y
// Android las mandan solas con credentials: 'include'), pero no se pueden leer
// desde JS: por eso el backend devuelve el token CSRF en el JSON de
// /api/auth/csrf/ y de /api/auth/login/, y acá se guarda en memoria.
//
// Django, en HTTPS, además exige un Referer del mismo sitio en los POST: la
// app no lo manda sola, así que se agrega con la dirección del servidor.
import Constants from 'expo-constants'

// Dirección del backend, en este orden:
//  1. EXPO_PUBLIC_API_URL del archivo .env (producción o una IP fija).
//  2. "extra.apiUrl" de app.json, si se completó.
//  3. En desarrollo, la IP de la compu que corre Expo (la misma que el celular
//     usó para descargar la app con el QR) en el puerto 8000 de Django. Así no
//     queda una IP vieja escrita a mano cuando el router asigna otra.
const PUERTO_DJANGO = 8000
function ipDeExpo() {
  const host = String(Constants.expoConfig?.hostUri || '').split(':')[0]
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ? `http://${host}:${PUERTO_DJANGO}` : ''
}
export const API_URL = String(
  process.env.EXPO_PUBLIC_API_URL ||
    Constants.expoConfig?.extra?.apiUrl ||
    ipDeExpo() ||
    `http://127.0.0.1:${PUERTO_DJANGO}`,
).replace(/\/+$/, '')

let tokenCsrf = null
export const guardarCsrf = (token) => {
  if (token) tokenCsrf = token
}

// Avisos globales (equivalente a window.dispatchEvent('sin-campana') de la web)
const oyentes = new Set()
export function alSinCampana(fn) {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}

export const urlCompleta = (url) => (/^https?:\/\//.test(url) ? url : `${API_URL}${url}`)

function cabeceras(extra) {
  return {
    Accept: 'application/json',
    'X-CSRFToken': tokenCsrf ?? '',
    Referer: `${API_URL}/`,
    'X-Requested-With': 'XMLHttpRequest',
    ...extra,
  }
}

// Si el servidor no responde (IP equivocada, firewall, Django apagado) fetch
// puede quedar esperando minutos: se corta a los 10 segundos.
const ESPERA = 10000

export async function pedir(url, opciones = {}) {
  const { datos, ...resto } = opciones
  let respuesta
  const corte = new AbortController()
  const reloj = setTimeout(() => corte.abort(), ESPERA)
  try {
    respuesta = await fetch(urlCompleta(url), {
      credentials: 'include',
      signal: corte.signal,
      ...resto,
      body: datos === undefined ? resto.body : JSON.stringify(datos),
      headers: cabeceras({ 'Content-Type': 'application/json', ...resto.headers }),
    })
  } catch {
    const error = new Error(
      `No se pudo conectar con el servidor (${API_URL}). Verifique que Django esté encendido ` +
        '(python manage.py runserver) y que el celular esté en la misma red Wi-Fi que la compu.',
    )
    error.status = 0
    throw error
  } finally {
    clearTimeout(reloj)
  }
  const cuerpo = await respuesta.json().catch(() => ({}))
  // Django responde 400 en HTML (sin JSON) cuando la IP no está en ALLOWED_HOSTS
  if (respuesta.status === 400 && !cuerpo.error && !cuerpo.detail) {
    cuerpo.error = `El servidor (${API_URL}) rechazó la dirección: agregue esa IP a DJANGO_ALLOWED_HOSTS en backend/.env.`
  }
  // El backend manda el token nuevo cuando lo rota (login)
  guardarCsrf(cuerpo?.csrfToken)
  if (!respuesta.ok) {
    const error = new Error(cuerpo.error || cuerpo.detail || 'No se pudo conectar con el servidor.')
    error.status = respuesta.status
    error.codigo = cuerpo.codigo
    if (cuerpo.codigo === 'sin_campana') oyentes.forEach((fn) => fn())
    throw error
  }
  return cuerpo
}

// Descarga una imagen de la API (gráficos PNG que pide sesión) y la devuelve
// como "data:image/png;base64,…" para mostrarla con <Image>.
export async function pedirImagen(url) {
  const respuesta = await fetch(urlCompleta(url), { credentials: 'include', headers: cabeceras() })
  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => ({}))
    const error = new Error(cuerpo.error || 'No se pudo cargar el gráfico.')
    error.status = respuesta.status
    throw error
  }
  const blob = await respuesta.blob()
  return new Promise((resolver, fallar) => {
    const lector = new FileReader()
    lector.onloadend = () => resolver(lector.result)
    lector.onerror = () => fallar(new Error('No se pudo leer la imagen.'))
    lector.readAsDataURL(blob)
  })
}
