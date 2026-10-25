import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { obtenerEstadisticas } from '../../api/encuestas'
import './cuestionarios.css'

// "Ver detalle" de un cuestionario: resumen y estadísticas de cada pregunta.
// Variable cualitativa (opciones con texto): barras de frecuencia y, si es de
// una sola opción, la distribución en una barra 100 %.
// Variable cuantitativa (opciones numéricas): histograma de columnas sobre el
// eje ordenado de valores, medidas de resumen y tabla de frecuencias acumuladas.

const TIPOS = { una_opcion: 'Una sola opción', opcion_multiple: 'Opción múltiple' }

// Paleta categórica validada (orden fijo, nunca se recicla)
const CATEGORICOS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
const MAX_CATEGORIAS = CATEGORICOS.length

const formatoNumero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 })
const formatoFecha = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' })
const f = (n) => formatoNumero.format(n)
const plural = (n, uno, varios) => `${f(n)} ${n === 1 ? uno : varios}`

function Dato({ etiqueta, valor }) {
  return (
    <div className="dato">
      <span className="dato__valor">{valor}</span>
      <span className="dato__etiqueta">{etiqueta}</span>
    </div>
  )
}

// --- Cualitativa ---------------------------------------------------------

// Barras horizontales de frecuencia, una por opción
function BarrasFrecuencia({ opciones }) {
  const maximo = Math.max(...opciones.map((o) => o.cantidad), 1)
  return (
    <div className="barras">
      {opciones.map((o) => (
        <div
          key={o.id}
          className="barras__fila"
          title={`${o.texto}: ${plural(o.cantidad, 'persona', 'personas')} (${f(o.porcentaje)} %)`}
        >
          <span className="barras__texto">{o.texto}</span>
          <span className="barras__pista" aria-hidden="true">
            {o.cantidad > 0 && <span className="barras__barra" style={{ width: `${(100 * o.cantidad) / maximo}%` }} />}
          </span>
          <span className="barras__valor">
            <b>{f(o.porcentaje)} %</b>
            <small>{f(o.cantidad)}</small>
          </span>
        </div>
      ))}
    </div>
  )
}

// Barra 100 %: cómo se reparte el total entre las opciones (solo "una sola opción")
function Distribucion({ opciones }) {
  let partes = opciones.filter((o) => o.cantidad > 0)
  if (partes.length > MAX_CATEGORIAS) {
    const resto = partes.slice(MAX_CATEGORIAS - 1)
    partes = [
      ...partes.slice(0, MAX_CATEGORIAS - 1),
      {
        id: 'otras',
        texto: 'Otras',
        cantidad: resto.reduce((a, o) => a + o.cantidad, 0),
        porcentaje: resto.reduce((a, o) => a + o.porcentaje, 0),
      },
    ]
  }
  // El color sigue a la opción (su posición en el cuestionario), no a su tamaño
  const colorDe = (o) => (o.id === 'otras' ? '#8a8794' : CATEGORICOS[opciones.indexOf(o) % MAX_CATEGORIAS])
  if (!partes.length) return null
  return (
    <figure className="distribucion">
      <figcaption>Distribución de las respuestas</figcaption>
      <div className="distribucion__barra">
        {partes.map((o) => (
          <span
            key={o.id}
            className="distribucion__parte"
            // Texto oscuro sobre el amarillo, blanco sobre el resto
            style={{ flexGrow: o.cantidad, background: colorDe(o), color: colorDe(o) === '#eda100' ? '#0b0b0b' : '#fff' }}
            title={`${o.texto}: ${f(o.porcentaje)} %`}
          >
            {o.porcentaje >= 12 && `${f(Math.round(o.porcentaje))} %`}
          </span>
        ))}
      </div>
      <ul className="leyenda">
        {partes.map((o) => (
          <li key={o.id}>
            <span className="leyenda__muestra" style={{ background: colorDe(o) }} />
            {o.texto} <b>{f(o.porcentaje)} %</b>
          </li>
        ))}
      </ul>
    </figure>
  )
}

// --- Cuantitativa ---------------------------------------------------------

function escalaY(maximo) {
  const paso = maximo <= 5 ? 1 : Math.ceil(maximo / 4)
  const tope = Math.max(paso, Math.ceil(maximo / paso) * paso)
  const marcas = []
  for (let v = 0; v <= tope; v += paso) marcas.push(v)
  return { tope, marcas }
}

