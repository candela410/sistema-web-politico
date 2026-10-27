import { NavLink } from 'react-router'

// Menú lateral: secciones con sus opciones. Las opciones salen de opciones.js
function Lateral({ secciones }) {
  return (
    <aside id="menu-lateral" className="lateral">
      <nav className="lateral__nav" aria-label="Secciones">
        {secciones.map((seccion, i) => (
          <div key={seccion.titulo ?? i} className="lateral__grupo">
            {seccion.titulo && <p className="lateral__titulo">{seccion.titulo}</p>}
            {seccion.opciones.map(({ ruta, texto, icono: Icono, exacta }) => (
              <NavLink key={ruta} to={ruta} end={exacta} className="lateral__opcion" title={texto}>
                <Icono size={22} strokeWidth={1.8} aria-hidden="true" />
                <span>{texto}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}

export default Lateral
