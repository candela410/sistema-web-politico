import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Pressable, View, useWindowDimensions } from 'react-native'
import { router } from 'expo-router'
import { ArrowRight, ChevronRight, ClipboardList } from 'lucide-react-native'
import { obtenerCuestionarios } from '../../api/cuestionarios'
import { obtenerEncuestasPorDia, obtenerParaResponder } from '../../api/encuestas'
import { obtenerRutas, obtenerZonas } from '../../api/mapa'
import { MARCA, useTema } from '../../tema/tema'
import { Pagina, Tarjeta, Texto, isoLocal, Text } from '../../ui'
import { seccionesPara } from '../../util/opciones'
import { tiene } from '../../util/permisos'
import { nombreDe } from '../../util/usuario'

// Accesos de la pantalla de inicio: solo las secciones del día a día, en este orden y con su color.
const TARJETAS = [
  { ruta: '/cuestionarios', color: 'celeste' },
  { ruta: '/responder', color: 'violeta' },
  { ruta: '/mapa', color: 'magenta' },
  { ruta: '/mi-ruta', color: 'magenta' },
  { ruta: '/equipos', color: 'violeta' },
  { ruta: '/usuarios', color: 'naranja' },
]
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

// Números del tablero según los permisos del usuario: solo se pide lo que puede ver.
async function cargarResumen(usuario) {
  const cantidad = (promesa) => promesa.then((l) => l.length).catch(() => null)
  const si = (permiso, pedir) => (tiene(usuario, permiso) ? pedir() : undefined)

  const [cuestionarios, zonas, rutas, paraCargar] = await Promise.all([
    si('core.view_cuestionario', () => obtenerCuestionarios().catch(() => null)),
    si('core.view_zona', () => cantidad(obtenerZonas())),
    si('core.view_ruta', () => cantidad(obtenerRutas())),
    si('core.add_encuesta', () => cantidad(obtenerParaResponder())),
  ])
  const numeros = [
    cuestionarios !== undefined && { texto: 'Cuestionarios activos', valor: cuestionarios && cuestionarios.filter((c) => c.activo).length },
    cuestionarios !== undefined && { texto: 'Encuestas cargadas', valor: cuestionarios && cuestionarios.reduce((t, c) => t + c.encuestas, 0) },
    zonas !== undefined && { texto: 'Zonas', valor: zonas },
    rutas !== undefined && { texto: 'Rutas', valor: rutas },
    paraCargar !== undefined && { texto: 'Encuestas para cargar', valor: paraCargar },
  ].filter(Boolean)
  return {
    numeros: numeros.slice(0, 4),
    ultimos: [...(cuestionarios ?? [])].sort((a, b) => b.creado_en.localeCompare(a.creado_en)).slice(0, 4),
  }
}

function semanaActual() {
  const hoy = new Date()
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes)
    d.setDate(lunes.getDate() + i)
    return { dia: DIAS[i], numero: d.getDate(), fecha: isoLocal(d), esHoy: d.toDateString() === hoy.toDateString(), futuro: d > hoy }
  })
}

function saludo() {
  const hora = new Date().getHours()
  if (hora >= 6 && hora < 12) return 'Buenos días'
  return hora >= 12 && hora < 20 ? 'Buenas tardes' : 'Buenas noches'
}

const fechaCorta = (iso) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })

// Número que cuenta desde 0 hasta su valor (700ms, frenando al final)
function Contador({ valor, style }) {
  const [mostrado, setMostrado] = useState(0)
  useEffect(() => {
    let cuadro
    let vigente = true
    AccessibilityInfo.isReduceMotionEnabled().then((reducir) => {
      if (!vigente) return
      if (reducir || !valor) return setMostrado(valor)
      const inicio = Date.now()
      const paso = () => {
        const t = Math.min(1, (Date.now() - inicio) / 700)
        setMostrado(Math.round(valor * (1 - (1 - t) ** 3)))
        if (t < 1) cuadro = requestAnimationFrame(paso)
      }
      cuadro = requestAnimationFrame(paso)
    })
    return () => {
      vigente = false
      cancelAnimationFrame(cuadro)
    }
  }, [valor])
  return <Text style={style}>{mostrado.toLocaleString('es-AR')}</Text>
}

function Barra({ alto, orden, color }) {
  const valor = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(valor, { toValue: alto, duration: 500, delay: orden * 60, useNativeDriver: false }).start()
  }, [alto, orden, valor])
  return (
    <Animated.View
      style={{
        width: 14,
        borderRadius: 7,
        backgroundColor: color,
        height: valor.interpolate({ inputRange: [0, 1], outputRange: [4, 60] }),
      }}
    />
  )
}

