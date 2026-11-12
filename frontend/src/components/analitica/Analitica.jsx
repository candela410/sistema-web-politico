import { useEffect, useState } from 'react'
import { FileDown } from 'lucide-react'
import { obtenerResumenAnalitica, urlGraficoAnalitica } from '../../api/analitica'
import './analitica.css'

// Dashboard: los gráficos del Módulo de Analítica de la campaña activa. Los
// genera el servidor con pandas, numpy y matplotlib (las mismas funciones que
// analitica/analitica.py), así que muestran los datos de este momento. Las
// fechas se aplican con el botón, para no regenerar todas las imágenes en cada
// tecla. Cada gráfico (o todos juntos) se descarga en PDF.

const GRAFICOS = [
  {
    clave: 'dashboard',
    titulo: 'Tablero de la campaña',
    pregunta: 'Resumen: totales, encuestas por equipo, militantes que más cargaron y días de mayor actividad.',
  },
  {
    clave: 'periodo',
    titulo: 'Encuestas por período',
    pregunta: '¿Cuántas encuestas se cargan por día, semana o mes (según el rango elegido)?',
  },
  {
    clave: 'evolucion',
    titulo: 'Evolución de las encuestas',
    pregunta: '¿Cómo crecen las encuestas cargadas y a cuánto se llegaría al ritmo actual?',
  },
  { clave: 'heatmap', titulo: 'Días y horarios', pregunta: '¿En qué días y horarios se encuesta más?' },
  { clave: 'donut', titulo: 'Participación por equipo', pregunta: '¿Qué parte del total aportó cada equipo?' },
]

const VACIOS = { desde: '', hasta: '' }
const fecha = (iso) => new Date(`${iso}T00:00`).toLocaleDateString('es-AR')
const nombreDe = (u) => [u.nombre, u.apellido].filter(Boolean).join(' ') || u.email

function Grafico({ grafico, url, onPdf, mensajeError = 'No se pudo generar el gráfico.' }) {
  // El estado se reinicia solo cuando cambia la imagen (la clave del componente es la url)
  const [estado, setEstado] = useState('cargando')
  const [descargando, setDescargando] = useState(false)

  async function pdf() {
    setDescargando(true)
    try {
      await onPdf()
    } finally {
      setDescargando(false)
    }
  }

  return (
    <figure className={`tarjeta-form analitica__grafico analitica__grafico--${grafico.clave}`}>
      <figcaption className="analitica__pie">
        <span>
          <strong>{grafico.titulo}</strong>
          <small>{grafico.pregunta}</small>
        </span>
        {estado === 'listo' && (
          <button type="button" className="boton boton--borde boton--chico" onClick={pdf} disabled={descargando}>
            <FileDown size={15} aria-hidden="true" />
            {descargando ? 'Generando…' : 'PDF'}
          </button>
        )}
      </figcaption>
      <div className={`analitica__imagen analitica__imagen--${estado}`}>
        {estado === 'error' && <p className="aviso-info">{mensajeError}</p>}
        <img
          src={url}
          alt={`${grafico.titulo}: ${grafico.pregunta}`}
          onLoad={() => setEstado('listo')}
          onError={() => setEstado('error')}
        />
      </div>
    </figure>
  )
}

