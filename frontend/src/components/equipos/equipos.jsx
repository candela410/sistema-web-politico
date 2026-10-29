import { useCallback, useEffect, useMemo, useState } from 'react'
import * as api from '../../api/equipos'
import { tiene } from '../../permisos'
import Modal from '../comunes/Modal'
import './equipos.css'
import Esqueleto from '../comunes/Esqueleto'
import Interruptor from '../comunes/Interruptor'
import { Pencil } from 'lucide-react'
import BotonIcono from '../comunes/BotonIcono'

function FormularioEquipo({ equipo, rutas, disponibles, onGuardado, onCerrar }) {
  const [nombre, setNombre] = useState(equipo?.nombre ?? '')
  const [ruta, setRuta] = useState(equipo?.ruta ? String(equipo.ruta) : '')
  const [elegidos, setElegidos] = useState(() => (equipo?.usuarios ?? []).map((u) => u.id))
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Los que ya están en este equipo más los que no tienen equipo
  const opciones = [...(equipo?.usuarios ?? []), ...disponibles]

  const alternar = (id) =>
    setElegidos((lista) => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]))

  async function guardar(evento) {
    evento.preventDefault()
    setError('')
    setGuardando(true)
    try {
      const datos = { nombre, ruta: Number(ruta), usuarios: elegidos }
      const guardado = equipo ? await api.editarEquipo(equipo.id, datos) : await api.crearEquipo(datos)
      onGuardado(guardado, !equipo)
    } catch (e) {
      setError(e.message)
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={equipo ? 'Editar equipo' : 'Nuevo equipo'} onCerrar={onCerrar}>
      <form className="formulario-equipo" onSubmit={guardar}>
        <label htmlFor="equipo-nombre">Nombre</label>
        <input
          id="equipo-nombre"
          className="entrada"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej.: Equipo Norte"
          maxLength={120}
          autoFocus
          required
        />

        <label htmlFor="equipo-ruta">Ruta</label>
        <select
          id="equipo-ruta"
          className="entrada"
          value={ruta}
          onChange={(e) => setRuta(e.target.value)}
          disabled={rutas.length === 0}
          required
        >
          <option value="" disabled>
            Elegí una ruta
          </option>
          {rutas.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre}
            </option>
          ))}
        </select>
        {rutas.length === 0 && (
          <p className="equipo__ayuda">
            Para crear un equipo primero tiene que haber una ruta en esta campaña. Se crean desde el Mapa.
          </p>
        )}

        <fieldset className="equipo__usuarios">
          <legend>
            Usuarios <span className="opcional">(opcional)</span>
          </legend>
          {opciones.length === 0 ? (
            <p className="equipo__ayuda">
              No hay usuarios para asignar. Solo aparecen usuarios activos de la campaña, con ficha de militante, que
              todavía no tienen equipo.
            </p>
          ) : (
            <>
              <p className="equipo__ayuda">Solo se muestran usuarios que todavía no tienen equipo.</p>
              <ul className="equipo__usuarios-lista">
                {opciones.map((u) => (
                  <li key={u.id}>
                    <label className="equipo__usuario">
                      <input type="checkbox" checked={elegidos.includes(u.id)} onChange={() => alternar(u.id)} />
                      <span className="equipo__usuario-nombre">{u.nombre}</span>
                      <small>{u.email}</small>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="equipo__ayuda">
                {elegidos.length === 1 ? '1 usuario elegido.' : `${elegidos.length} usuarios elegidos.`}
              </p>
            </>
          )}
        </fieldset>

        {error && (
          <p className="texto-error" role="alert">
            {error}
          </p>
        )}

        <div className="acciones">
          <button type="button" className="boton boton--borde" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" className="boton" disabled={guardando || !nombre.trim() || !ruta}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Equipos({ usuario }) {
  const [equipos, setEquipos] = useState(null)
  const [rutas, setRutas] = useState([])
  const [disponibles, setDisponibles] = useState([]) // usuarios sin equipo
  const [errorCarga, setErrorCarga] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState(null) // null | 'nuevo' | equipo
  const [aviso, setAviso] = useState('')
  const [errorAccion, setErrorAccion] = useState('')

  const puedeCrear = tiene(usuario, 'core.add_equipo')
  const puedeEditar = tiene(usuario, 'core.change_equipo')

  // Trae equipos, rutas y usuarios sin equipo. Se vuelve a llamar al guardar,
  // porque asignar usuarios cambia quiénes quedan disponibles.
  const cargar = useCallback(
    () =>
      api
        .obtenerEquipos()
        .then((r) => {
          setEquipos(r.equipos)
          setRutas(r.rutas)
          setDisponibles(r.usuarios_disponibles)
        })
        .catch((e) => setErrorCarga(e.message)),
    [],
  )

  useEffect(() => {
    cargar()
  }, [cargar])

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    if (!equipos || !texto) return equipos ?? []
    return equipos.filter(
      (e) =>
        e.nombre.toLowerCase().includes(texto) ||
        (e.ruta_nombre ?? '').toLowerCase().includes(texto) ||
        e.usuarios.some((u) => u.nombre.toLowerCase().includes(texto)),
    )
  }, [equipos, busqueda])

  function avisar(texto) {
    setAviso(texto)
    setTimeout(() => setAviso(''), 3000)
  }

  async function cambiarEstado(equipo) {
    setErrorAccion('')
    try {
      const guardado = await api.editarEquipo(equipo.id, { activo: !equipo.activo })
      setEquipos((lista) => lista.map((x) => (x.id === guardado.id ? guardado : x)))
      avisar(guardado.activo ? `Equipo “${guardado.nombre}” activado.` : `Equipo “${guardado.nombre}” desactivado.`)
    } catch (e) {
      setErrorAccion(e.message)
    }
  }

  return (
    <main className="pagina">
      <header className="pagina__encabezado">
        <div>
          <h1>Equipos</h1>
          <p>Grupos de militantes y la ruta que recorre cada uno.</p>
          <span className="franja-corta" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
        {puedeCrear && (
          <button type="button" className="boton pagina__accion" onClick={() => setEditando('nuevo')}>
            + Nuevo equipo
          </button>
        )}
      </header>

      <div className="buscador">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          placeholder="Buscar por nombre, ruta o usuario"
          aria-label="Buscar equipos"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {aviso && (
        <p className="aviso-ok" role="status">
          {aviso}
        </p>
      )}

      {errorAccion && (
        <p className="texto-error" role="alert">
          {errorAccion}
        </p>
      )}

      {errorCarga ? (
        <p className="texto-error" role="alert">
          {errorCarga}
        </p>
      ) : equipos === null ? (
        <Esqueleto />
      ) : visibles.length === 0 ? (
        <div className="vacio-tarjeta">
          {equipos.length === 0 ? (
            <>
              <b>Todavía no hay equipos.</b>
              {puedeCrear && <span>Creá el primero con “+ Nuevo equipo”.</span>}
            </>
          ) : (
            <span>No hay equipos que coincidan con “{busqueda}”.</span>
          )}
        </div>
      ) : (
        <ul className="equipos-lista">
          {visibles.map((e) => (
            <li key={e.id} className={e.activo ? 'equipo' : 'equipo equipo--inactivo'}>
              <div className="equipo__texto">
                <h3>{e.nombre}</h3>
                <div className="equipo__etiquetas">
                  <span className={e.ruta ? 'equipo__ruta' : 'equipo__ruta equipo__ruta--vacia'}>
                    {e.ruta_nombre ? `Ruta: ${e.ruta_nombre}` : 'Sin ruta'}
                  </span>
                  {!e.activo && <span className="equipo__estado">Desactivado</span>}
                </div>
                <p className="equipo__integrantes">
                  {e.usuarios.length === 0
                    ? 'Sin usuarios asignados'
                    : `${e.usuarios.length === 1 ? 'Usuario' : 'Usuarios'}: ${e.usuarios.map((u) => u.nombre).join(', ')}`}
                </p>
              </div>
              {puedeEditar && (
                <div className="equipo__acciones acciones-iconos">
                  <Interruptor
                    activo={e.activo}
                    onCambiar={() => cambiarEstado(e)}
                    etiqueta={`Equipo ${e.nombre} activo`}
                    confirmacion={{
                      titulo: 'Desactivar equipo',
                      mensaje: (
                        <>
                          ¿Seguro que querés desactivar <b>{e.nombre}</b>? Sus integrantes y su ruta se conservan, y lo
                          podés volver a activar cuando quieras.
                        </>
                      ),
                    }}
                  />
                  <BotonIcono icono={Pencil} etiqueta="Editar" onClick={() => setEditando(e)} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editando && (
        <FormularioEquipo
          equipo={editando === 'nuevo' ? null : editando}
          rutas={rutas}
          disponibles={disponibles}
          onCerrar={() => setEditando(null)}
          onGuardado={async (equipo, esNuevo) => {
            setEditando(null)
            await cargar()
            avisar(esNuevo ? `Equipo “${equipo.nombre}” creado.` : 'Cambios guardados.')
          }}
        />
      )}
    </main>
  )
}

export default Equipos