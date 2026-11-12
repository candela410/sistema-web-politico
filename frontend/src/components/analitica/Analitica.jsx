import { useEffect, useState } from 'react'
import { FileDown } from 'lucide-react'
import { obtenerResumenAnalitica, urlGraficoAnalitica } from '../../api/analitica'
import Modal from '../comunes/Modal'
import './analitica.css'

// Dashboard: los gráficos del Módulo de Analítica de la campaña activa. Los
// genera el servidor con pandas, numpy y matplotlib (las mismas funciones que
// analitica/analitica.py), así que muestran los datos de este momento. Las
// fechas se aplican con el botón, para no regenerar todas las imágenes en cada
// tecla. "Descargar PDF" abre un cartel para elegir qué gráficos incluir.

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

function Grafico({ grafico, url, mensajeError = 'No se pudo generar el gráfico.' }) {
  // El estado se reinicia solo cuando cambia la imagen (la clave del componente es la url)
  const [estado, setEstado] = useState('cargando')
  const [motivo, setMotivo] = useState('')

  // Si la imagen no se pudo generar, se pide de nuevo para leer el motivo que da el servidor
  function fallo() {
    setEstado('error')
    fetch(url, { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((r) => r.error && setMotivo(r.error))
      .catch(() => {})
  }
  return (
    <figure className={`tarjeta-form analitica__grafico analitica__grafico--${grafico.clave}`}>
      <figcaption className="analitica__pie">
        <span>
          <strong>{grafico.titulo}</strong>
          <small>{grafico.pregunta}</small>
        </span>
      </figcaption>
      <div className={`analitica__imagen analitica__imagen--${estado}`}>
        {estado === 'error' && <p className="aviso-info">{motivo || mensajeError}</p>}
        <img
          src={url}
          alt={`${grafico.titulo}: ${grafico.pregunta}`}
          onLoad={() => setEstado('listo')}
          onError={fallo}
        />
      </div>
    </figure>
  )
}

// Cartel para elegir qué gráficos van en el PDF (todos marcados al abrir)
function ElegirGraficosPdf({ graficos, onDescargar, onCerrar }) {
  const [elegidos, setElegidos] = useState(() => new Set(graficos.map((g) => g.clave)))
  const [generando, setGenerando] = useState(false)
  const todos = elegidos.size === graficos.length
  const alternar = (clave) =>
    setElegidos((actual) => {
      const nuevo = new Set(actual)
      if (nuevo.has(clave)) nuevo.delete(clave)
      else nuevo.add(clave)
      return nuevo
    })

  async function descargar() {
    setGenerando(true)
    await onDescargar(graficos.filter((g) => elegidos.has(g.clave)))
    setGenerando(false)
  }

  return (
    <Modal titulo="Descargar PDF" onCerrar={onCerrar}>
      <p className="modal__texto">Seleccione los gráficos que desea incluir en el informe.</p>
      <label className="casilla-texto pdf-elegir__todos">
        <input
          type="checkbox"
          checked={todos}
          onChange={() => setElegidos(todos ? new Set() : new Set(graficos.map((g) => g.clave)))}
        />
        <span>Todos los gráficos</span>
      </label>
      <ul className="pdf-elegir">
        {graficos.map((g) => (
          <li key={g.clave}>
            <label className="casilla-texto">
              <input type="checkbox" checked={elegidos.has(g.clave)} onChange={() => alternar(g.clave)} />
              <span>
                <b>{g.titulo}</b>
                <small>{g.pregunta}</small>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="acciones">
        <button type="button" className="boton boton--borde" onClick={onCerrar}>
          Cancelar
        </button>
        <button type="button" className="boton" onClick={descargar} disabled={elegidos.size === 0 || generando}>
          {generando ? 'Generando…' : `Descargar ${elegidos.size === 1 ? '1 gráfico' : `${elegidos.size} gráficos`}`}
        </button>
      </div>
    </Modal>
  )
}

function Analitica({ usuario }) {
  const [filtros, setFiltros] = useState(VACIOS)
  const [aplicados, setAplicados] = useState({ ...VACIOS, version: 0 })
  const [resumen, setResumen] = useState(null)
  const [error, setError] = useState('')
  const [eligiendoPdf, setEligiendoPdf] = useState(false)
  const [errorPdf, setErrorPdf] = useState('')

  useEffect(() => {
    const { version, ...pedido } = aplicados
    let vigente = true
    obtenerResumenAnalitica(pedido)
      .then((r) => {
        if (!vigente) return
        setResumen({ ...r, version })
        setError('')
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

  // Gráficos que se pueden incluir en el PDF (si hay encuestas en el período)
  const paraPdf = resumen?.encuestas > 0 ? GRAFICOS.map((g) => ({ ...g, url: urlDe(g.clave) })) : []

  async function descargarElegidos(lista) {
    await pdf(lista, lista.length === 1 ? `${lista[0].clave}.pdf` : 'dashboard.pdf')
    setEligiendoPdf(false)
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
        {paraPdf.length > 0 && (
          <button type="button" className="boton pagina__accion" onClick={() => setEligiendoPdf(true)}>
            <FileDown size={18} aria-hidden="true" />
            Descargar PDF
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
                  <Grafico key={`${g.clave}-${version}`} grafico={g} url={urlDe(g.clave)} />
                ))}
              </div>
            </>
          )}
        </>
      )}
      {eligiendoPdf && (
        <ElegirGraficosPdf graficos={paraPdf} onDescargar={descargarElegidos} onCerrar={() => setEligiendoPdf(false)} />
      )}
    </main>
  )
}

export default Analitica