export default function Inicio({ usuario }) {
  const { c } = useTema()
  const { width } = useWindowDimensions()
  const [resumen, setResumen] = useState(null)
  const permitidas = seccionesPara(usuario).flatMap((s) => s.opciones)
  const tarjetas = TARJETAS.map((t) => {
    const opcion = permitidas.find((o) => o.ruta === t.ruta)
    return opcion && { ...opcion, color: t.color }
  }).filter(Boolean)
  const colorDe = { violeta: MARCA.violeta, magenta: MARCA.magenta, celeste: MARCA.celeste, naranja: MARCA.naranja }
  const columnas = width >= 700 ? 3 : 2

  const cargar = () => cargarResumen(usuario).then(setResumen)
  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario])

  const [semana] = useState(semanaActual)
  const verEncuestas = tiene(usuario, 'core.view_encuesta')
  const [porDia, setPorDia] = useState(null)
  useEffect(() => {
    if (!verEncuestas) return
    obtenerEncuestasPorDia(semana[0].fecha, semana[6].fecha)
      .then((dias) => setPorDia(Object.fromEntries(dias.map((d) => [d.fecha, d.encuestas]))))
      .catch(() => setPorDia(null))
  }, [verEncuestas, semana])
  const maximo = porDia ? Math.max(1, ...Object.values(porDia)) : 1
  const totalSemana = porDia ? Object.values(porDia).reduce((t, n) => t + n, 0) : 0
  const mes = (() => {
    const texto = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    return texto.charAt(0).toUpperCase() + texto.slice(1)
  })()

  const COLOR_NUMERO = [MARCA.violeta, MARCA.magenta, MARCA.naranja, MARCA.celeste]
  return (
    <Pagina alRefrescar={cargar} style={{ gap: 12, paddingTop: 20 }}>
      {/* Saludo */}
      <View>
        <Text style={{ color: c.texto, fontSize: 22, fontWeight: '800' }} titulo accessibilityRole="header">
          {saludo()}, {usuario.nombre || nombreDe(usuario)}
        </Text>
        <Texto estilo="suave">¿Qué desea gestionar hoy?</Texto>
      </View>

      {tarjetas.length === 0 && (
        <Tarjeta>
          <Texto estilo="negrita">Todavía no tiene secciones habilitadas</Texto>
          <Texto estilo="suave">Solicite a la administración que le asigne un rol con permisos.</Texto>
        </Tarjeta>
      )}

      {/* Resumen: números separados por líneas, cada uno con su color */}
      {(resumen === null || resumen.numeros.length > 0) && (
        <Tarjeta style={{ flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 12, paddingHorizontal: 4 }} accessibilityLabel="Resumen">
          {(resumen?.numeros ?? [{ texto: 'Cargando…', valor: null }]).map((n, i) => (
            <View
              key={n.texto}
              style={{
                flexGrow: 1,
                flexBasis: width >= 700 ? 0 : '45%',
                alignItems: 'center',
                paddingVertical: 4,
                paddingHorizontal: 4,
                borderLeftWidth: i % (width >= 700 ? 4 : 2) === 0 ? 0 : 1,
                borderLeftColor: c.linea,
              }}
            >
              {resumen && n.valor != null ? (
                <Contador valor={n.valor} style={{ color: COLOR_NUMERO[i % 4], fontSize: 22, fontWeight: '800' }} />
              ) : (
                <Text style={{ color: COLOR_NUMERO[i % 4], fontSize: 22, fontWeight: '800' }}>{resumen ? '–' : '·'}</Text>
              )}
              <Texto estilo="chico" style={{ textAlign: 'center', fontSize: 11.5 }}>
                {n.texto}
              </Texto>
            </View>
          ))}
        </Tarjeta>
      )}

      {/* Accesos directos: tarjetas de color con ícono, título y flecha */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 }} accessibilityLabel="Secciones">
        {tarjetas.map(({ ruta, texto, descripcion, icono: Icono, color }) => (
          <Pressable
            key={ruta}
            onPress={() => router.navigate(ruta)}
            accessibilityRole="link"
            accessibilityLabel={descripcion ? `${texto}: ${descripcion}` : texto}
            android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
            style={({ pressed }) => ({
              width: columnas === 3 ? '32%' : '48.5%',
              minHeight: 116,
              backgroundColor: colorDe[color],
              borderRadius: 15,
              padding: 12,
              overflow: 'hidden',
              justifyContent: 'space-between',
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.28)', alignItems: 'center', justifyContent: 'center' }}>
              <Icono size={18} color="#fff" />
            </View>
            <View style={{ paddingRight: 26 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }} titulo>
                {texto}
              </Text>
              {descripcion ? <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 11.5 }}>{descripcion}</Text> : null}
            </View>
            <View style={{ position: 'absolute', right: 10, bottom: 11, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowRight size={15} color="#fff" />
            </View>
          </Pressable>
        ))}
      </View>

      {/* Calendario de la semana con las encuestas cargadas por día */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
        <Text style={{ color: c.texto, fontSize: 15, fontWeight: '800' }} titulo>
          Esta semana
        </Text>
        <Texto estilo="chico">{mes}</Texto>
      </View>
      <Tarjeta style={{ gap: 10, paddingVertical: 13, paddingHorizontal: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          {semana.map((d, i) => (
            <View key={i} style={{ alignItems: 'center', gap: 6, flex: 1 }} accessibilityLabel={d.futuro || !porDia ? undefined : `${porDia[d.fecha] ?? 0} encuestas`}>
              <Texto estilo="chico" style={{ fontSize: 11 }}>
                {d.dia}
              </Texto>
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: d.esHoy ? MARCA.violeta : 'transparent',
                }}
              >
                <Text style={{ color: d.esHoy ? '#fff' : c.texto, fontSize: 13, fontWeight: '700' }}>{d.numero}</Text>
              </View>
              {porDia && (
                <View style={{ height: 80, justifyContent: 'flex-end', alignItems: 'center' }}>
                  {!d.futuro && (
                    <>
                      <Barra alto={(porDia[d.fecha] ?? 0) / maximo} orden={i} color={d.esHoy ? MARCA.magenta : MARCA.celeste} />
                      <Texto estilo="chico" style={{ fontSize: 11 }}>
                        {porDia[d.fecha] ?? 0}
                      </Texto>
                    </>
                  )}
                </View>
              )}
            </View>
          ))}
        </View>
        {porDia && (
          <Texto estilo="chico" style={{ textAlign: 'center' }}>
            {totalSemana === 1 ? '1 encuesta cargada' : `${totalSemana} encuestas cargadas`} esta semana
          </Texto>
        )}
      </Tarjeta>

      {tiene(usuario, 'core.view_cuestionario') && (
        <>
          <Text style={{ color: c.texto, fontSize: 15, fontWeight: '800', marginTop: 2 }} titulo>
            Últimos cuestionarios
          </Text>
          <Tarjeta style={{ gap: 4, padding: 8 }}>
            {resumen === null ? (
              <Texto estilo="suave" style={{ padding: 8 }}>
                Cargando…
              </Texto>
            ) : resumen.ultimos.length === 0 ? (
              <Texto estilo="suave" style={{ padding: 8 }}>
                Cuando se creen cuestionarios, aquí se mostrarán los últimos.
              </Texto>
            ) : (
              resumen.ultimos.map((q) => (
                <Pressable
                  key={q.id}
                  onPress={() => router.navigate(tiene(usuario, 'core.view_encuesta') ? `/cuestionarios/${q.id}/estadisticas` : `/cuestionarios/${q.id}`)}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12, backgroundColor: pressed ? c.superficie2 : 'transparent' })}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.superficie2, alignItems: 'center', justifyContent: 'center' }}>
                    <ClipboardList size={18} color={c.violetaTexto} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Texto estilo="negrita" numberOfLines={1}>
                      {q.titulo}
                    </Texto>
                    <Texto estilo="chico">
                      {fechaCorta(q.creado_en)} · {q.encuestas === 1 ? '1 encuesta' : `${q.encuestas} encuestas`}
                    </Texto>
                  </View>
                  <ChevronRight size={18} color={c.gris} />
                </Pressable>
              ))
            )}
          </Tarjeta>
        </>
      )}

      {/* Identidad visual al pie del panel */}
      <View style={{ alignItems: 'center', marginTop: 6 }}>
        <View style={{ flexDirection: 'row', width: 43, height: 2, marginBottom: 5 }}>
          {[MARCA.celeste, MARCA.magenta, MARCA.naranja].map((color) => (
            <View key={color} style={{ flex: 1, backgroundColor: color }} />
          ))}
        </View>
        <Text style={{ color: c.gris, fontSize: 9, letterSpacing: 0.4 }}>GESTIÓN Y ORGANIZACIÓN · La Libertad Avanza</Text>
      </View>
    </Pagina>
  )
}
