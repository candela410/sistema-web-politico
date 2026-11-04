import { useId, useState } from 'react'
import BsModal from 'react-bootstrap/Modal'
import './Modal.css'

// Ventana modal de react-bootstrap con el aspecto de la campaña (Modal.css).
// Escape y el fondo la cierran (con su animación de salida, y recién al
// terminar se avisa con onCerrar), el foco queda adentro mientras está
// abierta y la página de atrás no se desplaza.
// className va a la caja de la ventana (por ejemplo "modal--ancho").

// Al abrirse, el foco va al primer campo o botón (como hacía el <dialog> de antes)
const ENFOCABLES =
  'input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'

function Modal({ titulo, children, onCerrar, className = '' }) {
  const idTitulo = useId()
  const [abierta, setAbierta] = useState(true)
  return (
    <BsModal
      show={abierta}
      onHide={() => setAbierta(false)}
      onExited={onCerrar}
      centered
      aria-labelledby={idTitulo}
      className="ventana-capa"
      dialogClassName={`ventana ${className}`.trim()}
      contentClassName="ventana__caja"
      backdropClassName="ventana__fondo"
      onEntering={(ventana) => ventana.querySelector(`.modal__contenido :is(${ENFOCABLES})`)?.focus()}
    >
      <div className="modal__contenido">
        <h2 id={idTitulo}>{titulo}</h2>
        {children}
      </div>
    </BsModal>
  )
}

export default Modal
