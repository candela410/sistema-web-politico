import { useState } from 'react'
import Spinner from 'react-bootstrap/Spinner'
import Modal from './Modal'

// Ventana para confirmar una acción ("¿Desea desactivar…?").
// onConfirmar puede ser async: mientras corre, el botón muestra un spinner y "…".
function Confirmacion({ titulo, children, textoConfirmar = 'Confirmar', peligro = true, onConfirmar, onCerrar }) {
  const [trabajando, setTrabajando] = useState(false)

  async function confirmar() {
    setTrabajando(true)
    try {
      await onConfirmar()
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <Modal titulo={titulo} onCerrar={onCerrar}>
      <div className="modal__texto">{children}</div>
      <div className="acciones">
        <button type="button" className="boton boton--borde" onClick={onCerrar} disabled={trabajando}>
          Cancelar
        </button>
        <button
          type="button"
          className={`boton${peligro ? ' boton--rojo' : ''}`}
          onClick={confirmar}
          disabled={trabajando}
          autoFocus
        >
          {trabajando && <Spinner animation="border" size="sm" aria-hidden="true" />}
          {trabajando ? `${textoConfirmar}…` : textoConfirmar}
        </button>
      </div>
    </Modal>
  )
}

export default Confirmacion
