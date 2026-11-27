import { useEffect, useState } from 'react'
import { AppState, Pressable, ScrollView, View } from 'react-native'
import { router } from 'expo-router'
import { ArrowLeft, FileDown } from 'lucide-react-native'
import { pedirImagen } from '../../api/cliente'
import { obtenerEstadisticas } from '../../api/encuestas'
import { MARCA, useTema } from '../../tema/tema'
import { Acciones, Boton, Casilla, Fila, Modal, Texto, TextoError, VacioTarjeta, Text, estiloTarjeta } from '../../ui'
import ImagenApi from '../../ui/ImagenApi'
import { guardar, leer } from '../../util/almacen'
import { disponibles, f, plural, porDefecto } from './catalogoGraficos'
import { explicarGrafico } from './explicacion'
import { medidasHtml, tablaHtml } from './pdf'

// Estadísticas de un cuestionario. En cada pregunta se elige UN tipo de gráfico
// a la vez, y se puede descargar un PDF. Mientras la pantalla está a la vista,
// las estadísticas se vuelven a pedir cada 5 segundos.
const CADA = 5000
const IMAGENES = new Set(['barras', 'columnas', 'linea', 'torta', 'distribucion'])
const formatoFecha = (v) =>
  new Date(v).toLocaleString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const nombreDe = (pregunta, clave) => disponibles(pregunta).find((g) => g.clave === clave)?.nombre ?? clave
const urlGrafico = (cuestionario, pregunta, clave, version) =>
  `/api/cuestionarios/${cuestionario}/estadisticas/${pregunta.id}/${clave}.png?v=${version ?? 0}`

function leerEleccion(id) {
  try {
    return JSON.parse(leer(`graficos-cuestionario-${id}`)) ?? {}
  } catch {
    return {}
  }
}

function graficoDe(pregunta, guardado) {
  const validas = disponibles(pregunta).map((g) => g.clave)
  const candidatos = Array.isArray(guardado) ? guardado : [guardado]
  return candidatos.find((x) => validas.includes(x)) ?? porDefecto(pregunta)
}

export function Dato({ etiqueta, valor }) {
  const { c } = useTema()
  return (
    <View style={{ flexBasis: '30%', flexGrow: 1, backgroundColor: c.fondo, borderRadius: 10, padding: 10 }}>
      <Text style={{ color: c.texto, fontSize: 18, fontWeight: '800' }}>{valor}</Text>
      <Texto estilo="chico">{etiqueta}</Texto>
    </View>
  )
}

function Tabla({ opciones, total, acumuladas }) {
  const { c } = useTema()
  const acumulado = opciones.map((_, i) => opciones.slice(0, i + 1).reduce((a, o) => a + o.cantidad, 0))
  const pct = (n) => (total ? f(Math.round((1000 * n) / total) / 10) : 0)
  const col = (ancho, alinear = 'right') => ({ width: ancho, padding: 8, color: c.texto, textAlign: alinear })
  const cab = acumuladas ? ['Valor', 'fi', 'fr %', 'Fi', 'Fr %'] : ['Opción', 'fi', 'fr %']
  return (
    <ScrollView horizontal style={{ borderWidth: 1, borderColor: c.linea, borderRadius: 10 }}>
      <View>
        <View style={{ flexDirection: 'row', backgroundColor: c.superficie2 }}>
          {cab.map((t, i) => (
            <Text key={t} style={[col(i ? 64 : 170, i ? 'right' : 'left'), { fontWeight: '800' }]}>
              {t}
            </Text>
          ))}
        </View>
        {opciones.map((o, i) => (
          <View key={o.id} style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: c.linea }}>
            <Text style={[col(170, 'left'), { fontWeight: '600' }]}>{o.texto}</Text>
            <Text style={col(64)}>{f(o.cantidad)}</Text>
            <Text style={col(64)}>{pct(o.cantidad)}</Text>
            {acumuladas && (
              <>
                <Text style={col(64)}>{f(acumulado[i])}</Text>
                <Text style={col(64)}>{pct(acumulado[i])}</Text>
              </>
            )}
          </View>
        ))}
        <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: c.linea, backgroundColor: c.superficie2 }}>
          <Text style={[col(170, 'left'), { fontWeight: '800' }]}>Total</Text>
          <Text style={col(64)}>{f(total)}</Text>
          <Text style={col(64)}>100</Text>
        </View>
      </View>
    </ScrollView>
  )
}

