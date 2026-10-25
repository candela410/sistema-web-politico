import { useEffect, useRef } from 'react'
import './Modal.css'

// Ventana modal basada en <dialog>: Escape y el fondo la cierran
function Modal({ titulo, children, onCerrar }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialogo = ref.current
    dialogo.showModal()
    return () => dialogo.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-titulo"
      onCancel={(e) => {
        e.preventDefault()
        onCerrar()
      }}
      onClick={(e) => e.target === ref.current && onCerrar()}
    >
      <div className="modal__contenido">
        <h2 id="modal-titulo">{titulo}</h2>
        {children}
      </div>
    </dialog>
  )
}

export default Modal
