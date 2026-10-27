
import { useEffect, useMemo, useState } from 'react'
import * as api from '../../api/grupos'
import Modal from '../comunes/Modal'
import './grupos.css'

const ordenar = (lista) =>
  [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

function FormularioGrupo({ grupo, onGuardado, onCerrar }) {
  const [nombre, setNombre] = useState(grupo?.nombre ?? '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar(evento) {
    evento.preventDefault()
    setError('')
    setGuardando(true)

    try {
      const datos = { nombre: nombre.trim() }

      const guardado = grupo
        ? await api.editarGrupo(grupo.id, datos)
        : await api.crearGrupo(datos)

      onGuardado(guardado, !grupo)
    } catch (e) {
      setError(e.message)
      setGuardando(false)
    }
  }

  return (
    <Modal
      titulo={grupo ? 'Editar grupo' : 'Nuevo grupo'}
      onCerrar={onCerrar}
    >
      <form className="formulario-grupo" onSubmit={guardar}>
        <label htmlFor="grupo-nombre">Nombre del grupo</label>

        <input
          id="grupo-nombre"
          className="entrada"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej.: Grupo Norte"
          maxLength={120}
          autoFocus
          required
        />

        {error && (
          <p className="texto-error" role="alert">
            {error}
          </p>
        )}

        <div className="acciones">
          <button
            type="button"
            className="boton boton--borde"
            onClick={onCerrar}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="boton"
            disabled={guardando || !nombre.trim()}
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ConfirmarBorrado({ grupo, onBorrado, onCerrar }) {
  const [error, setError] = useState('')
  const [borrando, setBorrando] = useState(false)

  async function borrar() {
    setError('')
    setBorrando(true)

    try {
      await api.borrarGrupo(grupo.id)
      onBorrado(grupo.id)
    } catch (e) {
      setError(e.message)
      setBorrando(false)
    }
  }

  return (
    <Modal titulo="Borrar grupo" onCerrar={onCerrar}>
      <p className="modal__texto">
        ¿Seguro que querés borrar el grupo <b>{grupo.nombre}</b>?
        Esta acción no se puede deshacer.
      </p>

      {error && (
        <p className="texto-error" role="alert">
          {error}
        </p>
      )}

      <div className="acciones">
        <button
          type="button"
          className="boton boton--borde"
          onClick={onCerrar}
        >
          Cancelar
        </button>

        <button
          type="button"
          className="boton boton--rojo"
          onClick={borrar}
          disabled={borrando}
        >
          {borrando ? 'Borrando…' : 'Borrar'}
        </button>
      </div>
    </Modal>
  )
}

function Grupos() {
  const [grupos, setGrupos] = useState(null)
  const [errorCarga, setErrorCarga] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState(null)
  const [borrando, setBorrando] = useState(null)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    api
      .obtenerGrupos()
      .then(setGrupos)
      .catch((e) => setErrorCarga(e.message))
  }, [])

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()

    if (!grupos || !texto) return grupos ?? []

    return grupos.filter((grupo) =>
      grupo.nombre.toLowerCase().includes(texto),
    )
  }, [grupos, busqueda])

  function avisar(texto) {
    setAviso(texto)
    setTimeout(() => setAviso(''), 3000)
  }

  return (
    <main className="pagina">
      <header className="pagina__encabezado">
        <div>
          <h1>Grupos</h1>
          <p>Administrá los grupos del sistema.</p>

          <span className="franja-corta" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>

        <button
          type="button"
          className="boton pagina__accion"
          onClick={() => setEditando('nuevo')}
        >
          + Nuevo grupo
        </button>
      </header>

      <div className="buscador">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>

        <input
          type="search"
          placeholder="Buscar grupo por nombre"
          aria-label="Buscar grupos"
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
      ) : grupos === null ? (
        <p className="vacio-tarjeta">Cargando grupos…</p>
      ) : visibles.length === 0 ? (
        <div className="vacio-tarjeta">
          {grupos.length === 0 ? (
            <>
              <b>Todavía no hay grupos.</b>
              <span>Creá el primero con “+ Nuevo grupo”.</span>
            </>
          ) : (
            <span>
              No hay grupos que coincidan con “{busqueda}”.
            </span>
          )}
        </div>
      ) : (
        <ul className="grupos-lista">
          {visibles.map((grupo) => (
            <li key={grupo.id} className="grupo">
              <div className="grupo__texto">
                <h3>{grupo.nombre}</h3>
              </div>

              <div className="grupo__acciones">
                <button
                  type="button"
                  className="boton boton--borde boton--chico"
                  onClick={() => setEditando(grupo)}
                >
                  Editar
                </button>

                <button
                  type="button"
                  className="boton boton--peligro boton--chico"
                  onClick={() => setBorrando(grupo)}
                >
                  Borrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editando && (
        <FormularioGrupo
          grupo={editando === 'nuevo' ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardado={(grupo, esNuevo) => {
            setGrupos((lista) =>
              ordenar(
                esNuevo
                  ? [...lista, grupo]
                  : lista.map((g) => (g.id === grupo.id ? grupo : g)),
              ),
            )

            setEditando(null)
            avisar(
              esNuevo
                ? `Grupo "${grupo.nombre}" creado.`
                : 'Cambios guardados.',
            )
          }}
        />
      )}

      {borrando && (
        <ConfirmarBorrado
          grupo={borrando}
          onCerrar={() => setBorrando(null)}
          onBorrado={(id) => {
            setGrupos((lista) =>
              lista.filter((grupo) => grupo.id !== id),
            )
            setBorrando(null)
            avisar('Grupo borrado.')
          }}
        />
      )}
    </main>
  )
}

export default Grupos
