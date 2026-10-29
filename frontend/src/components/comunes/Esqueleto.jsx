import './Esqueleto.css'

// Tarjetas "fantasma" con la forma de una fila de la lista mientras llegan
// los datos. Se anuncia como "Cargando…" a los lectores de pantalla.
function Esqueleto({ filas = 3, texto = 'Cargando…' }) {
  return (
    <div className="esqueleto" role="status" aria-live="polite">
      <span className="esqueleto__lector">{texto}</span>
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="esqueleto__fila" aria-hidden="true">
          <div className="esqueleto__texto">
            <i className="esqueleto__barra esqueleto__barra--chica" />
            <i className="esqueleto__barra esqueleto__barra--titulo" />
            <i className="esqueleto__barra esqueleto__barra--dato" />
          </div>
          <i className="esqueleto__barra esqueleto__barra--boton" />
          <i className="esqueleto__barra esqueleto__barra--boton" />
        </div>
      ))}
    </div>
  )
}

export default Esqueleto
