import { useEffect, useMemo, useState } from 'react'
import * as api from '../../api/categorias'
import Modal from '../comunes/Modal'
import Paginacion, { usePaginado } from '../comunes/Paginacion'
import Buscador from '../comunes/Buscador'
import { normalizar } from '../comunes/normalizar'
import './categorias.css'
import Esqueleto from '../comunes/Esqueleto'
import { Pencil, Trash2 } from 'lucide-react'
import BotonIcono from '../comunes/BotonIcono'
import AvisoOk from '../comunes/AvisoOk'
import Interruptor from '../comunes/Interruptor'
import { tiene } from '../../permisos'
import { useConCambios } from '../../validaciones'

const ordenar = (lista) => [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

function FormularioCategoria({ categoria, onGuardada, onCerrar }) {
  const [nombre, setNombre] = useState(categoria?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(categoria?.descripcion ?? '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const conCambios = useConCambios({ nombre, descripcion })

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
          autoCapitalize="sentences"
          enterKeyHint="next"
          autoFocus
          required
        />

        <label htmlFor="cat-descripcion">Descripción</label>
        <textarea
          id="cat-descripcion"
          className="entrada"
          rows={3}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Qué tipo de cuestionarios agrupa"
          maxLength={500}
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
          <button type="submit" className="boton" disabled={guardando || !nombre.trim() || !conCambios}>
            {guardando ? 'Guardando…' : categoria ? 'Guardar cambios' : 'Crear categoría'}
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
    <Modal titulo="Eliminar categoría" onCerrar={onCerrar}>
      <p className="modal__texto">
        ¿Desea eliminar la categoría <b>{categoria.nombre}</b>? Esta acción no se puede deshacer.
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

function Categorias({ usuario }) {
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
    const texto = normalizar(busqueda)
    if (!categorias || !texto) return categorias ?? []
    return categorias.filter(
      (c) => normalizar(c.nombre).includes(texto) || normalizar(c.descripcion).includes(texto),
    )
  }, [categorias, busqueda])
  const paginado = usePaginado(visibles)

  function avisar(texto) {
    setAviso(texto)
    setTimeout(() => setAviso(''), 4000)
  }

  // Desactivar una categoría desactiva también todos sus cuestionarios
  async function cambiarEstado(categoria, activa) {
    try {
      const r = await api.cambiarEstadoCategoria(categoria.id, activa)
      setCategorias((lista) => lista.map((c) => (c.id === categoria.id ? r.categoria : c)))
      avisar(
        activa
          ? `La categoría «${categoria.nombre}» fue activada.`
          : `La categoría «${categoria.nombre}» fue desactivada${
              r.cuestionarios_desactivados
                ? ` junto con ${r.cuestionarios_desactivados} cuestionario${r.cuestionarios_desactivados === 1 ? '' : 's'}`
                : ''
            }.`,
      )
    } catch (e) {
      setErrorCarga(e.message)
    }
  }
  const puedeEditar = tiene(usuario, 'core.change_categoria')

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

      <Buscador valor={busqueda} onCambio={setBusqueda} placeholder="Buscar por nombre o descripción" etiqueta="Buscar categorías" />

      <AvisoOk>{aviso}</AvisoOk>

      {errorCarga ? (
        <p className="texto-error" role="alert">
          {errorCarga}
        </p>
      ) : categorias === null ? (
        <Esqueleto />
      ) : visibles.length === 0 ? (
        <div className="vacio-tarjeta">
          {categorias.length === 0 ? (
            <>
              <b>Todavía no hay categorías.</b>
              <span>Cree la primera con «+ Nueva categoría».</span>
            </>
          ) : (
            <span>No hay categorías que coincidan con «{busqueda}».</span>
          )}
        </div>
      ) : (
        <>
          <ul className="categorias-lista">
            {paginado.items.map((c) => (
              <li key={c.id} className={`categoria${c.activa ? '' : ' categoria--apagada'}`}>
                <div className="categoria__texto">
                  <h3>
                    {c.nombre}
                    {!c.activa && <span className="etiqueta">Desactivada</span>}
                  </h3>
                  {c.descripcion && <p>{c.descripcion}</p>}
                  <span className="categoria__uso">
                    {c.cuestionarios === 1 ? '1 cuestionario' : `${c.cuestionarios} cuestionarios`}
                  </span>
                </div>
                <div className="categoria__acciones acciones-iconos">
                  {puedeEditar && (
                    <Interruptor
                      activo={c.activa}
                      onCambiar={(activa) => cambiarEstado(c, activa)}
                      etiqueta={`Categoría ${c.nombre} activa`}
                      textos={['Activa', 'Inactiva']}
                      confirmacion={{
                        titulo: 'Desactivar categoría',
                        mensaje: (
                          <>
                            ¿Desea desactivar la categoría <b>{c.nombre}</b>?
                            {c.cuestionarios > 0 &&
                              ` También se desactivarán sus cuestionarios (${c.cuestionarios}).`}
                          </>
                        ),
                      }}
                    />
                  )}
                  <BotonIcono icono={Pencil} etiqueta="Editar" onClick={() => setEditando(c)} />
                  <BotonIcono icono={Trash2} etiqueta="Eliminar" variante="peligro" onClick={() => setBorrando(c)} />
                </div>
              </li>
            ))}
          </ul>
          <Paginacion {...paginado} />
        </>
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
            avisar(esNueva ? `La categoría «${categoria.nombre}» fue creada.` : 'Los cambios se guardaron correctamente.')
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
            avisar('La categoría fue eliminada.')
          }}
        />
      )}
    </main>
  )
}

export default Categorias
