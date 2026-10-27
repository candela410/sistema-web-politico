
import { NavLink, Outlet } from 'react-router'
import logo from '../../assets/logo.png'
import './Menu.css'

function Menu({ usuario, onSalir }) {
  return (
    <div className="panel">
      <header className="panel__barra">
        <img
          className="panel__logo"
          src={logo}
          alt="La Libertad Avanza"
        />

        <nav
          className="panel__nav"
          aria-label="Secciones"
        >
          {usuario.es_staff && (
            <>
              <NavLink to="/mapa" className="panel__seccion">
                Mapa
              </NavLink>

              <NavLink
                to="/cuestionarios"
                className="panel__seccion"
              >
                Cuestionarios
              </NavLink>

              <NavLink
                to="/categorias"
                className="panel__seccion"
              >
                Categorías
              </NavLink>

              <NavLink
                to="/grupos"
                className="panel__seccion"
              >
                Grupos
              </NavLink>
            </>
          )}

          <NavLink
            to="/responder"
            className="panel__seccion"
          >
            {usuario.es_staff ? 'Cargar encuesta' : 'Encuestas'}
          </NavLink>
        </nav>

        <div className="panel__usuario">
          <span className="panel__nombre">
            {usuario.nombre || usuario.email}
          </span>

          <button
            type="button"
            className="boton boton--borde"
            onClick={onSalir}
          >
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

      <Outlet />
    </div>
  )
}

export default Menu
