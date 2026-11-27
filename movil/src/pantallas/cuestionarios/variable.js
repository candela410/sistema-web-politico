// Si todas las opciones son números, la variable es cuantitativa; si alguna
// tiene texto, cualitativa (el backend aplica la misma regla).
const esNumero = (texto) => /^\s*-?\d+([.,]\d+)?\s*$/.test(texto)
export function variableDe(opciones) {
  const textos = opciones.map((o) => o.texto).filter((t) => t.trim())
  return textos.length > 0 && textos.every(esNumero) ? 'cuantitativa' : 'cualitativa'
}
