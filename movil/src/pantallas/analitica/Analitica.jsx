import { useEffect, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { Download, FileDown } from 'lucide-react-native'
import { obtenerResumenAnalitica, urlGraficoAnalitica } from '../../api/analitica'
import { MARCA, useTema } from '../../tema/tema'
import RespuestasPorZona from './RespuestasPorZona'
import { Acciones, Boton, Casilla, Encabezado, Fila, Modal, Pagina, SelectorFecha, Tarjeta, Texto, TextoError, VacioTarjeta } from '../../ui'
import ImagenApi from '../../ui/ImagenApi'

// Dashboard: los gráficos del Módulo de Analítica de la campaña activa (los
// genera el servidor con pandas y matplotlib). Las fechas se aplican con el
// botón. Cada gráfico se comparte como PNG y "Exportar todo" arma un PDF.
const GRAFICOS = [
  { clave: 'dashboard', titulo: 'Tablero de la campaña', pregunta: 'Resumen: totales, encuestas por equipo, militantes que más cargaron y días de mayor actividad.' },
  { clave: 'periodo', titulo: 'Encuestas por período', pregunta: '¿Cuántas encuestas se cargan por día, semana o mes (según el rango elegido)?' },
  { clave: 'evolucion', titulo: 'Evolución de las encuestas', pregunta: '¿Cómo crecen las encuestas cargadas y a cuánto se llegaría al ritmo actual?' },
  { clave: 'heatmap', titulo: 'Días y horarios', pregunta: '¿En qué días y horarios se encuesta más?' },
  { clave: 'donut', titulo: 'Participación por equipo', pregunta: '¿Qué parte del total aportó cada equipo?' },
]
const VACIOS = { desde: '', hasta: '' }
const fecha = (iso) => new Date(`${iso}T00:00`).toLocaleDateString('es-AR')
const nombreDe = (u) => [u.nombre, u.apellido].filter(Boolean).join(' ') || u.email

// Guarda el PNG y abre "Compartir" (guardar en la galería, enviar…)
async function compartirPng(grafico, datos) {
  const ruta = `${FileSystem.cacheDirectory}${grafico.clave}.png`
  await FileSystem.writeAsStringAsync(ruta, datos.split(',')[1], { encoding: FileSystem.EncodingType.Base64 })
  await Sharing.shareAsync(ruta, { mimeType: 'image/png', dialogTitle: grafico.titulo })
}

function Grafico({ grafico, url, onError }) {
  const { c } = useTema()
  const datos = useRef(null)
  const [listo, setListo] = useState(false)
  return (
    <Tarjeta style={{ gap: 10 }}>
      <Fila style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Texto estilo="negrita" style={{ fontSize: 16 }}>
            {grafico.titulo}
          </Texto>
          <Texto estilo="chico">{grafico.pregunta}</Texto>
        </View>
        {listo && (
          <Pressable
            onPress={() => compartirPng(grafico, datos.current).catch((e) => onError(e.message))}
            accessibilityLabel={`Compartir «${grafico.titulo}» como imagen PNG`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: MARCA.violeta, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 }}
          >
            <Download size={14} color={c.violetaTexto} />
            <Texto style={{ color: c.violetaTexto, fontWeight: '700', fontSize: 13 }}>PNG</Texto>
          </Pressable>
        )}
      </Fila>
      <ImagenApi
        url={url}
        etiqueta={`${grafico.titulo}: ${grafico.pregunta}`}
        onCargada={(d) => {
          datos.current = d
          setListo(true)
        }}
      />
    </Tarjeta>
  )
}

function ElegirGraficosPdf({ graficos, onDescargar, onCerrar }) {
  const { c } = useTema()
  const [elegidos, setElegidos] = useState(() => new Set(graficos.map((g) => g.clave)))
  const [conExplicacion, setConExplicacion] = useState(true)
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
    await onDescargar(
      graficos.filter((g) => elegidos.has(g.clave)),
      conExplicacion,
    )
    setGenerando(false)
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
      titulo="Exportar todo en PDF"
      onCerrar={onCerrar}
      pie={
        <Acciones onCancelar={onCerrar}>
          <Boton
            titulo={generando ? 'Generando…' : `Descargar PDF (${elegidos.size === 1 ? '1 gráfico' : `${elegidos.size} gráficos`})`}
            onPress={descargar}
            cargando={generando}
            disabled={elegidos.size === 0}
          />
        </Acciones>
      }
    >
      <Texto estilo="suave" style={{ marginBottom: 6 }}>
        Seleccione los gráficos que desea incluir en el informe.
      </Texto>
      <Casilla marcada={todos} onCambio={() => setElegidos(todos ? new Set() : new Set(graficos.map((g) => g.clave)))}>
        <Texto estilo="negrita">Todos los gráficos</Texto>
      </Casilla>
      {graficos.map((g) => (
        <Casilla key={g.clave} marcada={elegidos.has(g.clave)} onCambio={() => alternar(g.clave)} style={{ paddingLeft: 12 }}>
          <Texto>{g.titulo}</Texto>
          <Texto estilo="chico">{g.pregunta}</Texto>
        </Casilla>
      ))}
      <Texto estilo="etiqueta" style={{ marginTop: 10 }}>
        ¿Descargar con la explicación?
      </Texto>
      <Radio marcada={conExplicacion} onPress={() => setConExplicacion(true)} titulo="Con explicación" detalle="Debajo de cada gráfico se explica cómo leerlo y qué muestran sus datos." />
      <Radio marcada={!conExplicacion} onPress={() => setConExplicacion(false)} titulo="Sin explicación" detalle="Solo los gráficos." />
    </Modal>
  )
}

