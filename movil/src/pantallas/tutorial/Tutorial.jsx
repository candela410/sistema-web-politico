import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useEvent } from 'expo'
import { useVideoPlayer, VideoView } from 'expo-video'
import { ChevronLeft, CircleCheck, CirclePlay, Clock, VideoOff } from 'lucide-react-native'
import { MARCA, useTema } from '../../tema/tema'
import { Boton, Encabezado, Fila, Pagina, Tarjeta, Texto, VacioTarjeta, Text } from '../../ui'
import { guardar, leer } from '../../util/almacen'
import { tutorialesPara } from './tutoriales'

// Sección "Tutorial": videos cortos, uno por cada cosa que se puede hacer en el
// sistema. Cada usuario ve solo los de sus funciones. Los pasos debajo del
// video saltan a ese momento.
const CLAVE_VISTOS = 'tutoriales-vistos'

function leerVistos() {
  try {
    return new Set(JSON.parse(leer(CLAVE_VISTOS) ?? '[]'))
  } catch {
    return new Set()
  }
}

const duracionTexto = (segundos) => {
  if (!segundos) return ''
  const s = Math.round(segundos)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function Video({ fuente, pasos, actual, setActual, onVisto, irA }) {
  const player = useVideoPlayer(fuente, (p) => {
    p.timeUpdateEventInterval = 0.4
  })
  const { currentTime } = useEvent(player, 'timeUpdate', { currentTime: 0 })
  useEffect(() => {
    let i = 0
    pasos.forEach((p, j) => {
      if (p.t != null && currentTime >= p.t - 0.2) i = j
    })
    setActual(i)
  }, [currentTime, pasos, setActual])
  useEffect(() => {
    const sub = player.addListener('playToEnd', onVisto)
    return () => sub.remove()
  }, [player, onVisto])
  useEffect(() => {
    irA.current = (t) => {
      player.currentTime = t
      player.play()
    }
  }, [player, irA])
  return <VideoView player={player} style={{ width: '100%', aspectRatio: 16 / 10, backgroundColor: '#000' }} nativeControls allowsFullscreen contentFit="contain" />
}

function Reproductor({ tutorial, onVisto }) {
  const { c } = useTema()
  const [actual, setActual] = useState(0)
  const irA = useRef(null)
  const sinVideo = !tutorial.video
  const pasos = tutorial.pasos

  function irAPaso(i) {
    setActual(i)
    const p = pasos[i]
    if (sinVideo || p.t == null) return
    irA.current?.(p.t)
  }

  return (
    <Tarjeta style={{ padding: 0, overflow: 'hidden' }}>
      {sinVideo ? (
        <View style={{ aspectRatio: 16 / 10, backgroundColor: c.superficie2, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 6 }}>
          <VideoOff size={40} strokeWidth={1.5} color={c.gris} />
          <Texto estilo="negrita" style={{ textAlign: 'center' }}>
            Este tutorial todavía no tiene video
          </Texto>
          <Texto estilo="suave" style={{ textAlign: 'center' }}>
            Seguí los pasos de abajo. Cuando se agregue el video va a aparecer acá.
          </Texto>
        </View>
      ) : (
        <Video fuente={tutorial.video} pasos={pasos} actual={actual} setActual={setActual} onVisto={onVisto} irA={irA} />
      )}
      <View style={{ padding: 16, gap: 6 }}>
        <Text style={{ color: c.magentaTexto, fontWeight: '800', fontSize: 12, textTransform: 'uppercase' }}>{tutorial.grupo}</Text>
        <Texto estilo="subtitulo">{tutorial.titulo}</Texto>
        <Texto estilo="suave">{tutorial.descripcion}</Texto>
        <Texto estilo="negrita" style={{ marginTop: 8 }}>
          Paso a paso
        </Texto>
        {pasos.map((p, i) => {
          const marcado = i === actual && !sinVideo
          return (
            <Pressable
              key={p.texto}
              onPress={() => irAPaso(i)}
              disabled={sinVideo}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                padding: 10,
                borderRadius: 10,
                backgroundColor: marcado ? c.superficie2 : 'transparent',
                borderWidth: 1.5,
                borderColor: marcado ? MARCA.violeta : 'transparent',
              }}
            >
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: marcado ? MARCA.violeta : c.superficie2, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: marcado ? '#fff' : c.texto, fontWeight: '800', fontSize: 12 }}>{i + 1}</Text>
              </View>
              <Text style={{ color: c.texto, flex: 1 }}>{p.texto}</Text>
              {!sinVideo && p.t != null && <Texto estilo="chico">{duracionTexto(p.t) || '0:00'}</Texto>}
            </Pressable>
          )
        })}
        {tutorial.nota ? <Texto style={{ backgroundColor: c.superficie2, padding: 10, borderRadius: 10, marginTop: 4 }}>{tutorial.nota}</Texto> : null}
      </View>
    </Tarjeta>
  )
}

