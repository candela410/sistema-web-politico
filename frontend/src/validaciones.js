// Reglas de los formularios. Son las mismas que aplica el backend
// (backend/core/validaciones.py): lo que se acepta acá se acepta allá.
import { useState } from 'react'

export const REGLA_EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/
export const REGLA_CONTRASENA = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{6,}$/

export const MENSAJE_EMAIL = 'Ingrese un correo electrónico válido (por ejemplo, usuario@correo.com).'
export const MENSAJE_CONTRASENA =
  'La contraseña debe tener al menos 6 caracteres, con una mayúscula, una minúscula y un número.'

export const emailValido = (valor) => REGLA_EMAIL.test(String(valor ?? '').trim())
export const contrasenaValida = (valor) => REGLA_CONTRASENA.test(String(valor ?? ''))

// Mensaje de error del correo ('' si está bien). Vacío: pide ingresarlo.
export function errorEmail(valor) {
  if (!String(valor ?? '').trim()) return 'Ingrese su correo electrónico.'
  return emailValido(valor) ? '' : MENSAJE_EMAIL
}

export function errorContrasena(valor) {
  if (!valor) return 'Ingrese su contraseña.'
  return contrasenaValida(valor) ? '' : MENSAJE_CONTRASENA
}

// Requisitos de la contraseña, para mostrarlos tildados mientras se escribe
export const requisitosContrasena = (valor = '') => [
  { texto: 'Al menos 6 caracteres', ok: valor.length >= 6 },
  { texto: 'Una letra mayúscula', ok: /[A-Z]/.test(valor) },
  { texto: 'Una letra minúscula', ok: /[a-z]/.test(valor) },
  { texto: 'Un número', ok: /[0-9]/.test(valor) },
]

// Formularios: guarda los valores con los que se abrió y avisa si hubo cambios,
// para deshabilitar "Guardar" mientras no se modificó nada.
const comparable = (valor) => JSON.stringify(valor, (_, v) => (typeof v === 'string' ? v.trim() : v))

export function useConCambios(valores) {
  const [inicial] = useState(() => comparable(valores))
  return comparable(valores) !== inicial
}
