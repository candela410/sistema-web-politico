import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import * as api from '../../api/cuestionarios'
import { tiene } from '../../permisos'
import Modal from '../comunes/Modal'
import Paginacion, { usePaginado } from '../comunes/Paginacion'
import Buscador from '../comunes/Buscador'
import { normalizar } from '../comunes/normalizar'
import AsignarCuestionario from './AsignarCuestionario'
import VerCuestionario from './VerCuestionario'
import { ChartColumn, Eye, Pencil, Trash2, UserPlus } from 'lucide-react'
import BotonIcono from '../comunes/BotonIcono'
import './cuestionarios.css'
import Esqueleto from '../comunes/Esqueleto'
import AvisoOk from '../comunes/AvisoOk'

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
    <Modal titulo="Eliminar cuestionario" onCerrar={onCerrar}>
      <p className="modal__texto">
        ¿Desea eliminar <b>{cuestionario.titulo}</b> con todas sus preguntas? Esta acción no se puede deshacer.
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
          {borrando ? 'Eliminando…' : 'Eliminar'}
        </button>
      </div>
    </Modal>
  )
}

const FILTROS_INICIALES = { categoria: '', estado: 'todos' }

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
  const [viendo, setViendo] = useState(null)
  const [aviso, setAviso] = useState(state?.aviso ?? '')

  useEffect(() => {
    api
      .obtenerCuestionarios()
      .then(setCuestionarios)
      .catch((e) => setErrorCarga(e.message))
  }, [])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(''), 4000)
    return () => clearTimeout(t)
  }, [aviso])

  // Categorías que aparecen en la lista, para el filtro
  const categorias = useMemo(() => {
    const unicas = new Map((cuestionarios ?? []).map((c) => [String(c.categoria.id), c.categoria.nombre]))
    return [...unicas].sort((a, b) => a[1].localeCompare(b[1]))
  }, [cuestionarios])

  const visibles = useMemo(() => {
    const texto = normalizar(busqueda)
    return (cuestionarios ?? []).filter(
      (c) =>
        (!texto || normalizar(c.titulo).includes(texto) || normalizar(c.categoria.nombre).includes(texto)) &&
        (!filtros.categoria || String(c.categoria.id) === filtros.categoria) &&
        (filtros.estado === 'todos' || c.activo === (filtros.estado === 'activos')),
    )
  }, [cuestionarios, busqueda, filtros])
  const paginado = usePaginado(visibles)

  const filtrar = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value }))

  return (
    <main className="pagina">
      <header className="pagina__encabezado">
        <div>
          <h1>Cuestionarios</h1>
          <p>Encuestas con sus preguntas y opciones.</p>
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

      <Buscador valor={busqueda} onCambio={setBusqueda} placeholder="Buscar por título" etiqueta="Buscar cuestionarios" />

      <div className="cuestionarios-filtros" role="group" aria-label="Filtros">
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
        {filtrando && (
          <button
            type="button"
            className="enlace-boton cuestionarios-filtros__limpiar"
            onClick={() => {
              setFiltros(FILTROS_INICIALES)
              setBusqueda('')
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <AvisoOk>{aviso}</AvisoOk>

      {errorCarga ? (
        <p className="texto-error" role="alert">
          {errorCarga}
        </p>
      ) : cuestionarios === null ? (
        <Esqueleto />
      ) : visibles.length === 0 ? (
        <div className="vacio-tarjeta">
          {cuestionarios.length === 0 ? (
            <>
              <b>Todavía no hay cuestionarios.</b>
              <span>Cree el primero con «+ Crear cuestionario».</span>
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
                <div className="cuestionario-item__acciones acciones-iconos">
                  <BotonIcono icono={Eye} etiqueta="Ver detalles" onClick={() => setViendo(c)} />
                  {/* Las estadísticas solo se abren desde este botón */}
                  {tiene(usuario, 'core.view_encuesta') && (
                    <BotonIcono
                      to={`/cuestionarios/${c.id}/estadisticas`}
                      icono={ChartColumn}
                      etiqueta="Estadísticas"
                      variante="lleno"
                    />
                  )}
                  {tiene(usuario, 'core.change_asignacioncuestionario') && (
                    <BotonIcono icono={UserPlus} etiqueta="Asignar a usuarios" onClick={() => setAsignando(c)} />
                  )}
                  {tiene(usuario, 'core.change_cuestionario') && (
                    <BotonIcono to={`/cuestionarios/${c.id}`} icono={Pencil} etiqueta="Editar" />
                  )}
                  {tiene(usuario, 'core.delete_cuestionario') && (
                    <BotonIcono icono={Trash2} etiqueta="Eliminar" variante="peligro" onClick={() => setBorrando(c)} />
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Paginacion {...paginado} />
        </>
      )}

      {viendo && (
        <VerCuestionario
          cuestionario={viendo}
          usuario={usuario}
          onCerrar={() => setViendo(null)}
        />
      )}

      {asignando && (
        <AsignarCuestionario
          cuestionario={asignando}
          onCerrar={() => setAsignando(null)}
          onGuardado={(cantidad) => {
            setAsignando(null)
            setAviso(
              cantidad === 0
                ? `«${asignando.titulo}» quedó sin usuarios asignados.`
                : `«${asignando.titulo}» quedó asignado a ${cantidad === 1 ? '1 usuario' : `${cantidad} usuarios`}.`,
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
            setAviso('El cuestionario fue eliminado.')
          }}
        />
      )}
    </main>
  )
}

export default ListaCuestionarios
