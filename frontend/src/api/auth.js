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

// Se ingresa con el nombre de usuario (apellido + inicial del nombre)
export async function iniciarSesion(nombreDeUsuario, password, recordar = false) {
  const { usuario } = await pedir('/api/auth/login/', {
    method: 'POST',
    datos: { usuario: nombreDeUsuario, password, recordar },
  })
  marcarSesion(true)
  recordarUsuario(usuario.username)
  return usuario
}

// Último nombre de usuario que ingresó en este navegador: se propone en el
// login y en "¿Olvidó su contraseña?" para no tener que recordarlo
const ULTIMO_USUARIO = 'ultimo-usuario'

export function ultimoUsuario() {
  try {
    return localStorage.getItem(ULTIMO_USUARIO) ?? ''
  } catch {
    return ''
  }
}

function recordarUsuario(nombre) {
  try {
    localStorage.setItem(ULTIMO_USUARIO, nombre)
  } catch {
    // Sin almacenamiento: no se recuerda
  }
}

// Configuración → Mi perfil. guardarPerfil devuelve { usuario, correo_pendiente }:
// para cambiar el correo se manda también { password } y el correo nuevo queda
// pendiente hasta que se confirme desde el enlace que le llega.
export const guardarPerfil = (datos) => pedir('/api/auth/perfil/', { method: 'PATCH', datos })
export const guardarFoto = (foto) => pedir('/api/auth/foto/', { method: 'PUT', datos: { foto } }).then((r) => r.usuario)
export const quitarFoto = () => pedir('/api/auth/foto/', { method: 'DELETE' }).then((r) => r.usuario)

// Enlace del correo para confirmar el correo nuevo (/confirmar-correo/:token).
// Devuelve { email, username }
export const confirmarCorreo = (token) => pedir('/api/auth/confirmar-correo/', { method: 'POST', datos: { token } })

// Mi perfil → "Cambiar contraseña": el enlace llega al correo del usuario. Devuelve { email }
export const pedirCambioDeContrasena = () => pedir('/api/auth/cambiar-contrasena/', { method: 'POST' })

// "¿Olvidó su contraseña?": con el nombre de usuario, el enlace llega al correo asociado
export const pedirEnlace = (usuario) => pedir('/api/auth/olvide/', { method: 'POST', datos: { usuario } })

// "¿Olvidó su usuario?": envía el nombre de usuario al correo indicado
export const pedirUsuario = (email) => pedir('/api/auth/olvide-usuario/', { method: 'POST', datos: { email } })

// Enlace del correo para elegir o restablecer la contraseña (/restablecer/:uid/:token)
export const comprobarEnlace = (uid, token) => pedir(`/api/auth/restablecer/${uid}/${token}/`)

export const restablecerContrasena = (uid, token, password, repetida) =>
  pedir(`/api/auth/restablecer/${uid}/${token}/`, { method: 'POST', datos: { password, repetida } })

export async function cerrarSesion() {
  marcarSesion(false)
  await pedir('/api/auth/logout/', { method: 'POST' })
}
