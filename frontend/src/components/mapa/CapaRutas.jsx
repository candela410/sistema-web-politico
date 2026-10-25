import L from 'leaflet'
import { Fragment } from 'react'
import { GeoJSON, Marker, Polyline, useMapEvents } from 'react-leaflet'

const COLOR_RUTA = '#c3268c'

function iconoParada(numero, color = COLOR_RUTA) {
  return L.divIcon({
    className: 'parada',
    html: `<span style="background:${color}">${numero}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

// Rutas guardadas: recorrido calculado por OpenRouteService + paradas numeradas
export function CapaRutas({ rutas, seleccionada, ocultar }) {
  return rutas
    .filter((r) => r.geometria && r.id !== ocultar)
    .map((r) => {
      const activa = r.id === seleccionada
      return (
        <Fragment key={r.id}>
          <GeoJSON
            key={`${r.id}-${activa}-${r.distancia_m}`}
            data={r.geometria}
            interactive={false}
            style={{ color: COLOR_RUTA, weight: activa ? 6 : 4, opacity: activa || !seleccionada ? 0.9 : 0.35 }}
          />
          {activa &&
            r.paradas.map(([lng, lat], i) => (
              <Marker key={i} position={[lat, lng]} icon={iconoParada(i + 1)} interactive={false} />
            ))}
        </Fragment>
      )
    })
}

// Modo "marcar paradas": cada clic agrega un punto; los puntos se pueden arrastrar
export function MarcarParadas({ paradas, onCambio }) {
  useMapEvents({
    click(e) {
      onCambio([...paradas, [round(e.latlng.lng), round(e.latlng.lat)]])
    },
  })

  return (
    <>
      {paradas.length > 1 && (
        <Polyline
          positions={paradas.map(([lng, lat]) => [lat, lng])}
          pathOptions={{ color: '#51318f', weight: 3, dashArray: '6 6' }}
          interactive={false}
        />
      )}
      {paradas.map(([lng, lat], i) => (
        <Marker
          key={`${i}-${lng}-${lat}`}
          position={[lat, lng]}
          icon={iconoParada(i + 1, '#51318f')}
          draggable
          eventHandlers={{
            dragend(e) {
              const { lat: la, lng: ln } = e.target.getLatLng()
              onCambio(paradas.map((p, j) => (j === i ? [round(ln), round(la)] : p)))
            },
          }}
        />
      ))}
    </>
  )
}

const round = (n) => Math.round(n * 1e6) / 1e6
