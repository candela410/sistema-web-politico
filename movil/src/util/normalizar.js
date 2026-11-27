// Texto para comparar sin distinguir mayúsculas ni acentos
// ("Administración" = "administracion"). Lo usan los buscadores de los listados.
const ACENTOS = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', à: 'a', è: 'e', ì: 'i', ò: 'o', ù: 'u', â: 'a', ê: 'e', î: 'i', ô: 'o', û: 'u', ã: 'a', õ: 'o', ç: 'c' }

export const normalizar = (texto) => {
  const minusculas = String(texto ?? '').toLowerCase()
  let base
  try {
    base = minusculas.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  } catch {
    base = minusculas.replace(/[áéíóúüàèìòùâêîôûãõç]/g, (l) => ACENTOS[l])
  }
  return base.trim()
}