export default function Analitica({ usuario }) {
  const { c } = useTema()
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
      .catch((e) => {
        if (!vigente) return
        setResumen(null)
        setError(e.message)
      })
    return () => {
      vigente = false
    }
  }, [aplicados])

  const cambiar = (campo) => (v) => setFiltros((f) => ({ ...f, [campo]: v }))
  const aplicar = () => setAplicados((a) => ({ ...filtros, version: a.version + 1 }))
  const limpiar = () => {
    setFiltros(VACIOS)
    setAplicados((a) => ({ ...VACIOS, version: a.version + 1 }))
  }
  const hayFiltros = Object.values(filtros).some(Boolean)
  const sinCambios = filtros.desde === aplicados.desde && filtros.hasta === aplicados.hasta
  const version = aplicados.version
  const periodo = resumen?.desde ? `${fecha(resumen.desde)} al ${fecha(resumen.hasta)}` : ''
  const urlDe = (clave) => urlGraficoAnalitica(clave, { desde: resumen.desde, hasta: resumen.hasta, v: version })

  const paraPdf = resumen?.encuestas > 0 ? GRAFICOS.map((g) => ({ ...g, url: urlDe(g.clave), explicacion: resumen.explicaciones?.[g.clave] ?? [] })) : []

  async function descargarElegidos(lista, conExplicacion) {
    setErrorPdf('')
    try {
      const { descargarGraficosPdf } = await import('./pdf')
      await descargarGraficosPdf({
        titulo: lista.length === 1 ? lista[0].titulo : 'Dashboard de la campaña',
        campana: usuario.campana?.nombre ?? '',
        periodo,
        generadoPor: nombreDe(usuario),
        graficos: lista.map((g) => ({ ...g, explicacion: conExplicacion ? g.explicacion : null })),
        archivo: `dashboard${conExplicacion ? '-explicado' : ''}.pdf`,
      })
      setEligiendoPdf(false)
    } catch (e) {
      setErrorPdf(e.message || 'No se pudo generar el PDF.')
    }
  }

  return (
    <Pagina alRefrescar={async () => setAplicados((a) => ({ ...a, version: a.version + 1 }))}>
      <Encabezado titulo="Dashboard" descripcion={`Gráficos de ${usuario.campana?.nombre ?? 'la campaña'} con los datos de este momento.`} />
      {paraPdf.length > 0 && <Boton titulo="Exportar todo" icono={FileDown} onPress={() => setEligiendoPdf(true)} grande />}

      <Tarjeta>
        <Fila gap={10}>
          <SelectorFecha style={{ flex: 1 }} etiqueta="Desde" valor={filtros.desde} maximo={filtros.hasta || undefined} onCambio={cambiar('desde')} />
          <SelectorFecha style={{ flex: 1 }} etiqueta="Hasta" valor={filtros.hasta} minimo={filtros.desde || undefined} onCambio={cambiar('hasta')} />
        </Fila>
        <Fila style={{ justifyContent: 'flex-end' }}>
          {hayFiltros && <Boton titulo="Limpiar" variante="borde" onPress={limpiar} />}
          <Boton titulo="Aplicar" onPress={aplicar} disabled={sinCambios} />
        </Fila>
      </Tarjeta>

      <TextoError>{errorPdf}</TextoError>
      {error ? (
        <TextoError>{error}</TextoError>
      ) : !resumen ? (
        <VacioTarjeta>Cargando…</VacioTarjeta>
      ) : resumen.encuestas === 0 ? (
        <Texto style={{ backgroundColor: c.superficie2, padding: 12, borderRadius: 10 }}>
          No hay encuestas cargadas{periodo ? ` entre el ${fecha(resumen.desde)} y el ${fecha(resumen.hasta)}` : ' en esta campaña'}. Los gráficos se mostrarán
          cuando se carguen encuestas.
        </Texto>
      ) : (
        <>
          <Texto estilo="negrita" style={{ color: c.violetaTexto }}>
            {resumen.encuestas === 1 ? '1 encuesta' : `${resumen.encuestas.toLocaleString('es-AR')} encuestas`} del {periodo}
          </Texto>
          {GRAFICOS.map((g) => (
            <Grafico key={`${g.clave}-${version}`} grafico={g} url={urlDe(g.clave)} onError={setErrorPdf} />
          ))}
        </>
      )}
      {resumen ? <RespuestasPorZona zonas={resumen.zonas ?? []} cuestionarios={resumen.cuestionarios ?? []} /> : null}

      {eligiendoPdf && <ElegirGraficosPdf graficos={paraPdf} onDescargar={descargarElegidos} onCerrar={() => setEligiendoPdf(false)} />}
    </Pagina>
  )
}
