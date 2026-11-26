// Reglas de los formularios. Son las mismas que aplica el backend
// (backend/core/validaciones.py): lo que se acepta acá se acepta allá.
import { useState } from 'react'

// Correo: la regex del documento de validación (usuario@dominio.com) sin puntos seguidos en el dominio
export const REGLA_EMAIL = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/
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

// Nombre de usuario del login (apellido + inicial del nombre; el correo no se acepta)
export function errorUsuario(valor) {
  const texto = String(valor ?? '').trim()
  if (!texto) return 'Ingrese su nombre de usuario.'
  if (texto.includes('@')) return 'Ingrese su nombre de usuario (apellido + inicial del nombre), no el correo.'
  return /\s/.test(texto) ? 'El nombre de usuario no lleva espacios.' : ''
}

// ---------------------------------------------------------------------------
// Filtros mientras se escribe: lo que no se acepta ni siquiera aparece en el
// campo (como keyboardType + maxLength + autoCapitalize de TextInput, pero
// también en la computadora). Son las mismas reglas que valida el backend.
// ---------------------------------------------------------------------------

// Sin espacios al principio ni dos seguidos (el espacio del final se deja:
// hace falta para escribir la palabra siguiente)
const espaciado = (texto) => texto.replace(/^\s+/, '').replace(/[ \t]{2,}/g, ' ')

// Documento, teléfono, código de área: solo números
export const soloNumeros = (texto) => texto.replace(/\D/g, '')

// Nombre y apellido de una persona: letras, espacio, ' y -, con mayúscula al
// principio de cada palabra ("maría josé" → "María José", "o'connor" → "O'Connor")
export const nombrePropio = (texto) =>
  espaciado(texto.replace(/[^\p{L}\s'-]/gu, '')).replace(/(^|[\s'-])(\p{L})/gu, (_, antes, letra) => antes + letra.toUpperCase())

// Primera letra en mayúscula (oraciones: descripciones, direcciones)
// (también después de ¿ ¡ « " o paréntesis: "¿cuál…" → "¿Cuál…")
export const primeraMayuscula = (texto) =>
  texto.replace(/^\s+/, '').replace(/^([¿¡«"'(]*)(\p{L})/u, (_, signos, letra) => signos + letra.toUpperCase())

// Nombre de una cosa (campaña, categoría, equipo, rol, zona, ruta): letras,
// números, espacios y . , - ' ( ) / º °, empezando con mayúscula
export const nombreCosa = (texto) => primeraMayuscula(espaciado(texto.replace(/[^\p{L}\p{N}\s.,'()/º°-]/gu, '')))

// Título, preguntas y opciones de un cuestionario: sin símbolos como @ # $ * _ = < > { } [ ] | \ ~ `
export const textoLibre = (texto) => primeraMayuscula(texto.replace(/[@#$^*_=<>{}[\]|\\~`]/g, ''))

// Correo y nombre de usuario: sin espacios y en minúsculas
export const sinEspaciosMinusculas = (texto) => texto.replace(/\s/g, '').toLowerCase()

// onChange de un campo con filtro. El texto limpio se pone en el campo en el
// mismo momento, con el cursor donde estaba (no salta al final ni se mezcla
// lo que se escribe rápido).
export function conFiltro(filtro, guardar) {
  return (e) => {
    const campo = e.target
    const escrito = campo.value
    const limpio = filtro(escrito)
    if (limpio !== escrito) {
      const posicion = Math.max(0, (campo.selectionStart ?? escrito.length) - (escrito.length - limpio.length))
      campo.value = limpio
      try {
        campo.setSelectionRange(posicion, posicion)
      } catch {
        // type="email" no permite mover el cursor: queda al final
      }
    }
    guardar(limpio)
  }
}

// Teléfono (Usuarios y Mi perfil): se guarda como "(387) 4123456", con el
// código de área entre paréntesis. Al editar se separa en los dos campos; uno
// cargado antes sin código queda entero en el campo del número.
export function separarTelefono(texto) {
  const valor = String(texto ?? '').trim()
  const m = valor.match(/^\((\d{2,4})\)\s*(.*)$/)
  if (m) return { codigo: m[1], numero: m[2] }
  // Formato anterior con el código separado: "0387 154123456", "387-4123456"
  const viejo = valor.match(/^0?(\d{2,4})[\s-]+(?:15)?([\d\s-]+)$/)
  if (viejo) {
    const numero = viejo[2].replace(/\D/g, '')
    if (viejo[1].length + numero.length === 10) return { codigo: viejo[1], numero }
  }
  return { codigo: '', numero: valor }
}

// Código de área sin el 0 y número sin el 15: entre los dos, 10 cifras
// (11 + 8, 387 + 7, 3878 + 6)
export function erroresTelefono(codigo, numero, original) {
  const cifras = numero.replace(/\D/g, '')
  if (!numero.trim()) return { codigo: '', telefono: '' }
  // Un teléfono ya guardado que no se tocó se acepta como está
  if (!codigo && numero === original) return { codigo: '', telefono: '' }
  if (!codigo) return { codigo: 'Ingrese el código de área.', telefono: '' }
  if (!/^\d{2,4}$/.test(codigo)) return { codigo: 'De 2 a 4 números, sin el 0.', telefono: '' }
  if (cifras.length !== 10 - codigo.length)
    return { codigo: '', telefono: `Con el código ${codigo}, el número lleva ${10 - codigo.length} cifras (sin el 15).` }
  return { codigo: '', telefono: '' }
}

// Cuántas cifras lleva el número según el código de área (sin código, hasta 8)
export const cifrasDelNumero = (codigo) => (codigo ? Math.max(6, 10 - String(codigo).length) : 8)

// Lo que se guarda: "(387) 4123456", o solo el número si no tiene código
export function armarTelefono(codigo, numero) {
  const limpio = String(numero ?? '').trim()
  return codigo && limpio ? `(${codigo}) ${limpio}` : limpio
}

// Persona encuestada: DNI de 7 u 8 números y nombre o apellido solo con letras
export const REGLA_DNI = /^\d{7,8}$/
export const REGLA_PERSONA = /^\p{L}+(?:[ '-]\p{L}+)*$/u

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
