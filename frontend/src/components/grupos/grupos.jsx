import { useEffect, useMemo, useState } from 'react'
import * as api from '../../api/grupos'
import Modal from '../comunes/Modal'
import './grupos.css'
import Esqueleto from '../comunes/Esqueleto'
import { Pencil, Trash2 } from 'lucide-react'
import BotonIcono from '../comunes/BotonIcono'
import AvisoOk from '../comunes/AvisoOk'
import Paginacion, { usePaginado } from '../comunes/Paginacion'
import Buscador from '../comunes/Buscador'
import { normalizar } from '../comunes/normalizar'
import { useConCambios } from '../../validaciones'

const ordenar = (lista) =>
  [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

const ORDEN_ACCIONES = ['Ver', 'Crear', 'Editar', 'Borrar']
const posicion = (accion) => {
  const i = ORDEN_ACCIONES.indexOf(accion)
  return i === -1 ? ORDEN_ACCIONES.length : i
}

function FormularioGrupo({ grupo, onGuardado, onCerrar }) {
  const [nombre, setNombre] = useState(grupo?.nombre ?? '')
  const [seleccion, setSeleccion] = useState(new Set(grupo?.permisos ?? []))
  const [secciones, setSecciones] = useState(null)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const conCambios = useConCambios({ nombre, permisos: [...seleccion].sort((a, b) => a - b) })

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
            disabled={guardando || !nombre.trim() || !conCambios}
          >
            {guardando ? 'Guardando…' : grupo ? 'Guardar cambios' : 'Crear rol'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// Eliminar un rol: si tiene usuarios (de cualquier campaña) no se puede, y se avisa
function ConfirmarBorrado({ grupo, onBorrado, onCerrar }) {
  const [error, setError] = useState('')
  const [borrando, setBorrando] = useState(false)
  const cantidad = grupo.total_usuarios ?? 0

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

  if (cantidad > 0)
    return (
      <Modal titulo="No se puede eliminar el rol" onCerrar={onCerrar}>
        <p className="modal__texto">
          El rol <b>{grupo.nombre}</b> tiene {cantidad} usuario{cantidad === 1 ? '' : 's'} asignado
          {cantidad === 1 ? '' : 's'}. Para eliminarlo, asigne otro rol a {cantidad === 1 ? 'ese usuario' : 'esos usuarios'}.
        </p>
        <div className="acciones">
          <button type="button" className="boton" onClick={onCerrar} autoFocus>
            Entendido
          </button>
        </div>
      </Modal>
    )

  return (
    <Modal titulo="Eliminar rol" onCerrar={onCerrar}>
      <p className="modal__texto">
        ¿Desea eliminar el rol <b>{grupo.nombre}</b>? Esta acción no se puede deshacer.
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
    const texto = normalizar(busqueda)

    if (!grupos || !texto) return grupos ?? []

    // Por nombre del rol o por nombre o correo de sus usuarios, sin distinguir acentos
    return grupos.filter((grupo) =>
      normalizar(`${grupo.nombre} ${grupo.usuarios.map((u) => `${u.nombre} ${u.email}`).join(' ')}`).includes(texto),
    )
  }, [grupos, busqueda])
  const paginado = usePaginado(visibles)

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

      <Buscador valor={busqueda} onCambio={setBusqueda} placeholder="Buscar por nombre o usuario" etiqueta="Buscar roles" />

      <AvisoOk>{aviso}</AvisoOk>

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
              <span>Cree el primero con «+ Nuevo rol».</span>
            </>
          ) : (
            <>
              <span>No hay roles que coincidan con «{busqueda}».</span>
              <button type="button" className="enlace-boton" onClick={() => setBusqueda('')}>
                Limpiar búsqueda
              </button>
            </>
          )}
        </div>
      ) : (
        <>
        <ul className="grupos-lista">
          {paginado.items.map((grupo) => (
            <li key={grupo.id} className="grupo">
              <div className="grupo__texto">
                <h3>{grupo.nombre}</h3>

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
              </div>

              <div className="grupo__acciones acciones-iconos">
                <BotonIcono icono={Pencil} etiqueta="Editar" onClick={() => setEditando(grupo)} />
                <BotonIcono
                  icono={Trash2}
                  etiqueta="Eliminar rol"
                  variante="peligro"
                  onClick={() => setBorrando(grupo)}
                />
              </div>
            </li>
          ))}
        </ul>
        <Paginacion {...paginado} />
        </>
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
                ? `El rol «${grupo.nombre}» fue creado.`
                : 'Los cambios se guardaron correctamente.',
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
            avisar('El rol fue eliminado.')
          }}
        />
      )}
    </main>
  )
}

export default Grupos