function Analitica({ usuario }) {
  const [filtros, setFiltros] = useState(VACIOS)
  const [aplicados, setAplicados] = useState({ ...VACIOS, version: 0 })
  const [resumen, setResumen] = useState(null)
  const [error, setError] = useState('')
  const [elegidos, setElegidos] = useState({ cuestionario: '', zona: '' })
  const [descargandoTodo, setDescargandoTodo] = useState(false)
  const [errorPdf, setErrorPdf] = useState('')

  useEffect(() => {
    const { version, ...pedido } = aplicados
    let vigente = true
    obtenerResumenAnalitica(pedido)
      .then((r) => {
        if (!vigente) return
        setResumen({ ...r, version })
        setError('')
        // Por defecto, el primer cuestionario de la campaña
        setElegidos((e) => (e.cuestionario || !r.cuestionarios.length ? e : { ...e, cuestionario: String(r.cuestionarios[0].id) }))
      })
      .catch((e) => vigente && (setResumen(null), setError(e.message)))
    return () => {
      vigente = false
    }
  }, [aplicados])

  const cambiar = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value }))
  const aplicar = (e) => {
    e.preventDefault()
    setAplicados((a) => ({ ...filtros, version: a.version + 1 }))
  }
  const limpiar = () => {
    setFiltros(VACIOS)
    setAplicados((a) => ({ ...VACIOS, version: a.version + 1 }))
  }
  const hayFiltros = Object.values(filtros).some(Boolean)
  // Sin cambios respecto de lo aplicado, "Aplicar" no hace nada
  const sinCambios = filtros.desde === aplicados.desde && filtros.hasta === aplicados.hasta
  const version = aplicados.version

  const periodo = resumen?.desde ? `${fecha(resumen.desde)} al ${fecha(resumen.hasta)}` : ''
  const urlDe = (clave) => urlGraficoAnalitica(clave, { desde: resumen.desde, hasta: resumen.hasta, v: version })
  const urlRespuestas = elegidos.cuestionario
    ? urlGraficoAnalitica('respuestas', { cuestionario: elegidos.cuestionario, zona: elegidos.zona })
    : ''
  const cuestionario = resumen?.cuestionarios.find((c) => String(c.id) === elegidos.cuestionario)
  const zona = resumen?.zonas.find((z) => String(z.id) === elegidos.zona)
  const graficoRespuestas = {
    clave: 'respuestas',
    titulo: 'Respuestas por zona',
    pregunta: `Respuestas de «${cuestionario?.titulo ?? ''}» ${zona ? `en ${zona.nombre}` : 'en todas las zonas'}.`,
  }

  async function pdf(lista, archivo) {
    setErrorPdf('')
    try {
      // jsPDF se carga recién al descargar (no pesa en la carga de la pantalla)
      const { descargarGraficosPdf } = await import('./pdf')
      await descargarGraficosPdf({
        titulo: lista.length === 1 ? lista[0].titulo : 'Dashboard de la campaña',
        campana: usuario.campana?.nombre ?? '',
        periodo,
        generadoPor: nombreDe(usuario),
        graficos: lista,
        archivo,
      })
    } catch (e) {
      setErrorPdf(e.message || 'No se pudo generar el PDF.')
    }
  }

  async function descargarTodo() {
    setDescargandoTodo(true)
    await pdf(GRAFICOS.map((g) => ({ ...g, url: urlDe(g.clave) })), 'dashboard.pdf')
    setDescargandoTodo(false)
  }

  return (
    <main className="pagina pagina--ancha">
      <header className="pagina__encabezado">
        <div>
          <h1>Dashboard</h1>
          <p>Gráficos de {usuario.campana?.nombre ?? 'la campaña'} con los datos de este momento.</p>
          <span className="franja-corta" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
        {resumen?.encuestas > 0 && (
          <button type="button" className="boton pagina__accion" onClick={descargarTodo} disabled={descargandoTodo}>
            <FileDown size={18} aria-hidden="true" />
            {descargandoTodo ? 'Generando PDF…' : 'Descargar todo en PDF'}
          </button>
        )}
      </header>

      <form className="analitica__filtros" onSubmit={aplicar} aria-label="Filtros">
        <label>
          Desde
          <input className="entrada" type="date" value={filtros.desde} max={filtros.hasta || undefined} onChange={cambiar('desde')} />
        </label>
        <label>
          Hasta
          <input className="entrada" type="date" value={filtros.hasta} min={filtros.desde || undefined} onChange={cambiar('hasta')} />
        </label>
        <div className="analitica__acciones">
          {hayFiltros && (
            <button type="button" className="boton boton--borde" onClick={limpiar}>
              Limpiar
            </button>
          )}
          <button type="submit" className="boton" disabled={sinCambios}>
            Aplicar
          </button>
        </div>
      </form>

      {errorPdf && (
        <p className="aviso-error" role="alert">
          {errorPdf}
        </p>
      )}

      {error ? (
        <p className="aviso-error" role="alert">
          {error}
        </p>
      ) : !resumen ? (
        <p className="vacio-tarjeta">Cargando…</p>
      ) : (
        <>
          {resumen.encuestas === 0 ? (
            <p className="aviso-info">
              No hay encuestas cargadas{periodo ? ` entre el ${fecha(resumen.desde)} y el ${fecha(resumen.hasta)}` : ' en esta campaña'}.
              Los gráficos se mostrarán cuando se carguen encuestas.
            </p>
          ) : (
            <>
              <p className="analitica__periodo">
                {resumen.encuestas === 1 ? '1 encuesta' : `${resumen.encuestas.toLocaleString('es-AR')} encuestas`} del{' '}
                {periodo}
              </p>
              <div className="analitica__graficos">
                {GRAFICOS.map((g) => (
                  <Grafico
                    key={`${g.clave}-${version}`}
                    grafico={g}
                    url={urlDe(g.clave)}
                    onPdf={() => pdf([{ ...g, url: urlDe(g.clave) }], `${g.clave}.pdf`)}
                  />
                ))}
              </div>
            </>
          )}

          <section className="analitica__seccion" aria-labelledby="titulo-respuestas">
            <h2 id="titulo-respuestas">Respuestas de un cuestionario por zona</h2>
            {resumen.cuestionarios.length === 0 ? (
              <p className="aviso-info">La campaña todavía no tiene cuestionarios.</p>
            ) : (
              <>
                <div className="analitica__filtros analitica__filtros--respuestas">
                  <label>
                    Cuestionario
                    <select
                      className="entrada"
                      value={elegidos.cuestionario}
                      onChange={(e) => setElegidos((x) => ({ ...x, cuestionario: e.target.value }))}
                    >
                      {resumen.cuestionarios.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.titulo}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Zona
                    <select
                      className="entrada"
                      value={elegidos.zona}
                      onChange={(e) => setElegidos((x) => ({ ...x, zona: e.target.value }))}
                    >
                      <option value="">Todas las zonas</option>
                      {resumen.zonas.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {urlRespuestas && (
                  <Grafico
                    key={urlRespuestas}
                    grafico={graficoRespuestas}
                    url={urlRespuestas}
                    mensajeError="No hay respuestas con ubicación para ese cuestionario en esa zona."
                    onPdf={() => pdf([{ ...graficoRespuestas, url: urlRespuestas }], 'respuestas-por-zona.pdf')}
                  />
                )}
              </>
            )}
          </section>
        </>
      )}
    </main>
  )
}

export default Analitica
