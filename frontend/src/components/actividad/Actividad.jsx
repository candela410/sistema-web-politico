import { useEffect, useState } from 'react'
import { obtenerHistorial } from '../../api/usuarios'
import './actividad.css'
import Esqueleto from '../comunes/Esqueleto'
import Paginacion, { POR_PAGINA } from '../comunes/Paginacion'

// Historial de actividad de la campaña activa, en un cuadro: cada movimiento
// registrado en el log de Django (fecha y hora, quién, qué hizo, sobre qué y,
// si editó, el dato anterior y el nuevo de cada campo). Como el resto del sistema, muestra solo la campaña en
// la que se está trabajando.

const ACCIONES = {
  crear: { texto: 'Creó', clase: 'crear' },
  editar: { texto: 'Editó', clase: 'editar' },
  borrar: { texto: 'Eliminó', clase: 'borrar' },
  sesion: { texto: 'Sesión', clase: 'sesion' },
}

const FILTROS_VACIOS = { usuario: '', accion: '', seccion: '', desde: '', hasta: '' }
const formatoFecha = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const formatoHora = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' })

const valor = (v) => (v === '' || v == null ? <span className="cambios__vacio">(vacío)</span> : String(v))

// Dato anterior o nuevo: un renglón por campo que cambió ("Nombre: Juan")
function Datos({ cambios, lado }) {
  if (!cambios.length) return <span className="cambios__vacio">—</span>
  return (
    <ul className="datos">
      {cambios.map((c) => (
        <li key={c.campo}>
          <span className="datos__campo">{c.campo}</span>
          <span className={`datos__valor datos__valor--${lado}`}>{valor(lado === 'antes' ? c.antes : c.despues)}</span>
        </li>
      ))}
    </ul>
  )
}

// Una fila del cuadro de actividad
function Fila({ m }) {
  const accion = ACCIONES[m.accion] ?? ACCIONES.editar
  const fecha = new Date(m.fecha)
  const sesion = m.accion === 'sesion'
  return (
    <tr>
      <td className="actividad-tabla__fecha">
        <span>{formatoFecha.format(fecha)}</span>
        <small>{formatoHora.format(fecha)}</small>
      </td>
      <td className="actividad-tabla__usuario">{m.usuario.nombre}</td>
      <td>
        <span className={`accion accion--${accion.clase}`}>{accion.texto}</span>
      </td>
      <td>{sesion ? '—' : m.seccion}</td>
      <td className="actividad-tabla__registro">
        {sesion ? m.detalle : <b>{m.objeto}</b>}
        {!sesion && m.detalle && <small>{m.detalle}</small>}
        {m.desde_admin && <small>Desde el administrador de Django</small>}
      </td>
      <td className="actividad-tabla__dato actividad-tabla__dato--antes">
        <Datos cambios={m.cambios} lado="antes" />
      </td>
      <td className="actividad-tabla__dato actividad-tabla__dato--despues">
        <Datos cambios={m.cambios} lado="despues" />
      </td>
    </tr>
  )
}

function Actividad({ usuario }) {
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [pagina, setPagina] = useState(1)
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  // Mientras lo mostrado no corresponda a los filtros actuales, está cargando
  const clave = JSON.stringify({ ...filtros, pagina })
  const [claveCargada, setClaveCargada] = useState(null)
  const cargando = claveCargada !== clave

  useEffect(() => {
    let vigente = true
    // Pequeña espera para no pedir en cada cambio rápido de filtros
    const t = setTimeout(() => {
      obtenerHistorial(JSON.parse(clave))
        .then((d) => {
          if (!vigente) return
          setDatos(d)
          setClaveCargada(clave)
        })
        .catch((e) => vigente && setError(e.message))
    }, 250)
    return () => {
      vigente = false
      clearTimeout(t)
    }
  }, [clave])

  const cambiar = (campo) => (e) => {
    setFiltros((f) => ({ ...f, [campo]: e.target.value }))
    setPagina(1)
  }
  const hayFiltros = Object.values(filtros).some(Boolean)

  return (
    <main className="pagina pagina--ancha">
      <header className="pagina__encabezado">
        <div>
          <h1>Actividad</h1>
          <p>Movimientos realizados en {usuario.campana?.nombre ?? 'la campaña'}: quién, cuándo y qué cambió.</p>
          <span className="franja-corta" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
      </header>

      <section className="filtros" aria-label="Filtros">
        <label>
          Persona
          <select className="entrada" value={filtros.usuario} onChange={cambiar('usuario')}>
            <option value="">Todas</option>
            {datos?.filtros.usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Acción
          <select className="entrada" value={filtros.accion} onChange={cambiar('accion')}>
            <option value="">Todas</option>
            <option value="crear">Creó</option>
            <option value="editar">Editó</option>
            <option value="borrar">Eliminó</option>
            <option value="sesion">Inicio / cierre de sesión</option>
          </select>
        </label>
        <label>
          Sección
          <select className="entrada" value={filtros.seccion} onChange={cambiar('seccion')}>
            <option value="">Todas</option>
            {datos?.filtros.secciones.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Desde
          <input className="entrada" type="date" value={filtros.desde} onChange={cambiar('desde')} />
        </label>
        <label>
          Hasta
          <input className="entrada" type="date" value={filtros.hasta} onChange={cambiar('hasta')} />
        </label>
        <div className="filtros__pie">
          {hayFiltros && (
            <button
              type="button"
              className="enlace-boton"
              onClick={() => {
                setFiltros(FILTROS_VACIOS)
                setPagina(1)
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </section>

      {error && (
        <p className="texto-error" role="alert">
          {error}
        </p>
      )}

      {!datos ? (
        !error && <Esqueleto filas={4} />
      ) : datos.total === 0 ? (
        <p className="vacio-tarjeta">{hayFiltros ? 'No hay movimientos con esos filtros.' : 'Todavía no hay movimientos.'}</p>
      ) : (
        <div className={`actividad${cargando ? ' actividad--cargando' : ''}`}>
          <p className="texto-suave">
            {datos.total} movimiento{datos.total === 1 ? '' : 's'}
          </p>
          <div className="actividad-tabla-envoltura">
            <table className="actividad-tabla">
              <thead>
                <tr>
                  <th scope="col">Fecha y hora</th>
                  <th scope="col">Usuario</th>
                  <th scope="col">Acción</th>
                  <th scope="col">Sección</th>
                  <th scope="col">Registro</th>
                  <th scope="col">Dato anterior</th>
                  <th scope="col">Dato nuevo</th>
                </tr>
              </thead>
              <tbody>
                {datos.movimientos.map((m) => (
                  <Fila key={m.id} m={m} />
                ))}
              </tbody>
            </table>
          </div>
          <Paginacion
            pagina={datos.pagina}
            paginas={datos.paginas}
            total={datos.total}
            porPagina={POR_PAGINA}
            irA={setPagina}
          />
        </div>
      )}
    </main>
  )
}

export default Actividad
