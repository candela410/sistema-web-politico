// Reglas de los formularios. Son las mismas que aplica el backend
// (backend/core/validaciones.py): lo que se acepta acá se acepta allá.
import { useState } from 'react'

// Correo: la regex del documento de validación (usuario@dominio.com), sin puntos seguidos en el dominio
export const REGLA_EMAIL = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/
// Contraseña: 8 o más caracteres con una mayúscula, una minúscula y un número
export const REGLA_CONTRASENA = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,}$/

export const MENSAJE_EMAIL = 'Ingrese un correo electrónico válido (por ejemplo, usuario@correo.com).'
export const MENSAJE_CONTRASENA =
  'La contraseña debe tener al menos 8 caracteres, con una mayúscula, una minúscula y un número.'

export const emailValido = (valor) => REGLA_EMAIL.test(String(valor ?? '').trim())
export const contrasenaValida = (valor) => REGLA_CONTRASENA.test(String(valor ?? ''))

// Mensaje de error del correo ('' si está bien). Vacío: pide ingresarlo.
export function errorEmail(valor) {
  if (!String(valor ?? '').trim()) return 'Ingrese su correo electrónico.'
  return emailValido(valor) ? '' : MENSAJE_EMAIL
}

// Nombre de usuario del login (apellido + inicial del nombre; también se acepta el correo)
export function errorUsuario(valor) {
  const texto = String(valor ?? '').trim()
  if (!texto) return 'Ingrese su nombre de usuario.'
  return /\s/.test(texto) ? 'El nombre de usuario no lleva espacios.' : ''
}

// Persona encuestada: DNI de 7 u 8 números y nombre o apellido solo con letras
export const REGLA_DNI = /^\d{7,8}$/
// (Sin \p{L}: Hermes, el motor de React Native, no siempre lo admite.)
const LETRA = "A-Za-zªºÀ-ÖØ-öø-ɏ"
export const REGLA_PERSONA = new RegExp(`^[${LETRA}]+(?:[ '-][${LETRA}]+)*$`)

export function errorDocumento(valor) {
  if (!valor) return 'Ingrese el documento.'
  return REGLA_DNI.test(valor) ? '' : 'El documento debe tener 7 u 8 números, sin puntos.'
}

export function errorPersona(valor, campo = 'El nombre') {
  const texto = String(valor ?? '').trim()
  if (!texto) return ''
  if (texto.length < 2) return `${campo} es muy corto.`
  return REGLA_PERSONA.test(texto) ? '' : `${campo} solo admite letras y espacios.`
}

// Requisitos de la contraseña, para mostrarlos tildados mientras se escribe
export const requisitosContrasena = (valor = '') => [
  { texto: 'Al menos 8 caracteres', ok: valor.length >= 8 },
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
