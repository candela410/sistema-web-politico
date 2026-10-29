// Gráficos de las estadísticas. Cada pregunta puede mostrar varios; la persona
// elige cuáles en la pantalla de Estadísticas (ver CATALOGO).
// Los gráficos los dibuja el servidor con pandas y matplotlib (imágenes PNG);
// la tabla de frecuencias y las medidas se muestran como datos.

import { useState } from 'react'
import { f } from './catalogoGraficos'

const IMAGENES = new Set(['barras', 'columnas', 'linea', 'torta', 'distribucion'])

function Imagen({ cuestionario, pregunta, clave }) {
  const [estado, setEstado] = useState('cargando')
  return (
    <div className={`grafico-imagen grafico-imagen--${estado}`}>
      {estado === 'error' && <p className="texto-error">No se pudo dibujar el gráfico.</p>}
      <img
        src={`/api/cuestionarios/${cuestionario}/estadisticas/${pregunta.id}/${clave}.png`}
        alt={`Gráfico de ${pregunta.enunciado}`}
        onLoad={() => setEstado('listo')}
        onError={() => setEstado('error')}
      />
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
export function Grafico({ clave, pregunta, cuestionario }) {
  if (IMAGENES.has(clave)) return <Imagen cuestionario={cuestionario} pregunta={pregunta} clave={clave} />
  switch (clave) {
    case 'tabla':
      return <Tabla opciones={pregunta.opciones} total={pregunta.elecciones} acumuladas={pregunta.variable === 'cuantitativa'} />
    case 'medidas':
      return <Medidas medidas={pregunta.medidas} />
    default:
      return null
  }
}
