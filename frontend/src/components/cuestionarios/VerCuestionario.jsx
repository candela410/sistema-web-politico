import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import * as api from '../../api/cuestionarios'
import { tiene } from '../../permisos'
import Esqueleto from '../comunes/Esqueleto'
import Modal from '../comunes/Modal'
import './ver.css'

const plural = (n, uno, varios) => (n === 1 ? `1 ${uno}` : `${n} ${varios}`)

// Ventana de solo lectura: datos del cuestionario, sus preguntas con las
// opciones y a qué equipos (y militantes) está asignado.
function VerCuestionario({ cuestionario, usuario, onCerrar }) {
  const [detalle, setDetalle] = useState(null)
  const [asignados, setAsignados] = useState(null) // null: cargando o sin permiso
  const [error, setError] = useState('')
  const puedeVerAsignaciones = tiene(usuario, 'core.view_asignacioncuestionario')

  useEffect(() => {
    api
      .obtenerCuestionario(cuestionario.id)
      .then(setDetalle)
      .catch((e) => setError(e.message))
    if (puedeVerAsignaciones) {
      api
        .obtenerAsignaciones(cuestionario.id)
        .then((d) => {
          // Solo los que tienen el cuestionario asignado, agrupados por equipo
          const soloAsignados = (usuarios) => usuarios.filter((u) => u.asignado)
          setAsignados({
            equipos: d.equipos
              .map((e) => ({ ...e, usuarios: soloAsignados(e.usuarios) }))
              .filter((e) => e.usuarios.length > 0),
            sinEquipo: soloAsignados(d.sin_equipo),
            total: d.asignados,
          })
        })
        .catch((e) => setError(e.message))
    }
  }, [cuestionario.id, puedeVerAsignaciones])

  return (
    <Modal titulo="Detalle del cuestionario" onCerrar={onCerrar} className="modal--ancho">
      <div className="ver__cabecera">
        <span className="cuestionario-item__categoria">{cuestionario.categoria.nombre}</span>
        <h3>{cuestionario.titulo}</h3>
        {cuestionario.descripcion && <p>{cuestionario.descripcion}</p>}
        <div className="ver__datos">
          <span className={`etiqueta ${cuestionario.activo ? 'etiqueta--verde' : ''}`}>
            {cuestionario.activo ? 'Activo' : 'Inactivo'}
          </span>
          <span className="etiqueta etiqueta--violeta">{plural(cuestionario.preguntas, 'pregunta', 'preguntas')}</span>
          <span className="etiqueta etiqueta--magenta">{plural(cuestionario.encuestas, 'encuesta', 'encuestas')}</span>
          <span className="ver__fecha">
            Creado el {new Date(cuestionario.creado_en).toLocaleDateString('es-AR', { dateStyle: 'long' })}
          </span>
        </div>
      </div>

      {error && (
        <p className="texto-error" role="alert">
          {error}
        </p>
      )}

      <div className="ver__cuerpo">
        <section className="ver__seccion">
          <h4>Preguntas</h4>
          {detalle === null ? (
            !error && <Esqueleto filas={2} texto="Cargando preguntas…" />
          ) : (
            <ol className="ver__preguntas">
              {detalle.preguntas.map((p) => (
                <li key={p.id}>
                  <p>
                    {p.enunciado}
                    {p.obligatoria && <span className="ver__obligatoria">Obligatoria</span>}
                  </p>
                  <ul className="ver__opciones">
                    {p.opciones.map((o) => (
                      <li key={o.id}>{o.texto}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </section>

        {puedeVerAsignaciones && (
          <section className="ver__seccion">
            <h4>
              Asignado a
              {asignados && asignados.total > 0 && (
                <span className="ver__contador">{plural(asignados.total, 'militante', 'militantes')}</span>
              )}
            </h4>
            {asignados === null ? (
              !error && <Esqueleto filas={1} texto="Cargando asignaciones…" />
            ) : asignados.total === 0 ? (
              <p className="ver__vacio">Todavía no está asignado a nadie.</p>
            ) : (
              <div className="ver__equipos">
                {[
                  ...asignados.equipos.map((e) => ({ clave: e.id, nombre: e.nombre, inactivo: !e.activo, usuarios: e.usuarios })),
                  ...(asignados.sinEquipo.length
                    ? [{ clave: 'sin', nombre: 'Sin equipo', usuarios: asignados.sinEquipo, suelto: true }]
                    : []),
                ].map((g) => (
                  <div key={g.clave} className={`ver__equipo${g.suelto ? ' ver__equipo--suelto' : ''}`}>
                    <p className="ver__equipo-nombre">
                      <Users size={15} aria-hidden="true" />
                      {g.nombre}
                      {g.inactivo && <span className="etiqueta-inactivo">Inactivo</span>}
                      <small>{g.usuarios.length}</small>
                    </p>
                    <ul>
                      {g.usuarios.map((u) => (
                        <li key={u.id} title={u.email}>
                          <span className="ver__avatar" aria-hidden="true">
                            {u.nombre.charAt(0).toUpperCase()}
                          </span>
                          {u.nombre}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <div className="acciones">
        <button type="button" className="boton" onClick={onCerrar} autoFocus>
          Cerrar
        </button>
      </div>
    </Modal>
  )
}

export default VerCuestionario
