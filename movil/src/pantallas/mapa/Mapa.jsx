import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native'
import MapView, { Callout, Circle, Marker, Polygon, Polyline } from 'react-native-maps'
import { ChevronDown, ChevronUp, X } from 'lucide-react-native'
import * as api from '../../api/mapa'
import { useSesion } from '../../sesion/Sesion'
import { MARCA, useTema } from '../../tema/tema'
import { Casilla, Fila, Texto, Text } from '../../ui'
import { tiene } from '../../util/permisos'
import { coordenadasDe, geometriaDesdeVertices, lineasDe, paradasACoordenadas, poligonosDe, redondear, verticesDe } from './geo'
import PanelRutas from './PanelRutas'
import PanelZonas from './PanelZonas'
import Parada from './Parada'

// Mapa de barrios, zonas y rutas (en la web: Leaflet + Geoman; acá react-native-maps).
// - Barrios: relleno con el color de su zona; al tocarlos se ven sus calles.
// - Zonas: se dibujan tocando el mapa vértice por vértice; al editarlas se arrastran los vértices.
// - Rutas: se marcan los puntos tocando el mapa y el servidor calcula el recorrido (OpenRouteService).
const COLOR_RUTA = '#c3268c'
const REGION_ARGENTINA = { latitude: -34.6, longitude: -64.5, latitudeDelta: 25, longitudeDelta: 25 }
const fechaEncuesta = (v) => new Date(v).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

