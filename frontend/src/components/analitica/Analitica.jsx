import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { obtenerResumenAnalitica, urlGraficoAnalitica } from '../../api/analitica'
import './analitica.css'

// Gráficos del Módulo de Analítica de la campaña activa. Los genera el servidor
// con pandas, numpy y matplotlib (las mismas funciones que analitica/analitica.py),
// así que muestran los datos de este momento. Los filtros se aplican con el
// botón, para no regenerar las cinco imágenes en cada tecla.

const GRAFICOS = [
  {
    clave: 'dashboard',
    titulo: 'Tablero de campaña',
    pregunta: 'Resumen: totales, avance de la meta, militantes que más cargaron y días de más actividad.',
  },
  { clave: 'barras', titulo: 'Encuestas por equipo', pregunta: '¿Cuántas encuestas carga cada equipo por semana?' },
  {
    clave: 'evolucion',
    titulo: 'Evolución y meta',
    pregunta: '¿Vamos a llegar a la meta? Poné una meta arriba para compararla con lo cargado.',
  },
  { clave: 'heatmap', titulo: 'Días y horarios', pregunta: '¿En qué días y horarios se encuesta más?' },
  { clave: 'donut', titulo: 'Participación por equipo', pregunta: '¿Qué parte del total aportó cada equipo?' },
]

const VACIOS = { desde: '', hasta: '', meta: '' }
const fecha = (iso) => new Date(`${iso}T00:00`).toLocaleDateString('es-AR')

function Grafico({ grafico, filtros, version }) {
  const [estado, setEstado] = useState('cargando')
  const url = urlGraficoAnalitica(grafico.clave, { ...filtros, v: version })

  return (
    <figure className={`tarjeta-form analitica__grafico analitica__grafico--${grafico.clave}`}>
      <figcaption className="analitica__pie">
        <span>
          <strong>{grafico.titulo}</strong>
          <small>{grafico.pregunta}</small>
        </span>
        {estado === 'listo' && (
          <a className="boton boton--borde boton--chico" href={url} download={`${grafico.clave}.png`}>
            <Download size={15} aria-hidden="true" />
            PNG
          </a>
        )}
      </figcaption>
      <div className={`analitica__imagen analitica__imagen--${estado}`}>
        {estado === 'error' && <p className="texto-error">No se pudo generar el gráfico.</p>}
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

  useEffect(() => {
    const { version, ...pedido } = aplicados
    let vigente = true
    obtenerResumenAnalitica({ desde: pedido.desde, hasta: pedido.hasta })
      .then((r) => vigente && (setResumen({ ...r, version }), setError('')))
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
  const { version, ...pedido } = aplicados

  return (
    <main className="pagina pagina--ancha">
      <header className="pagina__encabezado">
        <div>
          <h1>Analítica</h1>
          <p>Gráficos de {usuario.campana?.nombre ?? 'la campaña'} con los datos de este momento.</p>
          <span className="franja-corta" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
      </header>

      <form className="analitica__filtros" onSubmit={aplicar} aria-label="Filtros">
        <label>
          Desde
          <input className="entrada" type="date" value={filtros.desde} onChange={cambiar('desde')} />
        </label>
        <label>
          Hasta
          <input className="entrada" type="date" value={filtros.hasta} onChange={cambiar('hasta')} />
        </label>
        <label>
          Meta de encuestas
          <input
            className="entrada"
            type="number"
            min="1"
            step="1"
            placeholder="Opcional"
            value={filtros.meta}
            onChange={cambiar('meta')}
          />
        </label>
        <div className="analitica__acciones">
          {hayFiltros && (
            <button type="button" className="boton boton--borde" onClick={limpiar}>
              Limpiar
            </button>
          )}
          <button type="submit" className="boton">
            Aplicar
          </button>
        </div>
      </form>

      {error ? (
        <p className="aviso-error" role="alert">
          {error}
        </p>
      ) : !resumen ? (
        <p className="vacio-tarjeta">Cargando…</p>
      ) : resumen.encuestas === 0 ? (
        <p className="aviso-info">
          No hay encuestas cargadas
          {resumen.desde ? ` entre el ${fecha(resumen.desde)} y el ${fecha(resumen.hasta)}` : ' en esta campaña'}.
          Cuando los militantes carguen encuestas, acá vas a ver los gráficos.
        </p>
      ) : (
        <>
          <p className="analitica__periodo">
            {resumen.encuestas === 1 ? '1 encuesta' : `${resumen.encuestas.toLocaleString('es-AR')} encuestas`} del{' '}
            {fecha(resumen.desde)} al {fecha(resumen.hasta)}
          </p>
          <div className="analitica__graficos">
            {GRAFICOS.map((g) => (
              <Grafico
                key={`${g.clave}-${version}`}
                grafico={g}
                filtros={{ desde: resumen.desde, hasta: resumen.hasta, meta: pedido.meta }}
                version={version}
              />
            ))}
          </div>
        </>
      )}
    </main>
  )
}

export default Analitica
