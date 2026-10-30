import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { obtenerEstadisticas } from '../../api/encuestas'
import Modal from '../comunes/Modal'
import './cuestionarios.css'
import { disponibles, f, plural, porDefecto } from './catalogoGraficos'
import { Dato, Grafico } from './graficos'

// Estadísticas de un cuestionario (se abren con el botón "Estadísticas" de la
// lista). En cada pregunta la persona elige UN tipo de gráfico a la vez, y puede
// descargar un PDF eligiendo cuáles incluir.

const formatoFecha = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' })

const nombreDe = (pregunta, clave) => disponibles(pregunta).find((g) => g.clave === clave)?.nombre ?? clave

// La elección de gráficos se recuerda en este navegador (si se puede)
function leerEleccion(id) {
  try {
    return JSON.parse(localStorage.getItem(`graficos-cuestionario-${id}`)) ?? {}
  } catch {
    return {}
  }
}
function guardarEleccion(id, eleccion) {
  try {
    localStorage.setItem(`graficos-cuestionario-${id}`, JSON.stringify(eleccion))
  } catch {
    // Sin almacenamiento: la elección dura mientras la página esté abierta
  }
}

// Devuelve el único gráfico elegido para la pregunta. Si lo guardado no sirve
// (por ejemplo, elecciones viejas con varios gráficos) se usa el primero válido
// o el gráfico por defecto.
function graficoDe(pregunta, guardado) {
  const validas = disponibles(pregunta).map((g) => g.clave)
  const candidatos = Array.isArray(guardado) ? guardado : [guardado]
  return candidatos.find((c) => validas.includes(c)) ?? porDefecto(pregunta)
}

function EstadisticaPregunta({ cuestionario, pregunta, numero, elegido, onCambio, registrar }) {
  const cuantitativa = pregunta.variable === 'cuantitativa'
  const opciones = disponibles(pregunta)

  return (
    <section className="tarjeta-form estadistica">
      <header className="estadistica__cabecera">
        <span className="tarjeta-pregunta__numero">{numero}</span>
        <div>
          <h3>{pregunta.enunciado}</h3>
          <p className="texto-suave">
            {plural(pregunta.respondidas, 'persona respondió', 'personas respondieron')}
            {pregunta.sin_responder > 0 && ` · ${f(pregunta.sin_responder)} sin responder`}
          </p>
        </div>
        <span className={`variable variable--${pregunta.variable} estadistica__variable`}>
          {cuantitativa ? 'Cuantitativa' : 'Cualitativa'}
        </span>
      </header>

      {pregunta.respondidas === 0 ? (
        <p className="texto-suave">Nadie respondió esta pregunta todavía.</p>
      ) : (
        <>
          <div className="selector-graficos" role="radiogroup" aria-label="Tipo de gráfico a mostrar">
            <span className="selector-graficos__titulo">Gráfico:</span>
            {opciones.map((g) => (
              <button
                key={g.nombre}
                type="button"
                role="radio"
                className="chip-grafico"
                aria-checked={elegido === g.clave}
                onClick={() => elegido !== g.clave && onCambio(g.clave)}
              >
                {g.nombre}
              </button>
            ))}
          </div>

          <figure key={elegido} className="grafico" ref={(nodo) => registrar(pregunta.id, elegido, nodo)}>
            <figcaption>{nombreDe(pregunta, elegido)}</figcaption>
            <Grafico clave={elegido} pregunta={pregunta} cuestionario={cuestionario} />
          </figure>
        </>
      )}
    </section>
  )
}

