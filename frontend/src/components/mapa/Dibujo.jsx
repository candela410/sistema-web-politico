// Dibujo y edición de polígonos con Leaflet-Geoman (https://geoman.io/docs/leaflet)
import L from 'leaflet'
import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'

const ESTILO_DIBUJO = { color: '#51318f', fillColor: '#51318f', fillOpacity: 0.15, weight: 3 }

// Activa el modo "dibujar polígono"; al cerrar la figura devuelve su GeoJSON
export function DibujarPoligono({ onTerminar }) {
  const map = useMap()
  const alTerminar = useRef(onTerminar)
  useEffect(() => {
    alTerminar.current = onTerminar
  })

  useEffect(() => {
    map.pm.setLang('es')
    map.pm.enableDraw('Polygon', {
      allowSelfIntersection: false,
      snappable: true,
      templineStyle: ESTILO_DIBUJO,
      hintlineStyle: { ...ESTILO_DIBUJO, dashArray: '5 5' },
      pathOptions: ESTILO_DIBUJO,
    })
    const alCrear = (e) => {
      const geometria = e.layer.toGeoJSON().geometry
      map.removeLayer(e.layer)
      alTerminar.current(geometria)
    }
    map.on('pm:create', alCrear)
    return () => {
      map.off('pm:create', alCrear)
      map.pm.disableDraw()
    }
  }, [map])

  return null
}

// Muestra un polígono con vértices arrastrables; cada cambio devuelve el GeoJSON nuevo
export function EditarPoligono({ geometria, color = '#51318f', onCambio }) {
  const map = useMap()
  const alCambiar = useRef(onCambio)
  useEffect(() => {
    alCambiar.current = onCambio
  })
  const inicial = useRef(geometria)

  useEffect(() => {
    const capa = L.geoJSON(inicial.current, {
      style: { color, fillColor: color, fillOpacity: 0.2, weight: 3 },
    }).addTo(map)
    const poligonos = capa.getLayers()
    const avisar = () => {
      const geometrias = poligonos.map((p) => p.toGeoJSON().geometry)
      alCambiar.current(
        geometrias.length === 1
          ? geometrias[0]
          : { type: 'MultiPolygon', coordinates: geometrias.flatMap((g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)) },
      )
    }
    poligonos.forEach((p) => {
      p.pm.enable({ allowSelfIntersection: false, snappable: true })
      p.on('pm:edit', avisar)
    })
    return () => {
      poligonos.forEach((p) => {
        p.off('pm:edit', avisar)
        p.pm.disable()
      })
      map.removeLayer(capa)
    }
  }, [map, color])

  return null
}
