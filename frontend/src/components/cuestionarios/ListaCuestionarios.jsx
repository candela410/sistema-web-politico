import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import * as api from '../../api/cuestionarios'
import { tiene } from '../../permisos'
import Modal from '../comunes/Modal'
import Paginacion, { usePaginado } from '../comunes/Paginacion'
import AsignarCuestionario from './AsignarCuestionario'
import './cuestionarios.css'

function ConfirmarBorrado({ cuestionario, onBorrado, onCerrar }) {
  const [error, setError] = useState('')
  const [borrando, setBorrando] = useState(false)

  async function borrar() {
    setError('')
    setBorrando(true)
    try {
      await api.borrarCuestionario(cuestionario.id)
      onBorrado(cuestionario.id)
    } catch (e) {
      setError(e.message)
      setBorrando(false)
    }
  }

  return (
    <Modal titulo="Borrar cuestionario" onCerrar={onCerrar}>
      <p className="modal__texto">
        ¿Seguro que querés borrar <b>{cuestionario.titulo}</b> con todas sus preguntas? Esta acción no se puede
        deshacer.
      </p>
      {error && (
        <p className="texto-error" role="alert">
          {error}
        </p>
      )}
      <div className="acciones">
        <button type="button" className="boton boton--borde" onClick={onCerrar}>
          Cancelar
        </button>
        <button type="button" className="boton boton--rojo" onClick={borrar} disabled={borrando}>
          {borrando ? 'Borrando…' : 'Borrar'}
        </button>
      </div>
    </Modal>
  )
}

const FILTROS_INICIALES = { categoria: '', estado: 'todos', encuestas: 'todas' }