function DescargarPdf({ datos, eleccion, nodos, onCerrar }) {
  const preguntas = datos.preguntas.filter((p) => p.respondidas > 0 && (eleccion[p.id] ?? []).length)
  const [incluir, setIncluir] = useState(() => {
    const todo = { resumen: true }
    for (const p of preguntas) for (const c of eleccion[p.id]) todo[`${p.id}:${c}`] = true
    return todo
  })
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState('')
  const alternar = (clave) => setIncluir((i) => ({ ...i, [clave]: !i[clave] }))
  const marcarTodo = (valor) => setIncluir((i) => Object.fromEntries(Object.keys(i).map((k) => [k, valor])))
  const cantidad = Object.entries(incluir).filter(([k, v]) => v && k !== 'resumen').length

  async function generar() {
    setGenerando(true)
    setError('')
    try {
      const { descargarPdf } = await import('./pdf')
      const total = datos.preguntas.length
      const lista = datos.preguntas.map((p, i) => ({
        ...p,
        numero: i + 1,
        total,
        graficos: (eleccion[p.id] ?? [])
          .filter((c) => incluir[`${p.id}:${c}`])
          .map((c) => ({ nodo: nodos.current.get(`${p.id}:${c}`), nombre: nombreDe(p, c) }))
          .filter((g) => g.nodo),
      }))
      const nombre = datos.cuestionario.titulo.replace(/[^\w\sáéíóúñÁÉÍÓÚÑ-]/g, '').trim().replace(/\s+/g, '-')
      await descargarPdf({
        cuestionario: datos.cuestionario,
        campana: datos.campana,
        generadoPor: datos.generado_por,
        generadoEn: new Date(),
        formatoFecha,
        f,
        resumen: incluir.resumen
          ? {
              encuestas: datos.total_encuestas,
              militantes: datos.militantes,
              preguntas: total,
              conRespuestas: datos.preguntas.filter((p) => p.respondidas > 0).length,
              ultima: datos.ultima_encuesta,
            }
          : null,
        preguntas: { total, lista },
        archivo: `informe-estadisticas-${nombre || 'cuestionario'}.pdf`,
      })
      onCerrar()
    } catch (e) {
      setError(`No se pudo generar el PDF: ${e.message}`)
      setGenerando(false)
    }
  }

  return (
    <Modal titulo="Descargar PDF" onCerrar={onCerrar}>
      <p className="modal__texto">
        El informe siempre empieza con los datos del cuestionario (nombre, categoría, campaña, fecha). Marcá qué más querés
        incluir: aparece el gráfico que estás viendo en cada pregunta.
      </p>
      <div className="pdf-lista">
        <label className="casilla-texto">
          <input type="checkbox" checked={!!incluir.resumen} onChange={() => alternar('resumen')} />
          <span>Resumen general (encuestas, militantes, preguntas y última encuesta)</span>
        </label>
        {preguntas.map((p) => (
          <fieldset key={p.id} className="pdf-lista__pregunta">
            <legend>
              {datos.preguntas.indexOf(p) + 1}. {p.enunciado}
            </legend>
            {eleccion[p.id].map((c) => (
              <label key={c} className="casilla-texto">
                <input type="checkbox" checked={!!incluir[`${p.id}:${c}`]} onChange={() => alternar(`${p.id}:${c}`)} />
                <span>{nombreDe(p, c)}</span>
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <div className="pdf-lista__atajos">
        <button type="button" className="enlace-boton" onClick={() => marcarTodo(true)}>
          Marcar todo
        </button>
        <button type="button" className="enlace-boton" onClick={() => marcarTodo(false)}>
          Desmarcar todo
        </button>
      </div>
      {error && (
        <p className="texto-error" role="alert">
          {error}
        </p>
      )}
      <div className="acciones">
        <button type="button" className="boton boton--borde" onClick={onCerrar}>
          Cancelar
        </button>
        <button type="button" className="boton" onClick={generar} disabled={generando}>
          {generando ? 'Generando…' : `Descargar PDF${cantidad ? ` (${cantidad} gráfico${cantidad === 1 ? '' : 's'})` : ''}`}
        </button>
      </div>
    </Modal>
  )
}

function DetalleCuestionario() {
  const { id } = useParams()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [eleccion, setEleccion] = useState(() => leerEleccion(id))
  const [pdfAbierto, setPdfAbierto] = useState(false)
  // Nodos de cada gráfico en pantalla, para pasarlos al PDF
  const nodos = useRef(new Map())

  useEffect(() => {
    obtenerEstadisticas(id)
      .then(setDatos)
      .catch((e) => setError(e.message))
  }, [id])

  const elegidoDe = (p) => graficoDe(p, eleccion[p.id])
  function cambiar(p, clave) {
    const nueva = { ...eleccion, [p.id]: clave }
    setEleccion(nueva)
    guardarEleccion(id, nueva)
  }
  const registrar = (idPregunta, clave, nodo) => {
    const k = `${idPregunta}:${clave}`
    if (nodo) nodos.current.set(k, nodo)
    else nodos.current.delete(k)
  }

  return (
    <main className="editor">
      <div className="editor__barra">
        <Link to="/cuestionarios" className="enlace-volver">
          ← Cuestionarios
        </Link>
        <span className="editor__estado" />
        {datos && datos.total_encuestas > 0 && (
          <button type="button" className="boton" onClick={() => setPdfAbierto(true)}>
            Descargar PDF
          </button>
        )}
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
                <Dato etiqueta="Encuestas" valor={f(datos.total_encuestas)} />
                <Dato etiqueta="Militantes que cargaron" valor={f(datos.militantes)} />
                <Dato
                  etiqueta="Última encuesta"
                  valor={datos.ultima_encuesta ? formatoFecha.format(new Date(datos.ultima_encuesta)) : '—'}
                />
              </div>
            </section>

            <h2 className="detalle__seccion">Estadísticas</h2>
            {datos.total_encuestas === 0 && (
              <p className="aviso-info">
                Todavía no hay encuestas cargadas. Cuando los militantes respondan este cuestionario, acá vas a ver los
                resultados de cada pregunta.
              </p>
            )}
            {datos.preguntas.map((p, i) => (
              <EstadisticaPregunta
                key={p.id}
                cuestionario={id}
                pregunta={p}
                numero={i + 1}
                elegido={elegidoDe(p)}
                onCambio={(clave) => cambiar(p, clave)}
                registrar={registrar}
              />
            ))}
          </>
        )}
      </div>

      {pdfAbierto && datos && (
        <DescargarPdf
          datos={datos}
          eleccion={Object.fromEntries(datos.preguntas.map((p) => [p.id, [elegidoDe(p)]]))}
          nodos={nodos}
          onCerrar={() => setPdfAbierto(false)}
        />
      )}
    </main>
  )
}

export default DetalleCuestionario