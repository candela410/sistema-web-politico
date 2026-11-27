// Dashboard → "Respuestas por zona y cuestionario" (igual que en la web).
// Se elige una zona y un cuestionario y se ven sus preguntas con lo que se
// respondió. Cada encuesta cuenta en la zona donde se cargó,
// según su ubicación GPS. Cada opción muestra la cantidad,
// el porcentaje y una barra para comparar de un vistazo.
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import { obtenerRespuestasPorZona, urlGraficoZona } from '../../api/analitica'
import ImagenApi from '../../ui/ImagenApi'
import { useTema } from '../../tema/tema'
import { Selector, Tarjeta, Texto, TextoError, VacioTarjeta } from '../../ui'

const cuantas = (n) => (n === 1 ? '1 encuesta' : `${n.toLocaleString('es-AR')} encuestas`)

// Gráfico de una pregunta con las respuestas de la zona: torta si es de una
// sola opción, barras si es de opción múltiple (lo dibuja el servidor)
function Pregunta({ pregunta, url }) {
  return (
    <Tarjeta style={{ gap: 10 }}>
      <Texto estilo="negrita">
        {pregunta.orden}. {pregunta.enunciado}
      </Texto>
      <Texto estilo="chico">
        {pregunta.respuestas.toLocaleString('es-AR')} {pregunta.respuestas === 1 ? 'respuesta' : 'respuestas'}
        {pregunta.multiple ? ' · opción múltiple: cada persona puede elegir varias.' : ''}
      </Texto>
      {pregunta.respuestas === 0 ? (
        <Texto estilo="suave">Nadie respondió esta pregunta en las zonas elegidas.</Texto>
      ) : (
        <ImagenApi
          url={url}
          etiqueta={`Respuestas de «${pregunta.enunciado}»: ${pregunta.opciones.map((o) => `${o.texto} ${o.cantidad}`).join(', ')}`}
        />
      )}
    </Tarjeta>
  )
}

// Hasta cuántas zonas se comparan a la vez (igual que el backend)
const MAXIMO_ZONAS = 6

export default function RespuestasPorZona({ zonas, cuestionarios }) {
  const { c } = useTema()
  // Zonas elegidas, en el orden en que se marcaron
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
    datos && datos.zonas.map((z) => z.id).join(',') === zona && String(datos.cuestionario.id) === String(cuestionario)
  const aviso = { backgroundColor: c.superficie2, padding: 12, borderRadius: 10, gap: 6 }

  return (
    <View style={{ gap: 12, marginTop: 12 }}>
      <Texto estilo="subtitulo" accessibilityRole="header">
        Respuestas por zona y cuestionario
      </Texto>
      <Texto estilo="suave">
        Cada encuesta cuenta en la zona donde se cargó, según la ubicación GPS del celular. Elija varias zonas para
        comparar sus respuestas. Las cargadas sin GPS (por ejemplo, desde la web) no tienen zona. Esta consulta no usa las
        fechas de arriba.
      </Texto>
      <Tarjeta>
        <Texto estilo="etiqueta">Zonas * (hasta {MAXIMO_ZONAS})</Texto>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {zonas.map((z) => {
            const id = String(z.id)
            const marcada = elegidas.includes(id)
            const lleno = !marcada && elegidas.length >= MAXIMO_ZONAS
            return (
              <Pressable
                key={id}
                onPress={() => alternar(id)}
                disabled={lleno}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: marcada, disabled: lleno }}
                hitSlop={4}
                style={{
                  minHeight: 40,
                  paddingHorizontal: 14,
                  justifyContent: 'center',
                  borderRadius: 999,
                  borderWidth: 1.5,
                  borderColor: marcada ? c.violetaTexto : c.borde,
                  backgroundColor: marcada ? c.superficie2 : c.superficie,
                  opacity: lleno ? 0.5 : 1,
                }}
              >
                <Texto estilo={marcada ? 'negrita' : 'normal'} style={marcada ? { color: c.violetaTexto } : null}>
                  {marcada ? '✓ ' : ''}
                  {z.nombre}
                </Texto>
              </Pressable>
            )
          })}
        </View>
        <Selector
          etiqueta="Cuestionario *"
          valor={cuestionario}
          placeholder="Elegir cuestionario…"
          opciones={cuestionarios.map((q) => ({ valor: q.id, texto: q.titulo }))}
          onCambio={setCuestionario}
        />
      </Tarjeta>

      {!completo ? (
        <VacioTarjeta>Elija una o más zonas y un cuestionario para ver sus preguntas y respuestas.</VacioTarjeta>
      ) : error && !vigentes ? (
        <TextoError>{error}</TextoError>
      ) : !vigentes ? (
        <VacioTarjeta>Cargando…</VacioTarjeta>
      ) : datos.encuestas === 0 ? (
        <View style={aviso} accessibilityRole="alert">
          <Texto>
            No hay resultados: no se cargaron encuestas de «{datos.cuestionario.titulo}» dentro de{' '}
            {datos.zonas.map((z) => z.nombre).join(', ')} (según el GPS).
          </Texto>
          {datos.reparto.length > 0 && <Texto estilo="negrita">Dónde se cargó este cuestionario:</Texto>}
          {datos.reparto.map((r) => (
            <Texto key={r.zona}>
              • {r.zona}: {cuantas(r.encuestas)}
            </Texto>
          ))}
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }} accessibilityLabel="Encuestas por zona">
            {datos.zonas.map((z) => (
              <View key={z.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: z.color }} />
                <Texto>
                  {z.nombre}: <Texto estilo="negrita">{cuantas(z.encuestas)}</Texto>
                </Texto>
              </View>
            ))}
          </View>
          {elegidas.length > 1 && (
            <Texto estilo="chico">
              Cada barra es el porcentaje de las encuestas de esa zona que eligió la opción, así se comparan zonas con
              distinta cantidad de encuestas.
            </Texto>
          )}
          {datos.preguntas.map((p) => (
            <Pregunta
              key={`${p.id}-${zona}`}
              pregunta={p}
              url={urlGraficoZona(p.id, { zona, cuestionario, tema: c.oscuro ? 'oscuro' : '', v: datos.encuestas })}
            />
          ))}
        </>
      )}
    </View>
  )
}