export default function Tutorial({ usuario }) {
  const { c } = useTema()
  const tutoriales = useMemo(() => tutorialesPara(usuario), [usuario])
  const { video } = useLocalSearchParams()
  const [vistos, setVistos] = useState(leerVistos)
  const elegido = tutoriales.find((t) => t.id === video) ?? tutoriales[0]
  const indice = tutoriales.indexOf(elegido)

  const grupos = useMemo(() => {
    const mapa = new Map()
    tutoriales.forEach((t, i) => {
      if (!mapa.has(t.grupo)) mapa.set(t.grupo, [])
      mapa.get(t.grupo).push({ ...t, numero: i + 1 })
    })
    return [...mapa]
  }, [tutoriales])

  const elegir = (t) => router.setParams({ video: t.id })
  function marcarVisto(id) {
    setVistos((v) => {
      const nuevo = new Set(v).add(id)
      guardar(CLAVE_VISTOS, JSON.stringify([...nuevo]))
      return nuevo
    })
  }

  if (!elegido)
    return (
      <Pagina>
        <VacioTarjeta titulo="No hay tutoriales para su usuario.">Cuando tenga funciones asignadas, aquí verá cómo usarlas.</VacioTarjeta>
      </Pagina>
    )

  const cantidadVistos = tutoriales.filter((t) => vistos.has(t.id)).length

  return (
    <Pagina>
      <Encabezado titulo="Tutorial" descripcion="Videos cortos, paso a paso, de todo lo que puede hacer con su usuario." />
      <View style={{ gap: 4 }}>
        <Texto estilo="suave">
          <Text style={{ fontWeight: '800', color: c.texto }}>{cantidadVistos}</Text> de {tutoriales.length} vistos
        </Texto>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: c.superficie2, overflow: 'hidden' }}>
          <View style={{ height: 6, width: `${(cantidadVistos / tutoriales.length) * 100}%`, backgroundColor: MARCA.violeta }} />
        </View>
      </View>

      <Reproductor key={elegido.id} tutorial={elegido} onVisto={() => marcarVisto(elegido.id)} />

      <Fila style={{ justifyContent: 'space-between' }}>
        {indice > 0 ? <Boton titulo="Anterior" icono={ChevronLeft} variante="borde" chico onPress={() => elegir(tutoriales[indice - 1])} /> : <View />}
        <Text
          onPress={vistos.has(elegido.id) ? undefined : () => marcarVisto(elegido.id)}
          style={{ color: vistos.has(elegido.id) ? c.gris : c.violetaTexto, fontWeight: '700' }}
        >
          {vistos.has(elegido.id) ? 'Ya lo vio' : 'Marcar como visto'}
        </Text>
        {indice < tutoriales.length - 1 ? <Boton titulo="Siguiente" chico onPress={() => elegir(tutoriales[indice + 1])} /> : <View />}
      </Fila>

      {grupos.map(([grupo, items]) => (
        <View key={grupo} style={{ gap: 6 }}>
          <Text style={{ color: c.gris, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginTop: 6 }}>{grupo}</Text>
          {items.map((t) => {
            const visto = vistos.has(t.id)
            const actual = t.id === elegido.id
            return (
              <Pressable
                key={t.id}
                onPress={() => elegir(t)}
                accessibilityState={{ selected: actual }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: actual ? c.superficie2 : c.superficie,
                  borderWidth: 1.5,
                  borderColor: actual ? MARCA.violeta : c.linea,
                }}
              >
                {visto ? (
                  <CircleCheck size={22} color={c.verdeTexto} accessibilityLabel="Visto" />
                ) : t.video ? (
                  <CirclePlay size={22} color={c.violetaTexto} />
                ) : (
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: c.borde, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: c.gris, fontSize: 11, fontWeight: '700' }}>{t.numero}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Texto estilo="negrita">{t.titulo}</Texto>
                  <Fila gap={4}>
                    {t.video && <Clock size={12} color={c.gris} />}
                    <Texto estilo="chico">
                      {t.video ? duracionTexto(t.duracion) : 'Solo pasos escritos'} · {t.pasos.length} pasos
                    </Texto>
                  </Fila>
                </View>
              </Pressable>
            )
          })}
        </View>
      ))}
    </Pagina>
  )
}
