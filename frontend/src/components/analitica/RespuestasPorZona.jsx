import { useEffect, useState } from 'react'
import { obtenerRespuestasPorZona, urlGraficoZona } from '../../api/analitica'
import { useTemaActual } from '../../tema'
import ImagenAmpliable from '../comunes/ImagenAmpliable'

// Dashboard → "Respuestas por zona y cuestionario": se elige una zona y un
// cuestionario y se ven sus preguntas con lo que se respondió. Cada encuesta
// cuenta en la zona donde se cargó, según su ubicación GPS (backend:
// analitica_views.respuestas_por_zona). Cada pregunta se muestra como tabla (cantidades exactas)
// con una barra por opción (para comparar de un vistazo).

const cuantas = (n) => (n === 1 ? '1 encuesta' : `${n.toLocaleString('es-AR')} encuestas`)

// Gráfico de una pregunta con las respuestas de la zona: torta si es de una
// sola opción, barras si es de opción múltiple (lo dibuja el servidor con
// matplotlib, igual que Estadísticas)
function Pregunta({ pregunta, url }) {
  const [estado, setEstado] = useState('cargando')
  return (
    <figure className="zona-pregunta">
      <figcaption>
        <h3>
          {pregunta.orden}. {pregunta.enunciado}
        </h3>
        <p className="zona-pregunta__tipo">
          {pregunta.respuestas.toLocaleString('es-AR')} {pregunta.respuestas === 1 ? 'respuesta' : 'respuestas'}
          {pregunta.multiple ? ' · opción múltiple: cada persona puede elegir varias.' : ''}
        </p>
      </figcaption>
      {pregunta.respuestas === 0 ? (
        <p className="aviso-info">Nadie respondió esta pregunta en las zonas elegidas.</p>
      ) : (
        <div className={`zona-pregunta__imagen zona-pregunta__imagen--${estado}`}>
          {estado === 'error' && <p className="aviso-info">No se pudo generar el gráfico.</p>}
          <ImagenAmpliable
            titulo={`${pregunta.orden}. ${pregunta.enunciado}`}
            src={url}
            alt={`Respuestas de «${pregunta.enunciado}»: ${pregunta.opciones
              .map((o) => `${o.texto} ${o.cantidad}`)
              .join(', ')}`}
            loading="lazy"
            decoding="async"
            draggable={false}
            onLoad={() => setEstado('listo')}
            onError={() => setEstado('error')}
          />
        </div>
      )}
    </figure>
  )
}

// Hasta cuántas zonas se comparan a la vez (igual que el backend)
const MAXIMO_ZONAS = 6

function RespuestasPorZona({ zonas, cuestionarios }) {
  const tema = useTemaActual()
  // Zonas elegidas, en el orden en que se marcaron (ids como texto)
  const [elegidas, setElegidas] = useState([])
  const [cuestionario, setCuestionario] = useState('')
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const zona = elegidas.join(',')
  const completo = Boolean(zona && cuestionario)

  const alternar = (id) =>
    setElegidas((actual) =>
      actual.includes(id) ? actual.filter((z) => z !== id) : actual.length < MAXIMO_ZONAS ? [...actual, id] : actual,
    )

  // Se vuelve a consultar cada vez que cambian las zonas o el cuestionario
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
  const vigentes =
    datos && datos.zonas.map((z) => z.id).join(',') === zona && String(datos.cuestionario.id) === cuestionario
  const varias = elegidas.length > 1

  return (
    <section className="zona-respuestas" aria-labelledby="zona-respuestas-titulo">
      <header>
        <h2 id="zona-respuestas-titulo">Respuestas por zona y cuestionario</h2>
        <p>
          Cada encuesta cuenta en la zona donde se cargó, según la ubicación GPS del celular. Elija varias zonas para
          comparar sus respuestas. Las cargadas sin GPS (por ejemplo, desde la web) no tienen zona. Esta consulta no usa
          las fechas de arriba.
        </p>
      </header>

      <div className="tarjeta-form zona-respuestas__filtros">
        <fieldset className="zona-elegir">
          <legend>
            Zonas * <small>(hasta {MAXIMO_ZONAS})</small>
          </legend>
          <div className="zona-elegir__lista">
            {zonas.map((z) => {
              const marcada = elegidas.includes(String(z.id))
              const lleno = !marcada && elegidas.length >= MAXIMO_ZONAS
              return (
                <label key={z.id} className={`zona-chip${marcada ? ' zona-chip--marcada' : ''}`}>
                  <input
                    type="checkbox"
                    checked={marcada}
                    disabled={lleno}
                    onChange={() => alternar(String(z.id))}
                  />
                  {z.nombre}
                </label>
              )
            })}
          </div>
        </fieldset>
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
        <p className="vacio-tarjeta">Elija una o más zonas y un cuestionario para ver sus preguntas y respuestas.</p>
      ) : error && !vigentes ? (
        <p className="aviso-error" role="alert">
          {error}
        </p>
      ) : !vigentes ? (
        <p className="vacio-tarjeta">Cargando…</p>
      ) : datos.encuestas === 0 ? (
        <div className="aviso-info" role="status">
          <p>
            No hay resultados: no se cargaron encuestas de «{datos.cuestionario.titulo}» dentro de{' '}
            {datos.zonas.map((z) => z.nombre).join(', ')} (según el GPS).
          </p>
          {datos.reparto.length > 0 && (
            <>
              <p>Dónde se cargó este cuestionario:</p>
              <ul>
                {datos.reparto.map((r) => (
                  <li key={r.zona}>
                    {r.zona}: {cuantas(r.encuestas)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : (
        <>
          <ul className="zona-resumen" aria-label="Encuestas por zona">
            {datos.zonas.map((z) => (
              <li key={z.id}>
                <span className="zona-resumen__color" style={{ background: z.color }} aria-hidden="true" />
                {z.nombre}: <strong>{cuantas(z.encuestas)}</strong>
              </li>
            ))}
          </ul>
          {varias && (
            <p className="zona-pregunta__tipo">
              Cada barra es el porcentaje de las encuestas de esa zona que eligió la opción, así se comparan zonas con
              distinta cantidad de encuestas.
            </p>
          )}
          <div className="zona-preguntas">
            {datos.preguntas.map((p) => (
              <Pregunta
                key={`${p.id}-${tema}-${zona}`}
                pregunta={p}
                url={urlGraficoZona(p.id, { zona, cuestionario, tema: tema === 'oscuro' ? 'oscuro' : '', v: datos.encuestas })}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

export default RespuestasPorZona
