import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { obtenerEstadisticas } from '../../api/encuestas'
import Modal from '../comunes/Modal'
import './cuestionarios.css'
import { disponibles, f, plural, porDefecto } from './catalogoGraficos'
import { Dato, Grafico } from './graficos'

// Estadísticas de un cuestionario (se abren con el botón "Estadísticas" de la
// lista). En cada pregunta la persona elige qué gráficos ver, y puede
// descargar un PDF eligiendo cuáles incluir.

const TIPOS = { una_opcion: 'Una sola opción', opcion_multiple: 'Opción múltiple' }
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

function EstadisticaPregunta({ pregunta, numero, elegidos, onCambio, registrar }) {
  const cuantitativa = pregunta.variable === 'cuantitativa'
  const multiple = pregunta.tipo === 'opcion_multiple'
  const opciones = disponibles(pregunta)
  const alternar = (clave) =>
    onCambio(
      elegidos.includes(clave)
        ? elegidos.filter((c) => c !== clave)
        : opciones.map((o) => o.clave).filter((c) => c === clave || elegidos.includes(c)),
    )

  return (
    <section className="tarjeta-form estadistica">
      <header className="estadistica__cabecera">
        <span className="tarjeta-pregunta__numero">{numero}</span>
        <div>
          <h3>{pregunta.enunciado}</h3>
          <p className="texto-suave">
            {TIPOS[pregunta.tipo]} · {plural(pregunta.respondidas, 'persona respondió', 'personas respondieron')}
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
          <div className="selector-graficos" role="group" aria-label="Gráficos a mostrar">
            <span className="selector-graficos__titulo">Gráficos:</span>
            {opciones.map((g) => (
              <button
                key={g.clave}
                type="button"
                className="chip-grafico"
                aria-pressed={elegidos.includes(g.clave)}
                onClick={() => alternar(g.clave)}
              >
                {g.nombre}
              </button>
            ))}
          </div>

          {elegidos.length === 0 && <p className="texto-suave">Elegí al menos un gráfico para esta pregunta.</p>}
          {elegidos.map((clave) => (
            <figure key={clave} className="grafico" ref={(nodo) => registrar(pregunta.id, clave, nodo)}>
              <figcaption>{nombreDe(pregunta, clave)}</figcaption>
              <Grafico clave={clave} pregunta={pregunta} />
            </figure>
          ))}

          {multiple && (
            <p className="texto-suave">
              Cada persona pudo elegir varias opciones: los porcentajes de las barras son sobre{' '}
              {plural(pregunta.respondidas, 'persona', 'personas')} y pueden sumar más de 100 %. La torta y la tabla
              reparten el total de elecciones ({f(pregunta.elecciones)}).
            </p>
          )}
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
      const secciones = []
      if (incluir.resumen) {
        secciones.push({ titulo: 'Resumen', graficos: [{ nodo: nodos.current.get('resumen') }] })
      }
      datos.preguntas.forEach((p, i) => {
        const graficos = (eleccion[p.id] ?? [])
          .filter((c) => incluir[`${p.id}:${c}`])
          .map((c) => ({ nodo: nodos.current.get(`${p.id}:${c}`) }))
          .filter((g) => g.nodo)
        if (graficos.length) {
          secciones.push({
            titulo: `${i + 1}. ${p.enunciado}`,
            detalle: `${TIPOS[p.tipo]} · Variable ${p.variable} · ${plural(p.respondidas, 'persona respondió', 'personas respondieron')}`,
            graficos,
          })
        }
      })
      const nombre = datos.cuestionario.titulo.replace(/[^\w\sáéíóúñÁÉÍÓÚÑ-]/g, '').trim().replace(/\s+/g, '-')
      await descargarPdf({
        titulo: datos.cuestionario.titulo,
        subtitulo: `Estadísticas · ${datos.cuestionario.categoria} · ${f(datos.total_encuestas)} encuestas · Generado el ${formatoFecha.format(new Date())}`,
        secciones,
        archivo: `estadisticas-${nombre || 'cuestionario'}.pdf`,
      })
      onCerrar()
    } catch (e) {
      setError(`No se pudo generar el PDF: ${e.message}`)
      setGenerando(false)
    }
  }

  return (
    <Modal titulo="Descargar PDF" onCerrar={onCerrar}>
      <p className="modal__texto">Marcá qué querés incluir. Aparecen los gráficos que estás viendo en cada pregunta.</p>
      <div className="pdf-lista">
        <label className="casilla-texto">
          <input type="checkbox" checked={!!incluir.resumen} onChange={() => alternar('resumen')} />
          <span>Resumen (encuestas, militantes y última encuesta)</span>
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
        <button type="button" className="boton" onClick={generar} disabled={generando || (!cantidad && !incluir.resumen)}>
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

  const elegidosDe = (p) => eleccion[p.id] ?? porDefecto(p)
  function cambiar(p, elegidos) {
    const nueva = { ...eleccion, [p.id]: elegidos }
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
              <div className="datos-grilla" ref={(nodo) => (nodo ? nodos.current.set('resumen', nodo) : nodos.current.delete('resumen'))}>
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
                pregunta={p}
                numero={i + 1}
                elegidos={elegidosDe(p)}
                onCambio={(elegidos) => cambiar(p, elegidos)}
                registrar={registrar}
              />
            ))}
          </>
        )}
      </div>

      {pdfAbierto && datos && (
        <DescargarPdf
          datos={datos}
          eleccion={Object.fromEntries(datos.preguntas.map((p) => [p.id, elegidosDe(p)]))}
          nodos={nodos}
          onCerrar={() => setPdfAbierto(false)}
        />
      )}
    </main>
  )
}

export default DetalleCuestionario
