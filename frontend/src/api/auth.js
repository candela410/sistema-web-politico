// API de autenticación de Django
import { pedir } from './cliente'

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

// Marca de que en esta pestaña ya se inició sesión. Al abrir la página de
// nuevo (pestaña nueva o navegador reabierto) no está, y se pide el login.
const MARCA = 'sesion-iniciada'

export function sesionDeEstaPestana() {
  try {
    return sessionStorage.getItem(MARCA) === '1'
  } catch {
    return false
  }
}

function marcarSesion(valor) {
  try {
    if (valor) sessionStorage.setItem(MARCA, '1')
    else sessionStorage.removeItem(MARCA)
  } catch {
    // Sin almacenamiento: se pedirá el login en cada recarga
  }
}

export async function iniciarSesion(email, password, recordar = false) {
  const { usuario } = await pedir('/api/auth/login/', {
    method: 'POST',
    datos: { email, password, recordar },
  })
  marcarSesion(true)
  return usuario
}

// Enlace del correo para restablecer la contraseña (/restablecer/:uid/:token)
export const comprobarEnlace = (uid, token) => pedir(`/api/auth/restablecer/${uid}/${token}/`)

export const restablecerContrasena = (uid, token, password) =>
  pedir(`/api/auth/restablecer/${uid}/${token}/`, { method: 'POST', datos: { password } })

export async function cerrarSesion() {
  marcarSesion(false)
  await pedir('/api/auth/logout/', { method: 'POST' })
}
