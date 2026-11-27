import { useEffect, useRef, useState } from 'react'
import { Linking, View } from 'react-native'
import MapView, { Polyline } from 'react-native-maps'
import { Clock, MapPin, Milestone, Navigation, Route, Users } from 'lucide-react-native'
import { obtenerMiRuta } from '../../api/mapa'
import { MARCA, useTema } from '../../tema/tema'
import { Boton, Encabezado, Fila, Pagina, Tarjeta, Texto, TextoError, VacioTarjeta } from '../../ui'
import { PERFILES, distancia, duracion } from './formato'
import { coordenadasDe, lineasDe, paradasACoordenadas } from './geo'
import Parada from './Parada'

// Mi ruta: el recorrido asignado al equipo del usuario que inició sesión, con
// sus puntos numerados. Es solo para ver; las rutas se arman en el Mapa.
const COLOR_RUTA = '#c3268c'
const MODO_GOOGLE = { 'foot-walking': 'walking', 'driving-car': 'driving', 'cycling-regular': 'bicycling' }

function Dato({ icono: Icono, etiqueta, children }) {
  const { c } = useTema()
  return (
    <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: c.linea }}>
      <Fila gap={6}>
        <Icono size={15} color={c.gris} />
        <Texto estilo="chico">{etiqueta}</Texto>
      </Fila>
      <Texto style={{ marginTop: 2 }}>{children}</Texto>
    </View>
  )
}

function MapaDeRuta({ ruta }) {
  const { c } = useTema()
  const mapa = useRef(null)
  const puntos = ruta.geometria ? coordenadasDe(ruta.geometria) : paradasACoordenadas(ruta.paradas)
  const encuadrar = () =>
    mapa.current?.fitToCoordinates(puntos, { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: false })

  // Abre el recorrido en Google Maps para navegarlo punto por punto
  function navegar() {
    const p = ruta.paradas.map(([lng, lat]) => `${lat},${lng}`)
    const url = `https://www.google.com/maps/dir/?api=1&origin=${p[0]}&destination=${p[p.length - 1]}${
      p.length > 2 ? `&waypoints=${encodeURIComponent(p.slice(1, -1).join('|'))}` : ''
    }&travelmode=${MODO_GOOGLE[ruta.perfil] ?? 'walking'}`
    Linking.openURL(url)
  }

  return (
    <>
      <View style={{ height: 380, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: c.linea }}>
        <MapView ref={mapa} style={{ flex: 1 }} onMapReady={encuadrar} userInterfaceStyle={c.oscuro ? 'dark' : 'light'} showsUserLocation>
          {ruta.geometria ? (
            lineasDe(ruta.geometria).map((l, i) => <Polyline key={i} coordinates={l} strokeColor={COLOR_RUTA} strokeWidth={6} />)
          ) : (
            <Polyline coordinates={paradasACoordenadas(ruta.paradas)} strokeColor={COLOR_RUTA} strokeWidth={4} lineDashPattern={[6, 6]} />
          )}
          {ruta.paradas.map(([lng, lat], i) => (
            <Parada key={i} coordenada={{ latitude: lat, longitude: lng }} numero={i + 1} />
          ))}
        </MapView>
      </View>
      <Texto estilo="chico">Los números indican el orden de los puntos del recorrido.</Texto>
      {ruta.paradas.length >= 2 && <Boton titulo="Abrir en Google Maps" icono={Navigation} variante="borde" onPress={navegar} />}
    </>
  )
}

export default function MiRuta() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')

  const cargar = () =>
    obtenerMiRuta()
      .then(setDatos)
      .catch((e) => setError(e.message))
  useEffect(() => {
    cargar()
  }, [])

  const ruta = datos?.ruta
  const medio = ruta && PERFILES.find(([valor]) => valor === ruta.perfil)?.[1]

  return (
    <Pagina alRefrescar={cargar}>
      <Encabezado titulo="Mi ruta" descripcion="El recorrido asignado a su equipo." />
      {error ? (
        <TextoError>{error}</TextoError>
      ) : !datos ? (
        <VacioTarjeta>Cargando…</VacioTarjeta>
      ) : !datos.equipo ? (
        <VacioTarjeta>Todavía no tiene un equipo asignado. Cuando la administración lo incorpore a un equipo, aquí verá su ruta.</VacioTarjeta>
      ) : !ruta ? (
        <VacioTarjeta>Su equipo, {datos.equipo.nombre}, está desactivado. Consulte con la administración.</VacioTarjeta>
      ) : (
        <>
          <Tarjeta>
            <Fila gap={12} style={{ marginBottom: 6 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: MARCA.magenta, alignItems: 'center', justifyContent: 'center' }}>
                <Route size={26} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Texto estilo="subtitulo">{ruta.nombre}</Texto>
                {ruta.descripcion ? <Texto estilo="suave">{ruta.descripcion}</Texto> : null}
              </View>
            </Fila>
            <Dato icono={Users} etiqueta="Equipo">
              {datos.equipo.nombre}
            </Dato>
            <Dato icono={MapPin} etiqueta="Zona">
              {ruta.zonas.join(', ') || 'Sin zona'}
            </Dato>
            <Dato icono={Milestone} etiqueta="Recorrido">
              {distancia(ruta.distancia_m)} · {ruta.paradas.length} puntos
            </Dato>
            <Dato icono={Clock} etiqueta="Tiempo estimado">
              {duracion(ruta.duracion_s)}
              {medio ? ` (${medio.toLowerCase()})` : ''}
            </Dato>
          </Tarjeta>
          {ruta.paradas.length === 0 ? (
            <VacioTarjeta>La ruta todavía no tiene un recorrido marcado en el mapa. Consulte con la administración.</VacioTarjeta>
          ) : (
            <MapaDeRuta ruta={ruta} />
          )}
        </>
      )}
    </Pagina>
  )
}