function Medidas({ medidas }) {
  if (!medidas) return null
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Dato etiqueta="Media" valor={f(medidas.media)} />
      <Dato etiqueta="Mediana" valor={f(medidas.mediana)} />
      <Dato etiqueta="Moda" valor={medidas.moda.length ? medidas.moda.map(f).join(' y ') : 'No hay'} />
      <Dato etiqueta="Desvío estándar" valor={f(medidas.desvio)} />
      <Dato etiqueta="Mínimo" valor={f(medidas.minimo)} />
      <Dato etiqueta="Máximo" valor={f(medidas.maximo)} />
      <Dato etiqueta="Rango" valor={f(medidas.rango)} />
    </View>
  )
}

function Grafico({ clave, pregunta, cuestionario, version }) {
  if (IMAGENES.has(clave)) return <ImagenApi url={urlGrafico(cuestionario, pregunta, clave, version)} etiqueta={`Gráfico de ${pregunta.enunciado}`} />
  if (clave === 'tabla') return <Tabla opciones={pregunta.opciones} total={pregunta.elecciones} acumuladas={pregunta.variable === 'cuantitativa'} />
  if (clave === 'medidas') return <Medidas medidas={pregunta.medidas} />
  return null
}

function EstadisticaPregunta({ cuestionario, pregunta, numero, elegido, onCambio, version }) {
  const { c } = useTema()
  const cuantitativa = pregunta.variable === 'cuantitativa'
  return (
    <View style={{ ...estiloTarjeta(c), padding: 14, gap: 10 }}>
      <Fila gap={10} style={{ alignItems: 'flex-start' }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: MARCA.violeta, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>{numero}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Texto estilo="negrita" style={{ fontSize: 16 }}>
            {pregunta.enunciado}
          </Texto>
          <Texto estilo="chico">
            {plural(pregunta.respondidas, 'persona respondió', 'personas respondieron')}
            {pregunta.sin_responder > 0 && ` · ${f(pregunta.sin_responder)} sin responder`}
          </Texto>
        </View>
        <Text style={{ fontSize: 11, fontWeight: '800', color: cuantitativa ? c.azulTexto : c.magentaTexto }}>{cuantitativa ? 'Cuantitativa' : 'Cualitativa'}</Text>
      </Fila>
      {pregunta.respondidas === 0 ? (
        <Texto estilo="suave">Todavía no hay respuestas para esta pregunta.</Texto>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} accessibilityRole="radiogroup" accessibilityLabel="Tipo de gráfico a mostrar">
            {disponibles(pregunta).map((g) => {
              const marcado = elegido === g.clave
              return (
                <Pressable
                  key={g.nombre}
                  onPress={() => !marcado && onCambio(g.clave)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: marcado }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 999,
                    borderWidth: 1.5,
                    borderColor: marcado ? MARCA.violeta : c.borde,
                    backgroundColor: marcado ? MARCA.violeta : c.superficie,
                  }}
                >
                  <Text style={{ color: marcado ? '#fff' : c.texto, fontWeight: '600', fontSize: 13 }}>{g.nombre}</Text>
                </Pressable>
              )
            })}
          </ScrollView>
          <Texto estilo="chico" style={{ fontWeight: '700' }}>
            {nombreDe(pregunta, elegido)}
          </Texto>
          <Grafico clave={elegido} pregunta={pregunta} cuestionario={cuestionario} version={version} />
        </>
      )}
    </View>
  )
}

