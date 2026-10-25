import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { obtenerEstadisticas } from '../../api/encuestas'
import './cuestionarios.css'

// "Ver detalle" de un cuestionario: resumen y estadísticas de cada pregunta

const TIPOS = {
  opcion_multiple: 'Opción múltiple',
  si_no: 'Sí / No',
  texto: 'Texto libre',
  numero: 'Número',
}

const formatoNumero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 })
const formatoFecha = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' })
const plural = (n, uno, varios) => `${formatoNumero.format(n)} ${n === 1 ? uno : varios}`

function Dato({ etiqueta, valor }) {
  return (
    <div className="dato">
      <span className="dato__valor">{valor}</span>
      <span className="dato__etiqueta">{etiqueta}</span>
    </div>
  )
}

// Barras horizontales: una por opción, con cantidad y porcentaje escritos
function BarrasOpciones({ opciones, respondidas }) {
  const maximo = Math.max(...opciones.map((o) => o.cantidad), 1)
  return (
    <div className="barras" role="table" aria-label="Respuestas por opción">
      {opciones.map((o) => (
        <div
          key={o.id}
          className="barras__fila"
          role="row"
          title={`${o.texto}: ${plural(o.cantidad, 'respuesta', 'respuestas')} (${formatoNumero.format(o.porcentaje)} %)`}
        >
          <span className="barras__texto" role="cell">
            {o.texto}
          </span>
          <span className="barras__pista" role="cell" aria-hidden="true">
            {o.cantidad > 0 && (
              <span className="barras__barra" style={{ width: `${(100 * o.cantidad) / maximo}%` }} />
            )}
          </span>
          <span className="barras__valor" role="cell">
            <b>{formatoNumero.format(o.porcentaje)} %</b>
            <small>{formatoNumero.format(o.cantidad)}</small>
          </span>
        </div>
      ))}
      {respondidas === 0 && <p className="texto-suave">Nadie respondió esta pregunta todavía.</p>}
    </div>
  )
}

function EstadisticaPregunta({ pregunta, numero }) {
  return (
    <section className="tarjeta-form estadistica">
      <header className="estadistica__cabecera">
        <span className="tarjeta-pregunta__numero">{numero}</span>
        <div>
          <h3>{pregunta.enunciado}</h3>
          <p className="texto-suave">
            {TIPOS[pregunta.tipo]} · {plural(pregunta.respondidas, 'respuesta', 'respuestas')}
            {pregunta.sin_responder > 0 && ` · ${formatoNumero.format(pregunta.sin_responder)} sin responder`}
          </p>
        </div>
      </header>

      {pregunta.opciones && <BarrasOpciones opciones={pregunta.opciones} respondidas={pregunta.respondidas} />}

      {pregunta.tipo === 'numero' &&
        (pregunta.numeros ? (
          <div className="datos-grilla">
            <Dato etiqueta="Promedio" valor={formatoNumero.format(pregunta.numeros.promedio)} />
            <Dato etiqueta="Mediana" valor={formatoNumero.format(pregunta.numeros.mediana)} />
            <Dato etiqueta="Mínimo" valor={formatoNumero.format(pregunta.numeros.minimo)} />
            <Dato etiqueta="Máximo" valor={formatoNumero.format(pregunta.numeros.maximo)} />
          </div>
        ) : (
          <p className="texto-suave">Nadie respondió esta pregunta todavía.</p>
        ))}

      {pregunta.textos &&
        (pregunta.textos.length ? (
          <>
            <ul className="textos">
              {pregunta.textos.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
            {pregunta.respondidas > pregunta.textos.length && (
              <p className="texto-suave">Se muestran las {pregunta.textos.length} respuestas más recientes.</p>
            )}
          </>
        ) : (
          <p className="texto-suave">Nadie respondió esta pregunta todavía.</p>
        ))}
    </section>
  )
}

function DetalleCuestionario() {
  const { id } = useParams()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    obtenerEstadisticas(id)
      .then(setDatos)
      .catch((e) => setError(e.message))
  }, [id])

  return (
    <main className="editor">
      <div className="editor__barra">
        <Link to="/cuestionarios" className="enlace-volver">
          ← Cuestionarios
        </Link>
        <span className="editor__estado" />
        <Link to={`/cuestionarios/${id}`} className="boton boton--borde">
          Editar
        </Link>
      </div>

      <div className="editor__columna">
        {error ? (
          <p className="aviso-error" role="alert">
            {error}
          </p>
        ) : !datos ? (
          <p className="vacio-tarjeta">Cargando…</p>
        ) : (
          <>
            <section className="tarjeta-form tarjeta-titulo">
              <span className="cuestionario-item__categoria detalle__categoria">{datos.cuestionario.categoria}</span>
              <h1 className="detalle__titulo">{datos.cuestionario.titulo}</h1>
              <div className="datos-grilla">
                <Dato etiqueta="Encuestas" valor={formatoNumero.format(datos.total_encuestas)} />
                <Dato etiqueta="Militantes que cargaron" valor={formatoNumero.format(datos.militantes)} />
                <Dato
                  etiqueta="Última encuesta"
                  valor={datos.ultima_encuesta ? formatoFecha.format(new Date(datos.ultima_encuesta)) : '—'}
                />
              </div>
            </section>

            <h2 className="detalle__seccion">Estadísticas</h2>
            {datos.total_encuestas === 0 && (
              <p className="aviso-info">
                Todavía no hay encuestas cargadas. Cuando los militantes respondan este cuestionario, acá vas a ver
                los resultados de cada pregunta.
              </p>
            )}
            {datos.preguntas.map((p, i) => (
              <EstadisticaPregunta key={p.id} pregunta={p} numero={i + 1} />
            ))}
          </>
        )}
      </div>
    </main>
  )
}

export default DetalleCuestionario
