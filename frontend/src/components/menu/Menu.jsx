import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { salirDeCampana } from '../../api/campanas'
import logo from '../../assets/logo.png'
import { GESTION, SECCIONES, tiene } from '../../permisos'
import './Menu.css'

// Menú superior: secciones según los permisos de Django del usuario, menú
// "Gestión" (usuarios, permisos, actividad, campañas) y la campaña activa.
function Menu({ usuario, onCambio, onSalir }) {
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const [gestionAbierta, setGestionAbierta] = useState(false)
  const refGestion = useRef(null)

  const conCampana = !!usuario.campana
  const secciones = conCampana ? SECCIONES.filter((s) => tiene(usuario, s.permiso)) : []
  const gestion = GESTION.filter((s) => tiene(usuario, s.permiso) && (conCampana || s.ruta === '/campanas'))
  const enGestion = gestion.some((s) => ubicacion.pathname.startsWith(s.ruta))

  useEffect(() => {
    if (!gestionAbierta) return
    const cerrar = (e) => !refGestion.current?.contains(e.target) && setGestionAbierta(false)
    document.addEventListener('pointerdown', cerrar)
    return () => document.removeEventListener('pointerdown', cerrar)
  }, [gestionAbierta])

  async function cambiarCampana() {
    onCambio(await salirDeCampana())
    navegar('/campana')
  }

  return (
    <div className="panel">
      <header className="panel__barra">
        <img className="panel__logo" src={logo} alt="La Libertad Avanza" />
        <nav className="panel__nav" aria-label="Secciones">
          {secciones.map((s) => (
            <NavLink key={s.ruta} to={s.ruta} className="panel__seccion">
              {s.texto}
            </NavLink>
          ))}
        </nav>
        {gestion.length > 0 && (
          <div className="menu-gestion" ref={refGestion}>
            <button
              type="button"
              className={`panel__seccion menu-gestion__boton${enGestion ? ' active' : ''}`}
              aria-expanded={gestionAbierta}
              onClick={() => setGestionAbierta((a) => !a)}
            >
              Gestión <span aria-hidden="true">▾</span>
            </button>
            {gestionAbierta && (
              <div className="menu-gestion__lista">
                {gestion.map((s) => (
                  <NavLink
                    key={s.ruta}
                    to={s.ruta}
                    className="menu-gestion__item"
                    onClick={() => setGestionAbierta(false)}
                  >
                    {s.texto}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="panel__usuario">
          {usuario.campana && (
            <span className="campana-activa" title="Campaña activa">
              <span className="campana-activa__punto" aria-hidden="true" />
              <span className="campana-activa__nombre">{usuario.campana.nombre}</span>
              {usuario.puede_elegir_campana && (
                <button type="button" className="enlace-boton" onClick={cambiarCampana}>
                  Cambiar
                </button>
              )}
            </span>
          )}
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
      <Outlet />
    </div>
  )
}

export default Menu
