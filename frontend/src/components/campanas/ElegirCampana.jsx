import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import * as api from '../../api/campanas'
import logo from '../../assets/logo.png'
import { tiene } from '../../permisos'
import './campanas.css'

const formatoFecha = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' })
const fecha = (iso) => (iso ? formatoFecha.format(new Date(`${iso}T12:00:00`)) : null)

// Pantalla que ve el superusuario (o quien tenga permiso) después de ingresar:
// elige la campaña y recién ahí se abre el menú con todo lo de esa campaña.
function ElegirCampana({ usuario, onElegida, onSalir }) {
  const [campanas, setCampanas] = useState(null)
  const [error, setError] = useState('')
  const [entrando, setEntrando] = useState(null)

  useEffect(() => {
    api
      .obtenerDisponibles()
      .then(setCampanas)
      .catch((e) => setError(e.message))
  }, [])

  async function entrar(campana) {
    setError('')
    setEntrando(campana.id)
    try {
      onElegida(await api.elegirCampana(campana.id))
    } catch (e) {
      setError(e.message)
      setEntrando(null)
    }
  }

  return (
    <div className="elegir">
      <svg className="elegir__ola" viewBox="0 0 400 140" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 0h400v140c-40 6-80-2-110-22C250 92 215 50 160 48 105 46 60 70 0 104Z" />
      </svg>

      <main className="elegir__contenido">
        <img className="elegir__logo" src={logo} alt="La Libertad Avanza" />
        <header>
          <h1>Elegí la campaña</h1>
          <p>
            Hola, {usuario.nombre || usuario.email}. Elegí en qué campaña vas a trabajar: vas a ver solo sus datos.
          </p>
          <span className="franja-corta" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </header>

        {error && (
          <p className="texto-error" role="alert">
            {error}
          </p>
        )}

        {campanas === null ? (
          <p className="vacio-tarjeta">Cargando…</p>
        ) : campanas.length === 0 ? (
          <div className="vacio-tarjeta">
            <b>No hay campañas activas.</b>
            {tiene(usuario, 'core.add_campana') ? (
              <span>
                <Link to="/campanas">Creá la primera campaña</Link> para empezar.
              </span>
            ) : (
              <span>Pedile a la administración que cree una.</span>
            )}
          </div>
        ) : (
          <ul className="elegir__lista">
            {campanas.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="elegir__campana"
                  onClick={() => entrar(c)}
                  disabled={entrando !== null}
                  aria-busy={entrando === c.id}
                >
                  <span className="elegir__nombre">{c.nombre}</span>
                  {c.descripcion && <span className="elegir__descripcion">{c.descripcion}</span>}
                  <span className="elegir__datos">
                    {(c.fecha_inicio || c.fecha_fin) && (
                      <span>
                        {fecha(c.fecha_inicio) ?? '…'} – {fecha(c.fecha_fin) ?? '…'}
                      </span>
                    )}
                    <span>
                      {c.cuestionarios} cuestionario{c.cuestionarios === 1 ? '' : 's'} · {c.usuarios} usuario
                      {c.usuarios === 1 ? '' : 's'} · {c.rutas} ruta{c.rutas === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span className="elegir__entrar" aria-hidden="true">
                    {entrando === c.id ? 'Entrando…' : 'Entrar →'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <footer className="elegir__pie">
          {tiene(usuario, 'core.view_campana') && (
            <Link to="/campanas" className="boton boton--borde">
              Administrar campañas
            </Link>
          )}
          <button type="button" className="enlace-boton" onClick={onSalir}>
            Cerrar sesión
          </button>
        </footer>
      </main>
    </div>
  )
}

export default ElegirCampana
