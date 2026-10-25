import logo from './assets/logo.png'
import Mapa from './mapa/Mapa'
import './Panel.css'

// Estructura de la app una vez iniciada la sesión: barra superior + sección
function Panel({ usuario, onSalir }) {
  return (
    <div className="panel">
      <header className="panel__barra">
        <img className="panel__logo" src={logo} alt="La Libertad Avanza" />
        <nav className="panel__nav" aria-label="Secciones">
          <span className="panel__seccion" aria-current="page">
            Mapa
          </span>
        </nav>
        <div className="panel__usuario">
          <span className="panel__nombre">{usuario.nombre || usuario.email}</span>
          <button type="button" className="boton boton--borde" onClick={onSalir}>
            Salir
          </button>
        </div>
      </header>
      <span className="franja-marca" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <Mapa />
    </div>
  )
}

export default Panel
