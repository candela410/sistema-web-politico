import { useEffect, useState } from 'react'
import { obtenerRespuestasPorZona } from '../../api/analitica'

// Dashboard → "Respuestas por zona y cuestionario": se elige una zona y un
// cuestionario y se ven sus preguntas con lo que se respondió. La zona es la
// del equipo de quien cargó la encuesta (equipo → ruta → calles → barrios →
// zona), no el GPS. Cada pregunta se muestra como tabla (cantidades exactas)
// con una barra por opción (para comparar de un vistazo).

const cuantas = (n) => (n === 1 ? '1 encuesta' : `${n.toLocaleString('es-AR')} encuestas`)
const pct = (n) => `${n.toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`

function Pregunta({ pregunta }) {
  const maximo = Math.max(1, ...pregunta.opciones.map((o) => o.cantidad))
  return (
    <article className="zona-pregunta">
      <h3>
        {pregunta.orden}. {pregunta.enunciado}
      </h3>
      <p className="zona-pregunta__tipo">
        {pregunta.multiple
          ? 'Opción múltiple: cada persona puede elegir varias, por eso los porcentajes no suman 100 %.'
          : 'Una sola opción.'}
      </p>
      <table className="zona-tabla">
        <thead>
          <tr>
            <th scope="col">Opción</th>
            <th scope="col" className="zona-tabla__num">
              Respuestas
            </th>
            <th scope="col">% de las encuestas</th>
          </tr>
        </thead>
        <tbody>
          {pregunta.opciones.map((o) => (
            <tr key={o.id}>
              <td>{o.texto}</td>
              <td className="zona-tabla__num">{o.cantidad.toLocaleString('es-AR')}</td>
              <td>
                <span className="zona-barra" aria-hidden="true">
                  <span className="zona-barra__relleno" style={{ width: `${(100 * o.cantidad) / maximo}%` }} />
                </span>
                <span className="zona-barra__texto">{pct(o.porcentaje)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  )
}

function RespuestasPorZona({ zonas, cuestionarios }) {
  const [zona, setZona] = useState('')
  const [cuestionario, setCuestionario] = useState('')
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const completo = Boolean(zona && cuestionario)

  // Se vuelve a consultar cada vez que cambia cualquiera de los dos filtros
  useEffect(() => {
    if (!completo) return undefined
    let vigente = true
    obtenerRespuestasPorZona(zona, cuestionario)
      .then((r) => vigente && (setDatos(r), setError('')))
      .catch((e) => vigente && (setDatos(null), setError(e.message)))
    return () => {
      vigente = false
    }
  }, [zona, cuestionario, completo])

  // Mientras llega la respuesta de los filtros nuevos no se muestra la anterior
  const vigentes = datos && String(datos.zona.id) === zona && String(datos.cuestionario.id) === cuestionario

  return (
    <section className="zona-respuestas" aria-labelledby="zona-respuestas-titulo">
      <header>
        <h2 id="zona-respuestas-titulo">Respuestas por zona y cuestionario</h2>
        <p>
          La zona de cada encuesta es la del equipo de quien la cargó (los barrios que recorre su ruta). Esta consulta no
          usa las fechas de arriba.
        </p>
      </header>

      <div className="analitica__filtros zona-respuestas__filtros">
        <label>
          Zona *
          <select className="entrada" value={zona} onChange={(e) => setZona(e.target.value)}>
            <option value="">Elegir zona…</option>
            {zonas.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cuestionario *
          <select className="entrada" value={cuestionario} onChange={(e) => setCuestionario(e.target.value)}>
            <option value="">Elegir cuestionario…</option>
            {cuestionarios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!completo ? (
        <p className="vacio-tarjeta">Elija una zona y un cuestionario para ver sus preguntas y respuestas.</p>
      ) : error && !vigentes ? (
        <p className="aviso-error" role="alert">
          {error}
        </p>
      ) : !vigentes ? (
        <p className="vacio-tarjeta">Cargando…</p>
      ) : datos.encuestas === 0 ? (
        <p className="aviso-info" role="status">
          No hay resultados: no se cargaron encuestas de «{datos.cuestionario.titulo}» en {datos.zona.nombre}.
        </p>
      ) : !datos.separable ? (
        <div className="aviso-info" role="status">
          <p>
            En {datos.zona.nombre} hay {cuantas(datos.encuestas)} de «{datos.cuestionario.titulo}», pero este cuestionario
            también se cargó fuera de esta zona y las respuestas guardadas no indican a qué encuesta pertenecen. Por eso no
            se pueden mostrar solo las de esta zona sin mezclarlas con las de otras.
          </p>
          <p>Encuestas de este cuestionario por zona:</p>
          <ul>
            {datos.reparto.map((r) => (
              <li key={r.zona}>
                {r.zona}: {cuantas(r.encuestas)}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <p className="analitica__periodo">
            {cuantas(datos.encuestas)} de «{datos.cuestionario.titulo}» en {datos.zona.nombre}
          </p>
          <div className="zona-preguntas">
            {datos.preguntas.map((p) => (
              <Pregunta key={p.id} pregunta={p} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

export default RespuestasPorZona
