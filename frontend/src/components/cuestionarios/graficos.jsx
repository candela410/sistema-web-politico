// Gráficos de las estadísticas. Cada pregunta puede mostrar varios; la persona
// elige cuáles en la pantalla de Estadísticas (ver CATALOGO).

import { f } from './catalogoGraficos'

// Paleta categórica validada (orden fijo, nunca se recicla)
const CATEGORICOS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
const MAX_CATEGORIAS = CATEGORICOS.length
const GRIS_OTRAS = '#8a8794'
// Colores puestos como atributos del SVG (no por CSS) para que el PDF los conserve
const VIOLETA = '#51318f'
const TINTA = '#15121c'
const TINTA_SUAVE = '#5d5a66'
const GRILLA = '#ecebf0'
const BASE = '#c3c2cc'

// Cada opción con su color: sigue a la opción (su posición), no a su tamaño
function conColores(opciones) {
  return opciones.map((o, i) => ({ ...o, color: CATEGORICOS[i % MAX_CATEGORIAS] }))
}

// Más de 8 categorías con datos: las más chicas se juntan en "Otras"
function agrupar(opciones, total) {
  let partes = conColores(opciones).filter((o) => o.cantidad > 0)
  if (partes.length > MAX_CATEGORIAS) {
    const ordenadas = [...partes].sort((a, b) => b.cantidad - a.cantidad)
    const quedan = new Set(ordenadas.slice(0, MAX_CATEGORIAS - 1).map((o) => o.id))
    const resto = partes.filter((o) => !quedan.has(o.id))
    partes = [
      ...partes.filter((o) => quedan.has(o.id)),
      { id: 'otras', texto: 'Otras', color: GRIS_OTRAS, cantidad: resto.reduce((a, o) => a + o.cantidad, 0) },
    ]
  }
  return partes.map((o) => ({ ...o, parte: total ? (100 * o.cantidad) / total : 0 }))
}

const textoSobre = (color) => (color === '#eda100' ? '#0b0b0b' : '#fff')

// --- Barras horizontales ---------------------------------------------------

