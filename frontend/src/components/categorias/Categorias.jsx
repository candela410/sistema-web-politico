import { useEffect, useMemo, useState } from 'react'
import * as api from '../../api/categorias'
import Modal from '../comunes/Modal'
import './categorias.css'

const ordenar = (lista) => [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

function FormularioCategoria({ categoria, onGuardada, onCerrar }) {
  const [nombre, setNombre] = useState(categoria?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(categoria?.descripcion ?? '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar(evento) {
    evento.preventDefault()
    setError('')
    setGuardando(true)
    try {
      const datos = { nombre, descripcion }
      const guardada = categoria
        ? await api.editarCategoria(categoria.id, datos)
        : await api.crearCategoria(datos)
      onGuardada(guardada, !categoria)
    } catch (e) {
      setError(e.message)
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={categoria ? 'Editar categoría' : 'Nueva categoría'} onCerrar={onCerrar}>
      <form className="formulario-categoria" onSubmit={guardar}>
        <label htmlFor="cat-nombre">Nombre</label>
        <input
          id="cat-nombre"
          className="entrada"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej.: Seguridad"
          maxLength={120}
          autoFocus
          required
        />

        <label htmlFor="cat-descripcion">
          Descripción <span className="opcional">(opcional)</span>
        </label>
        <textarea
          id="cat-descripcion"
          className="entrada"
          rows={3}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Qué tipo de cuestionarios agrupa"
        />

        {error && (
          <p className="texto-error" role="alert">
            {error}
          </p>
        )}

        <div className="acciones">
          <button type="button" className="boton boton--borde" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" className="boton" disabled={guardando || !nombre.trim()}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ConfirmarBorrado({ categoria, onBorrada, onCerrar }) {
  const [error, setError] = useState('')
  const [borrando, setBorrando] = useState(false)

  async function borrar() {
    setError('')
    setBorrando(true)
    try {
      await api.borrarCategoria(categoria.id)
      onBorrada(categoria.id)
    } catch (e) {
      setError(e.message)
      setBorrando(false)
    }
  }

  return (
    <Modal titulo="Borrar categoría" onCerrar={onCerrar}>
      <p className="modal__texto">
        ¿Seguro que querés borrar <b>{categoria.nombre}</b>? Esta acción no se puede deshacer.
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

function Categorias() {
  const [categorias, setCategorias] = useState(null)
  const [errorCarga, setErrorCarga] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState(null) // null | 'nueva' | categoría
  const [borrando, setBorrando] = useState(null)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    api
      .obtenerCategorias()
      .then(setCategorias)
      .catch((e) => setErrorCarga(e.message))
  }, [])

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    if (!categorias || !texto) return categorias ?? []
    return categorias.filter(
      (c) => c.nombre.toLowerCase().includes(texto) || c.descripcion.toLowerCase().includes(texto),
    )
  }, [categorias, busqueda])

  function avisar(texto) {
    setAviso(texto)
    setTimeout(() => setAviso(''), 3000)
  }

  return (
    <main className="pagina">
      <header className="pagina__encabezado">
        <div>
          <h1>Categorías</h1>
          <p>Agrupan los cuestionarios por tema.</p>
          <span className="franja-corta" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
        <button type="button" className="boton pagina__accion" onClick={() => setEditando('nueva')}>
          + Nueva categoría
        </button>
      </header>

      <div className="buscador">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          placeholder="Buscar por nombre o descripción"
          aria-label="Buscar categorías"
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
      ) : categorias === null ? (
        <p className="vacio-tarjeta">Cargando…</p>
      ) : visibles.length === 0 ? (
        <div className="vacio-tarjeta">
          {categorias.length === 0 ? (
            <>
              <b>Todavía no hay categorías.</b>
              <span>Creá la primera con “+ Nueva categoría”.</span>
            </>
          ) : (
            <span>No hay categorías que coincidan con “{busqueda}”.</span>
          )}
        </div>
      ) : (
        <ul className="categorias-lista">
          {visibles.map((c) => (
            <li key={c.id} className="categoria">
              <div className="categoria__texto">
                <h3>{c.nombre}</h3>
                {c.descripcion && <p>{c.descripcion}</p>}
                <span className="categoria__uso">
                  {c.cuestionarios === 1 ? '1 cuestionario' : `${c.cuestionarios} cuestionarios`}
                </span>
              </div>
              <div className="categoria__acciones">
                <button type="button" className="boton boton--borde boton--chico" onClick={() => setEditando(c)}>
                  Editar
                </button>
                <button type="button" className="boton boton--peligro boton--chico" onClick={() => setBorrando(c)}>
                  Borrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editando && (
        <FormularioCategoria
          categoria={editando === 'nueva' ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardada={(categoria, esNueva) => {
            setCategorias((lista) =>
              ordenar(esNueva ? [...lista, categoria] : lista.map((c) => (c.id === categoria.id ? categoria : c))),
            )
            setEditando(null)
            avisar(esNueva ? `Categoría “${categoria.nombre}” creada.` : 'Cambios guardados.')
          }}
        />
      )}

      {borrando && (
        <ConfirmarBorrado
          categoria={borrando}
          onCerrar={() => setBorrando(null)}
          onBorrada={(id) => {
            setCategorias((lista) => lista.filter((c) => c.id !== id))
            setBorrando(null)
            avisar('Categoría borrada.')
          }}
        />
      )}
    </main>
  )
}

export default Categorias
