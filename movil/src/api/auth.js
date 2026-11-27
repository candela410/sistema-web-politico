// API de autenticación de Django
import { guardar, leer } from '../util/almacen'
import { guardarCsrf, pedir } from './cliente'
import { borrarCredenciales, guardarCredenciales } from '../util/credenciales'

export async function prepararCsrf() {
  const r = await pedir('/api/auth/csrf/')
  guardarCsrf(r.csrfToken)
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

// Se ingresa con el nombre de usuario (apellido + inicial del nombre).
// "Recordar" solo guarda el usuario y la contraseña para la próxima vez
// (util/credenciales.js); la sesión no queda abierta: al volver a abrir la app
// se pide el login, con los datos ya escritos.
export async function iniciarSesion(nombreDeUsuario, password, recordar = false) {
  const { usuario } = await pedir('/api/auth/login/', {
    method: 'POST',
    datos: { usuario: nombreDeUsuario, password },
  })
  if (recordar) {
    guardar(ULTIMO_USUARIO, usuario.username)
    await guardarCredenciales(usuario.username, password)
  } else {
    guardar(ULTIMO_USUARIO, null)
    await borrarCredenciales()
  }
  // Django rota el token CSRF al iniciar sesión
  await prepararCsrf().catch(() => {})
  return usuario
}

// Nombre de usuario recordado en este celular (con "Recordar"): se propone
// en el login y en "¿Olvidó su contraseña?"
const ULTIMO_USUARIO = 'ultimo-usuario'
export const ultimoUsuario = () => leer(ULTIMO_USUARIO, '')

// Configuración → Mi perfil. Las tres devuelven el usuario actualizado.
// { usuario, correo_pendiente }: si se cambió el correo, queda pendiente hasta confirmarlo
export const guardarPerfil = (datos) => pedir('/api/auth/perfil/', { method: 'PATCH', datos })
export const guardarFoto = (foto) => pedir('/api/auth/foto/', { method: 'PUT', datos: { foto } }).then((r) => r.usuario)
export const quitarFoto = () => pedir('/api/auth/foto/', { method: 'DELETE' }).then((r) => r.usuario)

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
  await pedir('/api/auth/logout/', { method: 'POST' })
  await prepararCsrf().catch(() => {})
}
