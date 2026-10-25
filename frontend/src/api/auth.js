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

export async function iniciarSesion(email, password, recordar = false) {
  const { usuario } = await pedir('/api/auth/login/', {
    method: 'POST',
    datos: { email, password, recordar },
  })
  return usuario
}

export async function cerrarSesion() {
  await pedir('/api/auth/logout/', { method: 'POST' })
}
