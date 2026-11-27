export const PERFILES = [
  ['foot-walking', 'A pie'],
  ['driving-car', 'En auto'],
  ['cycling-regular', 'En bicicleta'],
]

export const COLORES_ZONA = ['#51318f', '#2fb4e9', '#c3268c', '#f7a832', '#1f9d6b', '#e4572e', '#3a5ccc', '#8a8794']

export function distancia(metros) {
  if (metros == null) return '—'
  return metros < 1000 ? `${metros} m` : `${(metros / 1000).toFixed(1).replace('.', ',')} km`
}

export function duracion(segundos) {
  if (segundos == null) return '—'
  const minutos = Math.round(segundos / 60)
  if (minutos < 60) return `${minutos} min`
  return `${Math.floor(minutos / 60)} h ${minutos % 60} min`
}