function ListaCuestionarios({ usuario }) {
  const navegar = useNavigate()
  const { state } = useLocation()
  const [cuestionarios, setCuestionarios] = useState(null)
  const [errorCarga, setErrorCarga] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState(FILTROS_INICIALES)
  const filtrando = busqueda.trim() || Object.entries(filtros).some(([k, v]) => v !== FILTROS_INICIALES[k])
  const [borrando, setBorrando] = useState(null)
  const [asignando, setAsignando] = useState(null)
  const [aviso, setAviso] = useState(state?.aviso ?? '')

  useEffect(() => {
    api
      .obtenerCuestionarios()
      .then(setCuestionarios)
      .catch((e) => setErrorCarga(e.message))
  }, [])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(''), 3500)
    return () => clearTimeout(t)
  }, [aviso])

  // Categorías que aparecen en la lista, para el filtro
  const categorias = useMemo(() => {
    const unicas = new Map((cuestionarios ?? []).map((c) => [String(c.categoria.id), c.categoria.nombre]))
    return [...unicas].sort((a, b) => a[1].localeCompare(b[1]))
  }, [cuestionarios])

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return (cuestionarios ?? []).filter(
      (c) =>
        (!texto || c.titulo.toLowerCase().includes(texto) || c.categoria.nombre.toLowerCase().includes(texto)) &&
        (!filtros.categoria || String(c.categoria.id) === filtros.categoria) &&
        (filtros.estado === 'todos' || c.activo === (filtros.estado === 'activos')) &&
        (filtros.encuestas === 'todas' || (c.encuestas > 0) === (filtros.encuestas === 'con')),
    )
  }, [cuestionarios, busqueda, filtros])
  const paginado = usePaginado(visibles)

  const filtrar = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value }))

  return (
    <main className="pagina">
      <header className="pagina__encabezado">
        <div>
          <h1>Cuestionarios</h1>
          <p>Armá las encuestas con sus preguntas y opciones.</p>
          <span className="franja-corta" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
        {tiene(usuario, 'core.add_cuestionario') && (
          <Link to="/cuestionarios/nuevo" className="boton pagina__accion">
            + Crear cuestionario
          </Link>
        )}
      </header>

      <div className="buscador">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          placeholder="Buscar por título o categoría"
          aria-label="Buscar cuestionarios"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="filtros" role="group" aria-label="Filtros">
        <label>
          Categoría
          <select className="entrada" value={filtros.categoria} onChange={filtrar('categoria')}>
            <option value="">Todas</option>
            {categorias.map(([id, nombre]) => (
              <option key={id} value={id}>
                {nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Estado
          <select className="entrada" value={filtros.estado} onChange={filtrar('estado')}>
            <option value="todos">Todos</option>
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
          </select>
        </label>
        <label>
          Encuestas
          <select className="entrada" value={filtros.encuestas} onChange={filtrar('encuestas')}>
            <option value="todas">Todas</option>
            <option value="con">Con encuestas</option>
            <option value="sin">Sin encuestas</option>
          </select>
        </label>
        {filtrando && (
          <button
            type="button"
            className="enlace-boton filtros__limpiar"
            onClick={() => {
              setFiltros(FILTROS_INICIALES)
              setBusqueda('')
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {aviso && (
        <p className="aviso-ok" role="status">
          {aviso}
        </p>
      )}

      {errorCarga ? (
        <p className="texto-error" role="alert">
          {errorCarga}
        </p>
      ) : cuestionarios === null ? (
        <p className="vacio-tarjeta">Cargando…</p>
      ) : visibles.length === 0 ? (
        <div className="vacio-tarjeta">
          {cuestionarios.length === 0 ? (
            <>
              <b>Todavía no hay cuestionarios.</b>
              <span>Creá el primero con “+ Crear cuestionario”.</span>
            </>
          ) : (
            <span>No hay cuestionarios que coincidan con la búsqueda y los filtros.</span>
          )}
        </div>
      ) : (
        <>
          <ul className="cuestionarios-lista">
            {paginado.items.map((c) => (
              <li key={c.id} className="cuestionario-item">
                <button
                  type="button"
                  className="cuestionario-item__abrir"
                  onClick={() => navegar(`/cuestionarios/${c.id}`)}
                >
                  <span className="cuestionario-item__categoria">{c.categoria.nombre}</span>
                  <h3>{c.titulo}</h3>
                  {c.descripcion && <p>{c.descripcion}</p>}
                  <span className="cuestionario-item__datos">
                    {c.preguntas === 1 ? '1 pregunta' : `${c.preguntas} preguntas`} ·{' '}
                    {c.encuestas === 1 ? '1 encuesta' : `${c.encuestas} encuestas`}
                    {!c.activo && <span className="etiqueta-inactivo">Inactivo</span>}
                  </span>
                </button>
                <div className="cuestionario-item__acciones">
                  {/* Las estadísticas solo se abren desde este botón */}
                  {tiene(usuario, 'core.view_encuesta') && (
                    <Link to={`/cuestionarios/${c.id}/estadisticas`} className="boton boton--chico boton--estadisticas">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M5 20V11M12 20V5M19 20v-6" />
                      </svg>
                      Estadísticas
                    </Link>
                  )}
                  {tiene(usuario, 'core.change_asignacioncuestionario') && (
                    <button type="button" className="boton boton--borde boton--chico" onClick={() => setAsignando(c)}>
                      Asignar
                    </button>
                  )}
                  {tiene(usuario, 'core.change_cuestionario') && (
                    <Link to={`/cuestionarios/${c.id}`} className="boton boton--borde boton--chico">
                      Editar
                    </Link>
                  )}
                  {tiene(usuario, 'core.delete_cuestionario') && (
                    <button type="button" className="boton boton--peligro boton--chico" onClick={() => setBorrando(c)}>
                      Borrar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Paginacion {...paginado} />
        </>
      )}

      {asignando && (
        <AsignarCuestionario
          cuestionario={asignando}
          onCerrar={() => setAsignando(null)}
          onGuardado={(cantidad) => {
            setAsignando(null)
            setAviso(
              cantidad === 0
                ? `${asignando.titulo} quedó sin militantes asignados.`
                : `${asignando.titulo} quedó asignado a ${cantidad === 1 ? '1 militante' : `${cantidad} militantes`}.`,
            )
          }}
        />
      )}

      {borrando && (
        <ConfirmarBorrado
          cuestionario={borrando}
          onCerrar={() => setBorrando(null)}
          onBorrado={(id) => {
            setCuestionarios((lista) => lista.filter((c) => c.id !== id))
            setBorrando(null)
            setAviso('Cuestionario borrado.')
          }}
        />
      )}
    </main>
  )
}

export default ListaCuestionarios
