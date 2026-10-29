import { useEffect, useMemo, useState } from 'react'
import * as api from '../../api/grupos'
import Modal from '../comunes/Modal'
import './grupos.css'
import Esqueleto from '../comunes/Esqueleto'
import { Pencil, Trash2 } from 'lucide-react'
import BotonIcono from '../comunes/BotonIcono'

const GRUPO_MILITANTES = 'Militantes'

const ordenar = (lista) =>
  [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

const ORDEN_ACCIONES = ['Ver', 'Crear', 'Editar', 'Borrar']
const posicion = (accion) => {
  const i = ORDEN_ACCIONES.indexOf(accion)
  return i === -1 ? ORDEN_ACCIONES.length : i
}

// Devuelve por qué un rol no se puede borrar ('' si se puede)
function motivoSinBorrar(grupo) {
  if (grupo.nombre === GRUPO_MILITANTES) {
    return 'Este rol lo usa el sistema y no se puede borrar.'
  }
  if (grupo.total_usuarios > 0) {
    return `No se puede borrar: tiene ${grupo.total_usuarios} usuario${grupo.total_usuarios === 1 ? '' : 's'} asignado${grupo.total_usuarios === 1 ? '' : 's'}.`
  }
  return ''
}

function FormularioGrupo({ grupo, onGuardado, onCerrar }) {
  const [nombre, setNombre] = useState(grupo?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(grupo?.descripcion ?? '')
  const [seleccion, setSeleccion] = useState(new Set(grupo?.permisos ?? []))
  const [secciones, setSecciones] = useState(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    api
      .obtenerPermisos()
      .then(setSecciones)
      .catch((e) => setError(e.message))
  }, [])

  function alternar(id) {
    setSeleccion((actual) => {
      const nueva = new Set(actual)
      if (nueva.has(id)) nueva.delete(id)
      else nueva.add(id)
      return nueva
    })
  }

  function alternarSeccion(seccion) {
    const ids = seccion.permisos.map((p) => p.id)
    const todos = ids.every((id) => seleccion.has(id))
    setSeleccion((actual) => {
      const nueva = new Set(actual)
      ids.forEach((id) => (todos ? nueva.delete(id) : nueva.add(id)))
      return nueva
    })
  }

  async function guardar(evento) {
    evento.preventDefault()
    setError('')
    setGuardando(true)

    try {
      const datos = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        permisos: [...seleccion],
      }

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
      titulo={grupo ? 'Editar rol' : 'Nuevo rol'}
      onCerrar={onCerrar}
    >
      <form className="formulario-grupo" onSubmit={guardar}>
        <label htmlFor="grupo-nombre">Nombre del rol</label>

        <input
          id="grupo-nombre"
          className="entrada"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej.: Coordinador de zona"
          maxLength={120}
          autoFocus
          required
        />

        <label htmlFor="grupo-descripcion">Descripción</label>

        <textarea
          id="grupo-descripcion"
          className="entrada"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Para qué sirve este rol (opcional)"
          maxLength={500}
          rows={3}
        />

        <span className="formulario-grupo__titulo">
          Permisos ({seleccion.size})
        </span>

        {secciones === null ? (
          <p className="texto-suave">Cargando permisos…</p>
        ) : (
          <div className="permisos-selector">
            {secciones.map((seccion) => {
              const permisos = [...seccion.permisos].sort(
                (a, b) => posicion(a.accion) - posicion(b.accion),
              )
              const todos = permisos.every((p) => seleccion.has(p.id))

              return (
                <fieldset key={seccion.seccion} className="permisos-selector__seccion">
                  <legend>
                    <label>
                      <input
                        type="checkbox"
                        checked={todos}
                        onChange={() => alternarSeccion(seccion)}
                      />
                      <b>{seccion.seccion}</b>
                    </label>
                  </legend>

                  <div className="permisos-selector__acciones">
                    {permisos.map((permiso) => (
                      <label key={permiso.id}>
                        <input
                          type="checkbox"
                          checked={seleccion.has(permiso.id)}
                          onChange={() => alternar(permiso.id)}
                        />
                        {permiso.accion}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )
            })}
          </div>
        )}

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
    <Modal titulo="Borrar rol" onCerrar={onCerrar}>
      <p className="modal__texto">
        ¿Seguro que querés borrar el rol <b>{grupo.nombre}</b>?
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
      `${grupo.nombre} ${grupo.descripcion} ${grupo.usuarios.map((u) => u.nombre).join(' ')}`
        .toLowerCase()
        .includes(texto),
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
          <h1>Roles</h1>
          <p>Los mismos roles que se asignan en Usuarios, con sus permisos e integrantes.</p>

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
          + Nuevo rol
        </button>
      </header>

      <div className="buscador">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>

        <input
          type="search"
          placeholder="Buscar por nombre, descripción o usuario"
          aria-label="Buscar roles"
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
        <Esqueleto texto="Cargando roles…" />
      ) : visibles.length === 0 ? (
        <div className="vacio-tarjeta">
          {grupos.length === 0 ? (
            <>
              <b>Todavía no hay roles.</b>
              <span>Creá el primero con “+ Nuevo rol”.</span>
            </>
          ) : (
            <span>
              No hay roles que coincidan con “{busqueda}”.
            </span>
          )}
        </div>
      ) : (
        <ul className="grupos-lista">
          {visibles.map((grupo) => (
            <li key={grupo.id} className="grupo">
              <div className="grupo__texto">
                <h3>{grupo.nombre}</h3>

                {grupo.descripcion && (
                  <p className="grupo__descripcion">{grupo.descripcion}</p>
                )}

                <p className="grupo__permisos">
                  {grupo.permisos.length === 0
                    ? 'Sin permisos'
                    : `${grupo.permisos.length} permiso${grupo.permisos.length === 1 ? '' : 's'}`}
                </p>

                <p className="grupo__usuarios">
                  {grupo.usuarios.length === 0 ? (
                    'Sin usuarios'
                  ) : (
                    <>
                      {grupo.usuarios.length === 1 ? 'Usuario' : 'Usuarios'} ({grupo.usuarios.length}):{' '}
                      {grupo.usuarios.map((u, i) => (
                        <span key={u.id} className={u.activo ? undefined : 'grupo__usuario--inactivo'}>
                          {i > 0 && ', '}
                          {u.nombre}
                          {!u.activo && ' (inactivo)'}
                        </span>
                      ))}
                    </>
                  )}
                </p>

                {motivoSinBorrar(grupo) && (
                  <p className="grupo__aviso">{motivoSinBorrar(grupo)}</p>
                )}
              </div>

              <div className="grupo__acciones acciones-iconos">
                <BotonIcono icono={Pencil} etiqueta="Editar" onClick={() => setEditando(grupo)} />
                <BotonIcono
                  icono={Trash2}
                  etiqueta="Borrar rol"
                  ayuda={motivoSinBorrar(grupo) || 'Borrar rol'}
                  variante="peligro"
                  onClick={() => setBorrando(grupo)}
                  disabled={!!motivoSinBorrar(grupo)}
                />
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
                ? `Rol "${grupo.nombre}" creado.`
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
            avisar('Rol borrado.')
          }}
        />
      )}
    </main>
  )
}

export default Grupos