export function Barras({ opciones }) {
  const maximo = Math.max(...opciones.map((o) => o.cantidad), 1)
  return (
    <div className="barras">
      {opciones.map((o) => (
        <div key={o.id} className="barras__fila" title={`${o.texto}: ${f(o.cantidad)} (${f(o.porcentaje)} %)`}>
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

// --- Columnas / histograma ---------------------------------------------------

function escalaY(maximo) {
  const paso = maximo <= 5 ? 1 : Math.ceil(maximo / 4)
  const tope = Math.max(paso, Math.ceil(maximo / paso) * paso)
  const marcas = []
  for (let v = 0; v <= tope; v += paso) marcas.push(v)
  return { tope, marcas }
}

const recortar = (texto, n) => (texto.length > n ? `${texto.slice(0, n - 1)}…` : texto)

function Ejes({ marcas, y, m, ancho }) {
  return marcas.map((v) => (
    <g key={v}>
      <line x1={m.izquierda} x2={ancho - m.derecha} y1={y(v)} y2={y(v)} stroke={v === 0 ? BASE : GRILLA} strokeWidth="1" />
      <text x={m.izquierda - 8} y={y(v)} fill={TINTA_SUAVE} fontSize="12" textAnchor="end" dominantBaseline="middle">
        {f(v)}
      </text>
    </g>
  ))
}

export function Columnas({ opciones, enunciado }) {
  const ancho = 640
  const alto = 250
  const m = { arriba: 22, derecha: 8, abajo: 40, izquierda: 36 }
  const zonaAncho = ancho - m.izquierda - m.derecha
  const zonaAlto = alto - m.arriba - m.abajo
  const { tope, marcas } = escalaY(Math.max(...opciones.map((o) => o.cantidad), 1))
  const paso = zonaAncho / opciones.length
  const anchoColumna = Math.min(56, paso - 2)
  const y = (v) => m.arriba + zonaAlto - (zonaAlto * v) / tope
  const largoEtiqueta = Math.max(4, Math.floor(paso / 7))

  return (
    <svg className="grafico-svg" viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label={`Columnas de ${enunciado}`}>
      <Ejes marcas={marcas} y={y} m={m} ancho={ancho} />
      {opciones.map((o, i) => {
        const x = m.izquierda + i * paso + (paso - anchoColumna) / 2
        const r = Math.min(4, y(0) - y(o.cantidad))
        return (
          <g key={o.id}>
            <title>{`${o.texto}: ${f(o.cantidad)} (${f(o.porcentaje)} %)`}</title>
            <rect x={m.izquierda + i * paso} y={m.arriba} width={paso} height={zonaAlto} fill="transparent" />
            {o.cantidad > 0 && (
              <>
                <path
                  className="histograma__columna"
                  fill={VIOLETA}
                  d={`M${x},${y(0)} V${y(o.cantidad) + r} q0,-${r} ${r},-${r} H${x + anchoColumna - r} q${r},0 ${r},${r} V${y(0)} Z`}
                />
                <text x={x + anchoColumna / 2} y={y(o.cantidad) - 6} fill={TINTA} fontSize="12" fontWeight="700" textAnchor="middle">
                  {f(o.cantidad)}
                </text>
              </>
            )}
            <text x={x + anchoColumna / 2} y={alto - m.abajo + 18} fill={TINTA_SUAVE} fontSize="12" textAnchor="middle">
              {recortar(o.texto, largoEtiqueta)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// --- Polígono de frecuencias (cuantitativa) -----------------------------------

export function Linea({ opciones, enunciado }) {
  const ancho = 640
  const alto = 250
  const m = { arriba: 24, derecha: 24, abajo: 40, izquierda: 36 }
  const zonaAncho = ancho - m.izquierda - m.derecha
  const zonaAlto = alto - m.arriba - m.abajo
  const { tope, marcas } = escalaY(Math.max(...opciones.map((o) => o.cantidad), 1))
  const x = (i) => m.izquierda + (opciones.length === 1 ? zonaAncho / 2 : (zonaAncho * i) / (opciones.length - 1))
  const y = (v) => m.arriba + zonaAlto - (zonaAlto * v) / tope
  const puntos = opciones.map((o, i) => `${x(i)},${y(o.cantidad)}`).join(' ')

  return (
    <svg className="grafico-svg" viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label={`Polígono de frecuencias de ${enunciado}`}>
      <Ejes marcas={marcas} y={y} m={m} ancho={ancho} />
      <polyline points={puntos} fill="none" stroke={VIOLETA} strokeWidth="2" strokeLinejoin="round" />
      {opciones.map((o, i) => (
        <g key={o.id}>
          <title>{`${o.texto}: ${f(o.cantidad)} (${f(o.porcentaje)} %)`}</title>
          <circle cx={x(i)} cy={y(o.cantidad)} r="14" fill="transparent" />
          <circle cx={x(i)} cy={y(o.cantidad)} r="5" fill={VIOLETA} stroke="#fff" strokeWidth="2" />
          <text x={x(i)} y={y(o.cantidad) - 10} fill={TINTA} fontSize="12" fontWeight="700" textAnchor="middle">
            {f(o.cantidad)}
          </text>
          <text x={x(i)} y={alto - m.abajo + 18} fill={TINTA_SUAVE} fontSize="12" textAnchor="middle">
            {o.texto}
          </text>
        </g>
      ))}
    </svg>
  )
}

// --- Torta (cualitativa) -------------------------------------------------------

function Leyenda({ partes }) {
  return (
    <ul className="leyenda">
      {partes.map((o) => (
        <li key={o.id}>
          <span className="leyenda__muestra" style={{ background: o.color }} />
          {o.texto} <b>{f(Math.round(o.parte * 10) / 10)} %</b>
        </li>
      ))}
    </ul>
  )
}

export function Torta({ opciones, total, enunciado }) {
  const partes = agrupar(opciones, total)
  if (!partes.length) return null
  const radio = 90
  const centro = 100
  // Ángulo donde empieza cada sector: suma de los anteriores, desde arriba
  const sectores = partes.map((o, i) => {
    const previo = partes.slice(0, i).reduce((a, x) => a + x.cantidad, 0)
    const inicio = -Math.PI / 2 + (2 * Math.PI * previo) / total
    const barrido = (2 * Math.PI * o.cantidad) / total
    return { ...o, inicio, fin: inicio + barrido, medio: inicio + barrido / 2, barrido }
  })
  const punto = (a, r = radio) => [centro + r * Math.cos(a), centro + r * Math.sin(a)]

  return (
    <div className="torta">
      <svg className="torta__svg" viewBox="0 0 200 200" role="img" aria-label={`Torta de ${enunciado}`}>
        {sectores.length === 1 ? (
          <circle cx={centro} cy={centro} r={radio} fill={sectores[0].color} />
        ) : (
          sectores.map((s) => {
            const [x1, y1] = punto(s.inicio)
            const [x2, y2] = punto(s.fin)
            const grande = s.barrido > Math.PI ? 1 : 0
            return (
              <path
                key={s.id}
                d={`M${centro},${centro} L${x1},${y1} A${radio},${radio} 0 ${grande} 1 ${x2},${y2} Z`}
                fill={s.color}
                stroke="#fff"
                strokeWidth="2"
              >
                <title>{`${s.texto}: ${f(s.cantidad)} (${f(Math.round(s.parte * 10) / 10)} %)`}</title>
              </path>
            )
          })
        )}
        {sectores
          .filter((s) => s.parte >= 8)
          .map((s) => {
            const [x, y] = punto(s.medio, radio * 0.62)
            return (
              <text key={s.id} x={x} y={y} fontSize="12" fontWeight="700" fill={textoSobre(s.color)} textAnchor="middle" dominantBaseline="middle">
                {f(Math.round(s.parte))} %
              </text>
            )
          })}
      </svg>
      <Leyenda partes={partes} />
    </div>
  )
}

// --- Barra 100 % (cualitativa, una sola opción) ---------------------------------

export function Distribucion({ opciones, total }) {
  const partes = agrupar(opciones, total)
  if (!partes.length) return null
  return (
    <div className="distribucion">
      <div className="distribucion__barra">
        {partes.map((o) => (
          <span
            key={o.id}
            className="distribucion__parte"
            style={{ flexGrow: o.cantidad, background: o.color, color: textoSobre(o.color) }}
            title={`${o.texto}: ${f(Math.round(o.parte * 10) / 10)} %`}
          >
            {o.parte >= 12 && `${f(Math.round(o.parte))} %`}
          </span>
        ))}
      </div>
      <Leyenda partes={partes} />
    </div>
  )
}

// --- Tabla de frecuencias ----------------------------------------------------------

export function Tabla({ opciones, total, acumuladas }) {
  const acumulado = opciones.map((_, i) => opciones.slice(0, i + 1).reduce((a, o) => a + o.cantidad, 0))
  const pct = (n) => (total ? f(Math.round((1000 * n) / total) / 10) : 0)
  return (
    <div className="tabla-envoltura">
      <table className="tabla-frecuencias">
        <thead>
          <tr>
            <th scope="col">{acumuladas ? 'Valor' : 'Opción'}</th>
            <th scope="col" title="Frecuencia absoluta">fi</th>
            <th scope="col" title="Frecuencia relativa">fr %</th>
            {acumuladas && (
              <>
                <th scope="col" title="Frecuencia absoluta acumulada">Fi</th>
                <th scope="col" title="Frecuencia relativa acumulada">Fr %</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {opciones.map((o, i) => (
            <tr key={o.id}>
              <th scope="row">{o.texto}</th>
              <td>{f(o.cantidad)}</td>
              <td>{pct(o.cantidad)}</td>
              {acumuladas && (
                <>
                  <td>{f(acumulado[i])}</td>
                  <td>{pct(acumulado[i])}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td>{f(total)}</td>
            <td>100</td>
            {acumuladas && <td colSpan="2" />}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// --- Medidas (cuantitativa) ----------------------------------------------------------

export function Dato({ etiqueta, valor }) {
  return (
    <div className="dato">
      <span className="dato__valor">{valor}</span>
      <span className="dato__etiqueta">{etiqueta}</span>
    </div>
  )
}

export function Medidas({ medidas }) {
  if (!medidas) return null
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

// Dibuja el gráfico pedido para una pregunta
export function Grafico({ clave, pregunta }) {
  const props = { opciones: pregunta.opciones, enunciado: pregunta.enunciado, total: pregunta.elecciones }
  switch (clave) {
    case 'barras':
      return <Barras {...props} />
    case 'columnas':
      return <Columnas {...props} />
    case 'linea':
      return <Linea {...props} />
    case 'torta':
      return <Torta {...props} />
    case 'distribucion':
      return <Distribucion {...props} />
    case 'tabla':
      return <Tabla {...props} acumuladas={pregunta.variable === 'cuantitativa'} />
    case 'medidas':
      return <Medidas medidas={pregunta.medidas} />
    default:
      return null
  }
}
