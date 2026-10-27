import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { Menu as IconoMenu } from 'lucide-react'
import { salirDeCampana } from '../../api/campanas'
import logo from '../../assets/logo.png'
import BuscadorSecciones from './BuscadorSecciones'
import Lateral from './Lateral'
import MenuUsuario from './MenuUsuario'
import { opcionActual, seccionesPara } from './opciones'
import './Menu.css'

// En pantallas angostas el lateral se abre encima del contenido (como cajón)
const ANGOSTA = '(max-width: 900px)'
const CLAVE_COLAPSADO = 'menu-colapsado'

function leerColapsado() {
  try {
    return localStorage.getItem(CLAVE_COLAPSADO) === '1'
  } catch {
    return false
  }
}

// Estructura de la app: barra superior + menú lateral + la pantalla actual (Outlet).
// Las opciones salen de los permisos de Django del usuario (ver opciones.js).
function Menu({ usuario, onCambio, onSalir }) {
  const navegar = useNavigate()
  const { pathname } = useLocation()
  const secciones = seccionesPara(usuario)
  const actual = opcionActual(secciones, pathname)

  const [colapsado, setColapsado] = useState(leerColapsado) // PC: lateral solo con íconos
  // Celular: el cajón queda abierto solo en la pantalla donde se abrió,
  // así al elegir una opción (cambia la dirección) se cierra solo
  const [abiertoEn, setAbiertoEn] = useState(null)
  const abierto = abiertoEn === pathname
  const setAbierto = (valor) => setAbiertoEn(valor ? pathname : null)

  useEffect(() => {
    if (!abierto) return
    const alTeclear = (e) => e.key === 'Escape' && setAbiertoEn(null)
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [abierto])

  function alternarMenu() {
    if (window.matchMedia(ANGOSTA).matches) {
      setAbierto(!abierto)
      return
    }
    setColapsado((c) => {
      try {
        localStorage.setItem(CLAVE_COLAPSADO, c ? '0' : '1')
      } catch {
        // sin localStorage no se recuerda, pero el menú funciona igual
      }
      return !c
    })
  }

  async function cambiarCampana() {
    onCambio(await salirDeCampana())
    navegar('/campana')
  }

  const clases = ['panel', colapsado && 'panel--colapsado', abierto && 'panel--abierto'].filter(Boolean).join(' ')

  return (
    <div className={clases}>
      <header className="panel__barra">
        <div className="panel__inicio">
          <button
            type="button"
            className="panel__hamburguesa"
            onClick={alternarMenu}
            aria-label="Mostrar u ocultar el menú"
            aria-expanded={!colapsado || abierto}
            aria-controls="menu-lateral"
          >
            <IconoMenu size={22} />
          </button>
          <div className="panel__marca">
            <img className="panel__logo" src={logo} alt="La Libertad Avanza" />
            <div className="panel__titulo">
              <strong>Panel de gestión</strong>
              <span>{actual?.texto ?? 'Inicio'}</span>
            </div>
          </div>
        </div>
        <BuscadorSecciones secciones={secciones} />
        <div className="panel__derecha">
          {usuario.campana && (
            <span className="campana-activa" title="Campaña activa">
              <span className="campana-activa__punto" aria-hidden="true" />
              <span className="campana-activa__nombre">{usuario.campana.nombre}</span>
            </span>
          )}
          <MenuUsuario
            usuario={usuario}
            onCambiarCampana={usuario.puede_elegir_campana ? cambiarCampana : null}
            onSalir={onSalir}
          />
        </div>
      </header>
      <span className="franja-marca" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <div className="panel__cuerpo">
        <Lateral secciones={secciones} />
        <div className="panel__fondo" onClick={() => setAbierto(false)} aria-hidden="true" />
        <div className="panel__contenido">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default Menu
