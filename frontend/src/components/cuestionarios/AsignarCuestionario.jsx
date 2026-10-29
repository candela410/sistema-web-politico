import { useEffect, useMemo, useRef, useState } from 'react'
import * as api from '../../api/cuestionarios'
import Modal from '../comunes/Modal'
import './asignar.css'

// Check de un equipo: marca o desmarca a todos sus militantes.
// Queda "a medias" (indeterminado) si solo están elegidos algunos.
function CheckEquipo({ marcados, total, onChange, etiqueta }) {
  const ref = useRef(null)
  useEffect(() => {
    ref.current.indeterminate = marcados > 0 && marcados < total
  }, [marcados, total])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={total > 0 && marcados === total}
      disabled={total === 0}
      onChange={onChange}
      aria-label={etiqueta}
    />
  )
}

function Grupo({ titulo, inactivo, usuarios, elegidos, alternar, alternarTodos }) {
  // El check del equipo solo maneja a los que se pueden asignar
  const elegibles = usuarios.filter((u) => u.elegible)
  const marcados = elegibles.filter((u) => elegidos.has(u.id)).length
  return (
    <section className="asignar__grupo">
      <label className="asignar__equipo">
        <CheckEquipo
          marcados={marcados}
          total={elegibles.length}
          etiqueta={`Asignar a todo ${titulo}`}
          onChange={() => alternarTodos(elegibles, marcados < elegibles.length)}
        />
        <span className="asignar__equipo-nombre">{titulo}</span>
        {inactivo && <span className="etiqueta-inactivo">Inactivo</span>}
        <small>
          {marcados}/{elegibles.length}
        </small>
      </label>
      <ul className="asignar__miembros">
        {usuarios.map((u) => (
          <li key={u.id}>
            <label className={`asignar__miembro ${u.elegible ? '' : 'asignar__miembro--viejo'}`}>
              <input
                type="checkbox"
                checked={elegidos.has(u.id)}
                // El que ya no es militante activo solo se puede quitar
                disabled={!u.elegible && !elegidos.has(u.id)}
                onChange={() => alternar(u.id)}
              />
              <span className="asignar__nombre">{u.nombre}</span>
              <small>{u.elegible ? u.email : 'Ya no es militante activo'}</small>
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}

function AsignarCuestionario({ cuestionario, onCerrar, onGuardado }) {
  const [datos, setDatos] = useState(null)
  const [elegidos, setElegidos] = useState(new Set())
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    api
      .obtenerAsignaciones(cuestionario.id)
      .then((d) => {
        setDatos(d)
        const todos = [...d.equipos.flatMap((e) => e.usuarios), ...d.sin_equipo]
        setElegidos(new Set(todos.filter((u) => u.asignado).map((u) => u.id)))
      })
      .catch((e) => setError(e.message))
  }, [cuestionario.id])

  const hayMilitantes = useMemo(
    () => datos && (datos.equipos.length > 0 || datos.sin_equipo.length > 0),
    [datos],
  )

  function alternar(id) {
    setElegidos((actual) => {
      const nuevo = new Set(actual)
      if (nuevo.has(id)) nuevo.delete(id)
      else nuevo.add(id)
      return nuevo
    })
  }

  function alternarTodos(usuarios, marcar) {
    setElegidos((actual) => {
      const nuevo = new Set(actual)
      usuarios.forEach((u) => (marcar ? nuevo.add(u.id) : nuevo.delete(u.id)))
      return nuevo
    })
  }

  async function guardar() {
    setError('')
    setGuardando(true)
    try {
      const r = await api.guardarAsignaciones(cuestionario.id, [...elegidos])
      onGuardado(r.asignados)
    } catch (e) {
      setError(e.message)
      setGuardando(false)
    }
  }

  const c = datos?.cuestionario
  return (
    <Modal titulo="Asignar cuestionario" onCerrar={onCerrar} className="modal--ancho">
      <div className="asignar__cuestionario">
        <span className="cuestionario-item__categoria">{c?.categoria ?? cuestionario.categoria.nombre}</span>
        <b>{cuestionario.titulo}</b>
        {c && (
          <small>
            {c.preguntas === 1 ? '1 pregunta' : `${c.preguntas} preguntas`}
            {c.descripcion && ` · ${c.descripcion}`}
          </small>
        )}
      </div>

      {c && !c.activo && (
        <p className="asignar__nota">
          Este cuestionario está inactivo: los militantes no lo van a ver hasta que lo actives.
        </p>
      )}

      {datos === null && !error && <p className="modal__texto">Cargando…</p>}

      {datos && !hayMilitantes && (
        <p className="modal__texto">
          No hay militantes activos en la campaña. Asignales el rol <b>Militantes</b> desde Usuarios.
        </p>
      )}

      {datos && hayMilitantes && (
        <>
          <p className="asignar__ayuda">
            Marcá un equipo para asignárselo a todos sus integrantes, o elegí personas sueltas. Si alguien entra a un
            equipo después, hay que asignárselo de nuevo.
          </p>
          <div className="asignar__lista">
            {datos.equipos.map((e) => (
              <Grupo
                key={e.id}
                titulo={e.nombre}
                inactivo={!e.activo}
                usuarios={e.usuarios}
                elegidos={elegidos}
                alternar={alternar}
                alternarTodos={alternarTodos}
              />
            ))}
            {datos.sin_equipo.length > 0 && (
              <Grupo
                titulo="Sin equipo"
                usuarios={datos.sin_equipo}
                elegidos={elegidos}
                alternar={alternar}
                alternarTodos={alternarTodos}
              />
            )}
          </div>
          <p className="asignar__ayuda">
            {elegidos.size === 1 ? '1 militante elegido.' : `${elegidos.size} militantes elegidos.`}
          </p>
        </>
      )}

      {error && (
        <p className="texto-error" role="alert">
          {error}
        </p>
      )}

      <div className="acciones">
        <button type="button" className="boton boton--borde" onClick={onCerrar}>
          Cancelar
        </button>
        <button type="button" className="boton" onClick={guardar} disabled={!datos || guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </Modal>
  )
}

export default AsignarCuestionario
