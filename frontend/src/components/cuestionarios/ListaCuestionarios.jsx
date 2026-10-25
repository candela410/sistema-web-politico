import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import * as api from '../../api/cuestionarios'
import Modal from '../comunes/Modal'
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

function ListaCuestionarios() {
  const navegar = useNavigate()
  const { state } = useLocation()
  const [cuestionarios, setCuestionarios] = useState(null)
  const [errorCarga, setErrorCarga] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [borrando, setBorrando] = useState(null)
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

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    if (!cuestionarios || !texto) return cuestionarios ?? []
    return cuestionarios.filter(
      (c) => c.titulo.toLowerCase().includes(texto) || c.categoria.nombre.toLowerCase().includes(texto),
    )
  }, [cuestionarios, busqueda])

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
        <Link to="/cuestionarios/nuevo" className="boton pagina__accion">
          + Crear cuestionario
        </Link>
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
            <span>No hay cuestionarios que coincidan con “{busqueda}”.</span>
          )}
        </div>
      ) : (
        <ul className="cuestionarios-lista">
          {visibles.map((c) => (
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
                <Link to={`/cuestionarios/${c.id}`} className="boton boton--borde boton--chico">
                  Editar
                </Link>
                <button type="button" className="boton boton--peligro boton--chico" onClick={() => setBorrando(c)}>
                  Borrar
                </button>
              </div>
            </li>
          ))}
        </ul>
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
