// { desde: '2026-10-01', hasta: '' } → "?desde=2026-10-01" (sin los vacíos).
// URLSearchParams de React Native no está completo, por eso se arma a mano.
export function consulta(filtros = {}) {
  const partes = Object.entries(filtros)
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
  return partes.length ? `?${partes.join('&')}` : ''
}