function DescargarPdf({ datos, eleccion, cuestionario, onCerrar }) {
  const { c } = useTema()
  const preguntas = datos.preguntas.filter((p) => p.respondidas > 0 && (eleccion[p.id] ?? []).length)
  const [incluir, setIncluir] = useState(() => {
    const todo = { resumen: true }
    for (const p of preguntas) for (const k of eleccion[p.id]) todo[`${p.id}:${k}`] = true
    return todo
  })
  const [conExplicacion, setConExplicacion] = useState(true)
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState('')
  const alternar = (k) => setIncluir((i) => ({ ...i, [k]: !i[k] }))
  const marcarTodo = (valor) => setIncluir((i) => Object.fromEntries(Object.keys(i).map((k) => [k, valor])))
  const cantidad = Object.entries(incluir).filter(([k, v]) => v && k !== 'resumen').length

  async function generar() {
    setGenerando(true)
    setError('')
    try {
      const { descargarPdf } = await import('./pdf')
      const total = datos.preguntas.length
      const lista = []
      for (const [i, p] of datos.preguntas.entries()) {
        const graficos = []
        for (const k of (eleccion[p.id] ?? []).filter((k) => incluir[`${p.id}:${k}`])) {
          let html = ''
          if (IMAGENES.has(k)) html = `<img src="${await pedirImagen(urlGrafico(cuestionario, p, k, datos.total_encuestas))}">`
          else if (k === 'tabla') html = tablaHtml(p.opciones, p.elecciones, p.variable === 'cuantitativa', f)
          else if (k === 'medidas') html = medidasHtml(p.medidas, f)
          graficos.push({ html, nombre: nombreDe(p, k), explicacion: conExplicacion ? explicarGrafico(p, k) : null })
        }
        lista.push({ ...p, numero: i + 1, total, graficos })
      }
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
        archivo: `informe-estadisticas-${nombre || 'cuestionario'}${conExplicacion ? '-explicado' : ''}.pdf`,
      })
      onCerrar()
    } catch (e) {
      setError(`No se pudo generar el PDF: ${e.message}`)
      setGenerando(false)
    }
  }

  const Radio = ({ marcada, onPress, titulo, detalle }) => (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: marcada }} style={{ flexDirection: 'row', gap: 10, paddingVertical: 6 }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: marcada ? MARCA.violeta : c.borde, alignItems: 'center', justifyContent: 'center' }}>
        {marcada && <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: MARCA.violeta }} />}
      </View>
      <View style={{ flex: 1 }}>
        <Texto estilo="negrita">{titulo}</Texto>
        <Texto estilo="chico">{detalle}</Texto>
      </View>
    </Pressable>
  )

  return (
    <Modal
      titulo="Descargar PDF"
      onCerrar={onCerrar}
      pie={
        <Acciones onCancelar={onCerrar}>
          <Boton
            titulo={generando ? 'Generando…' : `Descargar PDF${cantidad ? ` (${cantidad})` : ''}`}
            onPress={generar}
            cargando={generando}
          />
        </Acciones>
      }
    >
      <Texto estilo="suave" style={{ marginBottom: 8 }}>
        El informe siempre comienza con los datos del cuestionario (nombre, categoría, campaña y fecha). Marque qué más desea incluir: se agrega el gráfico que se
        muestra en cada pregunta.
      </Texto>
      <Casilla marcada={!!incluir.resumen} onCambio={() => alternar('resumen')}>
        Resumen general (encuestas, usuarios que cargaron, preguntas y última encuesta)
      </Casilla>
      {preguntas.map((p) => (
        <View key={p.id} style={{ marginTop: 6 }}>
          <Texto estilo="negrita">
            {datos.preguntas.indexOf(p) + 1}. {p.enunciado}
          </Texto>
          {eleccion[p.id].map((k) => (
            <Casilla key={k} marcada={!!incluir[`${p.id}:${k}`]} onCambio={() => alternar(`${p.id}:${k}`)} style={{ paddingLeft: 12 }}>
              {nombreDe(p, k)}
            </Casilla>
          ))}
        </View>
      ))}
      <Fila gap={16} style={{ marginVertical: 8 }}>
        <Text style={{ color: c.violetaTexto, fontWeight: '700' }} onPress={() => marcarTodo(true)}>
          Marcar todo
        </Text>
        <Text style={{ color: c.violetaTexto, fontWeight: '700' }} onPress={() => marcarTodo(false)}>
          Desmarcar todo
        </Text>
      </Fila>
      <Texto estilo="etiqueta">¿Descargar con la explicación?</Texto>
      <Radio marcada={conExplicacion} onPress={() => setConExplicacion(true)} titulo="Con explicación" detalle="Debajo de cada gráfico se explica cómo leerlo y qué muestran sus datos." />
      <Radio marcada={!conExplicacion} onPress={() => setConExplicacion(false)} titulo="Sin explicación" detalle="Solo los gráficos." />
      <TextoError>{error}</TextoError>
    </Modal>
  )
}

