import { useState } from 'react'
import Confirmacion from './Confirmacion'

// Interruptor de píldora para activar/desactivar desde una lista.
// Cambia al instante (sin esperar al servidor); si el pedido falla,
// onCambiar no actualiza el dato y el interruptor vuelve a su lugar.
// Con `confirmacion` ({ titulo, mensaje }), antes de DESACTIVAR pregunta
// en una ventana; activar no pregunta.
function Interruptor({ activo, onCambiar, etiqueta, confirmacion, textos = ['Activo', 'Inactivo'] }) {
  const [pendiente, setPendiente] = useState(null)
  const [preguntando, setPreguntando] = useState(false)
  const valor = pendiente ?? activo

  async function aplicar(nuevo) {
    setPendiente(nuevo)
    try {
      await onCambiar(nuevo)
    } finally {
      setPendiente(null)
    }
  }

  function cambiar() {
    if (pendiente !== null) return
    const nuevo = !valor
    if (!nuevo && confirmacion) {
      setPreguntando(true)
      return
    }
    aplicar(nuevo)
  }

  return (
    <>
      <label className={`interruptor interruptor--lista${valor ? '' : ' interruptor--apagado'}`}>
        <input type="checkbox" role="switch" checked={valor} onChange={cambiar} aria-label={etiqueta} />
        <span className="interruptor__pista" aria-hidden="true" />
        <span className="interruptor__texto" aria-hidden="true">
          {valor ? textos[0] : textos[1]}
        </span>
      </label>
      {preguntando && (
        <Confirmacion
          titulo={confirmacion.titulo}
          textoConfirmar="Desactivar"
          onCerrar={() => setPreguntando(false)}
          onConfirmar={() => {
            setPreguntando(false)
            return aplicar(false)
          }}
        >
          {confirmacion.mensaje}
        </Confirmacion>
      )}
    </>
  )
}

export default Interruptor
