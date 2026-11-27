import { useState } from 'react'
import { Maximize2 } from 'lucide-react'
import Modal from './Modal'
import './ImagenAmpliable.css'

// Imagen de un gráfico que se agranda al tocarla: se abre en una ventana del
// ancho de la pantalla para verla mejor (Escape o el fondo la cierran).
// Recibe las mismas props que un <img>, más "titulo" para la ventana.
function ImagenAmpliable({ titulo, ...imagen }) {
  const [grande, setGrande] = useState(false)
  return (
    <>
      <button
        type="button"
        className="imagen-ampliable"
        onClick={() => setGrande(true)}
        aria-label={`Ver en grande: ${titulo}`}
        title="Ver en grande"
      >
        <img {...imagen} />
        <span className="imagen-ampliable__icono" aria-hidden="true">
          <Maximize2 size={16} />
        </span>
      </button>
      {grande && (
        <Modal titulo={titulo} className="modal--grafico" onCerrar={() => setGrande(false)}>
          <img src={imagen.src} alt={imagen.alt} className="imagen-ampliada" draggable={false} />
        </Modal>
      )}
    </>
  )
}

export default ImagenAmpliable
