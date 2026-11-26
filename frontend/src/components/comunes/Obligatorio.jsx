// Asterisco rojo de los campos obligatorios. "si" permite mostrarlo solo en
// algunos casos (por ejemplo, al crear y no al editar).
export default function Obligatorio({ si = true }) {
  if (!si) return null
  return (
    <span className="obligatorio" aria-hidden="true">
      {' '}*
    </span>
  )
}
