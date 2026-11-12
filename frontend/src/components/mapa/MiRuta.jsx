import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useState } from 'react'
import { Clock, MapPin, Milestone, Route, Users } from 'lucide-react'
import { GeoJSON, MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet'
import { obtenerMiRuta } from '../../api/mapa'
import { PERFILES, distancia, duracion } from './formato'
import '../perfil/perfil.css'
import './mapa.css'
import './miRuta.css'

// Mi ruta: el recorrido asignado al equipo del usuario que inició sesión, con
// sus puntos numerados. Es solo para ver; las rutas se arman en el Mapa.
const COLOR_RUTA = '#c3268c'
const CENTRO_ARGENTINA = [-34.6, -64.5]

const iconoParada = (numero) =>
  L.divIcon({
    className: 'parada',
    html: `<span style="background:${COLOR_RUTA}">${numero}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })

// Acerca el mapa al recorrido (o a los puntos, si todavía no se calculó)
function Encuadrar({ ruta }) {
  const map = useMap()
  useEffect(() => {
    const limites = ruta.geometria
      ? L.geoJSON(ruta.geometria).getBounds()
      : L.latLngBounds(ruta.paradas.map(([lng, lat]) => [lat, lng]))
    if (limites.isValid()) map.fitBounds(limites, { padding: [30, 30] })
  }, [ruta, map])
  return null
}

function Dato({ icono: Icono, etiqueta, children }) {
  return (
    <div className="ficha__dato">
      <dt>
        <Icono size={16} aria-hidden="true" />
        {etiqueta}
      </dt>
      <dd>{children}</dd>
    </div>
  )
}

function MapaDeRuta({ ruta }) {
  return (
    <>
      <div className="mi-ruta__mapa">
        <MapContainer center={CENTRO_ARGENTINA} zoom={5} className="mapa__leaflet">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          {ruta.geometria ? (
            <GeoJSON data={ruta.geometria} interactive={false} style={{ color: COLOR_RUTA, weight: 6, opacity: 0.9 }} />
          ) : (
            <Polyline
              positions={ruta.paradas.map(([lng, lat]) => [lat, lng])}
              pathOptions={{ color: COLOR_RUTA, weight: 4, dashArray: '6 6' }}
              interactive={false}
            />
          )}
          {ruta.paradas.map(([lng, lat], i) => (
            <Marker key={i} position={[lat, lng]} icon={iconoParada(i + 1)} interactive={false} />
          ))}
          <Encuadrar ruta={ruta} />
        </MapContainer>
      </div>
      <p className="mi-ruta__ayuda">Los números indican el orden de los puntos del recorrido.</p>
    </>
  )
}

function MiRuta() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    obtenerMiRuta()
      .then(setDatos)
      .catch((e) => setError(e.message))
  }, [])

  const ruta = datos?.ruta
  const medio = ruta && PERFILES.find(([valor]) => valor === ruta.perfil)?.[1]

  return (
    <main className="pagina">
      <header className="pagina__encabezado">
        <div>
          <h1>Mi ruta</h1>
          <p>El recorrido asignado a su equipo.</p>
          <span className="franja-corta" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
      </header>

      {error ? (
        <p className="aviso-error" role="alert">
          {error}
        </p>
      ) : !datos ? (
        <p className="vacio-tarjeta">Cargando…</p>
      ) : !datos.equipo ? (
        <p className="vacio-tarjeta">
          Todavía no tiene un equipo asignado. Cuando la administración lo incorpore a un equipo, aquí verá su ruta.
        </p>
      ) : !ruta ? (
        <p className="vacio-tarjeta">
          Su equipo, {datos.equipo.nombre}, está desactivado. Consulte con la administración.
        </p>
      ) : (
        <>
          <article className="ficha">
            <header className="ficha__encabezado">
              <span className="ficha__avatar" aria-hidden="true">
                <Route size={26} />
              </span>
              <div>
                <h2>{ruta.nombre}</h2>
                {ruta.descripcion && <p className="mi-ruta__descripcion">{ruta.descripcion}</p>}
              </div>
            </header>
            <dl className="ficha__datos">
              <Dato icono={Users} etiqueta="Equipo">
                {datos.equipo.nombre}
              </Dato>
              <Dato icono={MapPin} etiqueta="Zona">
                {ruta.zonas.join(', ') || <span className="texto-suave">Sin zona</span>}
              </Dato>
              <Dato icono={Milestone} etiqueta="Recorrido">
                {distancia(ruta.distancia_m)} · {ruta.paradas.length} puntos
              </Dato>
              <Dato icono={Clock} etiqueta="Tiempo estimado">
                {duracion(ruta.duracion_s)}
                {medio && ` (${medio.toLowerCase()})`}
              </Dato>
            </dl>
          </article>

          {ruta.paradas.length === 0 ? (
            <p className="aviso-info">
              La ruta todavía no tiene un recorrido marcado en el mapa. Consulte con la administración.
            </p>
          ) : (
            <MapaDeRuta ruta={ruta} />
          )}
        </>
      )}
    </main>
  )
}

export default MiRuta