export default function DetalleCuestionario({ id }) {
  const { c } = useTema()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [eleccion, setEleccion] = useState(() => leerEleccion(id))
  const [pdfAbierto, setPdfAbierto] = useState(false)

  useEffect(() => {
    obtenerEstadisticas(id)
      .then(setDatos)
      .catch((e) => setError(e.message))
  }, [id])

  // Actualización en vivo (si la app está a la vista y no se está armando el PDF)
  const cargado = datos !== null
  useEffect(() => {
    if (!cargado || pdfAbierto) return
    let vigente = true
    const reloj = setInterval(() => {
      if (AppState.currentState !== 'active') return
      obtenerEstadisticas(id)
        .then((nuevos) => {
          if (!vigente) return
          setDatos((actuales) =>
            actuales.total_encuestas === nuevos.total_encuestas && actuales.ultima_encuesta === nuevos.ultima_encuesta ? actuales : nuevos,
          )
        })
        .catch(() => {})
    }, CADA)
    return () => {
      vigente = false
      clearInterval(reloj)
    }
  }, [id, cargado, pdfAbierto])

  const elegidoDe = (p) => graficoDe(p, eleccion[p.id])
  function cambiar(p, k) {
    const nueva = { ...eleccion, [p.id]: k }
    setEleccion(nueva)
    guardar(`graficos-cuestionario-${id}`, JSON.stringify(nueva))
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.fondo }}>
      <Fila style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: c.superficie, borderBottomWidth: 1, borderColor: c.linea, justifyContent: 'space-between' }}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/cuestionarios'))}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 }}
          accessibilityRole="link"
        >
          <ArrowLeft size={18} color={c.violetaTexto} />
          <Text style={{ color: c.violetaTexto, fontWeight: '700' }}>Cuestionarios</Text>
        </Pressable>
        {datos && datos.total_encuestas > 0 && <Boton titulo="PDF" icono={FileDown} chico onPress={() => setPdfAbierto(true)} />}
      </Fila>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 40, maxWidth: 900, width: '100%', alignSelf: 'center' }}>
        {error ? (
          <TextoError>{error}</TextoError>
        ) : !datos ? (
          <VacioTarjeta>Cargando…</VacioTarjeta>
        ) : (
          <>
            <View style={{ ...estiloTarjeta(c), borderTopWidth: 8, borderTopColor: MARCA.violeta, padding: 16, gap: 8 }}>
              <Text style={{ color: c.magentaTexto, fontWeight: '800', fontSize: 12, textTransform: 'uppercase' }}>{datos.cuestionario.categoria}</Text>
              <Texto estilo="titulo" style={{ fontSize: 22 }}>
                {datos.cuestionario.titulo}
              </Texto>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Dato etiqueta="Encuestas" valor={f(datos.total_encuestas)} />
                <Dato etiqueta="Usuarios que cargaron" valor={f(datos.militantes)} />
                <Dato etiqueta="Última encuesta" valor={datos.ultima_encuesta ? formatoFecha(datos.ultima_encuesta) : '—'} />
              </View>
            </View>
            <Texto estilo="subtitulo">Estadísticas</Texto>
            {datos.total_encuestas === 0 && (
              <Texto style={{ backgroundColor: c.superficie2, padding: 12, borderRadius: 10 }}>
                Todavía no hay encuestas cargadas. Los resultados de cada pregunta se mostrarán cuando se responda este cuestionario.
              </Texto>
            )}
            {datos.preguntas.map((p, i) => (
              <EstadisticaPregunta
                key={p.id}
                cuestionario={id}
                pregunta={p}
                numero={i + 1}
                elegido={elegidoDe(p)}
                onCambio={(k) => cambiar(p, k)}
                version={datos.total_encuestas}
              />
            ))}
          </>
        )}
      </ScrollView>
      {pdfAbierto && datos && (
        <DescargarPdf
          datos={datos}
          cuestionario={id}
          eleccion={Object.fromEntries(datos.preguntas.map((p) => [p.id, [elegidoDe(p)]]))}
          onCerrar={() => setPdfAbierto(false)}
        />
      )}
    </View>
  )
}