// Histograma: una columna por valor, en el eje ordenado de menor a mayor
function Histograma({ opciones, enunciado }) {
  const ancho = 640
  const alto = 240
  const m = { arriba: 22, derecha: 8, abajo: 34, izquierda: 36 }
  const zonaAncho = ancho - m.izquierda - m.derecha
  const zonaAlto = alto - m.arriba - m.abajo
  const { tope, marcas } = escalaY(Math.max(...opciones.map((o) => o.cantidad), 1))
  const paso = zonaAncho / opciones.length
  const anchoColumna = Math.min(56, paso - 2)
  const y = (v) => m.arriba + zonaAlto - (zonaAlto * v) / tope

  return (
    <figure className="histograma">
      <figcaption>Frecuencia de cada valor</figcaption>
      <svg viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label={`Histograma de ${enunciado}`}>
        {marcas.map((v) => (
          <g key={v}>
            <line
              x1={m.izquierda}
              x2={ancho - m.derecha}
              y1={y(v)}
              y2={y(v)}
              className={v === 0 ? 'histograma__base' : 'histograma__grilla'}
            />
            <text x={m.izquierda - 8} y={y(v)} className="histograma__eje" textAnchor="end" dominantBaseline="middle">
              {f(v)}
            </text>
          </g>
        ))}
        {opciones.map((o, i) => {
          const x = m.izquierda + i * paso + (paso - anchoColumna) / 2
          const h = y(0) - y(o.cantidad)
          return (
            <g key={o.id}>
              <title>{`Valor ${o.texto}: ${plural(o.cantidad, 'respuesta', 'respuestas')} (${f(o.porcentaje)} %)`}</title>
              {/* Zona de hover más grande que la columna */}
              <rect x={m.izquierda + i * paso} y={m.arriba} width={paso} height={zonaAlto} fill="transparent" />
              {o.cantidad > 0 && (
                <path
                  className="histograma__columna"
                  d={`M${x},${y(0)} V${y(o.cantidad) + Math.min(4, h)} q0,-${Math.min(4, h)} ${Math.min(4, h)},-${Math.min(4, h)} H${x + anchoColumna - Math.min(4, h)} q${Math.min(4, h)},0 ${Math.min(4, h)},${Math.min(4, h)} V${y(0)} Z`}
                />
              )}
              {o.cantidad > 0 && (
                <text x={x + anchoColumna / 2} y={y(o.cantidad) - 6} className="histograma__valor" textAnchor="middle">
                  {f(o.cantidad)}
                </text>
              )}
              <text x={x + anchoColumna / 2} y={alto - m.abajo + 18} className="histograma__eje" textAnchor="middle">
                {o.texto}
              </text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

function TablaFrecuencias({ opciones, total }) {
  const acumuladas = opciones.map((_, i) => opciones.slice(0, i + 1).reduce((a, o) => a + o.cantidad, 0))
  const porcentaje = (n) => (total ? f(Math.round((1000 * n) / total) / 10) : 0)
  return (
    <div className="tabla-envoltura">
      <table className="tabla-frecuencias">
        <caption>Tabla de frecuencias</caption>
        <thead>
          <tr>
            <th scope="col">Valor</th>
            <th scope="col" title="Frecuencia absoluta">fi</th>
            <th scope="col" title="Frecuencia relativa">fr %</th>
            <th scope="col" title="Frecuencia absoluta acumulada">Fi</th>
            <th scope="col" title="Frecuencia relativa acumulada">Fr %</th>
          </tr>
        </thead>
        <tbody>
          {opciones.map((o, i) => {
            const acumulada = acumuladas[i]
            return (
              <tr key={o.id}>
                <th scope="row">{o.texto}</th>
                <td>{f(o.cantidad)}</td>
                <td>{porcentaje(o.cantidad)}</td>
                <td>{f(acumulada)}</td>
                <td>{porcentaje(acumulada)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Medidas({ medidas }) {
  return (
    <div className="datos-grilla">
      <Dato etiqueta="Media" valor={f(medidas.media)} />
      <Dato etiqueta="Mediana" valor={f(medidas.mediana)} />
      <Dato etiqueta="Moda" valor={medidas.moda.length ? medidas.moda.map(f).join(' y ') : 'No hay'} />
      <Dato etiqueta="Desvío estándar" valor={f(medidas.desvio)} />
      <Dato etiqueta="Mínimo" valor={f(medidas.minimo)} />
      <Dato etiqueta="Máximo" valor={f(medidas.maximo)} />
      <Dato etiqueta="Rango" valor={f(medidas.rango)} />
    </div>
  )
}

// --- Tarjeta por pregunta -------------------------------------------------

function EstadisticaPregunta({ pregunta, numero }) {
  const cuantitativa = pregunta.variable === 'cuantitativa'
  const multiple = pregunta.tipo === 'opcion_multiple'
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
      ) : cuantitativa ? (
        <>
          <Histograma opciones={pregunta.opciones} enunciado={pregunta.enunciado} />
          {pregunta.medidas && <Medidas medidas={pregunta.medidas} />}
          <TablaFrecuencias opciones={pregunta.opciones} total={pregunta.elecciones} />
          {multiple && (
            <p className="texto-suave">
              Como se pueden elegir varias opciones, las medidas usan todos los valores elegidos ({f(pregunta.elecciones)}).
            </p>
          )}
        </>
      ) : (
        <>
          <BarrasFrecuencia opciones={pregunta.opciones} />
          {multiple ? (
            <p className="texto-suave">
              Cada persona pudo elegir varias opciones: los porcentajes son sobre {plural(pregunta.respondidas, 'persona', 'personas')} y
              pueden sumar más de 100 %.
            </p>
          ) : (
            <Distribucion opciones={pregunta.opciones} />
          )}
        </>
      )}
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
