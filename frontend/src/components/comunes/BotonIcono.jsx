import { Link } from 'react-router'
import './BotonIcono.css'

// Botón cuadrado con solo un ícono. El texto ("Editar", "Borrar"…) va como
// nombre accesible y aparece en un cartelito al pasar el cursor.
// variante: "borde" (por defecto), "peligro" o "lleno". Con `to` es un enlace.
// `ayuda` reemplaza el texto del cartelito (por ejemplo, por qué está deshabilitado).
function BotonIcono({ icono: Icono, etiqueta, ayuda, variante = 'borde', to, className = '', ...resto }) {
  const props = {
    className: `accion-icono accion-icono--${variante} ${className}`.trim(),
    'aria-label': etiqueta,
    'data-ayuda': ayuda || etiqueta,
    ...resto,
  }
  const contenido = <Icono size={17} strokeWidth={2} aria-hidden="true" />
  if (to) {
    return (
      <Link to={to} {...props}>
        {contenido}
      </Link>
    )
  }
  return (
    <button type="button" {...props}>
      {contenido}
    </button>
  )
}

export default BotonIcono