// Color con transparencia ('#51318f' + 0.25 → 'rgba(81,49,143,0.25)')
function conAlfa(hex, alfa) {
  const h = (hex || '#51318f').replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alfa})`
}

export default function Mapa() {
  const { c } = useTema()
  const { usuario } = useSesion()
  const { width, height } = useWindowDimensions()
  const ancho = width >= 900
  const mapa = useRef(null)
  const [barrios, setBarrios] = useState(null)
  const [zonas, setZonas] = useState([])
  const [rutas, setRutas] = useState([])
  const [error, setError] = useState('')
  const [pestana, setPestana] = useState('zonas')
  // modo: null | { tipo: 'zona-nueva', puntos, geometria? } | { tipo: 'zona-editar', id, geometria } | { tipo: 'ruta', id?, paradas }
  const [modo, setModo] = useState(null)
  const [seleccion, setSeleccion] = useState(null) // { tipo: 'zona'|'ruta'|'barrio', id }
  const [calles, setCalles] = useState(null)
  const [encuestas, setEncuestas] = useState([])
  const [verEncuestas, setVerEncuestas] = useState(true)
  const [panelAbierto, setPanelAbierto] = useState(true)
  const listo = useRef(false)

  useEffect(() => {
    Promise.all([api.obtenerBarrios(), api.obtenerZonas(), api.obtenerRutas()])
      .then(([b, z, r]) => {
        setBarrios(b)
        setZonas(z)
        setRutas(r)
      })
      .catch((e) => setError(e.message))
    api
      .obtenerEncuestas()
      .then((d) => setEncuestas(d.features))
      .catch(() => setEncuestas([]))
  }, [])

  const encuadrar = useCallback((geojson, margen = 40, animado = true) => {
    const puntos = coordenadasDe(geojson)
    if (!puntos.length || !mapa.current) return
    mapa.current.fitToCoordinates(puntos, { edgePadding: { top: margen, right: margen, bottom: margen, left: margen }, animated: animado })
  }, [])

  // Al llegar los barrios, el mapa se acerca a la ciudad
  useEffect(() => {
    if (barrios?.features?.length && !listo.current) {
      listo.current = true
      setTimeout(() => encuadrar(barrios, 20, false), 300)
    }
  }, [barrios, encuadrar])

  const recargarBarrios = useCallback(() => api.obtenerBarrios().then(setBarrios), [])
  const colorDeZona = useMemo(() => Object.fromEntries(zonas.map((z) => [z.id, z.color])), [zonas])
  const zonaSeleccionada = seleccion?.tipo === 'zona' ? seleccion.id : null
  const rutaSeleccionada = seleccion?.tipo === 'ruta' ? seleccion.id : null

  function seleccionar(tipo, item) {
    setSeleccion({ tipo, id: item.id })
    setCalles(null)
    if (item.geometria) encuadrar(item.geometria, 50)
  }

  function tocarBarrio(feature) {
    if (modo) return
    setSeleccion({ tipo: 'barrio', id: feature.properties.id })
    api
      .obtenerCallesDeBarrio(feature.properties.id)
      .then((datos) => setCalles({ barrio: feature.properties, datos }))
      .catch((e) => setError(e.message))
  }

  const enDibujo = modo?.tipo === 'zona-nueva' && !modo.geometria
  const marcandoRuta = modo?.tipo === 'ruta'

  // Tocar el mapa: agrega un vértice (zona) o un punto (ruta)
  function tocarMapa(e) {
    const { latitude, longitude } = e.nativeEvent.coordinate
    if (enDibujo) setModo((m) => ({ ...m, puntos: [...(m.puntos ?? []), { latitude, longitude }] }))
    else if (marcandoRuta) setModo((m) => ({ ...m, paradas: [...m.paradas, [redondear(longitude), redondear(latitude)]] }))
  }

  // Barrios: sin contorno, solo el relleno del color de su zona (el contorno aparece en el elegido)
  const capaBarrios = useMemo(() => {
    if (!barrios) return null
    return barrios.features.flatMap((f) => {
      const { zona, id, nombre } = f.properties
      const color = colorDeZona[zona]
      const resaltado = seleccion?.tipo === 'barrio' && seleccion.id === id
      const opacidad = zonaSeleccionada && zona === zonaSeleccionada ? 0.45 : color ? 0.25 : 0.05
      if (f.geometry?.type === 'Point') {
        const [lng, lat] = f.geometry.coordinates
        return [
          <Circle
            key={`b${id}`}
            center={{ latitude: lat, longitude: lng }}
            radius={150}
            fillColor={conAlfa(color, opacidad + 0.1)}
            strokeColor={resaltado ? '#15121c' : conAlfa(color, 0.6)}
            strokeWidth={resaltado ? 3 : 1}
          />,
        ]
      }
      return poligonosDe(f.geometry).map((p, i) => (
        <Polygon
          key={`b${id}-${i}`}
          coordinates={p.coordenadas}
          holes={p.huecos.length ? p.huecos : undefined}
          fillColor={conAlfa(color, opacidad)}
          strokeColor={resaltado ? '#15121c' : 'transparent'}
          strokeWidth={resaltado ? 3 : 0}
          lineDashPattern={f.properties.aproximado ? [6, 4] : undefined}
          tappable={!modo}
          onPress={() => tocarBarrio(f)}
          accessibilityLabel={nombre}
        />
      ))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barrios, colorDeZona, seleccion, zonaSeleccionada, modo])

  // Vértices editables de la zona en edición
  const vertices = modo?.tipo === 'zona-editar' ? verticesDe(modo.geometria) : []
  function moverVertice(p, r, v, coord) {
    const nuevos = vertices.map((poli, i) =>
      poli.map((anillo, j) => anillo.map((punto, k) => (i === p && j === r && k === v ? [redondear(coord.longitude), redondear(coord.latitude)] : punto))),
    )
    setModo((m) => ({ ...m, geometria: geometriaDesdeVertices(nuevos) }))
  }

  const puede = (accion, cosa) => tiene(usuario, `core.${accion}_${cosa}`)
  const zonaEditada = modo?.tipo === 'zona-editar' ? zonas.find((z) => z.id === modo.id) : null

  const panel = (
    <View style={{ flex: 1 }}>
      <Fila gap={4} style={{ padding: 4, backgroundColor: c.fondo, borderRadius: 12, margin: 10, marginBottom: 6 }}>
        {[
          ['zonas', `Zonas (${zonas.length})`],
          ['rutas', `Rutas (${rutas.length})`],
        ].map(([clave, texto]) => (
          <Pressable
            key={clave}
            disabled={!!modo}
            onPress={() => {
              setPestana(clave)
              setSeleccion(null)
              setCalles(null)
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: pestana === clave, disabled: !!modo }}
            style={{ flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center', backgroundColor: pestana === clave ? c.superficie : 'transparent', opacity: modo && pestana !== clave ? 0.4 : 1 }}
          >
            <Text style={{ color: pestana === clave ? c.violetaTexto : c.gris, fontWeight: '800' }}>{texto}</Text>
          </Pressable>
        ))}
        {!ancho && (
          <Pressable onPress={() => setPanelAbierto((a) => !a)} hitSlop={8} style={{ paddingHorizontal: 8 }} accessibilityLabel={panelAbierto ? 'Achicar panel' : 'Agrandar panel'}>
            {panelAbierto ? <ChevronDown size={20} color={c.gris} /> : <ChevronUp size={20} color={c.gris} />}
          </Pressable>
        )}
      </Fila>
      {(panelAbierto || ancho || modo) && (
        <ScrollView contentContainerStyle={{ padding: 12, paddingTop: 4, gap: 10, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
          {error ? (
            <View style={{ backgroundColor: c.fondoError, borderColor: c.bordeError, borderWidth: 1, borderRadius: 10, padding: 10, flexDirection: 'row', gap: 8 }}>
              <Text style={{ color: c.rojoTexto, flex: 1 }}>{error}</Text>
              <Pressable onPress={() => setError('')} hitSlop={8} accessibilityLabel="Cerrar aviso">
                <X size={18} color={c.rojoTexto} />
              </Pressable>
            </View>
          ) : null}
          {barrios && barrios.features.length === 0 && (
            <Texto estilo="suave">Todavía no hay barrios cargados. Se cargan con el comando python manage.py importar_osm "Ciudad".</Texto>
          )}
          {calles && (
            <View style={{ backgroundColor: c.superficie2, borderRadius: 12, padding: 12, gap: 6 }}>
              <Fila style={{ justifyContent: 'space-between' }}>
                <Texto estilo="subtitulo" style={{ flex: 1 }}>
                  {calles.barrio.nombre}
                </Texto>
                <Text
                  onPress={() => {
                    setCalles(null)
                    setSeleccion(null)
                  }}
                  style={{ color: c.violetaTexto, fontWeight: '700' }}
                >
                  Cerrar
                </Text>
              </Fila>
              <Texto estilo="chico">
                {calles.barrio.zona ? `Zona: ${zonas.find((z) => z.id === calles.barrio.zona)?.nombre ?? '—'}` : 'Sin zona asignada'} · {calles.datos.features.length} calles
              </Texto>
              <Texto estilo="suave">{calles.datos.features.map((x) => x.properties.nombre).join(' · ')}</Texto>
            </View>
          )}
          {pestana === 'zonas' ? (
            <PanelZonas
              zonas={zonas}
              rutas={rutas}
              modo={modo}
              setModo={setModo}
              seleccionada={zonaSeleccionada}
              onSeleccionar={(z) => seleccionar('zona', z)}
              puedeCrear={puede('add', 'zona')}
              puedeEditar={puede('change', 'zona')}
              puedeBorrar={puede('delete', 'zona')}
              onGuardada={(zona, esNueva) => {
                setZonas((zs) => (esNueva ? [...zs, zona].sort((a, b) => a.nombre.localeCompare(b.nombre)) : zs.map((z) => (z.id === zona.id ? zona : z))))
                setSeleccion({ tipo: 'zona', id: zona.id })
                recargarBarrios()
              }}
              onBorrada={(id) => {
                setZonas((zs) => zs.filter((z) => z.id !== id))
                setSeleccion(null)
                recargarBarrios()
              }}
              onError={setError}
            />
          ) : (
            <PanelRutas
              rutas={rutas}
              modo={modo}
              setModo={setModo}
              seleccionada={rutaSeleccionada}
              onSeleccionar={(r) => seleccionar('ruta', r)}
              puedeCrear={puede('add', 'ruta')}
              puedeEditar={puede('change', 'ruta')}
              puedeBorrar={puede('delete', 'ruta')}
              onGuardada={(ruta, esNueva) => {
                setRutas((rs) => (esNueva ? [...rs, ruta].sort((a, b) => a.nombre.localeCompare(b.nombre)) : rs.map((r) => (r.id === ruta.id ? ruta : r))))
                setSeleccion({ tipo: 'ruta', id: ruta.id })
              }}
              onBorrada={(id) => {
                setRutas((rs) => rs.filter((r) => r.id !== id))
                setSeleccion(null)
              }}
              onError={setError}
            />
          )}
        </ScrollView>
      )}
    </View>
  )

  return (
    <View style={{ flex: 1, flexDirection: ancho ? 'row-reverse' : 'column', backgroundColor: c.fondo }}>
      <View style={{ flex: 1 }}>
        <MapView
          ref={mapa}
          style={{ flex: 1 }}
          initialRegion={REGION_ARGENTINA}
          onPress={tocarMapa}
          showsUserLocation={false}
          toolbarEnabled={false}
          userInterfaceStyle={c.oscuro ? 'dark' : 'light'}
        >
          {capaBarrios}

          {/* Contornos de las zonas */}
          {zonas
            .filter((z) => z.geometria && !(modo?.tipo === 'zona-editar' && modo.id === z.id))
            .flatMap((z) =>
              poligonosDe(z.geometria).map((p, i) => (
                <Polygon
                  key={`z${z.id}-${i}-${z.color}`}
                  coordinates={p.coordenadas}
                  holes={p.huecos.length ? p.huecos : undefined}
                  fillColor="transparent"
                  strokeColor={z.color}
                  strokeWidth={zonaSeleccionada === z.id ? 4 : 2.5}
                  tappable={false}
                />
              )),
            )}

          {/* Calles del barrio elegido */}
          {calles &&
            calles.datos.features.flatMap((f) =>
              lineasDe(f.geometry).map((linea, i) => <Polyline key={`c${f.properties.id}-${i}`} coordinates={linea} strokeColor="rgba(21,18,28,0.75)" strokeWidth={3} />),
            )}

          {/* Rutas guardadas: recorrido calculado + paradas numeradas de la elegida */}
          {rutas
            .filter((r) => r.geometria && r.id !== (marcandoRuta ? modo.id : null))
            .flatMap((r) => {
              const activa = r.id === rutaSeleccionada
              const lineas = lineasDe(r.geometria).map((linea, i) => (
                <Polyline
                  key={`r${r.id}-${i}-${activa}`}
                  coordinates={linea}
                  strokeColor={conAlfa(COLOR_RUTA, activa || !rutaSeleccionada ? 0.9 : 0.35)}
                  strokeWidth={activa ? 6 : 4}
                />
              ))
              const paradas = activa ? r.paradas.map(([lng, lat], i) => <Parada key={`p${r.id}-${i}`} coordenada={{ latitude: lat, longitude: lng }} numero={i + 1} />) : []
              return [...lineas, ...paradas]
            })}

          {/* Marcando una ruta: puntos arrastrables y línea punteada */}
          {marcandoRuta && modo.paradas.length > 1 && (
            <Polyline coordinates={paradasACoordenadas(modo.paradas)} strokeColor={MARCA.violeta} strokeWidth={3} lineDashPattern={[6, 6]} />
          )}
          {marcandoRuta &&
            modo.paradas.map(([lng, lat], i) => (
              <Parada
                key={`m${i}-${lng}-${lat}`}
                coordenada={{ latitude: lat, longitude: lng }}
                numero={i + 1}
                color={MARCA.violeta}
                arrastrable
                onArrastrar={(coord) =>
                  setModo((m) => ({ ...m, paradas: m.paradas.map((p, j) => (j === i ? [redondear(coord.longitude), redondear(coord.latitude)] : p)) }))
                }
              />
            ))}

          {/* Dibujando una zona nueva */}
          {enDibujo && (modo.puntos?.length ?? 0) > 1 && <Polyline coordinates={modo.puntos} strokeColor={MARCA.violeta} strokeWidth={3} lineDashPattern={[6, 4]} />}
          {enDibujo &&
            (modo.puntos ?? []).map((p, i) => (
              <Marker key={`v${i}-${p.latitude}-${p.longitude}`} coordinate={p} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: i === 0 ? MARCA.magenta : MARCA.violeta, borderWidth: 2, borderColor: '#fff' }} />
              </Marker>
            ))}
          {modo?.tipo === 'zona-nueva' &&
            modo.geometria &&
            poligonosDe(modo.geometria).map((p, i) => (
              <Polygon key={`borrador${i}`} coordinates={p.coordenadas} strokeColor={MARCA.violeta} strokeWidth={3} fillColor={conAlfa(MARCA.violeta, 0.2)} />
            ))}

          {/* Editando una zona: el contorno y sus vértices arrastrables */}
          {modo?.tipo === 'zona-editar' &&
            poligonosDe(modo.geometria).map((p, i) => (
              <Polygon key={`edit${i}`} coordinates={p.coordenadas} strokeColor={zonaEditada?.color ?? MARCA.violeta} strokeWidth={3} fillColor={conAlfa(zonaEditada?.color, 0.2)} />
            ))}
          {vertices.flatMap((poli, p) =>
            poli.flatMap((anillo, r) =>
              anillo.map(([lng, lat], v) => (
                <Marker
                  key={`vx${p}-${r}-${v}-${lng}-${lat}`}
                  coordinate={{ latitude: lat, longitude: lng }}
                  draggable
                  anchor={{ x: 0.5, y: 0.5 }}
                  onDragEnd={(e) => moverVertice(p, r, v, e.nativeEvent.coordinate)}
                  tracksViewChanges={false}
                >
                  <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', borderWidth: 3, borderColor: zonaEditada?.color ?? MARCA.violeta }} />
                </Marker>
              )),
            ),
          )}

          {/* Dónde se hizo cada encuesta */}
          {verEncuestas &&
            encuestas.map((e) => (
              <Marker
                key={`e${e.properties.id}`}
                coordinate={{ latitude: e.geometry.coordinates[1], longitude: e.geometry.coordinates[0] }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
              >
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: MARCA.naranja, borderWidth: 2, borderColor: '#fff' }} />
                <Callout>
                  <View style={{ padding: 4, maxWidth: 220 }}>
                    <Text style={{ fontWeight: '700' }}>{e.properties.cuestionario}</Text>
                    <Text style={{ fontSize: 12 }}>
                      {e.properties.militante ? `${e.properties.militante} · ` : ''}
                      {fechaEncuesta(e.properties.fecha)}
                    </Text>
                  </View>
                </Callout>
              </Marker>
            ))}
        </MapView>

        {!barrios && !error && (
          <View style={{ position: 'absolute', top: 12, alignSelf: 'center', backgroundColor: c.superficie, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 }}>
            <Texto>Cargando barrios…</Texto>
          </View>
        )}
        {(enDibujo || marcandoRuta) && (
          <View style={{ position: 'absolute', top: 10, left: 10, right: 10, backgroundColor: 'rgba(21,18,28,0.85)', padding: 10, borderRadius: 10 }}>
            <Text style={{ color: '#fff' }}>
              {enDibujo
                ? 'Toque el mapa para marcar los vértices de la zona. Cuando termine, presione «Cerrar contorno».'
                : 'Toque el mapa para agregar puntos a la ruta. Mantenga apretado un punto para moverlo.'}
            </Text>
          </View>
        )}
        {/* Referencias */}
        <View style={{ position: 'absolute', left: 10, bottom: 10, backgroundColor: c.superficie, borderRadius: 10, padding: 8, gap: 4, opacity: 0.95 }}>
          <Fila gap={6}>
            <View style={{ width: 14, height: 10, borderWidth: 2, borderColor: MARCA.violeta, backgroundColor: conAlfa(MARCA.violeta, 0.25) }} />
            <Texto estilo="chico">Zona (en su color)</Texto>
          </Fila>
          <Fila gap={6}>
            <View style={{ width: 14, height: 4, borderRadius: 2, backgroundColor: COLOR_RUTA }} />
            <Texto estilo="chico">Ruta</Texto>
          </Fila>
          {encuestas.length > 0 && (
            <Casilla marcada={verEncuestas} onCambio={setVerEncuestas} style={{ paddingVertical: 0 }}>
              <Fila gap={6}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: MARCA.naranja }} />
                <Texto estilo="chico">Encuestas ({encuestas.length})</Texto>
              </Fila>
            </Casilla>
          )}
        </View>
      </View>

      <View
        style={{
          backgroundColor: c.superficie,
          ...(ancho
            ? { width: 360, borderRightWidth: 1, borderColor: c.linea }
            : { height: panelAbierto || modo ? Math.min(height * 0.45, 420) : 58, borderTopWidth: 1, borderColor: c.linea, borderTopLeftRadius: 16, borderTopRightRadius: 16 }),
        }}
      >
        {panel}
      </View>
    </View>
  )
}
