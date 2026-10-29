import { useEffect, useState } from 'react'
import { obtenerHistorial } from '../../api/usuarios'
import './actividad.css'
import Esqueleto from '../comunes/Esqueleto'
import { Eye, EyeOff } from 'lucide-react'

// Historial de actividad: cada movimiento registrado en el log de Django
// (fecha, hora, quién, qué hizo y, si editó, el valor anterior y el nuevo).

const ACCIONES = {
  crear: { texto: 'Creó', clase: 'crear' },
  editar: { texto: 'Editó', clase: 'editar' },
  borrar: { texto: 'Borró', clase: 'borrar' },
  sesion: { texto: 'Sesión', clase: 'sesion' },
}

const FILTROS_VACIOS = { usuario: '', accion: '', seccion: '', desde: '', hasta: '', q: '', alcance: '' }
const formatoDia = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const formatoHora = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

const valor = (v) => (v === '' || v == null ? <span className="cambios__vacio">(vacío)</span> : String(v))

function Movimiento({ m }) {
  const [abierto, setAbierto] = useState(false)
  const accion = ACCIONES[m.accion] ?? ACCIONES.editar
  const hayCambios = m.cambios.length > 0
  return (
    <li className={`movimiento movimiento--${accion.clase}`}>
      <span className="movimiento__hora">{formatoHora.format(new Date(m.fecha))}</span>
      <span className="movimiento__marca" aria-hidden="true" />
      <div className="movimiento__cuerpo">
        <p className="movimiento__titulo">
          <b>{m.usuario.nombre}</b>{' '}
          <span className={`accion accion--${accion.clase}`}>{accion.texto}</span>{' '}
          {m.accion !== 'sesion' && (
            <>
              <span className="movimiento__seccion">{m.seccion}</span> <b>{m.objeto}</b>
            </>
          )}
          {m.accion === 'sesion' && <span>{m.detalle}</span>}
        </p>
        {m.detalle && m.accion !== 'sesion' && <p className="movimiento__detalle">{m.detalle}</p>}
        {m.desde_admin && <p className="movimiento__detalle">Hecho desde el admin de Django.</p>}
        {hayCambios && (
          <>
            <button
              type="button"
              className="enlace-boton enlace-boton--icono"
              aria-expanded={abierto}
              onClick={() => setAbierto((a) => !a)}
            >
              {abierto ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
              {abierto ? 'Ocultar cambios' : `Ver ${m.cambios.length === 1 ? 'el cambio' : `los ${m.cambios.length} cambios`}`}
            </button>
            {abierto && (
              <div className="cambios-envoltura">
                <table className="cambios">
                  <thead>
                    <tr>
                      <th scope="col">Campo</th>
                      <th scope="col">Antes</th>
                      <th scope="col">Después</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.cambios.map((c) => (
                      <tr key={c.campo}>
                        <th scope="row">{c.campo}</th>
                        <td className="cambios__antes">{valor(c.antes)}</td>
                        <td className="cambios__despues">{valor(c.despues)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </li>
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
    // Pequeña espera para no pedir en cada tecla del buscador
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
    setFiltros((f) => ({ ...f, [campo]: e.target.type === 'checkbox' ? (e.target.checked ? 'todas' : '') : e.target.value }))
    setPagina(1)
  }
  const hayFiltros = Object.values(filtros).some(Boolean)

  // Agrupa por día
  const dias = []
  for (const m of datos?.movimientos ?? []) {
    const dia = formatoDia.format(new Date(m.fecha))
    if (dias.at(-1)?.dia !== dia) dias.push({ dia, movimientos: [] })
    dias.at(-1).movimientos.push(m)
  }

  return (
    <main className="pagina pagina--ancha">
      <header className="pagina__encabezado">
        <div>
          <h1>Actividad</h1>
          <p>Todo lo que se hizo en {usuario.campana?.nombre ?? 'la campaña'}: quién, cuándo y qué cambió.</p>
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
            <option value="borrar">Borró</option>
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
        <label className="filtros__buscar">
          Buscar
          <input
            className="entrada"
            type="search"
            placeholder="Nombre de lo modificado"
            value={filtros.q}
            onChange={cambiar('q')}
          />
        </label>
        <div className="filtros__pie">
          {usuario.es_superusuario && (
            <label className="casilla-texto">
              <input type="checkbox" checked={filtros.alcance === 'todas'} onChange={cambiar('alcance')} />
              <span>Ver todas las campañas (también inicios de sesión de superusuarios y cambios de campañas)</span>
            </label>
          )}
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
          {dias.map((d) => (
            <section key={d.dia} className="dia">
              <h2 className="dia__titulo">{d.dia}</h2>
              <ol className="linea-tiempo">
                {d.movimientos.map((m) => (
                  <Movimiento key={m.id} m={m} />
                ))}
              </ol>
            </section>
          ))}
          {datos.paginas > 1 && (
            <nav className="paginado" aria-label="Páginas">
              <button
                type="button"
                className="boton boton--borde boton--chico"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => p - 1)}
              >
                ← Más nuevos
              </button>
              <span>
                Página {datos.pagina} de {datos.paginas}
              </span>
              <button
                type="button"
                className="boton boton--borde boton--chico"
                disabled={pagina >= datos.paginas}
                onClick={() => setPagina((p) => p + 1)}
              >
                Más viejos →
              </button>
            </nav>
          )}
        </div>
      )}
    </main>
  )
}

export default Actividad
