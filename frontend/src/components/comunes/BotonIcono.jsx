import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import Overlay from 'react-bootstrap/Overlay'
import Tooltip from 'react-bootstrap/Tooltip'
import './BotonIcono.css'

// Botón cuadrado con solo un ícono. El texto ("Editar", "Borrar"…) va como
// nombre accesible y aparece en un cartelito (Tooltip de react-bootstrap) al
// pasar el cursor o al llegar con Tab.
// variante: "borde" (por defecto), "peligro" o "lleno". Con `to` es un enlace.
// `ayuda` reemplaza el texto del cartelito (por ejemplo, por qué está deshabilitado).

// El cartelito espera un poco antes de aparecer, para no saltar al pasar el
// mouse de largo. Pero si otro cartelito se cerró hace un instante (se está
// recorriendo una fila de botones), el siguiente aparece al toque y sin animación.
const PAUSA = 350
const SEGUIDO = 300
let ultimoCierre = 0

const conMouse = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches

const UBICACION = { modifiers: [{ name: 'offset', options: { offset: [0, 8] } }] }

function BotonIcono({ icono: Icono, etiqueta, ayuda, variante = 'borde', to, className = '', ...resto }) {
  const boton = useRef(null)
  const espera = useRef(null)
  const [cartel, setCartel] = useState({ visible: false, instantaneo: false })

  useEffect(() => () => clearTimeout(espera.current), [])

  function mostrar(sinPausa) {
    clearTimeout(espera.current)
    const seguido = Date.now() - ultimoCierre < SEGUIDO
    if (sinPausa || seguido) setCartel({ visible: true, instantaneo: seguido })
    else espera.current = setTimeout(() => setCartel({ visible: true, instantaneo: false }), PAUSA)
  }

  function ocultar() {
    clearTimeout(espera.current)
    setCartel((c) => {
      if (c.visible) ultimoCierre = Date.now()
      return { ...c, visible: false }
    })
  }

  // Un botón deshabilitado no recibe eventos del mouse: va dentro de un <span>
  // que escucha por él, así el cartelito puede explicar por qué no se puede usar
  const deshabilitado = Boolean(resto.disabled) && !to
  const eventos = {
    onMouseEnter: (e) => {
      if (conMouse()) mostrar(false)
      resto.onMouseEnter?.(e)
    },
    onMouseLeave: (e) => {
      ocultar()
      resto.onMouseLeave?.(e)
    },
    onFocus: (e) => {
      if (e.currentTarget.matches(':focus-visible')) mostrar(true)
      resto.onFocus?.(e)
    },
    onBlur: (e) => {
      ocultar()
      resto.onBlur?.(e)
    },
    // Al tocarlo se esconde: si abre una ventana, el cartelito no queda encima
    onPointerDown: (e) => {
      ocultar()
      resto.onPointerDown?.(e)
    },
  }

  const props = {
    ref: deshabilitado ? undefined : boton,
    className: `accion-icono accion-icono--${variante} ${className}`.trim(),
    'aria-label': etiqueta,
    ...resto,
    ...(deshabilitado ? {} : eventos),
  }

  const contenido = <Icono size={17} strokeWidth={2} aria-hidden="true" />
  return (
    <>
      {to ? (
        <Link to={to} {...props}>
          {contenido}
        </Link>
      ) : deshabilitado ? (
        <span ref={boton} className="accion-icono__envoltorio" {...eventos}>
          <button type="button" {...props}>
            {contenido}
          </button>
        </span>
      ) : (
        <button type="button" {...props}>
          {contenido}
        </button>
      )}
      <Overlay target={boton} show={cartel.visible} placement="top" popperConfig={UBICACION}>
        {(overlay) => (
          <Tooltip {...overlay} className={`cartelito${cartel.instantaneo ? ' cartelito--instantaneo' : ''}`}>
            {ayuda || etiqueta}
          </Tooltip>
        )}
      </Overlay>
    </>
  )
}

export default BotonIcono
